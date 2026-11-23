"""Step 4 file API. Authenticated scope checks live in file_service."""

import uuid
from collections.abc import Callable, Coroutine
from typing import Annotated, Any, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response
from fastapi.routing import APIRoute
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.exceptions import AppException
from app.db.session import get_db
from app.models.file import FileKind
from app.models.user import User
from app.schemas.file import (
    FileConfirmCreate,
    FileDownloadCreate,
    FileDownloadRead,
    FilePage,
    FileRead,
    FileUploadCreate,
    FileUploadRead,
)
from app.services import file_processing_service, file_service
from app.services.file_processing_service import Scanner, get_scanner
from app.services.storage_service import LocalStorage, Storage, StorageInvalid, StorageMissing, get_storage
from urllib.parse import quote


Store = Annotated[Storage, Depends(get_storage)]

# ---------------------------------------------------------------------------
# Local-storage endpoints (dev only — bypassed in production when R2 is set)
# ---------------------------------------------------------------------------
# Plain APIRoute so it can stream raw file bytes (FileRoute restricts to 8 KiB).
local_router = APIRouter(tags=["files-local"])


@local_router.put(
    "/files/local-upload/{token}",
    status_code=204,
    summary="[Dev only] Receive a local-storage upload",
    include_in_schema=False,
)
async def local_upload(token: str, request: Request, storage: Store) -> None:
    """Writes the request body to disk. Only active when LocalStorage backend is used."""
    if not isinstance(storage, LocalStorage):
        raise AppException("NOT_FOUND", "Endpoint not available.", 404)
    try:
        payload = storage.verify_upload_token(token)
    except StorageInvalid as exc:
        raise AppException("FORBIDDEN", str(exc), 403) from exc
    data = await request.body()
    await storage.put(payload["k"], data, payload["m"])


@local_router.get(
    "/files/local-serve/{token}",
    summary="[Dev only] Serve a local-storage file",
    include_in_schema=False,
)
async def local_serve(token: str, storage: Store) -> Response:
    """Streams file bytes from disk. Only active when LocalStorage backend is used."""
    if not isinstance(storage, LocalStorage):
        raise AppException("NOT_FOUND", "Endpoint not available.", 404)
    try:
        payload = storage.verify_download_token(token)
    except StorageInvalid as exc:
        raise AppException("FORBIDDEN", str(exc), 403) from exc
    try:
        data, _ = await storage.read(payload["k"], 100 * 1024 * 1024)  # 100 MB dev cap
    except StorageMissing:
        raise AppException("NOT_FOUND", "File not found.", 404)
    name = payload.get("n", "file")
    disposition = "inline" if payload.get("img") else "attachment"
    return Response(
        content=data,
        media_type=payload["m"],
        headers={
            "Content-Disposition": f'{disposition}; filename*=UTF-8\'\'{quote(name, safe="")}',
            "Cache-Control": "private, no-store",
        },
    )


class FileRoute(APIRoute):
    """These endpoints accept metadata, never multipart/file bytes."""

    def get_route_handler(self) -> Callable[[Request], Coroutine[Any, Any, Response]]:
        handler = super().get_route_handler()

        async def limited_handler(request: Request) -> Response:
            body = bytearray()
            async for chunk in request.stream():
                if len(body) + len(chunk) > 8192:
                    raise AppException("REQUEST_TOO_LARGE", "File metadata exceeds 8 KiB.", 413)
                body.extend(chunk)
            # Populate Starlette's body cache after bounded streaming so FastAPI
            # can perform its normal Pydantic validation without a second read.
            request._body = bytes(body)
            response = await handler(request)
            response.headers["Cache-Control"] = "no-store"
            return response

        return limited_handler


router = APIRouter(
    route_class=FileRoute,
    tags=["files"],
    responses={
        413: {"description": "File metadata exceeds 8 KiB."},
        401: {"description": "Missing or invalid access token."},
        403: {"description": "Insufficient role or inactive account."},
        404: {"description": "Resource absent or outside caller's scope."},
        409: {"description": "Upload lifecycle or quota conflict."},
        422: {"description": "Invalid input; see error.details."},
        429: {"description": "Rate limit exceeded."},
        503: {"description": "Private storage unavailable."},
    },
)
DB = Annotated[AsyncSession, Depends(get_db)]
Actor = Annotated[User, Depends(get_current_user)]


@router.post(
    "/users/me/files/upload-requests",
    response_model=FileUploadRead,
    status_code=201,
    summary="Reserve a private personal upload",
)
async def personal_upload(
    payload: FileUploadCreate, db: DB, user: Actor, storage: Store
) -> FileUploadRead:
    """Owner-only personal file. PUT bytes with the returned headers, then confirm."""
    return await file_service.request_upload(db, user, payload, storage)


@router.post(
    "/organizations/{org_id}/files/upload-requests",
    response_model=FileUploadRead,
    status_code=201,
    summary="Reserve a private organization upload",
)
async def org_upload(
    org_id: uuid.UUID, payload: FileUploadCreate, db: DB, user: Actor, storage: Store
) -> FileUploadRead:
    """Active owner/admin/member only. Ownership is derived from path and membership."""
    return await file_service.request_upload(db, user, payload, storage, org_id)


@router.get("/users/me/files", response_model=FilePage, summary="List your personal files")
async def personal_files(
    db: DB,
    user: Actor,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    kind: FileKind | None = None,
    sort: Literal["created_at", "file_name"] = "created_at",
    order: Literal["asc", "desc"] = "desc",
) -> FilePage:
    """Paginated personal scope only; never includes organization uploads."""
    return await file_service.list_files(
        db, user, None, limit=limit, offset=offset, kind=kind, sort=sort, order=order
    )


@router.get(
    "/organizations/{org_id}/files", response_model=FilePage, summary="List organization files"
)
async def org_files(
    org_id: uuid.UUID,
    db: DB,
    user: Actor,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    kind: FileKind | None = None,
    sort: Literal["created_at", "file_name"] = "created_at",
    order: Literal["asc", "desc"] = "desc",
) -> FilePage:
    """Any active member, including viewer. No cross-organization discovery."""
    return await file_service.list_files(
        db, user, org_id, limit=limit, offset=offset, kind=kind, sort=sort, order=order
    )


@router.get("/files/{file_id}", response_model=FileRead, summary="Read authorized file metadata")
async def get_file(file_id: uuid.UUID, db: DB, user: Actor) -> FileRead:
    """No storage keys or signed URLs are exposed in this response."""
    return FileRead.model_validate(await file_service.file_access(db, user, file_id))


@router.post(
    "/files/{file_id}/confirm",
    response_model=FileRead,
    summary="Confirm an upload and schedule validation",
)
async def confirm_file(
    file_id: uuid.UUID,
    tasks: BackgroundTasks,
    db: DB,
    user: Actor,
    storage: Store,
    scanner: Annotated[Scanner, Depends(get_scanner)],
    payload: FileConfirmCreate | None = None,
) -> FileRead:
    """Idempotent. Confirmation is not scan approval. Poll metadata for ready/clean."""
    result = await file_service.confirm(db, user, file_id)
    if result.upload_status == "uploaded":
        tasks.add_task(file_processing_service.process_in_background, file_id, scanner, storage)
    return result


@router.post(
    "/files/{file_id}/download-url",
    response_model=FileDownloadRead,
    summary="Authorize a short-lived private download",
)
async def download_file(
    file_id: uuid.UUID, payload: FileDownloadCreate, db: DB, user: Actor, storage: Store
) -> FileDownloadRead:
    """Ready and clean files only. Each URL issuance rechecks current membership."""
    url, ttl = await file_service.download(db, user, file_id, payload.variant, storage)
    return FileDownloadRead(url=url, expires_in=ttl)


@router.delete("/files/{file_id}", status_code=204, summary="Soft-delete an authorized file")
async def delete_file(file_id: uuid.UUID, db: DB, user: Actor) -> None:
    """Deny access immediately; maintenance physically purges after the retention grace."""
    await file_service.delete_file(db, user, file_id)
