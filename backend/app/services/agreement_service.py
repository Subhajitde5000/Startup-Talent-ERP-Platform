"""Step 8g service: mentor agreements.

One row is one version of a mentorship's written terms::

    draft --send--> sent --(both sides sign)--> signed --terminate--> terminated
      |               |                            |
      +--discard      +--> superseded              +--> superseded
         (deleted)        (a newer version is          (a newer version is
                           sent)                        signed)

Who may do what (approved plan, Q3):

- The **mentor** on the mentorship acts for the mentor side.
- A startup **owner/admin** ("signer") acts for the startup side; the
  terms commit the company, so a plain member only READS and a viewer
  cannot see agreements at all (403 — they are a participant, so the
  honest answer is "not allowed", not "not found").
- Everyone else gets **404** (8b's no-existence-oracle rule), and so does
  the other side for a DRAFT: a draft is private until it is sent.

Rules on the mentorship (Q7): drafts are created and sent while the
mentorship is active or paused; signing needs it active.

Money never comes from a client for anything derived: the linked-records
totals are summed from completed session rows, the fee breakdown uses the
8h rates, and while a signed version is in force the session fee comes
from it (``fee_for_session``, called by 8d — Q5).
"""

import uuid
from collections.abc import Sequence
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import Select, delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import AuthError, conflict, forbidden, not_found, rate_limited
from app.core.exceptions import validation_error as _validation_error
from app.core.security import verify_password
from app.models.activity import ActivityEventType
from app.models.agreement import (
    AgreementSide,
    AgreementStatus,
    AgreementType,
    MentorAgreement,
)
from app.models.mentorship import Mentorship, MentorshipStatus
from app.models.organization import Organization, OrganizationMember, OrgRole
from app.models.session import MentoringSession, SessionStatus
from app.models.user import User
from app.schemas.agreement import (
    AgreementCreate,
    AgreementDetail,
    AgreementFeeBreakdown,
    AgreementLinkedRecords,
    AgreementPage,
    AgreementParty,
    AgreementRead,
    AgreementSign,
    AgreementSummary,
    AgreementTerminate,
    AgreementUpdate,
)
from app.services import activity_service, earning_service, rate_limiter

SIGNER_ROLES: frozenset[str] = frozenset({OrgRole.owner.value, OrgRole.admin.value})
READER_ROLES: frozenset[str] = SIGNER_ROLES | {OrgRole.member.value}
_DRAFTABLE = (MentorshipStatus.active.value, MentorshipStatus.paused.value)


# ------------------------------------------------------------------ helpers


def _now() -> datetime:
    return datetime.now(UTC)


async def _limit(user: User, *, sign: bool = False) -> None:
    settings = get_settings()
    if sign:
        key, limit, window = (
            f"agreement_sign:user:{user.id}",
            settings.AGREEMENT_SIGN_LIMIT,
            settings.AGREEMENT_SIGN_WINDOW_SECONDS,
        )
    else:
        key, limit, window = (
            f"agreement_write:user:{user.id}",
            settings.AGREEMENT_WRITE_LIMIT,
            settings.AGREEMENT_WRITE_WINDOW_SECONDS,
        )
    if not await rate_limiter.rate_limiter.check(key, limit, window):
        raise rate_limited("Too many agreement changes. Please slow down.")


def _field_error(field: str, msg: str) -> Exception:
    return _validation_error(
        msg, details=[{"loc": ["body", field], "msg": msg, "type": "value_error"}]
    )


async def _mentorship(db: AsyncSession, mentorship_id: uuid.UUID) -> Mentorship:
    row = (
        await db.execute(
            select(Mentorship).where(
                Mentorship.id == mentorship_id, Mentorship.deleted_at.is_(None)
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise not_found("Mentorship not found.")
    return row


async def _lock_mentorship(db: AsyncSession, mentorship_id: uuid.UUID) -> None:
    """Serialise version numbering and supersede/sign per mentorship."""
    await db.execute(
        select(Mentorship.id).where(Mentorship.id == mentorship_id).with_for_update()
    )


async def _side(db: AsyncSession, m: Mentorship, user: User) -> tuple[AgreementSide, str | None]:
    """The caller's side and startup role; 404 outsider, 403 viewer."""
    if m.mentor_id == user.id:
        return AgreementSide.mentor, None
    role = (
        await db.execute(
            select(OrganizationMember.role).where(
                OrganizationMember.org_id == m.startup_org_id,
                OrganizationMember.user_id == user.id,
                OrganizationMember.deleted_at.is_(None),
                OrganizationMember.status == "active",
            )
        )
    ).scalar_one_or_none()
    if role is None:
        raise not_found("Mentorship not found.")
    role_name = str(role)
    if role_name not in READER_ROLES:
        raise forbidden("Viewers cannot see mentorship agreements.")
    return AgreementSide.startup, role_name


def _is_signer(side: AgreementSide, role: str | None) -> bool:
    return side is AgreementSide.mentor or role in SIGNER_ROLES


def _require_signer(side: AgreementSide, role: str | None) -> None:
    if not _is_signer(side, role):
        raise forbidden("Only a startup owner or admin can act on agreements.")


async def _agreement(db: AsyncSession, agreement_id: uuid.UUID) -> MentorAgreement:
    row = (
        await db.execute(select(MentorAgreement).where(MentorAgreement.id == agreement_id))
    ).scalar_one_or_none()
    if row is None:
        raise not_found("Agreement not found.")
    return row


async def _load(
    db: AsyncSession, user: User, agreement_id: uuid.UUID
) -> tuple[MentorAgreement, Mentorship, AgreementSide, str | None]:
    row = await _agreement(db, agreement_id)
    m = (
        await db.execute(
            select(Mentorship).where(
                Mentorship.id == row.mentorship_id, Mentorship.deleted_at.is_(None)
            )
        )
    ).scalar_one_or_none()
    if m is None:
        raise not_found("Agreement not found.")
    side, role = await _side(db, m, user)
    if row.status == AgreementStatus.draft and row.proposed_by_side != side:
        raise not_found("Agreement not found.")
    return row, m, side, role


def _phase(row: MentorAgreement, today: date | None = None) -> str | None:
    if row.status != AgreementStatus.signed:
        return None
    today = today or date.today()
    if row.starts_on and today < row.starts_on:
        return "scheduled"
    if row.ends_on and today > row.ends_on:
        return "expired"
    return "active"


def _validate_money(agreement_type: str, fee: Decimal | None, field: str = "fee_amount") -> None:
    if agreement_type == AgreementType.per_session and fee is None:
        raise _field_error(field, "A per-session agreement needs a fee above 0.")
    if agreement_type == AgreementType.pro_bono and fee is not None:
        raise _field_error(field, "A pro bono agreement has no fee.")


def _validate_dates(starts_on: date | None, ends_on: date | None) -> None:
    if starts_on and ends_on and ends_on < starts_on:
        raise _field_error("ends_on", "The end date cannot be before the start date.")


async def _has_issued_version(db: AsyncSession, mentorship_id: uuid.UUID) -> bool:
    return (
        await db.execute(
            select(MentorAgreement.id)
            .where(
                MentorAgreement.mentorship_id == mentorship_id,
                MentorAgreement.status != AgreementStatus.draft,
            )
            .limit(1)
        )
    ).first() is not None


async def _names(db: AsyncSession, ids: set[uuid.UUID | None]) -> dict[uuid.UUID, str]:
    wanted = {i for i in ids if i is not None}
    if not wanted:
        return {}
    rows = await db.execute(select(User.id, User.display_name).where(User.id.in_(wanted)))
    return {uid: name for uid, name in rows.all()}


async def _parties(
    db: AsyncSession, mentorships: Sequence[Mentorship]
) -> dict[uuid.UUID, AgreementParty]:
    """Bulk party lookup so lists never N+1."""
    if not mentorships:
        return {}
    names = await _names(db, {m.mentor_id for m in mentorships})
    org_ids = {m.startup_org_id for m in mentorships}
    orgs = {
        oid: name
        for oid, name in (
            await db.execute(
                select(Organization.id, Organization.name).where(Organization.id.in_(org_ids))
            )
        ).all()
    }
    return {
        m.id: AgreementParty(
            mentor_id=m.mentor_id,
            mentor_name=names.get(m.mentor_id),
            startup_org_id=m.startup_org_id,
            startup_name=orgs.get(m.startup_org_id),
        )
        for m in mentorships
    }


def _read(
    row: MentorAgreement,
    *,
    party: AgreementParty,
    side: AgreementSide,
    role: str | None,
    mentorship_status: str,
    signer_names: dict[uuid.UUID, str],
) -> AgreementRead:
    signer = _is_signer(side, role)
    own_signed = (
        row.mentor_signed_at if side is AgreementSide.mentor else row.startup_signed_at
    )
    return AgreementRead(
        id=row.id,
        mentorship_id=row.mentorship_id,
        party=party,
        version=row.version,
        previous_version_id=row.previous_version_id,
        proposed_by_side=AgreementSide(row.proposed_by_side),
        agreement_type=AgreementType(row.agreement_type),
        terms=row.terms,
        equity_pct=row.equity_pct,
        fee_amount=row.fee_amount,
        currency=row.currency,
        cadence=row.cadence,
        status=AgreementStatus(row.status),
        phase=_phase(row),  # type: ignore[arg-type]
        starts_on=row.starts_on,
        ends_on=row.ends_on,
        change_reason=row.change_reason,
        sent_at=row.sent_at,
        mentor_signed_at=row.mentor_signed_at,
        startup_signed_at=row.startup_signed_at,
        startup_signed_by_name=(
            signer_names.get(row.startup_signed_by) if row.startup_signed_by else None
        ),
        ended_at=row.ended_at,
        end_reason=row.end_reason,
        created_at=row.created_at,
        updated_at=row.updated_at,
        viewer_side=side,
        can_edit=signer
        and row.status == AgreementStatus.draft
        and row.proposed_by_side == side
        and mentorship_status in _DRAFTABLE,
        can_sign=signer
        and row.status == AgreementStatus.sent
        and own_signed is None
        and mentorship_status == MentorshipStatus.active,
        can_terminate=signer and row.status == AgreementStatus.signed,
    )


async def _as_read(
    db: AsyncSession, row: MentorAgreement, m: Mentorship, side: AgreementSide, role: str | None
) -> AgreementRead:
    parties = await _parties(db, [m])
    names = await _names(db, {row.startup_signed_by})
    return _read(
        row,
        party=parties[m.id],
        side=side,
        role=role,
        mentorship_status=m.status,
        signer_names=names,
    )


async def _commit(db: AsyncSession) -> None:
    """Commit, mapping a lost race on a partial unique index to 409."""
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise conflict(
            "Another change to this agreement happened at the same time. Reload and retry.",
            code="AGREEMENT_CONFLICT",
        ) from None


def _audit(
    db: AsyncSession,
    m: Mentorship,
    row: MentorAgreement,
    user: User,
    event: ActivityEventType,
    summary: str,
    data: dict | None = None,
) -> None:
    activity_service.record(
        db,
        event_type=event,
        summary=summary,
        org_id=m.startup_org_id,
        actor_id=user.id,
        entity_type="mentor_agreement",
        entity_id=row.id,
        data={"mentorship_id": str(m.id), "version": row.version, **(data or {})},
    )


# ------------------------------------------------------------------- writes


async def create(
    db: AsyncSession, user: User, mentorship_id: uuid.UUID, payload: AgreementCreate
) -> AgreementRead:
    await _limit(user)
    m = await _mentorship(db, mentorship_id)
    side, role = await _side(db, m, user)
    _require_signer(side, role)
    if m.status not in _DRAFTABLE:
        raise conflict(
            "Agreements can be drafted only for an active or paused mentorship.",
            code="INVALID_STATE",
        )
    _validate_money(payload.agreement_type, payload.fee_amount)
    _validate_dates(payload.starts_on, payload.ends_on)
    if payload.change_reason is None and await _has_issued_version(db, m.id):
        raise _field_error("change_reason", "Explain what this version changes.")
    existing_draft = (
        await db.execute(
            select(MentorAgreement.id).where(
                MentorAgreement.mentorship_id == m.id,
                MentorAgreement.status == AgreementStatus.draft,
                MentorAgreement.proposed_by_side == side,
            )
        )
    ).first()
    if existing_draft is not None:
        raise conflict(
            "Your side already has a draft for this mentorship. Edit or discard it first.",
            code="DRAFT_EXISTS",
        )
    row = MentorAgreement(
        mentorship_id=m.id,
        proposed_by_side=side,
        created_by=user.id,
        status=AgreementStatus.draft,
        **payload.model_dump(),
    )
    db.add(row)
    await _commit(db)
    await db.refresh(row)
    return await _as_read(db, row, m, side, role)


async def _editable(
    db: AsyncSession, user: User, agreement_id: uuid.UUID
) -> tuple[MentorAgreement, Mentorship, AgreementSide, str | None]:
    row, m, side, role = await _load(db, user, agreement_id)
    _require_signer(side, role)
    if row.status != AgreementStatus.draft:
        raise conflict(
            "Only a draft can be changed. Propose a new version instead.", code="INVALID_STATE"
        )
    return row, m, side, role


async def update(
    db: AsyncSession, user: User, agreement_id: uuid.UUID, payload: AgreementUpdate
) -> AgreementRead:
    await _limit(user)
    row, m, side, role = await _editable(db, user, agreement_id)
    if m.status not in _DRAFTABLE:
        raise conflict("The mentorship is no longer active.", code="INVALID_STATE")
    changes = payload.model_dump(exclude_unset=True)
    for key in ("agreement_type", "currency"):
        if key in changes and changes[key] is None:
            raise _field_error(key, "This field cannot be cleared.")
    merged_type = changes.get("agreement_type", row.agreement_type)
    merged_fee = changes["fee_amount"] if "fee_amount" in changes else row.fee_amount
    if merged_type == AgreementType.pro_bono and "fee_amount" not in changes:
        # Switching to pro bono clears the fee instead of failing the CHECK.
        merged_fee = None
        changes["fee_amount"] = None
    _validate_money(merged_type, merged_fee)
    _validate_dates(
        changes.get("starts_on", row.starts_on), changes.get("ends_on", row.ends_on)
    )
    for key, value in changes.items():
        setattr(row, key, value)
    await _commit(db)
    await db.refresh(row)
    return await _as_read(db, row, m, side, role)


async def discard(db: AsyncSession, user: User, agreement_id: uuid.UUID) -> None:
    """A draft was never shared, so it is deleted outright (no audit trail)."""
    await _limit(user)
    row, _, _, _ = await _editable(db, user, agreement_id)
    await db.delete(row)
    await db.commit()


async def send(db: AsyncSession, user: User, agreement_id: uuid.UUID) -> AgreementRead:
    await _limit(user)
    row, m, side, role = await _editable(db, user, agreement_id)
    if m.status not in _DRAFTABLE:
        raise conflict(
            "Agreements can be sent only for an active or paused mentorship.",
            code="INVALID_STATE",
        )
    await _lock_mentorship(db, m.id)
    latest = (
        await db.execute(
            select(MentorAgreement)
            .where(
                MentorAgreement.mentorship_id == m.id,
                MentorAgreement.status != AgreementStatus.draft,
            )
            .order_by(MentorAgreement.version.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if latest is not None and row.change_reason is None:
        raise _field_error("change_reason", "Explain what this version changes.")
    now = _now()
    version = (latest.version or 0) + 1 if latest is not None else 1
    out = (
        await db.execute(
            select(MentorAgreement).where(
                MentorAgreement.mentorship_id == m.id,
                MentorAgreement.status == AgreementStatus.sent,
            )
        )
    ).scalar_one_or_none()
    if out is not None:
        out.status = AgreementStatus.superseded
        out.ended_at = now
        out.end_reason = f"Replaced by version {version}."
        await db.flush()
    row.version = version
    row.previous_version_id = latest.id if latest is not None else None
    row.status = AgreementStatus.sent
    row.sent_at = now
    _audit(
        db,
        m,
        row,
        user,
        ActivityEventType.agreement_sent,
        f"Agreement version {version} sent for signature.",
        {"side": side.value},
    )
    await _commit(db)
    await db.refresh(row)
    return await _as_read(db, row, m, side, role)


async def sign(
    db: AsyncSession, user: User, agreement_id: uuid.UUID, payload: AgreementSign
) -> AgreementRead:
    await _limit(user, sign=True)
    row, m, side, role = await _load(db, user, agreement_id)
    _require_signer(side, role)
    if row.status != AgreementStatus.sent:
        raise conflict("Only an agreement sent for signature can be signed.", code="INVALID_STATE")
    if m.status != MentorshipStatus.active:
        raise conflict("Agreements can be signed only during an active mentorship.", code="INVALID_STATE")
    already = row.mentor_signed_at if side is AgreementSide.mentor else row.startup_signed_at
    if already is not None:
        raise conflict("Your side has already signed this version.", code="ALREADY_SIGNED")
    if not verify_password(payload.current_password, user.password_hash):
        # 403, not change-password's 401: a 401 would make the shared client
        # refresh the token and retry, and the password still be wrong.
        raise AuthError("REAUTH_FAILED", "The password you entered is incorrect.", 403)
    await _lock_mentorship(db, m.id)
    await db.refresh(row)
    if row.status != AgreementStatus.sent:
        raise conflict("This version was replaced. Reload and review it.", code="INVALID_STATE")
    now = _now()
    if side is AgreementSide.mentor:
        row.mentor_signed_at = now
    else:
        row.startup_signed_at = now
        row.startup_signed_by = user.id
    fully = row.mentor_signed_at is not None and row.startup_signed_at is not None
    if fully:
        current = (
            await db.execute(
                select(MentorAgreement).where(
                    MentorAgreement.mentorship_id == m.id,
                    MentorAgreement.status == AgreementStatus.signed,
                )
            )
        ).scalar_one_or_none()
        if current is not None:
            current.status = AgreementStatus.superseded
            current.ended_at = now
            current.end_reason = f"Replaced by version {row.version}."
            await db.flush()
        row.status = AgreementStatus.signed
    _audit(
        db,
        m,
        row,
        user,
        ActivityEventType.agreement_signed,
        (
            f"Agreement version {row.version} signed by both sides."
            if fully
            else f"Agreement version {row.version} signed by the {side.value}."
        ),
        {"side": side.value, "fully_signed": fully},
    )
    await _commit(db)
    await db.refresh(row)
    return await _as_read(db, row, m, side, role)


async def terminate(
    db: AsyncSession, user: User, agreement_id: uuid.UUID, payload: AgreementTerminate
) -> AgreementRead:
    await _limit(user)
    row, m, side, role = await _load(db, user, agreement_id)
    _require_signer(side, role)
    if row.status != AgreementStatus.signed:
        raise conflict("Only a signed agreement can be terminated.", code="INVALID_STATE")
    row.status = AgreementStatus.terminated
    row.ended_at = _now()
    row.ended_by = user.id
    row.end_reason = payload.reason
    _audit(
        db,
        m,
        row,
        user,
        ActivityEventType.agreement_terminated,
        f"Agreement version {row.version} terminated.",
        {"side": side.value},
    )
    await _commit(db)
    await db.refresh(row)
    return await _as_read(db, row, m, side, role)


async def close_for_mentorship(db: AsyncSession, m: Mentorship, user: User) -> None:
    """Staged, not committed: called by 8b ``end``/``cancel`` (approved Q6).

    Drafts were never shared, so they are deleted; a sent or signed version
    is terminated with the reason "Mentorship ended".
    """
    await db.execute(
        delete(MentorAgreement).where(
            MentorAgreement.mentorship_id == m.id,
            MentorAgreement.status == AgreementStatus.draft,
        )
    )
    rows = (
        await db.execute(
            select(MentorAgreement).where(
                MentorAgreement.mentorship_id == m.id,
                MentorAgreement.status.in_(
                    [AgreementStatus.sent.value, AgreementStatus.signed.value]
                ),
            )
        )
    ).scalars()
    now = _now()
    for row in rows:
        row.status = AgreementStatus.terminated
        row.ended_at = now
        row.ended_by = user.id
        row.end_reason = "Mentorship ended."


async def fee_for_session(
    db: AsyncSession, mentorship_id: uuid.UUID, on: date
) -> MentorAgreement | None:
    """The signed version in force on ``on``, if any (approved Q5)."""
    return (
        await db.execute(
            select(MentorAgreement).where(
                MentorAgreement.mentorship_id == mentorship_id,
                MentorAgreement.status == AgreementStatus.signed,
                or_(MentorAgreement.starts_on.is_(None), MentorAgreement.starts_on <= on),
                or_(MentorAgreement.ends_on.is_(None), MentorAgreement.ends_on >= on),
            )
        )
    ).scalar_one_or_none()


# -------------------------------------------------------------------- reads


def _visible(q: Select, side: AgreementSide) -> Select:
    """Hide the other side's drafts."""
    return q.where(
        or_(
            MentorAgreement.status != AgreementStatus.draft,
            MentorAgreement.proposed_by_side == side.value,
        )
    )


def _ordered(q: Select) -> Select:
    # Drafts (no version) first, then newest version first.
    return q.order_by(
        MentorAgreement.version.is_(None).desc(),
        MentorAgreement.version.desc(),
        MentorAgreement.created_at.desc(),
        MentorAgreement.id,
    )


async def _page(
    db: AsyncSession,
    q: Select,
    *,
    limit: int,
    offset: int,
    roles: dict[uuid.UUID, tuple[AgreementSide, str | None]],
) -> AgreementPage:
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    rows = list((await db.execute(_ordered(q).limit(limit).offset(offset))).scalars().all())
    mentorships = {
        m.id: m
        for m in (
            await db.execute(
                select(Mentorship).where(Mentorship.id.in_({r.mentorship_id for r in rows}))
            )
        ).scalars()
    } if rows else {}
    parties = await _parties(db, list(mentorships.values()))
    names = await _names(db, {r.startup_signed_by for r in rows})
    items = []
    for row in rows:
        m = mentorships[row.mentorship_id]
        side, role = roles.get(m.id, (AgreementSide.mentor, None))
        items.append(
            _read(
                row,
                party=parties[m.id],
                side=side,
                role=role,
                mentorship_status=m.status,
                signer_names=names,
            )
        )
    return AgreementPage(items=items, total=total, limit=limit, offset=offset)


async def list_for_mentorship(
    db: AsyncSession,
    user: User,
    mentorship_id: uuid.UUID,
    *,
    status: AgreementStatus | None,
    limit: int,
    offset: int,
) -> AgreementPage:
    m = await _mentorship(db, mentorship_id)
    side, role = await _side(db, m, user)
    q = _visible(select(MentorAgreement).where(MentorAgreement.mentorship_id == m.id), side)
    if status is not None:
        q = q.where(MentorAgreement.status == status.value)
    return await _page(db, q, limit=limit, offset=offset, roles={m.id: (side, role)})


async def list_for_mentor(
    db: AsyncSession,
    user: User,
    *,
    status: AgreementStatus | None,
    awaiting_me: bool,
    proposed_by_me: bool,
    limit: int,
    offset: int,
) -> AgreementPage:
    q = _visible(
        select(MentorAgreement)
        .join(Mentorship, Mentorship.id == MentorAgreement.mentorship_id)
        .where(Mentorship.mentor_id == user.id, Mentorship.deleted_at.is_(None)),
        AgreementSide.mentor,
    )
    if status is not None:
        q = q.where(MentorAgreement.status == status.value)
    if awaiting_me:
        q = q.where(
            MentorAgreement.status == AgreementStatus.sent,
            MentorAgreement.mentor_signed_at.is_(None),
        )
    if proposed_by_me:
        q = q.where(
            MentorAgreement.proposed_by_side == AgreementSide.mentor.value,
            MentorAgreement.status.in_(
                [AgreementStatus.draft.value, AgreementStatus.sent.value]
            ),
        )
    return await _page(db, q, limit=limit, offset=offset, roles={})


async def _linked(db: AsyncSession, row: MentorAgreement) -> AgreementLinkedRecords:
    signed = [t for t in (row.mentor_signed_at, row.startup_signed_at) if t is not None]
    if len(signed) < 2:
        return AgreementLinkedRecords(
            completed_sessions=0, billed_amount=Decimal("0.00"), currency=row.currency
        )
    start = max(signed)
    q = select(func.count(), func.coalesce(func.sum(MentoringSession.fee_amount), 0)).where(
        MentoringSession.mentorship_id == row.mentorship_id,
        MentoringSession.status == SessionStatus.completed.value,
        MentoringSession.currency == row.currency,
        MentoringSession.scheduled_at >= start,
    )
    if row.ended_at is not None:
        q = q.where(MentoringSession.scheduled_at < row.ended_at)
    count, total = (await db.execute(q)).one()
    return AgreementLinkedRecords(
        completed_sessions=count,
        billed_amount=Decimal(total or 0).quantize(Decimal("0.01")),
        currency=row.currency,
    )


async def get(db: AsyncSession, user: User, agreement_id: uuid.UUID) -> AgreementDetail:
    row, m, side, role = await _load(db, user, agreement_id)
    base = await _as_read(db, row, m, side, role)
    breakdown = None
    if side is AgreementSide.mentor and row.fee_amount is not None:
        commission, tds, net = earning_service.compute_amounts(Decimal(row.fee_amount))
        breakdown = AgreementFeeBreakdown(
            gross_amount=Decimal(row.fee_amount),
            commission_amount=commission,
            tds_amount=tds,
            net_amount=net,
            currency=row.currency,
        )
    return AgreementDetail(
        **base.model_dump(), linked_records=await _linked(db, row), fee_breakdown=breakdown
    )


async def summary_for_workspace(
    db: AsyncSession, user: User, m: Mentorship
) -> AgreementSummary | None:
    """The 8j card. ``None`` for a startup viewer, who cannot see agreements."""
    try:
        side, role = await _side(db, m, user)
    except AuthError:
        return None
    rows = list(
        (
            await db.execute(
                select(MentorAgreement).where(
                    MentorAgreement.mentorship_id == m.id,
                    MentorAgreement.status.in_(
                        [AgreementStatus.signed.value, AgreementStatus.sent.value]
                    ),
                )
            )
        ).scalars()
    )
    if not rows:
        return AgreementSummary(current=None, pending=None)
    parties = await _parties(db, [m])
    names = await _names(db, {r.startup_signed_by for r in rows})

    def read(r: MentorAgreement) -> AgreementRead:
        return _read(
            r,
            party=parties[m.id],
            side=side,
            role=role,
            mentorship_status=m.status,
            signer_names=names,
        )

    current = next((r for r in rows if r.status == AgreementStatus.signed), None)
    pending = next((r for r in rows if r.status == AgreementStatus.sent), None)
    return AgreementSummary(
        current=read(current) if current else None, pending=read(pending) if pending else None
    )


__all__ = [
    "close_for_mentorship",
    "create",
    "discard",
    "fee_for_session",
    "get",
    "list_for_mentor",
    "list_for_mentorship",
    "send",
    "sign",
    "summary_for_workspace",
    "terminate",
    "update",
]
