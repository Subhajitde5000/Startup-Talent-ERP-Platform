"""Step 9h. Personal grants only; no authority derived from pipeline/deal stages.

Room locks serialize approvals, revocation, expiry, policy and content reads.
Audit counts successful authenticated content retrievals, not page impressions.
No reusable investor signed URLs are issued.
"""

import hashlib
import ipaddress
import uuid
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.config import get_settings
from app.core.exceptions import AppException, conflict, forbidden, not_found
from app.models.activity import ActivityEventType
from app.models.data_room import DataRoom, DataRoomDocument, DataRoomDocumentVersion, DataRoomFolder
from app.models.data_room_access import DataRoomAccessRequest, DocumentView
from app.models.file import File
from app.models.organization import MemberStatus, Organization, OrganizationMember
from app.models.user import User, UserRole, UserRoleRow
from app.schemas.data_room import Page
from app.schemas.data_room_access import AccessCreate, AccessDecision, AccessRead, NDAAcceptance
from app.services import activity_service, organization_service
from app.services import data_room_service as core
from app.services.file_service import enforce_limit
from app.services.investor_deal_service import _investor_org_or_404
from app.services.storage_service import Storage, StorageInvalid, StorageMissing


def access_audit(
    db: AsyncSession, room: DataRoom, user: User | None, row: DataRoomAccessRequest, action: str
) -> None:
    activity_service.record(
        db,
        event_type=ActivityEventType.data_room_access_changed,
        summary="Data room access changed.",
        org_id=room.org_id,
        actor_id=user.id if user else None,
        entity_type="data_room_access_request",
        entity_id=row.id,
        data={"action": action},
    )


async def investor(db: AsyncSession, user: User, *, write: bool = False) -> Organization:
    role = (
        await db.execute(
            select(UserRoleRow.user_id).where(
                UserRoleRow.user_id == user.id,
                UserRoleRow.role == UserRole.investor,
                UserRoleRow.revoked_at.is_(None),
            )
        )
    ).first()
    if role is None:
        raise forbidden()
    org = await _investor_org_or_404(db, user)
    await organization_service.require_membership(
        db, org.id, user, roles=core.WRITERS if write else None
    )
    return org


async def room_active(db: AsyncSession, org_id: uuid.UUID) -> DataRoom:
    await organization_service.startup_org_or_404(db, org_id)
    room = await core.room_for_org(db, org_id, lock=True)
    if not room.is_active:
        raise not_found("Data room not found.")
    return room


async def expire(db: AsyncSession, room: DataRoom) -> None:
    # Caller holds the room lock. Preserve the transition even if a later read is refused.
    rows = (
        (
            await db.execute(
                select(DataRoomAccessRequest).where(
                    DataRoomAccessRequest.data_room_id == room.id,
                    DataRoomAccessRequest.status.in_(["pending", "approved"]),
                    DataRoomAccessRequest.expires_at <= core.now(),
                )
            )
        )
        .scalars()
        .all()
    )
    for row in rows:
        row.status = "expired"
        access_audit(db, room, None, row, "expired")
    await db.flush()


async def create_request(
    db: AsyncSession, user: User, payload: AccessCreate
) -> DataRoomAccessRequest:
    org = await investor(db, user, write=True)
    await enforce_limit(
        f"data_room_request:{user.id}", get_settings().DATA_ROOM_REQUEST_LIMIT, 3600
    )
    room = await room_active(db, payload.startup_org_id)
    await expire(db, room)
    row = (
        await db.execute(
            select(DataRoomAccessRequest).where(
                DataRoomAccessRequest.data_room_id == room.id,
                DataRoomAccessRequest.requester_id == user.id,
                DataRoomAccessRequest.status.in_(["pending", "approved"]),
            )
        )
    ).scalar_one_or_none()
    if row is None:
        row = DataRoomAccessRequest(
            data_room_id=room.id,
            requester_id=user.id,
            requester_org=org.id,
            message=payload.message,
            scope=[],
            expires_at=core.now() + timedelta(days=30),
        )
        db.add(row)
        await db.flush()
        access_audit(db, room, user, row, "requested")
    await db.commit()
    return row


async def own_request(
    db: AsyncSession,
    user: User,
    request_id: uuid.UUID,
    *,
    write: bool = False,
    active: bool = False,
) -> tuple[DataRoom, DataRoomAccessRequest]:
    org = await investor(db, user, write=write)
    # Do not lock before confirming personal ownership (no lock-based ID oracle).
    room_org = (
        await db.execute(
            select(DataRoom.org_id)
            .join(DataRoomAccessRequest, DataRoomAccessRequest.data_room_id == DataRoom.id)
            .where(
                DataRoomAccessRequest.id == request_id,
                DataRoomAccessRequest.requester_id == user.id,
                DataRoomAccessRequest.requester_org == org.id,
            )
        )
    ).scalar_one_or_none()
    if room_org is None:
        raise not_found("Access request not found.")
    await organization_service.startup_org_or_404(db, room_org)
    room = await core.room_for_org(db, room_org, lock=True)
    if active and not room.is_active:
        raise not_found("Data room not found.")
    await expire(db, room)
    row = (
        await db.execute(
            select(DataRoomAccessRequest).where(DataRoomAccessRequest.id == request_id)
        )
    ).scalar_one()
    return room, row


async def decide(
    db: AsyncSession, user: User, org_id: uuid.UUID, request_id: uuid.UUID, payload: AccessDecision
) -> DataRoomAccessRequest:
    await core.startup_access(db, user, org_id, manage=True)
    await core.write_limit(user, org_id)
    room = await core.room_for_org(db, org_id, lock=True)
    await expire(db, room)
    row = (
        await db.execute(
            select(DataRoomAccessRequest).where(
                DataRoomAccessRequest.id == request_id,
                DataRoomAccessRequest.data_room_id == room.id,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise not_found("Access request not found.")
    expected = "approved" if payload.action == "revoke" else "pending"
    target = {"approve": "approved", "deny": "denied", "revoke": "revoked"}[payload.action]
    if row.status != expected:
        # Expiry transitions must persist even when the requested action is stale.
        await db.commit()
        raise conflict("This access request cannot make that transition.")
    if payload.action == "approve":
        if not room.is_active:
            raise conflict("Inactive rooms cannot grant access.")
        assert payload.scope
        for folder_id in payload.scope:
            try:
                await core.folder_in_room(db, room, folder_id)
            except AppException as exc:
                if exc.status_code == 404:
                    core.bad("scope", "Every folder must belong to this room.")
                raise
        expiry = payload.expires_at or core.now() + timedelta(days=30)
        if not core.now() < expiry <= core.now() + timedelta(days=365):
            core.bad("expires_at", "Expiry must be in the future and within 365 days.")
        row.scope, row.expires_at = sorted(str(v) for v in payload.scope), expiry
        row.nda_required = room.nda_required
        if room.nda_required:
            if not room.nda_file_id:
                raise conflict("Configure a ready legal PDF before approving NDA-protected access.")
            file = await core.usable_file(db, room, room.nda_file_id, nda=True)
            row.nda_file_id, row.nda_checksum = file.id, file.checksum_sha256
    row.status, row.decided_by, row.decided_at = target, user.id, core.now()
    access_audit(db, room, user, row, target)
    await db.commit()
    return row


async def require_effective(
    db: AsyncSession, user: User, room: DataRoom, *, nda: bool = True
) -> DataRoomAccessRequest:
    org = await investor(db, user)
    await expire(db, room)
    row = (
        await db.execute(
            select(DataRoomAccessRequest).where(
                DataRoomAccessRequest.data_room_id == room.id,
                DataRoomAccessRequest.requester_id == user.id,
                DataRoomAccessRequest.requester_org == org.id,
                DataRoomAccessRequest.status == "approved",
                DataRoomAccessRequest.expires_at > core.now(),
            )
        )
    ).scalar_one_or_none()
    if row is None or (nda and row.nda_required and row.nda_signed_at is None):
        await db.commit()
        raise not_found("Data room not found.")
    if row.nda_required:
        file = await db.get(File, row.nda_file_id)
        if (
            file is None
            or file.deleted_at
            or file.purged_at
            or file.scan_status != "clean"
            or file.upload_status != "ready"
            or file.checksum_sha256 != row.nda_checksum
        ):
            raise not_found("Data room not found.")
    return row


async def accept_nda(
    db: AsyncSession, user: User, request_id: uuid.UUID, payload: NDAAcceptance
) -> DataRoomAccessRequest:
    await enforce_limit(f"data_room_nda:{user.id}", get_settings().DATA_ROOM_NDA_LIMIT, 300)
    room, row = await own_request(db, user, request_id, write=True, active=True)
    effective = await require_effective(db, user, room, nda=False)
    if effective.id != row.id:
        raise not_found("Access request is not effective.")
    if (
        not row.nda_required
        or row.nda_file_id != payload.nda_file_id
        or row.nda_checksum != payload.nda_checksum
    ):
        raise conflict("Agreement does not match this grant's pinned NDA.")
    if row.nda_signed_at:
        if row.nda_legal_name != payload.legal_name:
            raise conflict("NDA evidence is immutable.")
        return row
    row.nda_legal_name, row.nda_signed_at = payload.legal_name, core.now()
    row.nda_agreed, row.purpose_agreed = True, True
    activity_service.record(
        db,
        event_type=ActivityEventType.data_room_nda_accepted,
        summary="Data room NDA acknowledged.",
        org_id=room.org_id,
        actor_id=user.id,
        entity_type="data_room_access_request",
        entity_id=row.id,
    )
    await db.commit()
    return row


async def read_bytes(storage: Storage, file: File) -> bytes:
    # Existing processor limits bound this in-memory proxy to at most 25 MiB.
    if (
        file.deleted_at
        or file.purged_at
        or file.upload_status != "ready"
        or file.scan_status != "clean"
    ):
        raise not_found("File not available.")
    try:
        data, mime = await storage.read(file.storage_key, 25 * 1024 * 1024)
    except (StorageMissing, StorageInvalid, OSError):
        raise AppException("STORAGE_UNAVAILABLE", "Private storage is unavailable.", 503) from None
    if (
        len(data) != file.byte_size
        or hashlib.sha256(data).hexdigest() != file.checksum_sha256
        or mime != file.mime_type
    ):
        raise AppException("STORAGE_UNAVAILABLE", "Private storage is unavailable.", 503)
    return data


async def content(
    db: AsyncSession,
    user: User,
    document_id: uuid.UUID,
    storage: Storage,
    *,
    version_id: uuid.UUID | None,
    ip: str | None,
    user_agent: str | None,
) -> tuple[bytes, str]:
    await enforce_limit(f"data_room_content:{user.id}", get_settings().DATA_ROOM_CONTENT_LIMIT, 300)
    await enforce_limit(f"file_download:{user.id}", get_settings().FILE_DOWNLOAD_LIMIT, 300)
    org_id = (
        await db.execute(
            select(DataRoom.org_id)
            .join(DataRoomFolder, DataRoomFolder.data_room_id == DataRoom.id)
            .join(DataRoomDocument, DataRoomDocument.folder_id == DataRoomFolder.id)
            .where(DataRoomDocument.id == document_id)
        )
    ).scalar_one_or_none()
    if org_id is None:
        raise not_found()
    await organization_service.startup_org_or_404(db, org_id)
    room = await core.room_for_org(db, org_id, lock=True)
    membership = (
        await db.execute(
            select(OrganizationMember.id).where(
                OrganizationMember.org_id == org_id,
                OrganizationMember.user_id == user.id,
                OrganizationMember.status == MemberStatus.active,
                OrganizationMember.deleted_at.is_(None),
            )
        )
    ).first()
    doc = await core.document_in_room(db, room, document_id)
    if not membership:
        if not room.is_active:
            raise not_found()
        grant = await require_effective(db, user, room)
        if doc.visibility != "approved_investors" or str(doc.folder_id) not in grant.scope:
            raise not_found()
    query = select(DataRoomDocumentVersion).where(DataRoomDocumentVersion.document_id == doc.id)
    if version_id:
        query = query.where(DataRoomDocumentVersion.id == version_id)
    else:
        query = query.where(DataRoomDocumentVersion.version_number == doc.version_number)
    version = (await db.execute(query)).scalar_one_or_none()
    if version is None or (not membership and version.version_number != doc.version_number):
        raise not_found()
    file = await db.get(File, version.file_id)
    if file is None or file.owner_org_id != org_id:
        raise not_found()
    data = await read_bytes(storage, file)
    try:
        safe_ip = str(ipaddress.ip_address(ip)) if ip else None
    except ValueError:
        safe_ip = None
    db.add(
        DocumentView(
            document_id=doc.id,
            version_id=version.id,
            viewer_id=user.id,
            ip=safe_ip,
            user_agent=user_agent[:512] if user_agent else None,
        )
    )
    doc.view_count += 1
    # Fail closed if the audit write cannot commit. The room lock serializes revoke.
    await db.commit()
    return data, file.mime_type


async def list_own_requests(
    db: AsyncSession,
    user: User,
    *,
    status: str | None,
    limit: int,
    offset: int,
    startup_org_id: uuid.UUID | None = None,
):
    org = await investor(db, user)
    # Expire only this requester's rooms, with deterministic lock ordering.
    rooms = (
        (
            await db.execute(
                select(DataRoom)
                .join(DataRoomAccessRequest, DataRoomAccessRequest.data_room_id == DataRoom.id)
                .where(
                    DataRoomAccessRequest.requester_id == user.id,
                    DataRoomAccessRequest.requester_org == org.id,
                    DataRoomAccessRequest.status.in_(["pending", "approved"]),
                    DataRoomAccessRequest.expires_at <= core.now(),
                )
                .distinct()
                .order_by(DataRoom.id)
            )
        )
        .scalars()
        .all()
    )
    for room in rooms:
        await core.room_for_org(db, room.org_id, lock=True)
        await expire(db, room)
    query = select(DataRoomAccessRequest).where(
        DataRoomAccessRequest.requester_id == user.id, DataRoomAccessRequest.requester_org == org.id
    )
    if startup_org_id:
        query = query.join(DataRoom, DataRoom.id == DataRoomAccessRequest.data_room_id).where(
            DataRoom.org_id == startup_org_id
        )
    if status:
        query = query.where(DataRoomAccessRequest.status == status)
    result = await core.page(
        db,
        query.order_by(DataRoomAccessRequest.created_at.desc(), DataRoomAccessRequest.id),
        AccessRead,
        limit,
        offset,
    )
    await db.commit()
    return await present_page(db, result)


async def nda_content(
    db: AsyncSession, user: User, request_id: uuid.UUID, storage: Storage
) -> tuple[bytes, str]:
    await enforce_limit(f"data_room_content:{user.id}", get_settings().DATA_ROOM_CONTENT_LIMIT, 300)
    room, row = await own_request(db, user, request_id, active=True)
    effective = await require_effective(db, user, room, nda=False)
    if effective.id != row.id:
        raise not_found("Access request is not effective.")
    if not row.nda_file_id:
        raise not_found("NDA not found.")
    file = await db.get(File, row.nda_file_id)
    if file is None or file.owner_org_id != room.org_id or file.checksum_sha256 != row.nda_checksum:
        raise not_found()
    data = await read_bytes(storage, file)
    activity_service.record(
        db,
        event_type=ActivityEventType.data_room_access_changed,
        summary="Pinned data room NDA retrieved.",
        org_id=room.org_id,
        actor_id=user.id,
        entity_type="data_room_access_request",
        entity_id=row.id,
        data={"action": "nda_retrieved"},
    )
    await db.commit()
    return data, file.mime_type


async def present_requests(db: AsyncSession, rows: list[AccessRead]) -> list[AccessRead]:
    """Authorized callers only; one bounded join, no public-directory visibility dependency."""
    if not rows:
        return []
    startup, firm = aliased(Organization), aliased(Organization)
    names = (
        (
            await db.execute(
                select(
                    DataRoomAccessRequest.id,
                    startup.id.label("startup_org_id"),
                    startup.name.label("startup_name"),
                    User.display_name.label("requester_name"),
                    firm.name.label("requester_org_name"),
                )
                .join(DataRoom, DataRoom.id == DataRoomAccessRequest.data_room_id)
                .join(startup, startup.id == DataRoom.org_id)
                .join(User, User.id == DataRoomAccessRequest.requester_id)
                .outerjoin(firm, firm.id == DataRoomAccessRequest.requester_org)
                .where(DataRoomAccessRequest.id.in_([r.id for r in rows]))
            )
        )
        .mappings()
        .all()
    )
    indexed = {r["id"]: dict(r) for r in names}
    return [
        row.model_copy(update={k: v for k, v in indexed.get(row.id, {}).items() if k != "id"})
        for row in rows
    ]


async def present_request(db: AsyncSession, row: DataRoomAccessRequest) -> AccessRead:
    return (await present_requests(db, [AccessRead.model_validate(row)]))[0]


async def present_page(db: AsyncSession, page: Page) -> Page:
    page.items = await present_requests(db, page.items)
    return page
