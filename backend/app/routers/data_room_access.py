"""Step 9h: scoped access, immutable NDA acknowledgments and authenticated bytes."""

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select

from app.core.exceptions import not_found
from app.models.data_room import DataRoomDocument, DataRoomFolder
from app.models.data_room_access import DataRoomAccessRequest, DocumentView
from app.routers.data_room import DB, Actor, Limit, Offset
from app.routers.files import FileRoute
from app.schemas.data_room import Page
from app.schemas.data_room_access import (
    AccessCreate,
    AccessDecision,
    AccessRead,
    InvestorDocumentRead,
    InvestorFolderRead,
    InvestorRoomRead,
    NDAAcceptance,
    ViewRead,
)
from app.services import data_room_access_service as service
from app.services import data_room_service as core
from app.services.storage_service import Storage, get_storage

router = APIRouter(
    tags=["data-room-access"],
    route_class=FileRoute,
    responses={
        401: {"description": "Authentication required"},
        403: {"description": "Insufficient role"},
        404: {"description": "Resource absent or inaccessible"},
        409: {"description": "Invalid lifecycle transition or NDA mismatch"},
        413: {"description": "Metadata exceeds 8 KiB"},
        422: {"description": "Invalid input"},
        429: {"description": "Rate limit exceeded"},
        503: {"description": "Storage unavailable"},
    },
)
Store = Annotated[Storage, Depends(get_storage)]
S = "/organizations/{org_id}/data-room"
INVESTOR_REQUESTS = "/investors/data-room-access-requests"
Status = Literal["pending", "approved", "denied", "expired", "revoked"]


def private_bytes(data: bytes, mime: str) -> Response:
    # Inline is only a presentation hint, NOT DRM/no-download enforcement.
    return Response(
        data,
        media_type=mime,
        headers={
            "Cache-Control": "private, no-store",
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox; default-src 'none'",
            "Referrer-Policy": "no-referrer",
        },
    )


@router.post(
    INVESTOR_REQUESTS,
    status_code=201,
    response_model=AccessRead,
    summary="Request personal data-room access (idempotent while open)",
)
async def create_request(payload: AccessCreate, db: DB, user: Actor):
    return await service.present_request(db, await service.create_request(db, user, payload))


@router.get(
    INVESTOR_REQUESTS,
    response_model=Page[AccessRead],
    summary="List only your own data-room requests",
)
async def own_requests(
    db: DB,
    user: Actor,
    status: Status | None = None,
    limit: Limit = 20,
    offset: Offset = 0,
    startup_org_id: uuid.UUID | None = None,
):
    return await service.list_own_requests(
        db, user, status=status, limit=limit, offset=offset, startup_org_id=startup_org_id
    )


@router.get(
    INVESTOR_REQUESTS + "/{request_id}",
    response_model=AccessRead,
    summary="Read your own request and pinned NDA identity",
)
async def own_request(request_id: uuid.UUID, db: DB, user: Actor):
    _, row = await service.own_request(db, user, request_id)
    await db.commit()
    return await service.present_request(db, row)


@router.get(
    S + "/access-requests",
    response_model=Page[AccessRead],
    summary="List requests to your startup's room",
)
async def startup_requests(
    org_id: uuid.UUID,
    db: DB,
    user: Actor,
    status: Status | None = None,
    limit: Limit = 20,
    offset: Offset = 0,
):
    await core.startup_access(db, user, org_id, manage=True)
    room = await core.room_for_org(db, org_id, lock=True)
    await service.expire(db, room)
    query = select(DataRoomAccessRequest).where(DataRoomAccessRequest.data_room_id == room.id)
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
    return await service.present_page(db, result)


@router.post(
    S + "/access-requests/{request_id}/decisions",
    response_model=AccessRead,
    summary="Approve, deny or revoke through the access state machine",
)
async def decide(
    org_id: uuid.UUID, request_id: uuid.UUID, payload: AccessDecision, db: DB, user: Actor
):
    return await service.present_request(
        db, await service.decide(db, user, org_id, request_id, payload)
    )


@router.get(
    INVESTOR_REQUESTS + "/{request_id}/nda-content",
    response_class=Response,
    summary="Read the exact NDA pinned to your approval",
    responses={200: {"content": {"application/pdf": {}}}},
)
async def nda_content(request_id: uuid.UUID, db: DB, user: Actor, storage: Store) -> Response:
    data, mime = await service.nda_content(db, user, request_id, storage)
    return private_bytes(data, mime)


@router.post(
    INVESTOR_REQUESTS + "/{request_id}/nda-acceptances",
    response_model=AccessRead,
    summary="Acknowledge the exact pinned NDA (not certified e-signature)",
)
async def accept_nda(request_id: uuid.UUID, payload: NDAAcceptance, db: DB, user: Actor):
    return await service.present_request(
        db, await service.accept_nda(db, user, request_id, payload)
    )


@router.get(
    "/investors/data-rooms/{startup_org_id}",
    response_model=InvestorRoomRead,
    summary="Read a room only with effective personal approval",
)
async def investor_room(startup_org_id: uuid.UUID, db: DB, user: Actor):
    room = await service.room_active(db, startup_org_id)
    grant = await service.require_effective(db, user, room)
    assert grant.expires_at is not None
    return InvestorRoomRead(
        id=room.id,
        org_id=room.org_id,
        name=room.name,
        access_request_id=grant.id,
        expires_at=grant.expires_at,
    )


@router.get(
    "/investors/data-rooms/{startup_org_id}/folders",
    response_model=Page[InvestorFolderRead],
    summary="List only explicitly approved folders",
)
async def investor_folders(
    startup_org_id: uuid.UUID, db: DB, user: Actor, limit: Limit = 20, offset: Offset = 0
):
    room = await service.room_active(db, startup_org_id)
    grant = await service.require_effective(db, user, room)
    query = (
        select(DataRoomFolder)
        .where(
            DataRoomFolder.data_room_id == room.id,
            DataRoomFolder.deleted_at.is_(None),
            DataRoomFolder.id.in_([uuid.UUID(v) for v in grant.scope]),
        )
        .order_by(DataRoomFolder.display_order, DataRoomFolder.id)
    )
    return await core.page(db, query, InvestorFolderRead, limit, offset)


@router.get(
    "/investors/data-rooms/{startup_org_id}/documents",
    response_model=Page[InvestorDocumentRead],
    summary="List only current documents visible under your grant",
)
async def investor_documents(
    startup_org_id: uuid.UUID,
    db: DB,
    user: Actor,
    folder_id: uuid.UUID | None = None,
    limit: Limit = 20,
    offset: Offset = 0,
):
    room = await service.room_active(db, startup_org_id)
    grant = await service.require_effective(db, user, room)
    if folder_id and str(folder_id) not in grant.scope:
        raise not_found("Folder not found.")
    query = (
        select(DataRoomDocument)
        .join(DataRoomFolder, DataRoomFolder.id == DataRoomDocument.folder_id)
        .where(
            DataRoomFolder.data_room_id == room.id,
            DataRoomFolder.deleted_at.is_(None),
            DataRoomDocument.deleted_at.is_(None),
            DataRoomDocument.visibility == "approved_investors",
            DataRoomDocument.folder_id.in_([uuid.UUID(v) for v in grant.scope]),
        )
    )
    if folder_id:
        query = query.where(DataRoomDocument.folder_id == folder_id)
    return await core.page(
        db,
        query.order_by(DataRoomDocument.created_at.desc(), DataRoomDocument.id),
        InvestorDocumentRead,
        limit,
        offset,
    )


@router.get(
    "/data-room-documents/{document_id}/content",
    response_class=Response,
    summary="Retrieve authorized bytes; every successful retrieval is audited",
    responses={200: {"content": {"application/pdf": {}, "application/octet-stream": {}}}},
)
async def content(
    document_id: uuid.UUID,
    request: Request,
    db: DB,
    user: Actor,
    storage: Store,
    version_id: uuid.UUID | None = None,
) -> Response:
    data, mime = await service.content(
        db,
        user,
        document_id,
        storage,
        version_id=version_id,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return private_bytes(data, mime)


@router.get(
    S + "/document-views",
    response_model=Page[ViewRead],
    summary="Read your startup's document retrieval audit",
)
async def views(
    org_id: uuid.UUID,
    db: DB,
    user: Actor,
    document_id: uuid.UUID | None = None,
    limit: Limit = 20,
    offset: Offset = 0,
):
    await core.startup_access(db, user, org_id, manage=True)
    room = await core.room_for_org(db, org_id)
    query = (
        select(DocumentView)
        .join(DataRoomDocument, DataRoomDocument.id == DocumentView.document_id)
        .join(DataRoomFolder, DataRoomFolder.id == DataRoomDocument.folder_id)
        .where(DataRoomFolder.data_room_id == room.id)
    )
    if document_id:
        # Include deleted documents' trails without permitting cross-room references.
        match = (
            await db.execute(
                select(DataRoomDocument.id)
                .join(DataRoomFolder, DataRoomFolder.id == DataRoomDocument.folder_id)
                .where(DataRoomDocument.id == document_id, DataRoomFolder.data_room_id == room.id)
            )
        ).first()
        if not match:
            raise not_found()
        query = query.where(DocumentView.document_id == document_id)
    result = await core.page(
        db,
        query.order_by(DocumentView.viewed_at.desc(), DocumentView.id.desc()),
        ViewRead,
        limit,
        offset,
    )
    from app.models.user import User

    if result.items:
        names = (
            await db.execute(
                select(DocumentView.id, DataRoomDocument.name, User.display_name)
                .join(DataRoomDocument, DataRoomDocument.id == DocumentView.document_id)
                .outerjoin(User, User.id == DocumentView.viewer_id)
                .where(DocumentView.id.in_([r.id for r in result.items]))
            )
        ).all()
        indexed = {r.id: r for r in names}
        for row in result.items:
            row.document_name = indexed[row.id].name
            row.viewer_name = indexed[row.id].display_name
    return result
