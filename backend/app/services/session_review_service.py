"""Session reviews with participant authorization and locked rating recomputation."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import conflict, forbidden, not_found, rate_limited
from app.models.mentorship import Mentorship
from app.models.organization import Organization, OrganizationMember
from app.models.session import AttendeeRole, MentoringSession, SessionAttendee, SessionStatus
from app.models.session_review import SessionReview
from app.models.talent import MentorProfile
from app.models.user import User
from app.schemas.session_review import (
    MentorReviewPage,
    MentorReviewRead,
    PublicReviewPage,
    PublicReviewRead,
    ReviewCreate,
    ReviewRead,
)
from app.services import mentor_directory_service, mentorship_service, rate_limiter


def _own(row: SessionReview) -> ReviewRead:
    return ReviewRead(
        id=row.id,
        session_id=row.session_id,
        rating=row.rating,
        public_text=row.public_text,
        private_feedback=row.private_feedback,
        public_consent=row.public_consent,
        anonymous=row.anonymous,
        created_at=row.created_at,
    )


async def _limit(user: User) -> None:
    settings = get_settings()
    if not await rate_limiter.rate_limiter.check(
        f"session_review_write:user:{user.id}",
        settings.SESSION_REVIEW_WRITE_LIMIT,
        settings.SESSION_REVIEW_WRITE_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many review changes. Please slow down.")


async def _eligible(
    db: AsyncSession, user: User, session_id: uuid.UUID
) -> tuple[MentoringSession, Mentorship]:
    result = (
        await db.execute(
            select(MentoringSession, Mentorship)
            .join(Mentorship, Mentorship.id == MentoringSession.mentorship_id)
            .where(MentoringSession.id == session_id, Mentorship.deleted_at.is_(None))
        )
    ).one_or_none()
    if result is None:
        raise not_found("Session not found.")
    session, mentorship = result
    await mentorship_service.require_can_read(db, mentorship, user)
    if user.id == mentorship.mentor_id:
        raise forbidden("Mentors cannot review their own sessions.")
    member = (
        await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.org_id == mentorship.startup_org_id,
                OrganizationMember.user_id == user.id,
                OrganizationMember.status == "active",
                OrganizationMember.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if member is None:
        raise not_found("Session not found.")
    if member.role == "viewer":
        raise forbidden("Viewers cannot submit reviews.")
    attendee = (
        await db.execute(
            select(SessionAttendee).where(
                SessionAttendee.session_id == session_id,
                SessionAttendee.user_id == user.id,
                SessionAttendee.role == AttendeeRole.startup,
            )
        )
    ).scalar_one_or_none()
    if attendee is None:
        raise forbidden("Only recorded startup attendees can review a session.")
    return session, mentorship


async def _lock_profile(db: AsyncSession, mentor_id: uuid.UUID) -> MentorProfile:
    profile = (
        await db.execute(
            select(MentorProfile).where(MentorProfile.user_id == mentor_id).with_for_update()
        )
    ).scalar_one_or_none()
    if profile is None:
        raise conflict("Mentor profile is unavailable.")
    return profile


async def _recompute(db: AsyncSession, profile: MentorProfile) -> None:
    """Store the same number the directory shows (approved Q8).

    Only consented reviews count, and only once there are at least
    ``PUBLIC_RATING_MIN_REVIEWS`` of them; below that the rating is NULL.
    Before 8i's close-out this stored a plain average of every review, so
    the mentor's own profile disagreed with their public card.
    """
    await db.flush()
    count, avg = (
        await db.execute(
            select(func.count(SessionReview.id), func.avg(SessionReview.rating))
            .join(MentoringSession, MentoringSession.id == SessionReview.session_id)
            .join(Mentorship, Mentorship.id == MentoringSession.mentorship_id)
            .where(
                Mentorship.mentor_id == profile.user_id,
                SessionReview.deleted_at.is_(None),
                SessionReview.public_consent.is_(True),
                Mentorship.deleted_at.is_(None),
            )
        )
    ).one()
    visible = count >= mentor_directory_service.PUBLIC_RATING_MIN_REVIEWS and avg is not None
    profile.rating = round(float(avg), 2) if visible else None


async def create(
    db: AsyncSession, user: User, session_id: uuid.UUID, body: ReviewCreate
) -> ReviewRead:
    await _limit(user)
    session, mentorship = await _eligible(db, user, session_id)
    if session.status != SessionStatus.completed:
        raise conflict("Only completed sessions can be reviewed.", code="INVALID_STATE")
    profile = await _lock_profile(db, mentorship.mentor_id)
    row = SessionReview(session_id=session.id, reviewer_id=user.id, **body.model_dump())
    db.add(row)
    try:
        await _recompute(db, profile)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise conflict("You have already reviewed this session.", code="REVIEW_EXISTS") from None
    await db.refresh(row)
    return _own(row)


async def mine(db: AsyncSession, user: User, session_id: uuid.UUID) -> ReviewRead:
    await _eligible(db, user, session_id)
    row = (
        await db.execute(
            select(SessionReview).where(
                SessionReview.session_id == session_id,
                SessionReview.reviewer_id == user.id,
                SessionReview.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise not_found("Review not found.")
    return _own(row)


async def remove(db: AsyncSession, user: User, review_id: uuid.UUID) -> None:
    """The author may always withdraw their own review (approved Q9).

    Earlier this re-ran the reviewer eligibility check, so someone who had
    left the startup (or become a viewer) could no longer take back what
    they wrote. Ownership of the row is the only rule now; anyone else
    gets 404.
    """
    await _limit(user)
    row = (
        await db.execute(
            select(SessionReview).where(
                SessionReview.id == review_id,
                SessionReview.reviewer_id == user.id,
                SessionReview.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise not_found("Review not found.")
    mentor_id = (
        await db.execute(
            select(Mentorship.mentor_id)
            .join(MentoringSession, MentoringSession.mentorship_id == Mentorship.id)
            .where(MentoringSession.id == row.session_id)
        )
    ).scalar_one()
    profile = await _lock_profile(db, mentor_id)
    # Re-read under the profile lock so two withdrawals cannot both apply.
    await db.refresh(row, with_for_update=True)
    if row.deleted_at is not None:
        raise not_found("Review not found.")
    row.deleted_at = datetime.now(UTC)
    await _recompute(db, profile)
    await db.commit()


async def mentor_reviews(db: AsyncSession, user: User, limit: int, offset: int) -> MentorReviewPage:
    query = (
        select(SessionReview, Organization.name, MentoringSession.topic)
        .join(MentoringSession, MentoringSession.id == SessionReview.session_id)
        .join(Mentorship, Mentorship.id == MentoringSession.mentorship_id)
        .join(Organization, Organization.id == Mentorship.startup_org_id)
        .where(
            Mentorship.mentor_id == user.id,
            Mentorship.deleted_at.is_(None),
            SessionReview.deleted_at.is_(None),
        )
    )
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    rows = (
        await db.execute(
            query.order_by(SessionReview.created_at.desc(), SessionReview.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return MentorReviewPage(
        items=[
            MentorReviewRead(
                **MentorReviewRead.model_validate(r, from_attributes=True).model_dump(
                    exclude={"startup_name", "session_topic"}
                ),
                startup_name=name,
                session_topic=topic,
            )
            for r, name, topic in rows
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


async def public_reviews(
    db: AsyncSession, handle: str, limit: int, offset: int
) -> PublicReviewPage:
    mentor_id = await mentor_directory_service.resolve_visible_mentor_id(db, handle)
    if mentor_id is None:
        raise not_found("Mentor not found.")
    query = (
        select(SessionReview, User.display_name)
        .join(MentoringSession, MentoringSession.id == SessionReview.session_id)
        .join(Mentorship, Mentorship.id == MentoringSession.mentorship_id)
        .join(User, User.id == SessionReview.reviewer_id)
        .where(
            Mentorship.mentor_id == mentor_id,
            Mentorship.deleted_at.is_(None),
            SessionReview.deleted_at.is_(None),
            SessionReview.public_consent.is_(True),
        )
    )
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    rows = (
        await db.execute(
            query.order_by(SessionReview.created_at.desc(), SessionReview.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return PublicReviewPage(
        items=[
            PublicReviewRead(
                rating=r.rating,
                public_text=r.public_text,
                reviewer_name=None if r.anonymous else name,
                created_at=r.created_at,
            )
            for r, name in rows
        ],
        total=total,
        limit=limit,
        offset=offset,
    )
