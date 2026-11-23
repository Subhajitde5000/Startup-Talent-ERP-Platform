"""Step 9g startup routes. Metadata only; bytes use the existing file upload API."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.data_room import DataRoomDocument, DataRoomDocumentVersion, DataRoomFolder
from app.models.user import User
from app.routers.files import FileRoute
from app.schemas.data_room import (
    DocumentCreate,
    DocumentRead,
    DocumentUpdate,
    FolderCreate,
    FolderRead,
    FolderUpdate,
    Page,
    RoomPut,
    RoomRead,
    VersionCreate,
    VersionRead,
)
from app.services import data_room_service as service

router = APIRouter(
    prefix="/organizations/{org_id}/data-room",
    tags=["data-room"],
    route_class=FileRoute,
    responses={
        401: {"description": "Authentication required"},
        403: {"description": "Insufficient membership role"},
        404: {"description": "Resource absent or outside scope"},
        409: {"description": "State or reference conflict"},
        413: {"description": "Metadata exceeds 8 KiB"},
        422: {"description": "Invalid fields"},
        429: {"description": "Rate limit exceeded"},
    },
)
DB = Annotated[AsyncSession, Depends(get_db)]
Actor = Annotated[User, Depends(get_current_user)]
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0, le=1000000)]


@router.get("", response_model=RoomRead, summary="Read the startup's data room")
async def get_room(org_id: uuid.UUID, db: DB, user: Actor):
    await service.startup_access(db, user, org_id)
    return await service.room_for_org(db, org_id)


@router.put("", response_model=RoomRead, summary="Explicitly create or update room and NDA policy")
async def put_room(org_id: uuid.UUID, payload: RoomPut, db: DB, user: Actor):
    return await service.put_room(db, user, org_id, payload)


@router.get("/folders", response_model=Page[FolderRead], summary="List startup folders")
async def folders(org_id: uuid.UUID, db: DB, user: Actor, limit: Limit = 20, offset: Offset = 0):
    await service.startup_access(db, user, org_id)
    room = await service.room_for_org(db, org_id)
    query = (
        select(DataRoomFolder)
        .where(DataRoomFolder.data_room_id == room.id, DataRoomFolder.deleted_at.is_(None))
        .order_by(DataRoomFolder.display_order, DataRoomFolder.id)
    )
    return await service.page(db, query, FolderRead, limit, offset)


@router.post("/folders", response_model=FolderRead, status_code=201, summary="Create a folder")
async def create_folder(org_id: uuid.UUID, payload: FolderCreate, db: DB, user: Actor):
    return await service.save_folder(db, user, org_id, payload)


@router.patch(
    "/folders/{folder_id}", response_model=FolderRead, summary="Rename, reorder or move a folder"
)
async def update_folder(
    org_id: uuid.UUID, folder_id: uuid.UUID, payload: FolderUpdate, db: DB, user: Actor
):
    return await service.save_folder(db, user, org_id, payload, folder_id)


@router.delete("/folders/{folder_id}", status_code=204, summary="Soft-delete an empty folder")
async def delete_folder(org_id: uuid.UUID, folder_id: uuid.UUID, db: DB, user: Actor) -> None:
    await service.delete_folder(db, user, org_id, folder_id)


@router.get("/documents", response_model=Page[DocumentRead], summary="List startup documents")
async def documents(
    org_id: uuid.UUID,
    db: DB,
    user: Actor,
    folder_id: uuid.UUID | None = None,
    limit: Limit = 20,
    offset: Offset = 0,
):
    await service.startup_access(db, user, org_id)
    room = await service.room_for_org(db, org_id)
    if folder_id:
        await service.folder_in_room(db, room, folder_id)
    query = (
        select(DataRoomDocument)
        .join(DataRoomFolder, DataRoomFolder.id == DataRoomDocument.folder_id)
        .where(
            DataRoomFolder.data_room_id == room.id,
            DataRoomFolder.deleted_at.is_(None),
            DataRoomDocument.deleted_at.is_(None),
        )
    )
    if folder_id:
        query = query.where(DataRoomDocument.folder_id == folder_id)
    return await service.page(
        db,
        query.order_by(DataRoomDocument.created_at.desc(), DataRoomDocument.id),
        DocumentRead,
        limit,
        offset,
    )


@router.post(
    "/documents",
    response_model=DocumentRead,
    status_code=201,
    summary="Attach a ready organization file as a document",
)
async def create_document(org_id: uuid.UUID, payload: DocumentCreate, db: DB, user: Actor):
    return await service.create_document(db, user, org_id, payload)


@router.patch(
    "/documents/{document_id}",
    response_model=DocumentRead,
    summary="Update document metadata or manager-controlled visibility",
)
async def update_document(
    org_id: uuid.UUID, document_id: uuid.UUID, payload: DocumentUpdate, db: DB, user: Actor
):
    return await service.update_document(db, user, org_id, document_id, payload)


@router.delete(
    "/documents/{document_id}",
    status_code=204,
    summary="Soft-delete a document, retaining versions",
)
async def delete_document(org_id: uuid.UUID, document_id: uuid.UUID, db: DB, user: Actor) -> None:
    await service.delete_document(db, user, org_id, document_id)


@router.get(
    "/documents/{document_id}/versions",
    response_model=Page[VersionRead],
    summary="List immutable document versions",
)
async def versions(
    org_id: uuid.UUID,
    document_id: uuid.UUID,
    db: DB,
    user: Actor,
    limit: Limit = 20,
    offset: Offset = 0,
):
    await service.startup_access(db, user, org_id)
    room = await service.room_for_org(db, org_id)
    await service.document_in_room(db, room, document_id)
    return await service.page(
        db,
        select(DataRoomDocumentVersion)
        .where(DataRoomDocumentVersion.document_id == document_id)
        .order_by(DataRoomDocumentVersion.version_number.desc()),
        VersionRead,
        limit,
        offset,
    )


@router.post(
    "/documents/{document_id}/versions",
    response_model=VersionRead,
    status_code=201,
    summary="Append an immutable document version",
)
async def add_version(
    org_id: uuid.UUID, document_id: uuid.UUID, payload: VersionCreate, db: DB, user: Actor
):
    return await service.add_version(db, user, org_id, document_id, payload.file_id)
