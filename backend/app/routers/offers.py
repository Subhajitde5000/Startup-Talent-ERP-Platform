"""Step 7g job-offer routes.

Five prefixes, matching how each resource is addressed:

- ``/organizations/{org_id}/jobs/{job_id}/applications/{id}/offers``
  create a draft inside one application (7d-style nested path).
- ``/organizations/{org_id}/offers``               employer list
- ``/offers/{id}``                                 detail, PATCH, send,
  withdraw, accept, decline (org derived from the row)
- ``/applications/{id}/offers``                    candidate's own view
- ``/offer-decline-reasons``                       seeded reason lookup

Thin layer per AGENTS.md section 3: parse, call the service, return the
schema. Authorization — including the 404-instead-of-403 rule for foreign
offer ids and the candidate's own-application rule — lives in
``offer_service``.
"""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.offer import JobOfferStatus
from app.models.user import User
from app.routers.files import FileRoute
from app.routers.jobs import _ErrorResponse
from app.schemas.job import JobAction
from app.schemas.offer import (
    OfferCreate,
    OfferDecline,
    OfferDeclineReasonRead,
    OfferPage,
    OfferRead,
    OfferUpdate,
)
from app.services import offer_service


class OfferRoute(FileRoute):
    """Offer metadata is small; keep the shared bounded-body guard."""

    max_body_bytes = 32 * 1024
    body_limit_message = "Offer metadata exceeds 32 KiB."


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
        "description": "Live offer exists, offer frozen or invalid offer state",
    },
    413: {"model": _ErrorResponse, "description": "Metadata exceeds 32 KiB"},
    422: {"model": _ErrorResponse, "description": "Invalid fields or foreign references"},
    429: {"model": _ErrorResponse, "description": "Offer rate limit"},
}

application_router = APIRouter(
    route_class=OfferRoute,
    prefix="/organizations/{org_id}/jobs/{job_id}/applications/{application_id}",
    tags=["offers"],
    responses=_RESPONSES,
)
org_router = APIRouter(
    route_class=OfferRoute,
    prefix="/organizations/{org_id}",
    tags=["offers"],
    responses=_RESPONSES,
)
offer_router = APIRouter(
    route_class=OfferRoute,
    prefix="/offers",
    tags=["offers"],
    responses=_RESPONSES,
)
candidate_router = APIRouter(
    route_class=OfferRoute,
    prefix="/applications",
    tags=["offers"],
    responses=_RESPONSES,
)
reasons_router = APIRouter(
    route_class=OfferRoute,
    prefix="/offer-decline-reasons",
    tags=["offers"],
    responses=_RESPONSES,
)

_EMPTY = JobAction()

DB = Annotated[AsyncSession, Depends(get_db)]
Actor = Annotated[User, Depends(get_current_user)]
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


@application_router.post(
    "/offers",
    response_model=OfferRead,
    status_code=201,
    summary="Create a draft offer for an applicant",
)
async def create_offer(
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    application_id: uuid.UUID,
    payload: OfferCreate,
    db: DB,
    user: Actor,
) -> OfferRead:
    """Owner/admin only; closed jobs and terminal applications are 409,
    a second live offer on the application is 409 (plan D10). Cross-org
    ``owner_id``/``document_file_id`` references are 422."""
    return await offer_service.create(
        db, user, org_id, job_id, application_id, payload
    )


@org_router.get(
    "/offers",
    response_model=OfferPage,
    summary="List this organization's job offers",
)
async def list_offers(
    org_id: uuid.UUID,
    db: DB,
    user: Actor,
    status: JobOfferStatus | None = None,
    job_id: uuid.UUID | None = None,
    application_id: uuid.UUID | None = None,
    limit: Limit = 20,
    offset: Offset = 0,
) -> OfferPage:
    """Owner/admin/member; sent offers past their expiry flip to
    ``expired`` lazily (one audit row each) before the page is built."""
    return await offer_service.list_offers(
        db,
        user,
        org_id,
        status=status,
        job_id=job_id,
        application_id=application_id,
        limit=limit,
        offset=offset,
    )


@offer_router.get(
    "/mine",
    response_model=OfferPage,
    summary="All my received offers across my applications",
)
async def my_offers(db: DB, user: Actor, limit: Limit = 20, offset: Offset = 0) -> OfferPage:
    """Candidate aggregate (plan G2): own applications only, drafts hidden."""
    return await offer_service.mine(db, user, limit=limit, offset=offset)


@offer_router.get(
    "/{offer_id}",
    response_model=OfferRead,
    summary="Get one offer (employer or owning candidate)",
)
async def get_offer(offer_id: uuid.UUID, db: DB, user: Actor) -> OfferRead:
    """Membership is derived from the row; outsiders get 404, never an
    existence oracle. The owning candidate resolves the same id first
    (plan G4), mirroring accept/decline."""
    return await offer_service.detail(db, user, offer_id)


@offer_router.patch(
    "/{offer_id}",
    response_model=OfferRead,
    summary="Edit a draft offer or extend a sent offer's expiry",
)
async def patch_offer(
    offer_id: uuid.UUID, payload: OfferUpdate, db: DB, user: Actor
) -> OfferRead:
    """Owner/admin only. Full edit while draft; after send only
    ``expires_on`` may change (plan D3) — anything else is 409."""
    return await offer_service.patch(db, user, offer_id, payload)


@offer_router.post(
    "/{offer_id}/send",
    response_model=OfferRead,
    summary="Send a draft offer to the candidate",
)
async def send_offer(
    offer_id: uuid.UUID, db: DB, user: Actor, payload: JobAction = _EMPTY
) -> OfferRead:
    """Owner/admin only; moves the application to ``offered`` (plan D11)."""
    return await offer_service.send(db, user, offer_id)


@offer_router.post(
    "/{offer_id}/withdraw",
    response_model=OfferRead,
    summary="Withdraw an offer the employer no longer stands behind",
)
async def withdraw_offer(
    offer_id: uuid.UUID, db: DB, user: Actor, payload: JobAction = _EMPTY
) -> OfferRead:
    """Owner/admin only; reverts an ``offered`` application to
    ``interview`` (plan D11)."""
    return await offer_service.withdraw(db, user, offer_id)


@offer_router.post(
    "/{offer_id}/accept",
    response_model=OfferRead,
    summary="Accept a sent offer (candidate)",
)
async def accept_offer(
    offer_id: uuid.UUID, db: DB, user: Actor, payload: JobAction = _EMPTY
) -> OfferRead:
    """The candidate's own sent/countered offer only (404 otherwise);
    leaves the stage on ``offered`` (plan D11)."""
    return await offer_service.accept(db, user, offer_id)


@offer_router.post(
    "/{offer_id}/decline",
    response_model=OfferRead,
    summary="Decline a sent offer with a seeded reason (candidate)",
)
async def decline_offer(
    offer_id: uuid.UUID, payload: OfferDecline, db: DB, user: Actor
) -> OfferRead:
    """The candidate's own sent/countered offer only; the reason id must
    be an active seeded reason (422), no free text (plan D5)."""
    return await offer_service.decline(db, user, offer_id, payload)


@candidate_router.get(
    "/{application_id}/offers",
    response_model=OfferPage,
    summary="List offers for my application",
)
async def candidate_offers(
    application_id: uuid.UUID, db: DB, user: Actor, limit: Limit = 20, offset: Offset = 0
) -> OfferPage:
    """Own application only (404 otherwise)."""
    return await offer_service.candidate_list(
        db, user, application_id, limit=limit, offset=offset
    )


@candidate_router.get(
    "/{application_id}/offers/{offer_id}",
    response_model=OfferRead,
    summary="Get one of my application's offers",
)
async def candidate_offer(
    application_id: uuid.UUID, offer_id: uuid.UUID, db: DB, user: Actor
) -> OfferRead:
    """Another candidate's offer or application is 404 (no oracle)."""
    return await offer_service.candidate_detail(db, user, application_id, offer_id)


@reasons_router.get(
    "",
    response_model=list[OfferDeclineReasonRead],
    summary="List active offer decline reasons",
)
async def list_decline_reasons(db: DB, user: Actor) -> list[OfferDeclineReasonRead]:
    """Seeded platform lookup (plan D5); any authenticated user — the
    candidate needs it to decline."""
    return await offer_service.decline_reasons(db, user)
