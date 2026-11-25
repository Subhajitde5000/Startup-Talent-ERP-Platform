"""Shared 7f–7h mechanics, reusing existing hiring/auth/file/audit policies."""

import hashlib
import json
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any, Protocol

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import conflict, not_found, validation_error
from app.models.activity import ActivityEventType
from app.models.file import File
from app.models.job import Job
from app.models.job_application import ApplicationStageEvent, JobApplication
from app.models.organization import Organization
from app.models.user import User
from app.schemas.file import FileDownloadRead
from app.services import activity_service, file_service, job_application_service, job_service
from app.services import applicant_pipeline_service as pipeline
from app.services.storage_service import Storage


class Fingerprinted(Protocol):
    fingerprint: str


class Versioned(Protocol):
    version: int
    updated_at: datetime


def now() -> datetime:
    return datetime.now(UTC)


def day() -> date:
    return now().date()


def digest(payload: BaseModel) -> str:
    def canonical(value: Any) -> Any:
        if isinstance(value, Decimal):
            return str(value.normalize())
        if isinstance(value, datetime):
            return value.astimezone(UTC).isoformat()
        if isinstance(value, (date, uuid.UUID)):
            return str(value)
        if isinstance(value, dict):
            return {
                k: canonical(v)
                for k, v in value.items()
                if k not in {"expected_version", "request_id"}
            }
        if isinstance(value, list):
            return [canonical(v) for v in value]
        return value

    return hashlib.sha256(
        json.dumps(canonical(payload.model_dump()), sort_keys=True).encode()
    ).hexdigest()


def retry(row: Fingerprinted, fingerprint: str) -> None:
    if row.fingerprint != fingerprint:
        raise conflict("This request key was used with different input.", "IDEMPOTENCY_CONFLICT")


def expect(row: Versioned, version: int) -> None:
    if row.version != version:
        raise conflict("This record changed. Reload before retrying.", "STALE_VERSION")


def touch(row: Versioned) -> None:
    row.version += 1
    row.updated_at = now()


def audit(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    kind: str,
    entity_id: uuid.UUID,
    action: str,
    *,
    anonymous: bool = False,
) -> None:
    event = {
        "interview": ActivityEventType.interview_changed,
        "offer": ActivityEventType.job_offer_changed,
        "hire": ActivityEventType.hire_changed,
        "template": ActivityEventType.onboarding_template_changed,
        "document": ActivityEventType.hire_document_changed,
    }[kind]
    activity_service.record(
        db,
        event_type=event,
        summary=f"Hiring {kind} changed.",
        org_id=org_id,
        actor_id=None if anonymous else user.id,
        entity_type=kind,
        entity_id=entity_id,
        data={"action": action},
    )


async def seeker(db: AsyncSession, user: User, write: bool = False) -> None:
    await job_application_service.require_seeker(db, user)
    settings = get_settings()
    await file_service.enforce_limit(
        f"applicant_{'write' if write else 'read'}:{user.id}",
        settings.APPLICANT_WRITE_LIMIT if write else settings.APPLICANT_READ_LIMIT,
        60,
    )


async def sensitive(user: User) -> None:
    await file_service.enforce_limit(
        f"hiring_sensitive:{user.id}", get_settings().APPLICANT_WRITE_LIMIT, 60
    )


async def own_application(
    db: AsyncSession, user: User, app_id: uuid.UUID, *, lock: bool = False
) -> tuple[Job, JobApplication]:
    app = await job_application_service.own(db, user, app_id)
    job = await job_service._job(
        db, uuid.UUID(app.job_snapshot["org_id"]), app.job_id, lock=lock, include_archived=True
    )
    org = await db.get(Organization, job.org_id)
    if org is None or org.deleted_at is not None or org.status != "active":
        raise not_found()
    if lock:
        app = await job_application_service.own(db, user, app_id, lock=True)
    return job, app


def active_application(app: JobApplication) -> None:
    if app.deleted_at or app.stage in pipeline.TERMINAL:
        raise conflict("This application is read-only.", "APPLICATION_READ_ONLY")


def label(app: JobApplication) -> str:
    return f"Candidate {app.id}" if app.is_blind else app.profile_snapshot["contact"]["name"]


def stage(db: AsyncSession, user: User, job: Job, app: JobApplication, value: str) -> None:
    if app.stage == value:
        return
    before = app.stage
    app.stage = value
    app.stage_changed_at = app.updated_at = now()
    db.add(
        ApplicationStageEvent(
            application_id=app.id,
            from_stage=before,
            to_stage=value,
            actor_id=user.id,
            created_at=app.stage_changed_at,
        )
    )
    pipeline.audit(db, user, job, ActivityEventType.application_stage_changed, app.id)


async def personal_document(db: AsyncSession, user: User, file_id: uuid.UUID) -> File:
    row = await file_service.file_access(db, user, file_id)
    if (
        row.owner_org_id is not None
        or row.uploaded_by != user.id
        or row.kind not in {"legal", "document"}
    ):
        raise validation_error("Attach your own private legal/document file.")
    if row.upload_status != "ready" or row.scan_status != "clean" or row.purged_at:
        raise conflict("File is not ready and clean.", "FILE_NOT_READY")
    return row


async def download(
    db: AsyncSession,
    user: User,
    file_id: uuid.UUID | None,
    storage: Storage,
    org_id: uuid.UUID,
    kind: str,
    entity_id: uuid.UUID,
) -> FileDownloadRead:
    row = await db.get(File, file_id) if file_id else None
    if row is None or row.owner_org_id is not None or row.kind not in {"legal", "document"}:
        raise not_found("Document unavailable.")
    await file_service.enforce_limit(
        f"file_download:{user.id}", get_settings().FILE_DOWNLOAD_LIMIT, 300
    )
    url, expires = await file_service.sign_ready_download(row, "original", storage)
    audit(db, user, org_id, kind, entity_id, "document_downloaded")
    await db.commit()
    return FileDownloadRead(url=url, expires_in=expires)


def page(items: list, total: int, limit: int, offset: int) -> dict[str, Any]:
    return dict(
        items=items, total=total, limit=limit, offset=offset, has_more=offset + len(items) < total
    )


async def cancel_pending(
    db: AsyncSession, user: User, app: JobApplication, org_id: uuid.UUID
) -> None:
    """Called under the application lock by withdrawal/rejection, in the same transaction."""
    from sqlalchemy import select

    from app.models.hiring_workflow import Interview, JobOffer

    interviews = (
        await db.execute(
            select(Interview)
            .where(
                Interview.application_id == app.id, Interview.status.in_(["scheduled", "confirmed"])
            )
            .order_by(Interview.id)
            .with_for_update()
        )
    ).scalars()
    for row in interviews:
        row.status, row.cancelled_reason = "cancelled", "Application closed."
        touch(row)
        audit(
            db,
            user,
            org_id,
            "interview",
            row.id,
            "application_closed",
            anonymous=app.is_blind and user.id == app.applicant_id,
        )
    offers = (
        await db.execute(
            select(JobOffer)
            .where(
                JobOffer.application_id == app.id,
                JobOffer.deleted_at.is_(None),
                JobOffer.status.in_(["draft", "sent", "countered"]),
            )
            .order_by(JobOffer.id)
            .with_for_update()
        )
    ).scalars()
    for offer in offers:
        offer.status = "withdrawn"
        touch(offer)
        audit(
            db,
            user,
            org_id,
            "offer",
            offer.id,
            "application_closed",
            anonymous=app.is_blind and user.id == app.applicant_id,
        )


async def manager_role(db: AsyncSession, user: User, org_id: uuid.UUID) -> bool:
    """Request-local memo; callers have already passed the active hiring authorization guard."""
    from sqlalchemy import select

    from app.models.organization import OrganizationMember

    key = ("hiring_manager", user.id, org_id)
    if key not in db.info:
        role = await db.scalar(
            select(OrganizationMember.role).where(
                OrganizationMember.org_id == org_id,
                OrganizationMember.user_id == user.id,
                OrganizationMember.status == "active",
                OrganizationMember.deleted_at.is_(None),
            )
        )
        db.info[key] = role in pipeline.MANAGERS
    return bool(db.info[key])
