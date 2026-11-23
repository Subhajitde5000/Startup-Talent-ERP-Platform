"""File ownership, reservations, confirmation and short-lived download grants."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import (
    AuthError,
    conflict,
    forbidden,
    not_found,
    rate_limited,
    validation_error,
)
from app.models.activity import ActivityEventType
from app.models.file import File
from app.models.organization import OrganizationMember, OrgRole
from app.models.user import User
from app.schemas.file import FilePage, FileRead, FileUploadCreate, FileUploadRead
from app.services import activity_service, organization_service
from app.services.rate_limiter import rate_limiter
from app.services.storage_service import Storage

WRITE_ROLES = {OrgRole.owner, OrgRole.admin, OrgRole.member}


def now() -> datetime:
    return datetime.now(UTC)


def aware(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


def file_prefix(row: File) -> str:
    return row.storage_key.rsplit("/", 1)[0] + "/"


def audit(
    db: AsyncSession, row: File, event: ActivityEventType, actor: uuid.UUID | None = None
) -> None:
    activity_service.record(
        db,
        event_type=event,
        summary=f"File {event.value.removeprefix('file_').replace('_', ' ')}.",
        org_id=row.owner_org_id,
        actor_id=actor,
        entity_type="file",
        entity_id=row.id,
    )


async def enforce_limit(key: str, limit: int, seconds: int) -> None:
    if not await rate_limiter.check(key, limit, seconds):
        raise rate_limited("Too many file operations. Please try again later.")


async def org_access(
    db: AsyncSession, user: User, org_id: uuid.UUID, *, write: bool = False
) -> OrganizationMember:
    org = await organization_service.org_or_404(db, org_id)
    if org.status != "active":
        raise not_found("Organization not found.")
    # Reuse the membership helper; conceal non-membership, not role denials.
    try:
        membership = await organization_service.require_membership(db, org.id, user)
    except AuthError as exc:
        if exc.status_code == 403:
            raise not_found("Organization not found.") from None
        raise
    if write and membership.role not in WRITE_ROLES:
        raise forbidden()
    return membership


async def file_access(
    db: AsyncSession, user: User, file_id: uuid.UUID, *, action: str = "read"
) -> File:
    query = select(File).where(File.id == file_id, File.deleted_at.is_(None))
    if action == "delete":
        query = query.with_for_update()
    row = (await db.execute(query)).scalar_one_or_none()
    if row is None:
        raise not_found("File not found.")
    if row.owner_org_id is not None:
        membership = await org_access(db, user, row.owner_org_id, write=action != "read")
        if (
            action in {"confirm", "delete"}
            and membership.role == OrgRole.member
            and row.uploaded_by != user.id
        ):
            raise forbidden()
    elif row.uploaded_by != user.id or not row.storage_key.startswith(f"personal/{user.id}/"):
        raise not_found("File not found.")
    return row


async def request_upload(
    db: AsyncSession,
    user: User,
    payload: FileUploadCreate,
    storage: Storage,
    org_id: uuid.UUID | None = None,
) -> FileUploadRead:
    settings = get_settings()
    # Lock the actor row to serialize reservation quotas across API instances.
    await db.execute(select(User.id).where(User.id == user.id).with_for_update())
    if org_id is not None:
        await org_access(db, user, org_id, write=True)
    await enforce_limit(f"file_upload:user:{user.id}", settings.FILE_UPLOAD_USER_LIMIT, 3600)
    if org_id is not None:
        await enforce_limit(f"file_upload:org:{org_id}", settings.FILE_UPLOAD_ORG_LIMIT, 3600)
    count = (
        await db.execute(
            select(func.count())
            .select_from(File)
            .where(
                File.uploaded_by == user.id,
                File.deleted_at.is_(None),
                or_(
                    File.upload_status == "uploaded",
                    (File.upload_status == "pending") & (File.upload_expires_at > now()),
                ),
            )
        )
    ).scalar_one()
    if count >= settings.FILE_PENDING_LIMIT:
        raise conflict("Too many unfinished uploads.", "FILE_PENDING_LIMIT")
    file_id = uuid.uuid4()
    prefix = f"organizations/{org_id}/{file_id}" if org_id else f"personal/{user.id}/{file_id}"
    staging = f"staging/{prefix}/upload"
    url = await storage.sign_upload(staging, payload.mime_type, settings.FILE_UPLOAD_TTL_SECONDS)
    row = File(
        id=file_id,
        owner_org_id=org_id,
        uploaded_by=user.id,
        kind=payload.kind.value,
        file_name=payload.file_name,
        mime_type=payload.mime_type,
        byte_size=payload.byte_size,
        storage_key=f"{prefix}/reserved",
        upload_storage_key=staging,
        upload_expires_at=now() + timedelta(seconds=settings.FILE_UPLOAD_TTL_SECONDS),
    )
    db.add(row)
    audit(db, row, ActivityEventType.file_upload_requested, user.id)
    await db.commit()
    await db.refresh(row)
    return FileUploadRead(
        file=FileRead.model_validate(row),
        upload_url=url,
        headers={"Content-Type": row.mime_type},
        expires_in=settings.FILE_UPLOAD_TTL_SECONDS,
    )


async def list_files(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID | None,
    *,
    limit: int,
    offset: int,
    kind: str | None,
    sort: str,
    order: str,
) -> FilePage:
    if org_id:
        await org_access(db, user, org_id)
        filters = [File.owner_org_id == org_id]
    else:
        filters = [
            File.owner_org_id.is_(None),
            File.uploaded_by == user.id,
            File.storage_key.startswith(f"personal/{user.id}/"),
        ]
    filters.append(File.deleted_at.is_(None))
    if kind:
        filters.append(File.kind == kind)
    total = (await db.execute(select(func.count()).select_from(File).where(*filters))).scalar_one()
    column = {"created_at": File.created_at, "file_name": File.file_name}[sort]
    rows = (
        (
            await db.execute(
                select(File)
                .where(*filters)
                .order_by(column.desc() if order == "desc" else column.asc(), File.id)
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    return FilePage(
        items=[FileRead.model_validate(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


async def confirm(db: AsyncSession, user: User, file_id: uuid.UUID) -> FileRead:
    row = await file_access(db, user, file_id, action="confirm")
    await enforce_limit(f"file_action:{user.id}", get_settings().FILE_ACTION_LIMIT, 300)
    if row.upload_status in {"expired", "rejected"}:
        raise conflict("This upload can no longer be confirmed.", "FILE_UPLOAD_CLOSED")
    if row.upload_status == "pending":
        if aware(row.upload_expires_at) <= now():
            raise conflict("The upload reservation has expired.", "FILE_UPLOAD_EXPIRED")
        result = await db.execute(
            update(File)
            .where(File.id == row.id, File.upload_status == "pending", File.deleted_at.is_(None))
            .values(upload_status="uploaded", confirmed_at=now())
            .returning(File.id)
        )
        if result.scalar_one_or_none() is not None:
            audit(db, row, ActivityEventType.file_confirmed, user.id)
        await db.commit()
        await db.refresh(row)
    return FileRead.model_validate(row)


async def download(
    db: AsyncSession, user: User, file_id: uuid.UUID, variant: str, storage: Storage
) -> tuple[str, int]:
    row = await file_access(db, user, file_id)
    settings = get_settings()
    await enforce_limit(f"file_download:{user.id}", settings.FILE_DOWNLOAD_LIMIT, 300)
    if row.upload_status != "ready" or row.scan_status != "clean":
        raise conflict("This file is not available for download.", "FILE_NOT_READY")
    key, mime, name = row.storage_key, row.mime_type, row.file_name
    if variant == "thumbnail":
        if not row.thumbnail_storage_key:
            raise not_found("Thumbnail not found.")
        key, mime, name = row.thumbnail_storage_key, "image/webp", "thumbnail.webp"
    return await storage.sign_download(
        key, name, mime, settings.FILE_DOWNLOAD_TTL_SECONDS, image=mime.startswith("image/")
    ), settings.FILE_DOWNLOAD_TTL_SECONDS


async def delete_file(db: AsyncSession, user: User, file_id: uuid.UUID) -> None:
    row = await file_access(db, user, file_id, action="delete")
    await enforce_limit(f"file_action:{user.id}", get_settings().FILE_ACTION_LIMIT, 300)
    from app.models.data_room import DataRoom, DataRoomDocumentVersion
    from app.models.data_room_access import DataRoomAccessRequest
    from app.models.organization import Organization
    from app.models.startup import StartupProfile

    # Retained versions and pinned NDA evidence must never lose their bytes.
    references = (
        select(DataRoomDocumentVersion.id).where(DataRoomDocumentVersion.file_id == row.id),
        select(DataRoom.id).where(DataRoom.nda_file_id == row.id),
        select(DataRoomAccessRequest.id).where(DataRoomAccessRequest.nda_file_id == row.id),
    )
    for query in references:
        if (await db.execute(query.limit(1))).first():
            raise conflict("File is retained by a data room or NDA record.", "FILE_IN_USE")

    # Soft deletion must detach selected files in the SAME transaction.
    await db.execute(
        update(Organization).where(Organization.logo_file_id == row.id).values(logo_file_id=None)
    )
    await db.execute(
        update(StartupProfile)
        .where(StartupProfile.pitch_deck_file_id == row.id)
        .values(pitch_deck_file_id=None)
    )
    row.deleted_at = now()
    audit(db, row, ActivityEventType.file_deleted, user.id)
    await db.commit()


async def require_org_attachment(
    db: AsyncSession, user: User, org_id: uuid.UUID, file_id: uuid.UUID, kind: str, field: str
) -> File:
    """Parent write permission is checked by its service; validate same-org file.

    Lock against concurrent deletion. Foreign, missing, deleted, unscanned and
    wrong-kind IDs share one field error rather than revealing file existence.
    """
    await org_access(db, user, org_id, write=True)
    row = (
        await db.execute(
            select(File)
            .where(
                File.id == file_id,
                File.owner_org_id == org_id,
                File.kind == kind,
                File.deleted_at.is_(None),
                File.purged_at.is_(None),
                File.upload_status == "ready",
                File.scan_status == "clean",
            )
            .with_for_update()
        )
    ).scalar_one_or_none()
    if row is None:
        message = f"Select a ready, clean {kind} file belonging to this organization."
        raise validation_error(
            message, details=[{"loc": ["body", field], "msg": message, "type": "value_error"}]
        )
    return row


def record_attachment_change(db: AsyncSession, user: User, org_id: uuid.UUID, field: str) -> None:
    activity_service.record(
        db,
        event_type=ActivityEventType.file_attachment_changed,
        summary="Organization file selection changed.",
        org_id=org_id,
        actor_id=user.id,
        entity_type="organization",
        entity_id=org_id,
        data={"field": field},
    )
