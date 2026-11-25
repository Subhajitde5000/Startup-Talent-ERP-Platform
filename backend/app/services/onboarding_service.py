"""Accepted-offer conversion, independent copied checklists, private hire documents."""

import uuid
from datetime import timedelta

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import conflict, forbidden, not_found, validation_error
from app.models.hiring_workflow import (
    Hire,
    HireDocument,
    HireOnboardingItem,
    OnboardingTemplate,
    OnboardingTemplateItem,
)
from app.models.job import Job
from app.models.job_application import JobApplication
from app.models.organization import OrganizationMember
from app.models.user import User
from app.schemas import hiring_workflow as s
from app.schemas.file import FileDownloadRead
from app.services import applicant_pipeline_service as pipeline
from app.services import hiring_workflow_service as common
from app.services import job_offer_service as offers
from app.services import job_service
from app.services.storage_service import Storage


async def manager(
    db: AsyncSession, user: User, org_id: uuid.UUID, write: bool = False
) -> OrganizationMember:
    member = await pipeline.authorize(db, user, org_id, write=write)
    if member.role not in pipeline.MANAGERS:
        raise forbidden("Only owners and admins can manage onboarding templates.")
    return member


async def template_row(
    db: AsyncSession, org_id: uuid.UUID, id_: uuid.UUID, lock: bool = False
) -> OnboardingTemplate:
    stmt = select(OnboardingTemplate).where(
        OnboardingTemplate.id == id_,
        OnboardingTemplate.org_id == org_id,
        OnboardingTemplate.deleted_at.is_(None),
    )
    if lock:
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise not_found()
    return row


async def template_project(db: AsyncSession, row: OnboardingTemplate) -> s.OnboardingTemplateRead:
    items = list(
        (
            await db.execute(
                select(OnboardingTemplateItem)
                .where(OnboardingTemplateItem.template_id == row.id)
                .order_by(OnboardingTemplateItem.display_order)
            )
        ).scalars()
    )
    return s.OnboardingTemplateRead(
        id=row.id,
        name=row.name,
        items=[s.TemplateItemRead.model_validate(item) for item in items],
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def template_create(
    db: AsyncSession, user: User, org_id: uuid.UUID, payload: s.OnboardingTemplateInput
) -> s.OnboardingTemplateRead:
    await manager(db, user, org_id, True)
    row = OnboardingTemplate(org_id=org_id, name=payload.name)
    db.add(row)
    await db.flush()
    db.add_all(
        [
            OnboardingTemplateItem(template_id=row.id, display_order=i, **item.model_dump())
            for i, item in enumerate(payload.items)
        ]
    )
    common.audit(db, user, org_id, "template", row.id, "created")
    await db.commit()
    return await template_project(db, row)


async def template_get(
    db: AsyncSession, user: User, org_id: uuid.UUID, id_: uuid.UUID
) -> s.OnboardingTemplateRead:
    await pipeline.authorize(db, user, org_id)
    return await template_project(db, await template_row(db, org_id, id_))


async def template_list(
    db: AsyncSession, user: User, org_id: uuid.UUID, limit: int = 20, offset: int = 0
) -> s.TemplatePage:
    await pipeline.authorize(db, user, org_id)
    stmt = select(OnboardingTemplate).where(
        OnboardingTemplate.org_id == org_id, OnboardingTemplate.deleted_at.is_(None)
    )
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = list(
        (
            await db.execute(
                stmt.order_by(OnboardingTemplate.created_at.desc(), OnboardingTemplate.id)
                .limit(limit)
                .offset(offset)
            )
        ).scalars()
    )
    return s.TemplatePage(
        **common.page([await template_project(db, row) for row in rows], total or 0, limit, offset)
    )


async def template_patch(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    id_: uuid.UUID,
    payload: s.OnboardingTemplateInput,
) -> s.OnboardingTemplateRead:
    await manager(db, user, org_id, True)
    row = await template_row(db, org_id, id_, True)
    before = await template_project(db, row)
    if before.name == payload.name and [
        item.model_dump(exclude={"id", "display_order"}) for item in before.items
    ] == [item.model_dump() for item in payload.items]:
        return before
    await db.execute(
        delete(OnboardingTemplateItem).where(OnboardingTemplateItem.template_id == id_)
    )
    row.name, row.updated_at = payload.name, common.now()
    db.add_all(
        [
            OnboardingTemplateItem(template_id=id_, display_order=i, **item.model_dump())
            for i, item in enumerate(payload.items)
        ]
    )
    common.audit(db, user, org_id, "template", id_, "edited")
    await db.commit()
    return await template_project(db, row)


async def template_archive(db: AsyncSession, user: User, org_id: uuid.UUID, id_: uuid.UUID) -> None:
    await manager(db, user, org_id, True)
    row = await template_row(db, org_id, id_, True)
    row.deleted_at = common.now()
    common.audit(db, user, org_id, "template", id_, "archived")
    await db.commit()


async def scope(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    id_: uuid.UUID,
    write: bool = False,
    task: bool = False,
    private: bool = False,
) -> tuple[OrganizationMember, Job, JobApplication, Hire]:
    member = await pipeline.authorize(db, user, org_id, write=write)
    hit = (
        await db.execute(
            select(Hire, JobApplication.job_id)
            .join(JobApplication, JobApplication.id == Hire.application_id)
            .where(Hire.id == id_, Hire.org_id == org_id, JobApplication.deleted_at.is_(None))
        )
    ).one_or_none()
    if hit is None:
        raise not_found()
    job = await job_service._job(db, org_id, hit.job_id, lock=write, include_archived=True)
    stmt = select(JobApplication).where(
        JobApplication.id == hit.Hire.application_id, JobApplication.deleted_at.is_(None)
    )
    if write:
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    app = (await db.execute(stmt)).scalar_one_or_none()
    if app is None:
        raise not_found()
    row = hit.Hire
    if write:
        row = (
            await db.execute(
                select(Hire)
                .where(Hire.id == id_)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
        ).scalar_one()
    direct = member.role in pipeline.MANAGERS or user.id in {row.owner_id, row.manager_id}
    if not direct and private:
        raise not_found()
    if not direct and user.id not in {job.owner_id, app.assignee_id}:
        own_task = (
            await db.scalar(
                select(HireOnboardingItem.id)
                .where(HireOnboardingItem.hire_id == id_, HireOnboardingItem.owner_id == user.id)
                .limit(1)
            )
            if task
            else None
        )
        if own_task is None:
            raise not_found()
    return member, job, app, row


def writable(row: Hire) -> None:
    if row.status in {"active", "no_show", "cancelled"}:
        raise conflict("This onboarding record is read-only.", "HIRE_READ_ONLY")


async def project(db: AsyncSession, row: Hire, app: JobApplication, user: User) -> s.HireRead:
    total = await db.scalar(
        select(func.count())
        .select_from(HireOnboardingItem)
        .where(HireOnboardingItem.hire_id == row.id)
    )
    completed = await db.scalar(
        select(func.count())
        .select_from(HireOnboardingItem)
        .where(
            HireOnboardingItem.hire_id == row.id, HireOnboardingItem.status.in_(["done", "waived"])
        )
    )
    manager = await common.manager_role(db, user, row.org_id)
    job = await db.get(Job, app.job_id)
    editable = manager or user.id in {row.owner_id, job.owner_id if job else None}
    private = manager or user.id in {row.owner_id, row.manager_id}
    return s.HireRead.model_validate(
        {
            **{k: getattr(row, k) for k in s.HireRead.model_fields if hasattr(row, k)},
            "applicant_label": common.label(app),
            "job_id": app.job_id,
            "job_title": app.job_snapshot["title"],
            "can_edit": editable and row.status not in {"active", "no_show", "cancelled"},
            "can_manage_tasks": (editable or user.id == row.manager_id)
            and row.status not in {"active", "no_show", "cancelled"},
            "can_access_documents": private,
            "completed_items": completed,
            "total_items": total,
        }
    )


async def create(
    db: AsyncSession, user: User, org_id: uuid.UUID, payload: s.HireCreate
) -> s.HireRead:
    await common.sensitive(user)
    job, app, offer = await offers.scope(db, user, payload.offer_id, org_id, True)
    old = (await db.execute(select(Hire).where(Hire.application_id == app.id))).scalar_one_or_none()
    if old:
        if old.offer_id != payload.offer_id:
            raise conflict("This application was converted using another offer.")
        common.retry(old, common.digest(payload))
        return await project(db, old, app, user)
    common.active_application(app)
    if offer.status != "accepted" or offer.superseded_at or app.stage != "offered":
        raise conflict("A current accepted offer is required.", "ACCEPTED_OFFER_REQUIRED")
    for id_ in (payload.owner_id, payload.manager_id):
        if id_:
            await pipeline.eligible_assignee(db, org_id, id_)
    items = []
    if payload.template_id:
        template = await template_row(db, org_id, payload.template_id, True)
        items = list(
            (
                await db.execute(
                    select(OnboardingTemplateItem)
                    .where(OnboardingTemplateItem.template_id == template.id)
                    .order_by(OnboardingTemplateItem.display_order)
                )
            ).scalars()
        )
    try:
        due_dates = [offer.start_date + timedelta(days=item.due_offset_days) for item in items]
    except OverflowError as exc:
        raise validation_error(
            "A copied task due date is outside the supported calendar range."
        ) from exc
    row = Hire(
        application_id=app.id,
        offer_id=offer.id,
        org_id=org_id,
        user_id=app.applicant_id,
        fingerprint=common.digest(payload),
        department=payload.department,
        manager_id=payload.manager_id,
        owner_id=payload.owner_id or user.id,
        start_date=offer.start_date,
    )
    db.add(row)
    await db.flush()
    db.add_all(
        [
            HireOnboardingItem(
                hire_id=row.id,
                section=item.section,
                title=item.title,
                owner_id=row.manager_id
                if item.owner_role == "manager"
                else row.owner_id
                if item.owner_role == "owner"
                else None,
                due_on=due_on,
            )
            for item, due_on in zip(items, due_dates, strict=True)
        ]
    )
    common.stage(db, user, job, app, "hired")
    common.audit(db, user, org_id, "hire", row.id, "created")
    await db.commit()
    return await project(db, row, app, user)


async def get(db: AsyncSession, user: User, org_id: uuid.UUID, id_: uuid.UUID) -> s.HireRead:
    _, _, app, row = await scope(db, user, org_id, id_)
    return await project(db, row, app, user)


async def listing(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    status: s.HireStatus | None = None,
    limit: int = 20,
    offset: int = 0,
) -> s.HirePage:
    member = await pipeline.authorize(db, user, org_id)
    stmt = (
        select(Hire, JobApplication)
        .join(JobApplication, JobApplication.id == Hire.application_id)
        .join(Job, Job.id == JobApplication.job_id)
        .where(Hire.org_id == org_id, JobApplication.deleted_at.is_(None))
    )
    if member.role not in pipeline.MANAGERS:
        stmt = stmt.where(
            or_(
                Hire.owner_id == user.id,
                Hire.manager_id == user.id,
                Job.owner_id == user.id,
                JobApplication.assignee_id == user.id,
            )
        )
    if status:
        stmt = stmt.where(Hire.status == status)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (
        await db.execute(stmt.order_by(Hire.created_at.desc(), Hire.id).limit(limit).offset(offset))
    ).all()
    return s.HirePage(
        **common.page(
            [await project(db, row, app, user) for row, app in rows], total or 0, limit, offset
        )
    )


async def patch(
    db: AsyncSession, user: User, org_id: uuid.UUID, id_: uuid.UUID, payload: s.HirePatch
) -> s.HireRead:
    member, job, app, row = await scope(db, user, org_id, id_, True)
    if member.role not in pipeline.MANAGERS and user.id not in {job.owner_id, row.owner_id}:
        raise forbidden("Only a hiring manager or hire/job owner can edit the hire.")
    writable(row)
    changes = payload.model_dump(exclude_unset=True, exclude={"expected_version"})
    if "start_date" in changes and changes["start_date"] is None:
        raise validation_error("Start date cannot be null.")
    if all(getattr(row, k) == v for k, v in changes.items()):
        return await project(db, row, app, user)
    common.expect(row, payload.expected_version)
    for key in ("manager_id", "owner_id"):
        if changes.get(key):
            await pipeline.eligible_assignee(db, org_id, changes[key])
    for key, value in changes.items():
        setattr(row, key, value)
    # Copied due dates/owners remain historical until explicitly edited per task.
    common.touch(row)
    common.audit(db, user, org_id, "hire", id_, "edited")
    await db.commit()
    return await project(db, row, app, user)


async def transition(
    db: AsyncSession, user: User, org_id: uuid.UUID, id_: uuid.UUID, payload: s.HireTransition
) -> s.HireRead:
    member, job, app, row = await scope(db, user, org_id, id_, True)
    if member.role not in pipeline.MANAGERS and user.id not in {job.owner_id, row.owner_id}:
        raise forbidden("Only a hiring manager or hire/job owner can transition the hire.")
    target = {
        "onboard": "onboarding",
        "activate": "active",
        "no_show": "no_show",
        "cancel": "cancelled",
    }[payload.action]
    if row.status == target:
        return await project(db, row, app, user)
    common.expect(row, payload.expected_version)
    writable(row)
    if target == "active":
        if row.status != "onboarding" or row.start_date > common.day():
            raise conflict("Activation requires onboarding and the start date to have arrived.")
        pending = await db.scalar(
            select(HireOnboardingItem.id)
            .where(
                HireOnboardingItem.hire_id == id_,
                HireOnboardingItem.status.not_in(["done", "waived"]),
            )
            .limit(1)
        )
        if pending:
            raise conflict("Complete or explicitly waive outstanding checklist items.")
    if target == "no_show" and row.start_date > common.day():
        raise conflict("Wait for the start date before marking a no-show.")
    row.status = target
    common.touch(row)
    common.audit(db, user, org_id, "hire", id_, target)
    await db.commit()
    return await project(db, row, app, user)


async def tasks(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    id_: uuid.UUID,
    limit: int = 20,
    offset: int = 0,
) -> s.TaskPage:
    member, job, app, row = await scope(db, user, org_id, id_, task=True)
    stmt = select(HireOnboardingItem).where(HireOnboardingItem.hire_id == id_)
    if member.role not in pipeline.MANAGERS and user.id not in {
        row.owner_id,
        row.manager_id,
        job.owner_id,
        app.assignee_id,
    }:
        stmt = stmt.where(HireOnboardingItem.owner_id == user.id)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = list(
        (
            await db.execute(
                stmt.order_by(HireOnboardingItem.due_on, HireOnboardingItem.id)
                .limit(limit)
                .offset(offset)
            )
        ).scalars()
    )
    return s.TaskPage(
        **common.page([s.TaskRead.model_validate(r) for r in rows], total or 0, limit, offset)
    )


async def task_patch(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    id_: uuid.UUID,
    task_id: uuid.UUID,
    payload: s.TaskPatch,
) -> s.TaskRead:
    member, job, app, row = await scope(db, user, org_id, id_, True, task=True)
    writable(row)
    item = (
        await db.execute(
            select(HireOnboardingItem)
            .where(HireOnboardingItem.id == task_id, HireOnboardingItem.hire_id == id_)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if item is None:
        raise not_found()
    full = member.role in pipeline.MANAGERS or user.id in {
        job.owner_id,
        row.owner_id,
        row.manager_id,
    }
    changes = payload.model_dump(exclude_unset=True, exclude={"expected_version"})
    if not full and (
        item.owner_id != user.id
        or set(changes) - {"status", "note"}
        or changes.get("status") == "waived"
    ):
        raise forbidden("Assignees may update only their own status and note, not waive tasks.")
    if any(changes.get(key, "absent") is None for key in ("status", "due_on")):
        raise validation_error("Status and due date cannot be null.")
    if all(getattr(item, k) == v for k, v in changes.items()):
        return s.TaskRead.model_validate(item)
    common.expect(item, payload.expected_version)
    if changes.get("owner_id"):
        await pipeline.eligible_assignee(db, org_id, changes["owner_id"])
    for key, value in changes.items():
        setattr(item, key, value)
    common.touch(item)
    common.audit(db, user, org_id, "hire", id_, "checklist_changed")
    await db.commit()
    return s.TaskRead.model_validate(item)


async def documents(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    id_: uuid.UUID,
    limit: int = 20,
    offset: int = 0,
) -> s.DocumentPage:
    await scope(db, user, org_id, id_, private=True)
    stmt = select(HireDocument).where(HireDocument.hire_id == id_)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = list(
        (
            await db.execute(
                stmt.order_by(HireDocument.created_at, HireDocument.id).limit(limit).offset(offset)
            )
        ).scalars()
    )
    return s.DocumentPage(
        **common.page([s.DocumentRead.model_validate(r) for r in rows], total or 0, limit, offset)
    )


async def document_create(
    db: AsyncSession, user: User, org_id: uuid.UUID, id_: uuid.UUID, payload: s.DocumentCreate
) -> s.DocumentRead:
    _, _, _, hire = await scope(db, user, org_id, id_, True, private=True)
    old = (
        await db.execute(
            select(HireDocument).where(
                HireDocument.hire_id == id_, HireDocument.request_id == payload.request_id
            )
        )
    ).scalar_one_or_none()
    if old:
        common.retry(old, common.digest(payload))
        return s.DocumentRead.model_validate(old)
    writable(hire)
    row = HireDocument(
        hire_id=id_,
        requested_by=user.id,
        fingerprint=common.digest(payload),
        **payload.model_dump(),
    )
    db.add(row)
    await db.flush()
    common.audit(db, user, org_id, "document", row.id, "requested")
    await db.commit()
    return s.DocumentRead.model_validate(row)


async def document_patch(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    id_: uuid.UUID,
    document_id: uuid.UUID,
    payload: s.DocumentPatch,
) -> s.DocumentRead:
    _, _, _, hire = await scope(db, user, org_id, id_, True, private=True)
    row = (
        await db.execute(
            select(HireDocument)
            .where(HireDocument.id == document_id, HireDocument.hire_id == id_)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if row is None:
        raise not_found()
    target = {
        "attach": "received",
        "verify": "verified",
        "reject": "rejected",
        "expire": "expired",
    }[payload.action]
    if (
        row.status == target
        and (payload.action != "attach" or row.file_id == payload.file_id)
        and (payload.action != "reject" or row.review_reason == payload.reason)
    ):
        return s.DocumentRead.model_validate(row)
    writable(hire)
    common.expect(row, payload.expected_version)
    if payload.action == "attach":
        if row.status not in {"requested", "rejected"}:
            raise conflict("Only requested or rejected documents can receive attachments.")
        assert payload.file_id is not None
        await common.personal_document(db, user, payload.file_id)
        row.file_id = payload.file_id
        row.reviewed_at = row.reviewed_by = row.review_reason = None
    elif payload.action in {"verify", "reject"}:
        if row.status != "received":
            raise conflict("Only received documents can be reviewed.")
        from app.models.file import File

        file = await db.get(File, row.file_id)
        if (
            file is None
            or file.deleted_at
            or file.purged_at
            or file.scan_status != "clean"
            or file.upload_status != "ready"
        ):
            raise conflict("The document is not ready and clean.", "FILE_NOT_READY")
        row.reviewed_at, row.reviewed_by, row.review_reason = common.now(), user.id, payload.reason
    elif row.status == "expired":
        raise conflict("Document is already expired.")
    row.status = target
    common.touch(row)
    common.audit(db, user, org_id, "document", row.id, target)
    await db.commit()
    return s.DocumentRead.model_validate(row)


async def document_download(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    id_: uuid.UUID,
    document_id: uuid.UUID,
    storage: Storage,
) -> FileDownloadRead:
    await scope(db, user, org_id, id_, private=True)
    row = (
        await db.execute(
            select(HireDocument).where(HireDocument.id == document_id, HireDocument.hire_id == id_)
        )
    ).scalar_one_or_none()
    if row is None or row.status not in {"received", "verified"}:
        raise not_found()
    return await common.download(db, user, row.file_id, storage, org_id, "document", row.id)
