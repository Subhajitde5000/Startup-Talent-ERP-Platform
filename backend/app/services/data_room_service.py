"""Step 9g. Lock the room before mutations to serialize hierarchy/version changes."""

import uuid
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import conflict, not_found, validation_error
from app.models.activity import ActivityEventType
from app.models.data_room import DataRoom, DataRoomDocument, DataRoomDocumentVersion, DataRoomFolder
from app.models.file import File
from app.models.organization import OrgRole
from app.models.user import User
from app.schemas.data_room import (
    DocumentCreate,
    DocumentUpdate,
    FolderCreate,
    FolderUpdate,
    Page,
    RoomPut,
)
from app.services import activity_service, organization_service
from app.services.file_service import enforce_limit, org_access

MANAGERS = {OrgRole.owner, OrgRole.admin}
WRITERS = MANAGERS | {OrgRole.member}


def now() -> datetime:
    return datetime.now(UTC)


def bad(field: str, message: str) -> None:
    raise validation_error(
        message, [{"loc": ["body", field], "msg": message, "type": "value_error"}]
    )


def audit(
    db: AsyncSession, room: DataRoom, user: User, action: str, target: uuid.UUID | None = None
) -> None:
    activity_service.record(
        db,
        event_type=ActivityEventType.data_room_changed,
        summary="Data room changed.",
        org_id=room.org_id,
        actor_id=user.id,
        entity_type="data_room",
        entity_id=room.id,
        data={"action": action, "target_id": str(target) if target else None},
    )


async def write_limit(user: User, org_id: uuid.UUID) -> None:
    settings = get_settings()
    await enforce_limit(f"data_room_write:user:{user.id}", settings.DATA_ROOM_WRITE_LIMIT, 300)
    await enforce_limit(f"data_room_write:org:{org_id}", settings.DATA_ROOM_ORG_WRITE_LIMIT, 300)


async def startup_access(
    db: AsyncSession, user: User, org_id: uuid.UUID, *, manage: bool = False, write: bool = False
) -> None:
    await organization_service.startup_org_or_404(db, org_id)
    membership = await org_access(db, user, org_id)
    if (manage and membership.role not in MANAGERS) or (write and membership.role not in WRITERS):
        from app.core.exceptions import forbidden

        raise forbidden()


async def room_for_org(db: AsyncSession, org_id: uuid.UUID, *, lock: bool = False) -> DataRoom:
    query = select(DataRoom).where(DataRoom.org_id == org_id)
    if lock:
        query = query.with_for_update()
    row = (await db.execute(query)).scalar_one_or_none()
    if row is None:
        raise not_found("Data room not found.")
    return row


async def folder_in_room(db: AsyncSession, room: DataRoom, folder_id: uuid.UUID) -> DataRoomFolder:
    row = (
        await db.execute(
            select(DataRoomFolder).where(
                DataRoomFolder.id == folder_id,
                DataRoomFolder.data_room_id == room.id,
                DataRoomFolder.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise not_found("Folder not found.")
    return row


async def document_in_room(
    db: AsyncSession, room: DataRoom, document_id: uuid.UUID
) -> DataRoomDocument:
    row = (
        await db.execute(
            select(DataRoomDocument)
            .join(DataRoomFolder, DataRoomFolder.id == DataRoomDocument.folder_id)
            .where(
                DataRoomDocument.id == document_id,
                DataRoomFolder.data_room_id == room.id,
                DataRoomFolder.deleted_at.is_(None),
                DataRoomDocument.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise not_found("Document not found.")
    return row


async def usable_file(
    db: AsyncSession, room: DataRoom, file_id: uuid.UUID, *, nda: bool = False
) -> File:
    row = (
        await db.execute(
            select(File)
            .where(
                File.id == file_id,
                File.owner_org_id == room.org_id,
                File.deleted_at.is_(None),
                File.purged_at.is_(None),
                File.upload_status == "ready",
                File.scan_status == "clean",
            )
            .with_for_update()
        )
    ).scalar_one_or_none()
    if row is None or (nda and (row.kind != "legal" or row.mime_type != "application/pdf")):
        bad(
            "nda_file_id" if nda else "file_id",
            "Select a ready, clean organization file of the required kind.",
        )
    assert row is not None
    return row


async def page(
    db: AsyncSession, query: Any, read_type: type[BaseModel], limit: int, offset: int
) -> Page[Any]:
    total = (
        await db.execute(select(func.count()).select_from(query.order_by(None).subquery()))
    ).scalar_one()
    rows = (await db.execute(query.limit(limit).offset(offset))).scalars().all()
    return Page(
        items=[read_type.model_validate(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


async def put_room(db: AsyncSession, user: User, org_id: uuid.UUID, payload: RoomPut) -> DataRoom:
    await startup_access(db, user, org_id, manage=True)
    await write_limit(user, org_id)
    # Serialize first creation on the existing organization, including concurrent PUTs.
    from app.models.organization import Organization

    await db.execute(select(Organization.id).where(Organization.id == org_id).with_for_update())
    room = (
        await db.execute(select(DataRoom).where(DataRoom.org_id == org_id).with_for_update())
    ).scalar_one_or_none()
    if room is None:
        room = DataRoom(org_id=org_id)
        db.add(room)
        await db.flush()
    data = payload.model_dump(exclude_unset=True)
    if data.get("nda_file_id") is not None:
        await usable_file(db, room, data["nda_file_id"], nda=True)
    for key, value in data.items():
        setattr(room, key, value)
    audit(db, room, user, "room_saved")
    await db.commit()
    return room


async def hierarchy(
    db: AsyncSession, room: DataRoom, parent_id: uuid.UUID | None, moving: uuid.UUID | None = None
) -> None:
    rows = list(
        (
            await db.execute(
                select(DataRoomFolder).where(
                    DataRoomFolder.data_room_id == room.id, DataRoomFolder.deleted_at.is_(None)
                )
            )
        ).scalars()
    )
    if moving is None and len(rows) >= 500:
        raise conflict("Folder limit reached.")
    parents = {r.id: r.parent_id for r in rows}
    if parent_id is not None and parent_id not in parents:
        bad("parent_id", "Parent must belong to this room.")
    marker = moving or uuid.uuid4()
    parents[marker] = parent_id
    for node in parents:
        seen: set[uuid.UUID] = set()
        cursor: uuid.UUID | None = node
        while cursor is not None:
            if cursor in seen or len(seen) >= 8:
                bad("parent_id", "Folder hierarchy must be acyclic and at most eight levels deep.")
            seen.add(cursor)
            cursor = parents.get(cursor)


async def save_folder(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    payload: FolderCreate | FolderUpdate,
    folder_id: uuid.UUID | None = None,
) -> DataRoomFolder:
    await startup_access(db, user, org_id, manage=True)
    await write_limit(user, org_id)
    room = await room_for_org(db, org_id, lock=True)
    row = await folder_in_room(db, room, folder_id) if folder_id else None
    data = payload.model_dump(exclude_unset=True)
    parent_id = data.get("parent_id", row.parent_id if row else None)
    await hierarchy(db, room, parent_id, folder_id)
    if row is None:
        assert isinstance(payload, FolderCreate)
        row = DataRoomFolder(data_room_id=room.id, **payload.model_dump())
        db.add(row)
    else:
        for key, value in data.items():
            setattr(row, key, value)
    await db.flush()
    audit(db, room, user, "folder_saved", row.id)
    await db.commit()
    return row


async def delete_folder(
    db: AsyncSession, user: User, org_id: uuid.UUID, folder_id: uuid.UUID
) -> None:
    await startup_access(db, user, org_id, manage=True)
    await write_limit(user, org_id)
    room = await room_for_org(db, org_id, lock=True)
    row = await folder_in_room(db, room, folder_id)
    children = (
        await db.execute(
            select(DataRoomFolder.id)
            .where(DataRoomFolder.parent_id == row.id, DataRoomFolder.deleted_at.is_(None))
            .limit(1)
        )
    ).first()
    documents = (
        await db.execute(
            select(DataRoomDocument.id)
            .where(DataRoomDocument.folder_id == row.id, DataRoomDocument.deleted_at.is_(None))
            .limit(1)
        )
    ).first()
    if children or documents:
        raise conflict("Only empty folders can be deleted.")
    row.deleted_at = now()
    audit(db, room, user, "folder_deleted", row.id)
    await db.commit()


async def create_document(
    db: AsyncSession, user: User, org_id: uuid.UUID, payload: DocumentCreate
) -> DataRoomDocument:
    await startup_access(db, user, org_id, write=True)
    await write_limit(user, org_id)
    room = await room_for_org(db, org_id, lock=True)
    if payload.visibility != "private":
        await startup_access(db, user, org_id, manage=True)
    await folder_in_room(db, room, payload.folder_id)
    await usable_file(db, room, payload.file_id)
    row = DataRoomDocument(**payload.model_dump(), updated_by=user.id)
    db.add(row)
    await db.flush()
    db.add(
        DataRoomDocumentVersion(
            document_id=row.id, file_id=row.file_id, version_number=1, uploaded_by=user.id
        )
    )
    audit(db, room, user, "document_created", row.id)
    await db.commit()
    return row


async def update_document(
    db: AsyncSession, user: User, org_id: uuid.UUID, document_id: uuid.UUID, payload: DocumentUpdate
) -> DataRoomDocument:
    await startup_access(db, user, org_id, write=True)
    await write_limit(user, org_id)
    room = await room_for_org(db, org_id, lock=True)
    row = await document_in_room(db, room, document_id)
    data = payload.model_dump(exclude_unset=True)
    if {"folder_id", "visibility"} & data.keys():
        await startup_access(db, user, org_id, manage=True)
    if "folder_id" in data:
        if data["folder_id"] is None:
            bad("folder_id", "Folder cannot be null.")
        await folder_in_room(db, room, data["folder_id"])
    for key, value in data.items():
        setattr(row, key, value)
    row.updated_by = user.id
    audit(db, room, user, "document_updated", row.id)
    await db.commit()
    return row


async def add_version(
    db: AsyncSession, user: User, org_id: uuid.UUID, document_id: uuid.UUID, file_id: uuid.UUID
) -> DataRoomDocumentVersion:
    await startup_access(db, user, org_id, write=True)
    await write_limit(user, org_id)
    room = await room_for_org(db, org_id, lock=True)
    row = await document_in_room(db, room, document_id)
    await usable_file(db, room, file_id)
    if row.file_id == file_id:
        return (
            await db.execute(
                select(DataRoomDocumentVersion).where(
                    DataRoomDocumentVersion.document_id == row.id,
                    DataRoomDocumentVersion.version_number == row.version_number,
                )
            )
        ).scalar_one()
    row.version_number += 1
    row.version, row.file_id, row.updated_by = f"v{row.version_number}", file_id, user.id
    version = DataRoomDocumentVersion(
        document_id=row.id, file_id=file_id, version_number=row.version_number, uploaded_by=user.id
    )
    db.add(version)
    audit(db, room, user, "version_created", row.id)
    await db.commit()
    return version


async def delete_document(
    db: AsyncSession, user: User, org_id: uuid.UUID, document_id: uuid.UUID
) -> None:
    await startup_access(db, user, org_id, manage=True)
    await write_limit(user, org_id)
    room = await room_for_org(db, org_id, lock=True)
    row = await document_in_room(db, room, document_id)
    row.deleted_at, row.updated_by = now(), user.id
    audit(db, room, user, "document_deleted", row.id)
    await db.commit()
