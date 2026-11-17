"""Profile service: self profile edit, readiness, data (delete) requests.

Object-level permission (AGENTS.md section 5): every function here operates
on the AUTHENTICATED user passed in by the router — there is no way to name
another user id, so cross-user writes are impossible by construction.

Server-controlled fields (status, roles, verification, ids, timestamps)
are absent from UserUpdate; this service only ever writes the keys the
client explicitly sent, so mass assignment cannot reach them (item 6).
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import conflict
from app.models.profile import (
    CasePriority,
    DataRequest,
    DataRequestStatus,
    DataRequestType,
    NotificationChannel,
    NotificationPreference,
    UserReadiness,
)
from app.models.user import User
from app.schemas.profile import (
    DeleteRequestRead,
    NotificationPreferenceItem,
    NotificationPreferenceRead,
    NotificationPreferenceUpdate,
    ReadinessRead,
    UserMeRead,
    UserUpdate,
)
from app.services import user_service

# Profile completion checks for the readiness formula (Step 3 plan v1).
# resume/practice are 0 until Steps 4-5 add their data.
_COMPLETENESS_CHECKS = (
    lambda u: bool(u.display_name),
    lambda u: bool(u.handle),
    lambda u: bool(u.avatar_url),
    lambda u: bool(u.phone),
    lambda u: u.email_verified_at is not None,
)

# Statuses that count as "still open" for the one-open-request rule.
_OPEN_REQUEST_STATUSES = (
    DataRequestStatus.received,
    DataRequestStatus.verifying,
    DataRequestStatus.in_progress,
)


def profile_complete_score(user: User) -> int:
    passed = sum(1 for check in _COMPLETENESS_CHECKS if check(user))
    return int(100 * passed / len(_COMPLETENESS_CHECKS))


def _apply_patch(user: User, data: dict[str, object]) -> None:
    for field, value in data.items():
        setattr(user, field, value)


async def _check_handle_available(db: AsyncSession, user: User, handle: str) -> None:
    result = await db.execute(
        select(User.id).where(
            User.handle == handle,
            User.id != user.id,
            User.deleted_at.is_(None),
        )
    )
    if result.first() is not None:
        raise conflict("That handle is already taken.")


async def _upsert_readiness(db: AsyncSession, user: User) -> None:
    """Persist readiness scores (resume/practice keep their stored values)."""
    score = profile_complete_score(user)
    result = await db.execute(
        select(UserReadiness).where(UserReadiness.user_id == user.id).with_for_update()
    )
    row = result.scalar_one_or_none()
    if row is None:
        db.add(
            UserReadiness(
                user_id=user.id,
                profile_complete=score,
                resume_score=0,
                practice_score=0,
                overall_score=score,
            )
        )
    else:
        row.profile_complete = score
        row.overall_score = score  # v1: overall == profile completeness


async def update_me(
    db: AsyncSession, user: User, payload: UserUpdate
) -> UserMeRead:
    data = payload.model_dump(exclude_unset=True)
    handle = data.get("handle")
    if isinstance(handle, str) and handle != user.handle:
        await _check_handle_available(db, user, handle)
    _apply_patch(user, data)
    if data:
        await _upsert_readiness(db, user)
        await db.commit()
        await db.refresh(user)
    return await user_service.get_me(db, user)


async def get_readiness(db: AsyncSession, user: User) -> ReadinessRead:
    """Readiness: profile_complete computed live from the user row,
    resume/practice from user_readiness (0 until Steps 4-5)."""
    result = await db.execute(
        select(UserReadiness).where(UserReadiness.user_id == user.id)
    )
    row = result.scalar_one_or_none()
    profile_complete = profile_complete_score(user)
    resume = row.resume_score if row is not None else 0
    practice = row.practice_score if row is not None else 0
    # v1 formula: overall == profile completeness (no resume/practice yet).
    overall = profile_complete
    return ReadinessRead(
        profile_complete=profile_complete,
        resume_score=resume,
        practice_score=practice,
        overall_score=overall,
    )


async def create_delete_request(db: AsyncSession, user: User) -> DeleteRequestRead:
    """Record a self-service erasure request (DPDP data_requests, item 9).

    One open request per user; fulfilment/assignment arrive with Step 15.
    """
    result = await db.execute(
        select(DataRequest.id).where(
            DataRequest.data_subject_id == user.id,
            DataRequest.status.in_(_OPEN_REQUEST_STATUSES),
        )
    )
    if result.first() is not None:
        raise conflict("You already have an open data request.")
    now = datetime.now(UTC)
    due_days = get_settings().DATA_REQUEST_DUE_DAYS
    request = DataRequest(
        request_type=DataRequestType.erasure,
        authority="self_service",
        data_subject_id=user.id,
        data_subject_label=user.primary_email,
        scope="Full account erasure requested from account settings.",
        status=DataRequestStatus.received,
        priority=CasePriority.normal,
        records_identified=0,
        received_at=now,
        due_at=now + timedelta(days=due_days),
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)
    return DeleteRequestRead(
        id=request.id,
        request_type=request.request_type,
        status=request.status,
        priority=request.priority,
        received_at=request.received_at,
        due_at=request.due_at,
        fulfilled_at=request.fulfilled_at,
    )


async def get_delete_request(db: AsyncSession, user: User) -> DeleteRequestRead | None:
    """Latest data request for the authenticated user (404-free: null when none)."""
    result = await db.execute(
        select(DataRequest)
        .where(DataRequest.data_subject_id == user.id)
        .order_by(DataRequest.received_at.desc())
        .limit(1)
    )
    request = result.scalar_one_or_none()
    if request is None:
        return None
    return DeleteRequestRead(
        id=request.id,
        request_type=request.request_type,
        status=request.status,
        priority=request.priority,
        received_at=request.received_at,
        due_at=request.due_at,
        fulfilled_at=request.fulfilled_at,
    )


# --- Step 3 part 8: notification preferences (stub) -------------------------


async def get_notification_preferences(
    db: AsyncSession, user: User
) -> NotificationPreferenceRead:
    result = await db.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == user.id)
    )
    items = [
        NotificationPreferenceItem(
            category=row.category, channel=row.channel.value, is_enabled=row.is_enabled
        )
        for row in result.scalars().all()
    ]
    return NotificationPreferenceRead(items=items)


async def update_notification_preferences(
    db: AsyncSession, user: User, payload: NotificationPreferenceUpdate
) -> NotificationPreferenceRead:
    for item in payload.items:
        existing = await db.execute(
            select(NotificationPreference).where(
                NotificationPreference.user_id == user.id,
                NotificationPreference.category == item.category,
                NotificationPreference.channel == NotificationChannel(item.channel),
            )
        )
        row = existing.scalar_one_or_none()
        if row is None:
            db.add(
                NotificationPreference(
                    user_id=user.id,
                    category=item.category,
                    channel=NotificationChannel(item.channel),
                    is_enabled=item.is_enabled,
                )
            )
        else:
            row.is_enabled = item.is_enabled
    await db.commit()
    return await get_notification_preferences(db, user)
