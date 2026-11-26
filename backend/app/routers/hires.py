"""Step 7h hire and onboarding routes.

Five prefixes, matching how each resource is addressed:

- ``/offers/{id}/hire``                          create a hire from an
  accepted offer (org derived from the offer row).
- ``/organizations/{org_id}/hires``              employer list
- ``/hires/{id}``                                detail, PATCH, onboarding
  checklist and documents (org derived from the hire row)
- ``/documents/{id}``                            PATCH and download
- ``/organizations/{org_id}/onboarding-templates``  org template CRUD

Thin layer per AGENTS.md section 3: parse, call the service, return the
schema. Authorization — including the 404-instead-of-403 rule for foreign
row ids — lives in ``hire_service``.
"""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.hire import HireStatus
from app.models.organization import Department
from app.models.user import User
from app.routers.files import FileRoute
from app.routers.jobs import _ErrorResponse
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
    TemplatePage,
    TemplateRead,
    TemplateUpdate,
)
from app.schemas.job import JobAction
from app.services import hire_service
from app.services.storage_service import Storage, get_storage


class HireRoute(FileRoute):
    """Hire metadata is small; keep the shared bounded-body guard."""

    max_body_bytes = 32 * 1024
    body_limit_message = "Hire metadata exceeds 32 KiB."


_RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {"model": _ErrorResponse, "description": "Missing or invalid authentication"},
    403: {
        "model": _ErrorResponse,
        "description": "Hiring role, membership or action permission required",
    },
    404: {
        "model": _ErrorResponse,
        "description": "Resource unavailable or outside the authorized scope",
    },
    409: {
        "model": _ErrorResponse,
        "description": "Duplicate hire, offer not accepted or invalid state",
    },
    413: {"model": _ErrorResponse, "description": "Metadata exceeds 32 KiB"},
    422: {"model": _ErrorResponse, "description": "Invalid fields or foreign references"},
    429: {"model": _ErrorResponse, "description": "Hire rate limit"},
}

offer_router = APIRouter(
    route_class=HireRoute,
    prefix="/offers",
    tags=["hires"],
    responses=_RESPONSES,
)
org_router = APIRouter(
    route_class=HireRoute,
    prefix="/organizations/{org_id}",
    tags=["hires"],
    responses=_RESPONSES,
)
hire_router = APIRouter(
    route_class=HireRoute,
    prefix="/hires",
    tags=["hires"],
    responses=_RESPONSES,
)
document_router = APIRouter(
    route_class=HireRoute,
    prefix="/documents",
    tags=["hires"],
    responses=_RESPONSES,
)

_EMPTY = JobAction()

DB = Annotated[AsyncSession, Depends(get_db)]
Actor = Annotated[User, Depends(get_current_user)]
Store = Annotated[Storage, Depends(get_storage)]
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


@offer_router.post(
    "/{offer_id}/hire",
    response_model=HireRead,
    status_code=201,
    summary="Turn an accepted offer into a hire",
)
async def create_hire(
    offer_id: uuid.UUID, payload: HireCreate, db: DB, user: Actor
) -> HireRead:
    """Owner/admin only; the offer must be accepted (409) and the
    application not already hired (409 on the unique application_id).
    ``template_id``/``manager_id``/``owner_id`` must reference this
    organization (422). Defaults follow plan D12."""
    return await hire_service.create_hire(db, user, offer_id, payload)


@org_router.get(
    "/hires",
    response_model=HirePage,
    summary="List this organization's hires",
)
async def list_hires(
    org_id: uuid.UUID,
    db: DB,
    user: Actor,
    status: HireStatus | None = None,
    department: Department | None = None,
    limit: Limit = 20,
    offset: Offset = 0,
) -> HirePage:
    """Owner/admin/member; outsider organizations get 403 (org-path
    contract), foreign hire ids on the bare routes get 404."""
    return await hire_service.list_hires(
        db, user, org_id, status=status, department=department,
        limit=limit, offset=offset,
    )


@hire_router.get(
    "/{hire_id}",
    response_model=HireRead,
    summary="Get one hire",
)
async def get_hire(hire_id: uuid.UUID, db: DB, user: Actor) -> HireRead:
    """Membership comes from the hire's organization; outsiders get 404."""
    return await hire_service.hire_detail(db, user, hire_id)


@hire_router.patch(
    "/{hire_id}",
    response_model=HireRead,
    summary="Edit a hire or move its onboarding status",
)
async def patch_hire(
    hire_id: uuid.UUID, payload: HireUpdate, db: DB, user: Actor
) -> HireRead:
    """Owner/admin only. Status moves follow the hire lifecycle table
    (pending -> onboarding -> active; no_show/cancelled are dead ends)."""
    return await hire_service.patch_hire(db, user, hire_id, payload)


@hire_router.get(
    "/{hire_id}/onboarding-items",
    response_model=OnboardingItemPage,
    summary="List a hire's onboarding checklist",
)
async def onboarding_items(
    hire_id: uuid.UUID, db: DB, user: Actor, limit: Limit = 50, offset: Offset = 0
) -> OnboardingItemPage:
    """Copied from the template at hire creation; section/title are
    snapshots and never client-writable."""
    return await hire_service.onboarding_items(
        db, user, hire_id, limit=limit, offset=offset
    )


@hire_router.patch(
    "/{hire_id}/onboarding-items/{item_id}",
    response_model=OnboardingItemRead,
    summary="Update one checklist item (owner, due date, status, note)",
)
async def patch_onboarding_item(
    hire_id: uuid.UUID,
    item_id: uuid.UUID,
    payload: OnboardingItemUpdate,
    db: DB,
    user: Actor,
) -> OnboardingItemRead:
    """Owner/admin only; ``owner_id`` must be an active member (422)."""
    return await hire_service.patch_onboarding_item(
        db, user, hire_id, item_id, payload
    )


@hire_router.post(
    "/{hire_id}/documents",
    response_model=HireDocumentRead,
    status_code=201,
    summary="Request a hire document (optionally attaching a file)",
)
async def create_document(
    hire_id: uuid.UUID, payload: HireDocumentCreate, db: DB, user: Actor
) -> HireDocumentRead:
    """Owner/admin only; ``file_id`` must be a ready, clean organization
    document file (422). The initial status is server-owned (``requested``)."""
    return await hire_service.create_document(db, user, hire_id, payload)


@hire_router.get(
    "/{hire_id}/documents",
    response_model=HireDocumentPage,
    summary="List a hire's documents",
)
async def list_documents(
    hire_id: uuid.UUID, db: DB, user: Actor, limit: Limit = 50, offset: Offset = 0
) -> HireDocumentPage:
    return await hire_service.list_documents(
        db, user, hire_id, limit=limit, offset=offset
    )


@document_router.patch(
    "/{document_id}",
    response_model=HireDocumentRead,
    summary="Update a hire document (metadata, status or attached file)",
)
async def patch_document(
    document_id: uuid.UUID, payload: HireDocumentUpdate, db: DB, user: Actor
) -> HireDocumentRead:
    """Owner/admin only; status moves follow requested -> received ->
    verified/rejected, with ``expired`` reachable from any live state."""
    return await hire_service.patch_document(db, user, document_id, payload)


@document_router.post(
    "/{document_id}/download",
    response_model=FileDownloadRead,
    summary="Request a short-lived download URL for a hire document",
)
async def download_document(
    document_id: uuid.UUID,
    db: DB,
    user: Actor,
    storage: Store,
    payload: JobAction = _EMPTY,
    disposition: Annotated[str, Query(pattern="^(attachment|inline)$")] = "attachment",
) -> FileDownloadRead:
    """Only the attached, ready/clean organization file; outsiders get
    404 and there is no generic file access through this route."""
    return await hire_service.document_download(
        db, user, document_id, storage, inline=(disposition == "inline")
    )


@org_router.get(
    "/onboarding-templates",
    response_model=TemplatePage,
    summary="List this organization's onboarding templates",
)
async def list_templates(
    org_id: uuid.UUID,
    db: DB,
    user: Actor,
    q: Annotated[str | None, Query(max_length=120)] = None,
    limit: Limit = 20,
    offset: Offset = 0,
) -> TemplatePage:
    return await hire_service.list_templates(
        db, user, org_id, q=q, limit=limit, offset=offset
    )


@org_router.post(
    "/onboarding-templates",
    response_model=TemplateRead,
    status_code=201,
    summary="Create an onboarding template",
)
async def create_template(
    org_id: uuid.UUID, payload: TemplateCreate, db: DB, user: Actor
) -> TemplateRead:
    """Owner/admin only; ``is_platform`` is never client-writable (422).
    ``display_order`` is the posted list position (server-owned)."""
    return await hire_service.create_template(db, user, org_id, payload)


@org_router.get(
    "/onboarding-templates/{template_id}",
    response_model=TemplateRead,
    summary="Get one onboarding template with its items",
)
async def template_detail(
    org_id: uuid.UUID, template_id: uuid.UUID, db: DB, user: Actor
) -> TemplateRead:
    """Foreign template ids are 404 (no oracle)."""
    return await hire_service.template_detail(db, user, org_id, template_id)


@org_router.patch(
    "/onboarding-templates/{template_id}",
    response_model=TemplateRead,
    summary="Rename a template or replace its checklist items",
)
async def patch_template(
    org_id: uuid.UUID,
    template_id: uuid.UUID,
    payload: TemplateUpdate,
    db: DB,
    user: Actor,
) -> TemplateRead:
    """Owner/admin only; a posted ``items`` list replaces the whole set
    (the 7e criteria pattern)."""
    return await hire_service.patch_template(
        db, user, org_id, template_id, payload
    )
