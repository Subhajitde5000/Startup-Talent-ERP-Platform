"""Immutable approved offer versions and applicant-only responses/comparison."""

import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import conflict, forbidden, not_found, validation_error
from app.models.hiring_workflow import JobOffer, JobOfferApproval, OfferDeclineReason
from app.models.job import Job, JobBenefit
from app.models.job_application import JobApplication
from app.models.organization import Organization, OrganizationMember
from app.models.user import User
from app.schemas import hiring_workflow as s
from app.schemas.file import FileDownloadRead
from app.services import applicant_pipeline_service as pipeline
from app.services import hiring_workflow_service as common
from app.services.storage_service import Storage

ACTIONABLE = {"draft", "sent", "countered"}


def effective(row: JobOffer) -> str:
    return (
        "expired"
        if row.status in {"sent", "countered"} and row.expires_on < common.day()
        else row.status
    )


def project(
    row: JobOffer, staff: bool = False, app: JobApplication | None = None, job: Job | None = None
) -> s.OfferRead:
    values = {k: getattr(row, k) for k in s.OfferRead.model_fields if hasattr(row, k)}
    values["status"] = effective(row)
    values["document_available"] = row.document_file_id is not None
    if staff:
        values.update(
            owner_id=row.owner_id,
            created_by=row.created_by,
            submitted_at=row.submitted_at,
            applicant_label=common.label(app) if app else "Candidate",
            pipeline_writable=bool(
                job
                and app
                and job.deleted_at is None
                and job.status != "closed"
                and app.stage not in pipeline.TERMINAL
            ),
        )
    return (s.StaffOfferRead if staff else s.OfferRead).model_validate(values)


async def scope(
    db: AsyncSession,
    user: User,
    id_: uuid.UUID,
    org_id: uuid.UUID | None = None,
    write: bool = False,
) -> tuple[Job, JobApplication, JobOffer]:
    if org_id:
        member = await pipeline.authorize(db, user, org_id, write=write)
        hit = (
            await db.execute(
                select(JobOffer, JobApplication.job_id)
                .join(JobApplication, JobApplication.id == JobOffer.application_id)
                .join(Job, Job.id == JobApplication.job_id)
                .where(JobOffer.id == id_, Job.org_id == org_id, JobOffer.deleted_at.is_(None))
            )
        ).one_or_none()
        if hit is None:
            raise not_found()
        _, job, app = await pipeline.scoped(
            db, user, org_id, hit.job_id, hit.JobOffer.application_id, write=write, _member=member
        )
        row = hit.JobOffer
    else:
        await common.seeker(db, user, write)
        row = (
            await db.execute(
                select(JobOffer)
                .join(JobApplication, JobApplication.id == JobOffer.application_id)
                .where(
                    JobOffer.id == id_,
                    JobApplication.applicant_id == user.id,
                    JobApplication.deleted_at.is_(None),
                    JobOffer.deleted_at.is_(None),
                    JobOffer.sent_at.is_not(None),
                )
            )
        ).scalar_one_or_none()
        if row is None:
            raise not_found()
        job, app = await common.own_application(db, user, row.application_id, lock=write)
    if write:
        row = (
            await db.execute(
                select(JobOffer)
                .where(JobOffer.id == id_)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
        ).scalar_one()
    return job, app, row


def valid_dates(payload: s.OfferTerms | JobOffer) -> None:
    if payload.expires_on < common.day() or payload.start_date <= common.day():
        raise validation_error("Expiry cannot be in the past and start date must be in the future.")


def actionable(row: JobOffer, app: JobApplication) -> None:
    common.active_application(app)
    if row.superseded_at is not None or effective(row) not in {"sent", "countered"}:
        raise conflict("This offer is not actionable.", "OFFER_READ_ONLY")


async def snapshot(db: AsyncSession, job: Job, app: JobApplication) -> dict:
    benefits = list(
        (
            await db.execute(
                select(JobBenefit.label)
                .where(JobBenefit.job_id == job.id)
                .order_by(JobBenefit.display_order)
            )
        ).scalars()
    )
    return {
        **app.job_snapshot,
        "title": job.title,
        "location": job.location,
        "work_mode": job.work_mode,
        "employment_type": job.employment_type,
        "benefits": benefits,
    }


async def create(
    db: AsyncSession, user: User, org_id: uuid.UUID, payload: s.OfferCreate
) -> s.OfferRead:
    await common.sensitive(user)
    app = await db.get(JobApplication, payload.application_id)
    if app is None:
        await pipeline.authorize(db, user, org_id, write=True)
        raise not_found()
    _, job, app = await pipeline.scoped(db, user, org_id, app.job_id, app.id, write=True)
    old = (
        await db.execute(
            select(JobOffer).where(
                JobOffer.application_id == app.id, JobOffer.request_id == payload.request_id
            )
        )
    ).scalar_one_or_none()
    if old:
        common.retry(old, common.digest(payload))
        if old.deleted_at:
            raise conflict("This request created an archived offer.")
        return project(old, True, app, job)
    pipeline.writable(job, app)
    if app.stage not in {"shortlisted", "interview", "offered"}:
        raise conflict("Shortlist or interview this application before offering.")
    valid_dates(payload)
    live = (
        await db.execute(
            select(JobOffer).where(
                JobOffer.application_id == app.id,
                JobOffer.deleted_at.is_(None),
                JobOffer.superseded_at.is_(None),
                JobOffer.status.in_([*ACTIONABLE, "accepted"]),
            )
        )
    ).scalar_one_or_none()
    if live:
        if effective(live) == "expired":
            live.status = "expired"
            common.touch(live)
            await db.flush()
        else:
            raise conflict("This application already has a live offer.", "OFFER_EXISTS")
    if payload.document_file_id:
        await common.personal_document(db, user, payload.document_file_id)
    version = (
        await db.scalar(
            select(func.max(JobOffer.terms_version)).where(JobOffer.application_id == app.id)
        )
        or 0
    ) + 1
    row = JobOffer(
        **payload.model_dump(exclude={"request_id"}),
        request_id=payload.request_id,
        fingerprint=common.digest(payload),
        created_by=user.id,
        owner_id=user.id,
        terms_version=version,
        job_snapshot=await snapshot(db, job, app),
    )
    db.add(row)
    await db.flush()
    common.audit(db, user, org_id, "offer", row.id, "created")
    await db.commit()
    return project(row, True, app, job)


async def listing(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID | None = None,
    *,
    status: s.OfferStatus | None = None,
    application_id: uuid.UUID | None = None,
    submitted: bool | None = None,
    limit: int = 20,
    offset: int = 0,
) -> s.StaffOfferPage | s.OfferPage:
    stmt = (
        select(JobOffer, JobApplication, Job)
        .join(JobApplication, JobApplication.id == JobOffer.application_id)
        .join(Job, Job.id == JobApplication.job_id)
        .join(Organization, Organization.id == Job.org_id)
        .where(
            JobOffer.deleted_at.is_(None),
            JobApplication.deleted_at.is_(None),
            Organization.status == "active",
            Organization.deleted_at.is_(None),
        )
    )
    if org_id:
        member = await pipeline.authorize(db, user, org_id)
        stmt = stmt.where(Job.org_id == org_id)
        if member.role not in pipeline.MANAGERS:
            stmt = stmt.where(or_(Job.owner_id == user.id, JobApplication.assignee_id == user.id))
    else:
        await common.seeker(db, user)
        stmt = stmt.where(JobApplication.applicant_id == user.id, JobOffer.sent_at.is_not(None))
    if status == "expired":
        stmt = stmt.where(
            or_(
                JobOffer.status == "expired",
                JobOffer.status.in_(["sent", "countered"]) & (JobOffer.expires_on < common.day()),
            )
        )
    elif status:
        stmt = stmt.where(JobOffer.status == status)
        if status in {"sent", "countered"}:
            stmt = stmt.where(JobOffer.expires_on >= common.day())
    if submitted is not None:
        stmt = stmt.where(
            JobOffer.submitted_at.is_not(None) if submitted else JobOffer.submitted_at.is_(None)
        )
    if application_id:
        stmt = stmt.where(JobOffer.application_id == application_id)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = list(
        (
            await db.execute(
                stmt.order_by(JobOffer.created_at.desc(), JobOffer.id.desc())
                .limit(limit)
                .offset(offset)
            )
        ).all()
    )
    return (s.StaffOfferPage if org_id else s.OfferPage)(
        **common.page(
            [project(row, bool(org_id), app, job) for row, app, job in rows],
            total or 0,
            limit,
            offset,
        )
    )


async def get(
    db: AsyncSession, user: User, id_: uuid.UUID, org_id: uuid.UUID | None = None
) -> s.OfferRead:
    job, app, row = await scope(db, user, id_, org_id)
    return project(row, bool(org_id), app, job)


async def patch(
    db: AsyncSession, user: User, org_id: uuid.UUID, id_: uuid.UUID, payload: s.OfferPatch
) -> s.OfferRead:
    job, app, row = await scope(db, user, id_, org_id, True)
    pipeline.writable(job, app)
    values = payload.model_dump(exclude={"expected_version"})
    if "document_file_id" not in payload.model_fields_set:
        values.pop("document_file_id", None)
    if all(getattr(row, key) == value for key, value in values.items()):
        return project(row, True, app, job)
    common.expect(row, payload.expected_version)
    if row.status != "draft" or row.submitted_at or row.superseded_at:
        raise conflict("Submitted offer terms are immutable. Create a revision.", "OFFER_LOCKED")
    valid_dates(payload)
    if payload.document_file_id:
        await common.personal_document(db, user, payload.document_file_id)
    for key, value in values.items():
        setattr(row, key, value)
    row.job_snapshot = await snapshot(db, job, app)
    common.touch(row)
    common.audit(db, user, org_id, "offer", id_, "edited")
    await db.commit()
    return project(row, True, app, job)


async def archive(db: AsyncSession, user: User, org_id: uuid.UUID, id_: uuid.UUID) -> None:
    job, app, row = await scope(db, user, id_, org_id, True)
    pipeline.writable(job, app)
    if row.status != "draft" or row.submitted_at:
        raise conflict("Only unsubmitted drafts may be archived.")
    row.deleted_at = common.now()
    common.audit(db, user, org_id, "offer", id_, "archived")
    await db.commit()


async def approver(db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID) -> None:
    await pipeline.eligible_assignee(db, org_id, user_id)
    member = (
        await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.org_id == org_id,
                OrganizationMember.user_id == user_id,
                OrganizationMember.status == "active",
                OrganizationMember.deleted_at.is_(None),
            )
        )
    ).scalar_one()
    if member.role not in pipeline.MANAGERS:
        raise validation_error("Approvers must be active organization owners or admins.")


async def submit(
    db: AsyncSession, user: User, org_id: uuid.UUID, id_: uuid.UUID, payload: s.ApprovalRequest
) -> s.OfferRead:
    job, app, row = await scope(db, user, id_, org_id, True)
    pipeline.writable(job, app)
    approvals = list(
        (
            await db.execute(select(JobOfferApproval).where(JobOfferApproval.offer_id == id_))
        ).scalars()
    )
    if (
        row.submitted_at
        and row.submitted_by == user.id
        and {p.approver_id for p in approvals} == set(payload.approver_ids)
    ):
        return project(row, True, app, job)
    common.expect(row, payload.expected_version)
    if row.status != "draft" or row.submitted_at or row.superseded_at:
        raise conflict("This version has already been submitted or is terminal.")
    if row.created_by in payload.approver_ids or user.id in payload.approver_ids:
        raise validation_error("Authors and submitters cannot approve their own offer.")
    valid_dates(row)
    for id_approver in payload.approver_ids:
        await approver(db, org_id, id_approver)
    # Refresh once on submission; this snapshot never changes after submission.
    row.job_snapshot = await snapshot(db, job, app)
    row.submitted_at, row.submitted_by = common.now(), user.id
    db.add_all([JobOfferApproval(offer_id=row.id, approver_id=id_) for id_ in payload.approver_ids])
    common.touch(row)
    common.audit(db, user, org_id, "offer", row.id, "approval_requested")
    await db.commit()
    return project(row, True, app, job)


async def approvals(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    id_: uuid.UUID,
    limit: int = 20,
    offset: int = 0,
) -> s.ApprovalPage:
    await scope(db, user, id_, org_id)
    stmt = select(JobOfferApproval).where(JobOfferApproval.offer_id == id_)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = list(
        (await db.execute(stmt.order_by(JobOfferApproval.id).limit(limit).offset(offset))).scalars()
    )
    return s.ApprovalPage(
        **common.page([s.ApprovalRead.model_validate(r) for r in rows], total or 0, limit, offset)
    )


async def decide(
    db: AsyncSession, user: User, org_id: uuid.UUID, id_: uuid.UUID, payload: s.ApprovalDecision
) -> s.OfferRead:
    job, app, row = await scope(db, user, id_, org_id, True)
    pipeline.writable(job, app)
    await approver(db, org_id, user.id)
    if user.id in {row.created_by, row.submitted_by}:
        raise forbidden("Authors/submitters cannot approve their own offer.")
    approval = (
        await db.execute(
            select(JobOfferApproval).where(
                JobOfferApproval.offer_id == id_, JobOfferApproval.approver_id == user.id
            )
        )
    ).scalar_one_or_none()
    if approval is None:
        raise not_found()
    if approval.status == payload.decision and approval.note == payload.note:
        return project(row, True, app, job)
    common.expect(row, payload.expected_version)
    if (
        row.status != "draft"
        or not row.submitted_at
        or row.superseded_at
        or approval.status != "pending"
    ):
        raise conflict("This approval is immutable or no longer actionable.")
    approval.status, approval.note, approval.decided_at = (
        payload.decision,
        payload.note,
        common.now(),
    )
    common.touch(row)
    common.audit(db, user, org_id, "offer", id_, "approval_decided")
    await db.commit()
    return project(row, True, app, job)


async def send(
    db: AsyncSession, user: User, org_id: uuid.UUID, id_: uuid.UUID, payload: s.Expected
) -> s.OfferRead:
    job, app, row = await scope(db, user, id_, org_id, True)
    if row.status == "sent" and row.sent_at:
        return project(row, True, app, job)
    pipeline.writable(job, app)
    common.expect(row, payload.expected_version)
    if row.status != "draft" or not row.submitted_at or row.superseded_at:
        raise conflict("Only a submitted draft may be sent.")
    valid_dates(row)
    approvals = list(
        (
            await db.execute(select(JobOfferApproval).where(JobOfferApproval.offer_id == id_))
        ).scalars()
    )
    if not approvals or any(a.status != "approved" or a.approver_id is None for a in approvals):
        raise conflict("Every assigned approver must approve first.", "APPROVAL_REQUIRED")
    for approval in approvals:
        assert approval.approver_id is not None
        await approver(db, org_id, approval.approver_id)
    if row.document_file_id:
        # Sender may differ from author; validate ready file without granting generic access.
        from app.models.file import File

        file = await db.get(File, row.document_file_id)
        if (
            file is None
            or file.deleted_at
            or file.purged_at
            or file.owner_org_id
            or file.upload_status != "ready"
            or file.scan_status != "clean"
        ):
            raise conflict("The offer document is not ready.", "FILE_NOT_READY")
    row.status, row.sent_at = "sent", common.now()
    app.is_blind = False
    common.stage(db, user, job, app, "offered")
    common.touch(row)
    common.audit(db, user, org_id, "offer", id_, "sent")
    await db.commit()
    return project(row, True, app, job)


async def withdraw(
    db: AsyncSession, user: User, org_id: uuid.UUID, id_: uuid.UUID, payload: s.Expected
) -> s.OfferRead:
    job, app, row = await scope(db, user, id_, org_id, True)
    if row.status == "withdrawn":
        return project(row, True, app, job)
    common.expect(row, payload.expected_version)
    if row.status not in ACTIONABLE or row.superseded_at:
        raise conflict("Only actionable offers may be withdrawn.")
    row.status = "withdrawn"
    common.touch(row)
    common.audit(db, user, org_id, "offer", id_, "withdrawn")
    await db.commit()
    return project(row, True, app, job)


async def revision(
    db: AsyncSession, user: User, org_id: uuid.UUID, id_: uuid.UUID, payload: s.OfferRevision
) -> s.OfferRead:
    job, app, row = await scope(db, user, id_, org_id, True)
    old = (
        await db.execute(
            select(JobOffer).where(
                JobOffer.application_id == app.id, JobOffer.request_id == payload.request_id
            )
        )
    ).scalar_one_or_none()
    if old:
        common.retry(old, common.digest(payload))
        if old.parent_offer_id != row.id:
            raise conflict("Request key belongs to a different parent offer.")
        return project(old, True, app, job)
    pipeline.writable(job, app)
    common.expect(row, payload.expected_version)
    if row.superseded_at or row.status == "accepted":
        raise conflict("Accepted/superseded offers cannot be revised.")
    valid_dates(payload)
    if payload.document_file_id:
        await common.personal_document(db, user, payload.document_file_id)
    live = await db.scalar(
        select(JobOffer.id).where(
            JobOffer.application_id == app.id,
            JobOffer.id != id_,
            JobOffer.deleted_at.is_(None),
            JobOffer.superseded_at.is_(None),
            JobOffer.status.in_([*ACTIONABLE, "accepted"]),
        )
    )
    if live:
        raise conflict("A newer live offer exists.")
    row.superseded_at = common.now()
    common.touch(row)
    await db.flush()
    version = (
        await db.scalar(
            select(func.max(JobOffer.terms_version)).where(JobOffer.application_id == app.id)
        )
        or 0
    ) + 1
    new = JobOffer(
        application_id=app.id,
        **payload.model_dump(exclude={"expected_version", "request_id"}),
        request_id=payload.request_id,
        fingerprint=common.digest(payload),
        parent_offer_id=id_,
        created_by=user.id,
        owner_id=user.id,
        terms_version=version,
        job_snapshot=await snapshot(db, job, app),
    )
    db.add(new)
    await db.flush()
    common.audit(db, user, org_id, "offer", new.id, "revised")
    await db.commit()
    return project(new, True, app, job)


async def expire(
    db: AsyncSession, user: User, org_id: uuid.UUID, id_: uuid.UUID, payload: s.Expected
) -> s.OfferRead:
    job, app, row = await scope(db, user, id_, org_id, True)
    if row.status == "expired":
        return project(row, True, app, job)
    common.expect(row, payload.expected_version)
    if row.status not in {"sent", "countered"} or row.expires_on >= common.day():
        raise conflict("Only overdue sent/countered offers can expire.")
    row.status = "expired"
    common.touch(row)
    common.audit(db, user, org_id, "offer", id_, "expired")
    await db.commit()
    return project(row, True, app, job)


async def respond(
    db: AsyncSession, user: User, id_: uuid.UUID, payload: s.OfferResponse
) -> s.OfferRead:
    await common.sensitive(user)
    job, app, row = await scope(db, user, id_, write=True)
    target = "accepted" if payload.action == "accept" else "declined"
    if (
        row.status == target
        and row.decline_reason_id == payload.decline_reason_id
        and row.decline_detail == payload.decline_detail
    ):
        return project(row)
    common.expect(row, payload.expected_version)
    actionable(row, app)
    if payload.action == "accept" and row.start_date < common.day():
        raise conflict("The proposed start date is in the past.")
    if payload.decline_reason_id:
        reason = await db.get(OfferDeclineReason, payload.decline_reason_id)
        if reason is None or not reason.is_active:
            raise validation_error("Select an active decline reason.")
    row.status, row.responded_at = target, common.now()
    row.decline_reason_id, row.decline_detail = payload.decline_reason_id, payload.decline_detail
    common.touch(row)
    common.audit(db, user, job.org_id, "offer", id_, target)
    await db.commit()
    return project(row)


async def counter(
    db: AsyncSession, user: User, id_: uuid.UUID, payload: s.OfferCounter
) -> s.OfferRead:
    await common.sensitive(user)
    job, app, row = await scope(db, user, id_, write=True)
    if row.status == "countered" and row.counter_note == payload.note:
        return project(row)
    common.expect(row, payload.expected_version)
    actionable(row, app)
    if row.status != "sent":
        raise conflict("An offer can only be countered once. Wait for a revision.")
    row.status, row.counter_note, row.responded_at = "countered", payload.note, common.now()
    common.touch(row)
    common.audit(db, user, job.org_id, "offer", id_, "countered")
    await db.commit()
    return project(row)


async def compare(db: AsyncSession, user: User, ids: list[uuid.UUID]) -> s.OfferPage:
    if len(set(ids)) != len(ids):
        raise validation_error("Select distinct offers.")
    rows = [await get(db, user, id_) for id_ in ids]
    return s.OfferPage(**common.page(rows, len(rows), len(rows), 0))


async def reasons(
    db: AsyncSession, user: User, limit: int = 20, offset: int = 0
) -> s.DeclineReasonPage:
    await common.seeker(db, user)
    stmt = select(OfferDeclineReason).where(OfferDeclineReason.is_active.is_(True))
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = list(
        (
            await db.execute(stmt.order_by(OfferDeclineReason.code).limit(limit).offset(offset))
        ).scalars()
    )
    return s.DeclineReasonPage(
        **common.page(
            [s.DeclineReasonRead.model_validate(r) for r in rows], total or 0, limit, offset
        )
    )


async def document(
    db: AsyncSession, user: User, id_: uuid.UUID, storage: Storage, org_id: uuid.UUID | None = None
) -> FileDownloadRead:
    job, app, row = await scope(db, user, id_, org_id)
    return await common.download(db, user, row.document_file_id, storage, job.org_id, "offer", id_)
