"""Step 7h hires: create from an accepted offer, manage, onboarding,
hire documents and org templates.

Reuse of earlier steps (no parallel systems):

- Organization gate mirrors 7d/7e/7f/7g (same shape as
  ``offer_service``'s gates, but the HIRE_* budget — each feature owns
  its rate-limit keys): active employer/startup org, hiring global role,
  active membership (reads: ``{owner, admin, member}``; writes:
  owner/admin).
- ``offer_service._load`` resolves the offer row for hire creation;
  ``offer_service._move_stage`` writes the ``hired`` stage event exactly
  like 7d's stage writes.
- ``applicant_pipeline_service.TERMINAL`` guards dead applications;
  ``file_service.require_org_attachment`` validates hire-document file
  references; ``organization_service.require_owner_ref``
  validates ``manager_id``/``owner_id``/item owners (422 with
  ``loc: [body, field]``).
- Step 4 files (``FileKind.document``) carry the bytes — no parallel
  upload path (plan D13: employer uploads on behalf; no candidate
  endpoint).

Plan decisions encoded here: hire creation from an ACCEPTED offer only
(BUILD_PLAN 7h), ``application_id`` UNIQUE -> 409 ``HIRE_EXISTS`` (D12),
template section/title are copied snapshots (only owner/due/status/note
are per-hire editable), no delete endpoints anywhere (D9 — withdraw/
cancel/waive are terminal states), and cross-org ids resolve as 404
while cross-org payload references are 422 with ``loc: [body, field]``.
"""

import uuid
from datetime import timedelta

from sqlalchemy import case, delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import require_role
from app.core.exceptions import conflict, forbidden, not_found, rate_limited, validation_error
from app.models.activity import ActivityEventType
from app.models.file import File
from app.models.hire import (
    Hire,
    HireDocument,
    HireDocumentStatus,
    HireOnboardingItem,
    HireStatus,
    OnboardingItemStatus,
    OnboardingTemplate,
    OnboardingTemplateItem,
)
from app.models.job import Job
from app.models.job_application import JobApplication
from app.models.offer import JobOfferStatus
from app.models.organization import (
    Department,
    MemberStatus,
    Organization,
    OrganizationMember,
    OrgRole,
    OrgType,
)
from app.models.user import User, UserRole
from app.schemas.file import FileDownloadRead
from app.schemas.hire import (
    HireCreate,
    HireDocumentCreate,
    HireDocumentPage,
    HireDocumentRead,
    HireDocumentUpdate,
    HirePage,
    HireRead,
    HireUpdate,
    OnboardingItemPage,
    OnboardingItemRead,
    OnboardingItemUpdate,
    TemplateCreate,
    TemplateItemRead,
    TemplatePage,
    TemplateRead,
    TemplateUpdate,
)
from app.services import (
    activity_service,
    applicant_pipeline_service,
    file_service,
    job_service,
    offer_service,
    organization_service,
)
from app.services.rate_limiter import rate_limiter
from app.services.storage_service import Storage

MANAGERS = {OrgRole.owner, OrgRole.admin}
_READ_ROLES = {OrgRole.owner, OrgRole.admin, OrgRole.member}
_EMPLOYER = require_role(UserRole.employer)
_STARTUP_HIRING = require_role(UserRole.employer, UserRole.startup)

# Lifecycle (plan D14 keeps the schema values; this table is the write
# rule): pending -> onboarding -> active, with no_show/cancelled as the
# dead ends. ``active`` is terminal — re-opening employment is not a
# checklist operation.
HIRE_TRANSITIONS: dict[HireStatus, frozenset[HireStatus]] = {
    HireStatus.pending_onboarding: frozenset(
        {HireStatus.onboarding, HireStatus.active, HireStatus.no_show, HireStatus.cancelled}
    ),
    HireStatus.onboarding: frozenset(
        {HireStatus.active, HireStatus.no_show, HireStatus.cancelled}
    ),
    HireStatus.active: frozenset(),
    HireStatus.no_show: frozenset(),
    HireStatus.cancelled: frozenset(),
}

# Checklist rows move freely between the five schema values (the CHECK
# guarantees the vocabulary; there is no ordering rule in the plan).
ITEM_STATUSES = frozenset(OnboardingItemStatus)

# Document statuses (schema CHECK): a document moves forward to
# verified/rejected and can expire from any live state; terminal states
# never move back.
DOCUMENT_TRANSITIONS: dict[HireDocumentStatus, frozenset[HireDocumentStatus]] = {
    HireDocumentStatus.requested: frozenset(
        {HireDocumentStatus.received, HireDocumentStatus.expired}
    ),
    HireDocumentStatus.received: frozenset(
        {HireDocumentStatus.verified, HireDocumentStatus.rejected, HireDocumentStatus.expired}
    ),
    HireDocumentStatus.verified: frozenset({HireDocumentStatus.expired}),
    HireDocumentStatus.rejected: frozenset({HireDocumentStatus.expired}),
    HireDocumentStatus.expired: frozenset(),
}


async def _limit(user: User, *, write: bool) -> None:
    settings = get_settings()
    if write:
        ok = await rate_limiter.check(
            f"hire_write:{user.id}",
            settings.HIRE_WRITE_LIMIT,
            settings.HIRE_WRITE_WINDOW_SECONDS,
        )
        message = "Too many hire changes. Please slow down."
    else:
        ok = await rate_limiter.check(
            f"hire_read:{user.id}", settings.HIRE_READ_LIMIT, 60
        )
        message = "Too many hire requests. Please try again later."
    if not ok:
        raise rate_limited(message)


async def authorize(
    db: AsyncSession, user: User, org_id: uuid.UUID, *, write: bool = False
) -> OrganizationMember:
    """Org-prefixed gate (list + template routes). Outsiders get 403 —
    the established org-path contract; bare row ids use ``_gate`` and
    resolve as 404 instead."""
    org = await organization_service.org_or_404(db, org_id)
    if org.type not in {OrgType.employer, OrgType.startup} or org.status != "active":
        raise not_found("Organization not found.")
    await (_STARTUP_HIRING if org.type == OrgType.startup else _EMPLOYER)(db, user)
    if user.status != "active" or user.email_verified_at is None:
        raise forbidden("An active, verified hiring account is required.")
    member = await organization_service.require_membership(
        db, org.id, user, roles=set(MANAGERS) if write else set(_READ_ROLES)
    )
    await _limit(user, write=write)
    return member


async def _gate(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    *,
    write: bool,
    missing: str,
) -> OrganizationMember:
    """Bare-route gate: outsiders and non-hiring orgs are 404 with the
    route's own ``missing`` message (no existence oracle), then role and
    the HIRE_* rate budget apply."""
    org = (
        await db.execute(
            select(Organization).where(
                Organization.id == org_id,
                Organization.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if (
        org is None
        or org.type not in {OrgType.employer, OrgType.startup}
        or org.status != "active"
    ):
        raise not_found(missing)
    member = (
        await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.org_id == org.id,
                OrganizationMember.user_id == user.id,
                OrganizationMember.deleted_at.is_(None),
                OrganizationMember.status == MemberStatus.active,
            )
        )
    ).scalar_one_or_none()
    if member is None:
        raise not_found(missing)
    await (_STARTUP_HIRING if org.type == OrgType.startup else _EMPLOYER)(db, user)
    if user.status != "active" or user.email_verified_at is None:
        raise forbidden("An active, verified hiring account is required.")
    if write:
        if member.role not in MANAGERS:
            raise forbidden("Only owners and admins can manage hires.")
        await _limit(user, write=True)
    else:
        if member.role not in _READ_ROLES:
            raise forbidden()
        await _limit(user, write=False)
    return member


async def _bare_hire(
    db: AsyncSession, hire_id: uuid.UUID, *, lock: bool = False, missing: str = "Hire not found."
) -> Hire:
    """Bare ``/hires/{id}`` lookup — org comes from the row; the gate
    decides 404 vs 403 afterwards."""
    stmt = select(Hire).where(Hire.id == hire_id)
    if lock:
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise not_found(missing)
    return row


def _audit(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    event: ActivityEventType,
    entity_type: str,
    entity_id: uuid.UUID,
    summary: str,
) -> None:
    activity_service.record(
        db,
        event_type=event,
        summary=summary,
        org_id=org_id,
        actor_id=user.id,
        entity_type=entity_type,
        entity_id=entity_id,
    )


async def _people(db: AsyncSession, user_ids: set[uuid.UUID]) -> dict[uuid.UUID, User]:
    if not user_ids:
        return {}
    rows = (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
    return {row.id: row for row in rows}


async def _job_titles(
    db: AsyncSession, application_ids: set[uuid.UUID]
) -> dict[uuid.UUID, str | None]:
    """G5: one query for every hire row's job title."""
    if not application_ids:
        return {}
    rows = (
        await db.execute(
            select(JobApplication.id, Job.title)
            .join(Job, Job.id == JobApplication.job_id)
            .where(JobApplication.id.in_(application_ids))
        )
    ).all()
    return {app_id: title for app_id, title in rows}


async def _checklist_counts(
    db: AsyncSession, hire_ids: set[uuid.UUID]
) -> dict[uuid.UUID, tuple[int, int]]:
    """G6: (total, done) per hire in one grouped query; absent = (0, 0)."""
    if not hire_ids:
        return {}
    rows = (
        await db.execute(
            select(
                HireOnboardingItem.hire_id,
                func.count(HireOnboardingItem.id),
                func.sum(
                    case(
                        (HireOnboardingItem.status == OnboardingItemStatus.done, 1),
                        else_=0,
                    )
                ),
            )
            .where(HireOnboardingItem.hire_id.in_(hire_ids))
            .group_by(HireOnboardingItem.hire_id)
        )
    ).all()
    return {hire_id: (int(total), int(done or 0)) for hire_id, total, done in rows}


def _read(
    hire: Hire,
    person: User | None,
    *,
    job_title: str | None,
    checklist: tuple[int, int],
) -> HireRead:
    total, done = checklist
    return HireRead(
        id=hire.id,
        application_id=hire.application_id,
        offer_id=hire.offer_id,
        org_id=hire.org_id,
        user_id=hire.user_id,
        name=person.display_name if person else "",
        email=person.primary_email if person else "",
        job_title=job_title,
        department=hire.department,
        manager_id=hire.manager_id,
        owner_id=hire.owner_id,
        start_date=hire.start_date,
        status=hire.status,
        checklist_total=total,
        checklist_done=done,
        created_at=hire.created_at,
        updated_at=hire.updated_at,
    )


async def _reads(db: AsyncSession, rows: list[Hire]) -> list[HireRead]:
    people = await _people(db, {row.user_id for row in rows})
    titles = await _job_titles(db, {row.application_id for row in rows})
    counts = await _checklist_counts(db, {row.id for row in rows})
    return [
        _read(
            row,
            people.get(row.user_id),
            job_title=titles.get(row.application_id),
            checklist=counts.get(row.id, (0, 0)),
        )
        for row in rows
    ]


async def _read_one(db: AsyncSession, hire: Hire, person: User | None) -> HireRead:
    titles = await _job_titles(db, {hire.application_id})
    counts = await _checklist_counts(db, {hire.id})
    return _read(
        hire,
        person,
        job_title=titles.get(hire.application_id),
        checklist=counts.get(hire.id, (0, 0)),
    )


async def create_hire(
    db: AsyncSession, user: User, offer_id: uuid.UUID, payload: HireCreate
) -> HireRead:
    offer, app, job = await offer_service._load(db, offer_id, lock=True)
    await _gate(db, user, job.org_id, write=True, missing="Offer not found.")
    # Payload references resolve first: a malformed request is a 422 no
    # matter what state the offer/application is in.
    template: OnboardingTemplate | None = None
    if payload.template_id is not None:
        template = (
            await db.execute(
                select(OnboardingTemplate).where(
                    OnboardingTemplate.id == payload.template_id,
                    OnboardingTemplate.org_id == job.org_id,
                    OnboardingTemplate.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if template is None:
            message = "Select an onboarding template belonging to this organization."
            raise validation_error(
                message,
                details=[
                    {"loc": ["body", "template_id"], "msg": message, "type": "value_error"}
                ],
            )
    if payload.manager_id is not None:
        await organization_service.require_owner_ref(
            db, job.org_id, payload.manager_id, field="manager_id", label="Hire manager"
        )
    if payload.owner_id is not None:
        await organization_service.require_owner_ref(
            db, job.org_id, payload.owner_id, field="owner_id", label="Hire owner"
        )
    # D12 defaults: start date from the offer, department from the job,
    # manager/owner from the job owner and finally the caller.
    start_date = payload.start_date or offer.start_date
    if start_date is None:
        message = "A start date is required when the offer has none."
        raise validation_error(
            message,
            details=[
                {"loc": ["body", "start_date"], "msg": message, "type": "value_error"}
            ],
        )
    if offer.status != JobOfferStatus.accepted:
        raise conflict(
            "Only an accepted offer can become a hire.", "OFFER_NOT_ACCEPTED"
        )
    # D12: one hire per application — the explicit answer to a duplicate
    # (the unique index below is only the race backstop).
    already = (
        await db.execute(select(Hire.id).where(Hire.application_id == app.id))
    ).first()
    if already is not None:
        raise conflict(
            "A hire already exists for this application.", "HIRE_EXISTS"
        )
    if app.stage in applicant_pipeline_service.TERMINAL:
        raise conflict(
            "This application can no longer become a hire.",
            "APPLICATION_READ_ONLY",
        )
    default_owner = job.owner_id or user.id
    hire = Hire(
        application_id=app.id,
        offer_id=offer.id,
        org_id=job.org_id,
        user_id=app.applicant_id,
        department=payload.department or job.department,
        manager_id=payload.manager_id or default_owner,
        owner_id=payload.owner_id or default_owner,
        start_date=start_date,
        status=HireStatus.pending_onboarding,
    )
    db.add(hire)
    try:
        await db.flush()
    except IntegrityError:
        # application_id is UNIQUE: one hire per application (D12).
        await db.rollback()
        raise conflict(
            "A hire already exists for this application.", "HIRE_EXISTS"
        ) from None
    if template is not None:
        items = (
            (
                await db.execute(
                    select(OnboardingTemplateItem)
                    .where(OnboardingTemplateItem.template_id == template.id)
                    .order_by(OnboardingTemplateItem.display_order, OnboardingTemplateItem.id)
                )
            )
            .scalars()
            .all()
        )
        for item in items:
            due_on = (
                start_date + timedelta(days=item.due_offset_days)
                if item.due_offset_days is not None
                else None
            )
            db.add(
                HireOnboardingItem(
                    hire_id=hire.id,
                    section=item.section,
                    title=item.title,
                    owner_id=None,  # role -> person is assigned per hire
                    due_on=due_on,
                    status=OnboardingItemStatus.pending,
                )
            )
    # D11: hire creation moves the application to ``hired``.
    offer_service._move_stage(db, app, "hired", user.id)
    _audit(
        db, user, job.org_id, ActivityEventType.hire_created, "hire", hire.id,
        "Hire created.",
    )
    await db.commit()
    await db.refresh(hire)
    person = await db.get(User, hire.user_id)
    return await _read_one(db, hire, person)


async def list_hires(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    *,
    status: HireStatus | None = None,
    department: Department | None = None,
    limit: int,
    offset: int,
) -> HirePage:
    await authorize(db, user, org_id)
    stmt = select(Hire).where(Hire.org_id == org_id)
    if status is not None:
        stmt = stmt.where(Hire.status == status)
    if department is not None:
        stmt = stmt.where(Hire.department == department)
    total = (
        await db.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar_one()
    rows = (
        (
            await db.execute(
                stmt.order_by(Hire.created_at.desc(), Hire.id.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    reads = await _reads(db, list(rows))
    return HirePage(
        items=reads, total=total, limit=limit, offset=offset,
        has_more=offset + len(rows) < total,
    )


async def hire_detail(db: AsyncSession, user: User, hire_id: uuid.UUID) -> HireRead:
    hire = await _bare_hire(db, hire_id)
    await _gate(db, user, hire.org_id, write=False, missing="Hire not found.")
    person = await db.get(User, hire.user_id)
    return await _read_one(db, hire, person)


async def patch_hire(
    db: AsyncSession, user: User, hire_id: uuid.UUID, payload: HireUpdate
) -> HireRead:
    hire = await _bare_hire(db, hire_id, lock=True)
    await _gate(db, user, hire.org_id, write=True, missing="Hire not found.")
    fields = payload.model_fields_set
    if not fields:
        person = await db.get(User, hire.user_id)
        return await _read_one(db, hire, person)
    for field in ("start_date", "status"):
        if field in fields and getattr(payload, field) is None:
            message = f"{field} is required."
            raise validation_error(
                message,
                details=[{"loc": ["body", field], "msg": message, "type": "value_error"}],
            )
    if "status" in fields and payload.status is not None and payload.status != hire.status:
        if payload.status not in HIRE_TRANSITIONS[hire.status]:
            raise conflict(
                f"A hire in {hire.status} state cannot become {payload.status}.",
                "HIRE_INVALID_STATE",
            )
    if "manager_id" in fields and payload.manager_id is not None:
        await organization_service.require_owner_ref(
            db, hire.org_id, payload.manager_id, field="manager_id", label="Hire manager"
        )
    if "owner_id" in fields and payload.owner_id is not None:
        await organization_service.require_owner_ref(
            db, hire.org_id, payload.owner_id, field="owner_id", label="Hire owner"
        )
    for field in fields:
        setattr(hire, field, getattr(payload, field))
    _audit(
        db, user, hire.org_id, ActivityEventType.hire_updated, "hire", hire.id,
        "Hire updated.",
    )
    await db.commit()
    await db.refresh(hire)
    person = await db.get(User, hire.user_id)
    return await _read_one(db, hire, person)


async def onboarding_items(
    db: AsyncSession, user: User, hire_id: uuid.UUID, *, limit: int, offset: int
) -> OnboardingItemPage:
    hire = await _bare_hire(db, hire_id)
    await _gate(db, user, hire.org_id, write=False, missing="Hire not found.")
    stmt = select(HireOnboardingItem).where(HireOnboardingItem.hire_id == hire.id)
    total = (
        await db.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar_one()
    rows = (
        (
            await db.execute(
                stmt.order_by(HireOnboardingItem.created_at, HireOnboardingItem.id)
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    return OnboardingItemPage(
        items=[OnboardingItemRead.model_validate(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(rows) < total,
    )


async def patch_onboarding_item(
    db: AsyncSession,
    user: User,
    hire_id: uuid.UUID,
    item_id: uuid.UUID,
    payload: OnboardingItemUpdate,
) -> OnboardingItemRead:
    hire = await _bare_hire(db, hire_id, lock=True)
    await _gate(db, user, hire.org_id, write=True, missing="Hire not found.")
    item = (
        await db.execute(
            select(HireOnboardingItem)
            .where(
                HireOnboardingItem.id == item_id,
                HireOnboardingItem.hire_id == hire.id,
            )
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if item is None:
        raise not_found("Checklist item not found.")
    fields = payload.model_fields_set
    if not fields:
        return OnboardingItemRead.model_validate(item)
    if "owner_id" in fields and payload.owner_id is not None:
        await organization_service.require_owner_ref(
            db,
            hire.org_id,
            payload.owner_id,
            field="owner_id",
            label="Checklist owner",
        )
    if "status" in fields and payload.status is not None:
        item.status = payload.status
    for field in ("owner_id", "due_on", "note"):
        if field in fields:
            setattr(item, field, getattr(payload, field))
    _audit(
        db,
        user,
        hire.org_id,
        ActivityEventType.onboarding_item_updated,
        "hire_onboarding_item",
        item.id,
        "Onboarding item updated.",
    )
    await db.commit()
    await db.refresh(item)
    return OnboardingItemRead.model_validate(item)


async def create_document(
    db: AsyncSession, user: User, hire_id: uuid.UUID, payload: HireDocumentCreate
) -> HireDocumentRead:
    hire = await _bare_hire(db, hire_id, lock=True)
    await _gate(db, user, hire.org_id, write=True, missing="Hire not found.")
    if payload.file_id is not None:
        await file_service.require_org_attachment(
            db, user, hire.org_id, payload.file_id, "document", "file_id"
        )
    doc = HireDocument(
        hire_id=hire.id,
        file_id=payload.file_id,
        name=payload.name,
        purpose=payload.purpose,
        retention=payload.retention,
        due_on=payload.due_on,
        status=HireDocumentStatus.requested,  # server-owned initial state
        requested_by=user.id,
    )
    db.add(doc)
    await db.flush()
    _audit(
        db,
        user,
        hire.org_id,
        ActivityEventType.hire_document_requested,
        "hire_document",
        doc.id,
        "Hire document requested.",
    )
    await db.commit()
    await db.refresh(doc)
    return HireDocumentRead.model_validate(doc)


async def list_documents(
    db: AsyncSession, user: User, hire_id: uuid.UUID, *, limit: int, offset: int
) -> HireDocumentPage:
    hire = await _bare_hire(db, hire_id)
    await _gate(db, user, hire.org_id, write=False, missing="Hire not found.")
    stmt = select(HireDocument).where(HireDocument.hire_id == hire.id)
    total = (
        await db.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar_one()
    rows = (
        (
            await db.execute(
                stmt.order_by(HireDocument.created_at.desc(), HireDocument.id.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    return HireDocumentPage(
        items=[HireDocumentRead.model_validate(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(rows) < total,
    )


async def _document(
    db: AsyncSession, document_id: uuid.UUID, *, lock: bool = False
) -> tuple[HireDocument, Hire]:
    stmt = (
        select(HireDocument, Hire)
        .join(Hire, Hire.id == HireDocument.hire_id)
        .where(HireDocument.id == document_id)
    )
    if lock:
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    result = (await db.execute(stmt)).first()
    if result is None:
        raise not_found("Document not found.")
    return result[0], result[1]


async def patch_document(
    db: AsyncSession, user: User, document_id: uuid.UUID, payload: HireDocumentUpdate
) -> HireDocumentRead:
    doc, hire = await _document(db, document_id, lock=True)
    await _gate(db, user, hire.org_id, write=True, missing="Document not found.")
    fields = payload.model_fields_set
    if not fields:
        return HireDocumentRead.model_validate(doc)
    if "name" in fields and payload.name is None:
        message = "name is required."
        raise validation_error(
            message,
            details=[{"loc": ["body", "name"], "msg": message, "type": "value_error"}],
        )
    if "status" in fields and payload.status is not None and payload.status != doc.status:
        if payload.status not in DOCUMENT_TRANSITIONS[doc.status]:
            raise conflict(
                f"A document in {doc.status} state cannot become {payload.status}.",
                "DOCUMENT_INVALID_STATE",
            )
    if "file_id" in fields and payload.file_id is not None:
        await file_service.require_org_attachment(
            db, user, hire.org_id, payload.file_id, "document", "file_id"
        )
    for field in fields:
        setattr(doc, field, getattr(payload, field))
    _audit(
        db,
        user,
        hire.org_id,
        ActivityEventType.hire_document_updated,
        "hire_document",
        doc.id,
        "Hire document updated.",
    )
    await db.commit()
    await db.refresh(doc)
    return HireDocumentRead.model_validate(doc)


async def document_download(
    db: AsyncSession,
    user: User,
    document_id: uuid.UUID,
    storage: Storage,
    *,
    inline: bool = False,
) -> FileDownloadRead:
    doc, hire = await _document(db, document_id)
    await _gate(db, user, hire.org_id, write=False, missing="Document not found.")
    if doc.file_id is None:
        raise not_found("Document file not found.")
    file = await db.get(File, doc.file_id)
    if file is None or file.owner_org_id != hire.org_id:
        raise not_found("Document file not found.")
    settings = get_settings()
    await file_service.enforce_limit(
        f"file_download:{user.id}", settings.FILE_DOWNLOAD_LIMIT, 300
    )
    url, ttl = await file_service.sign_ready_download(
        file, "original", storage, inline=inline
    )
    # No audit event: downloads are reads; the plan's activity vocabulary
    # covers mutations only (the 7c resume audit is the blind-review
    # exception, which does not apply to org hire documents).
    return FileDownloadRead(
        url=url, expires_in=ttl, file_name=file.file_name, mime_type=file.mime_type
    )


async def list_templates(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    *,
    q: str | None = None,
    limit: int,
    offset: int,
) -> TemplatePage:
    await authorize(db, user, org_id)
    stmt = select(OnboardingTemplate).where(
        OnboardingTemplate.org_id == org_id,
        OnboardingTemplate.deleted_at.is_(None),
    )
    if q and q.strip():
        pattern = f"%{job_service._escape_like(q.strip())}%"
        stmt = stmt.where(OnboardingTemplate.name.ilike(pattern, escape="\\"))
    total = (
        await db.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar_one()
    rows = (
        (
            await db.execute(
                stmt.order_by(OnboardingTemplate.created_at.desc(), OnboardingTemplate.id.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    items_by_template = await _template_items(db, [row.id for row in rows])
    return TemplatePage(
        items=[
            TemplateRead(
                id=row.id,
                org_id=row.org_id,
                name=row.name,
                is_platform=row.is_platform,
                items=[
                    _item_read(item)
                    for item in items_by_template.get(row.id, [])
                ],
                created_at=row.created_at,
                updated_at=row.updated_at,
            )
            for row in rows
        ],
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(rows) < total,
    )


async def create_template(
    db: AsyncSession, user: User, org_id: uuid.UUID, payload: TemplateCreate
) -> TemplateRead:
    await authorize(db, user, org_id, write=True)
    template = OnboardingTemplate(org_id=org_id, name=payload.name, is_platform=False)
    db.add(template)
    await db.flush()
    for index, item in enumerate(payload.items):
        db.add(
            OnboardingTemplateItem(
                template_id=template.id,
                section=item.section,
                title=item.title,
                owner_role=item.owner_role,
                due_offset_days=item.due_offset_days,
                display_order=index,
            )
        )
    _audit(
        db,
        user,
        org_id,
        ActivityEventType.onboarding_template_created,
        "onboarding_template",
        template.id,
        "Onboarding template created.",
    )
    await db.commit()
    await db.refresh(template)
    return await _template_read(db, template)


async def template_detail(
    db: AsyncSession, user: User, org_id: uuid.UUID, template_id: uuid.UUID
) -> TemplateRead:
    await authorize(db, user, org_id)
    template = await _template(db, org_id, template_id)
    return await _template_read(db, template)


async def patch_template(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    template_id: uuid.UUID,
    payload: TemplateUpdate,
) -> TemplateRead:
    await authorize(db, user, org_id, write=True)
    template = await _template(db, org_id, template_id, lock=True)
    fields = payload.model_fields_set
    if not fields:
        return await _template_read(db, template)
    if "name" in fields:
        if payload.name is None:
            message = "name is required."
            raise validation_error(
                message,
                details=[
                    {"loc": ["body", "name"], "msg": message, "type": "value_error"}
                ],
            )
        template.name = payload.name
    if "items" in fields and payload.items is not None:
        # Replace-set (the 7e criteria pattern): the posted list is the
        # whole checklist; display_order is the list position.
        await db.execute(
            delete(OnboardingTemplateItem).where(
                OnboardingTemplateItem.template_id == template.id
            )
        )
        for index, item in enumerate(payload.items):
            db.add(
                OnboardingTemplateItem(
                    template_id=template.id,
                    section=item.section,
                    title=item.title,
                    owner_role=item.owner_role,
                    due_offset_days=item.due_offset_days,
                    display_order=index,
                )
            )
    _audit(
        db,
        user,
        org_id,
        ActivityEventType.onboarding_template_updated,
        "onboarding_template",
        template.id,
        "Onboarding template updated.",
    )
    await db.commit()
    await db.refresh(template)
    return await _template_read(db, template)


async def _template(
    db: AsyncSession, org_id: uuid.UUID, template_id: uuid.UUID, *, lock: bool = False
) -> OnboardingTemplate:
    stmt = select(OnboardingTemplate).where(
        OnboardingTemplate.id == template_id,
        OnboardingTemplate.org_id == org_id,
        OnboardingTemplate.deleted_at.is_(None),
    )
    if lock:
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise not_found("Template not found.")
    return row


def _item_read(item: OnboardingTemplateItem) -> TemplateItemRead:
    return TemplateItemRead(
        id=item.id,
        section=item.section,
        title=item.title,
        owner_role=item.owner_role,
        due_offset_days=item.due_offset_days,
        display_order=item.display_order,
    )


async def _template_items(
    db: AsyncSession, template_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[OnboardingTemplateItem]]:
    if not template_ids:
        return {}
    rows = (
        (
            await db.execute(
                select(OnboardingTemplateItem)
                .where(OnboardingTemplateItem.template_id.in_(template_ids))
                .order_by(
                    OnboardingTemplateItem.template_id,
                    OnboardingTemplateItem.display_order,
                    OnboardingTemplateItem.id,
                )
            )
        )
        .scalars()
        .all()
    )
    grouped: dict[uuid.UUID, list[OnboardingTemplateItem]] = {}
    for row in rows:
        grouped.setdefault(row.template_id, []).append(row)
    return grouped


async def _template_read(db: AsyncSession, template: OnboardingTemplate) -> TemplateRead:
    items = await _template_items(db, [template.id])
    return TemplateRead(
        id=template.id,
        org_id=template.org_id,
        name=template.name,
        is_platform=template.is_platform,
        items=[_item_read(item) for item in items.get(template.id, [])],
        created_at=template.created_at,
        updated_at=template.updated_at,
    )


__all__ = [
    "create_hire",
    "list_hires",
    "hire_detail",
    "patch_hire",
    "onboarding_items",
    "patch_onboarding_item",
    "create_document",
    "list_documents",
    "patch_document",
    "document_download",
    "list_templates",
    "create_template",
    "template_detail",
    "patch_template",
    "HIRE_TRANSITIONS",
    "DOCUMENT_TRANSITIONS",
]
