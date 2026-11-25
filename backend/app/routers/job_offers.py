"""7g staff offers and distinct applicant responses; no shared staff serializer."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from app.routers.files import Store
from app.routers.interviews import HiringRoute, Limit, Offset, errors
from app.routers.jobs import DB, Actor
from app.schemas import hiring_workflow as s
from app.schemas.file import FileDownloadRead
from app.services import job_offer_service as service

router = APIRouter(
    prefix="/organizations/{org_id}/job-offers",
    tags=["job offers"],
    route_class=HiringRoute,
    responses=errors,
)
candidate_router = APIRouter(
    prefix="/job-offers", tags=["applicant offers"], route_class=HiringRoute, responses=errors
)


@router.post(
    "", response_model=s.StaffOfferRead, status_code=201, summary="Create a private offer draft"
)
async def create(org_id: uuid.UUID, payload: s.OfferCreate, db: DB, user: Actor) -> s.OfferRead:
    return await service.create(db, user, org_id, payload)


@router.get("", response_model=s.StaffOfferPage, summary="List offers in pipeline scope")
async def listing(
    org_id: uuid.UUID,
    db: DB,
    user: Actor,
    status: s.OfferStatus | None = None,
    application_id: uuid.UUID | None = None,
    submitted: bool | None = None,
    limit: Limit = 20,
    offset: Offset = 0,
) -> s.StaffOfferPage | s.OfferPage:
    return await service.listing(
        db,
        user,
        org_id,
        status=status,
        application_id=application_id,
        submitted=submitted,
        limit=limit,
        offset=offset,
    )


@router.get("/{id_}", response_model=s.StaffOfferRead, summary="Read an internal offer version")
async def get(org_id: uuid.UUID, id_: uuid.UUID, db: DB, user: Actor) -> s.OfferRead:
    return await service.get(db, user, id_, org_id)


@router.patch(
    "/{id_}", response_model=s.StaffOfferRead, summary="Edit only unsubmitted draft terms"
)
async def patch(
    org_id: uuid.UUID, id_: uuid.UUID, payload: s.OfferPatch, db: DB, user: Actor
) -> s.OfferRead:
    return await service.patch(db, user, org_id, id_, payload)


@router.delete("/{id_}", status_code=204, summary="Archive an unsubmitted draft")
async def archive(org_id: uuid.UUID, id_: uuid.UUID, db: DB, user: Actor) -> None:
    await service.archive(db, user, org_id, id_)


@router.post(
    "/{id_}/submit",
    response_model=s.StaffOfferRead,
    summary="Freeze terms and request independent approvals",
)
async def submit(
    org_id: uuid.UUID, id_: uuid.UUID, payload: s.ApprovalRequest, db: DB, user: Actor
) -> s.OfferRead:
    return await service.submit(db, user, org_id, id_, payload)


@router.get(
    "/{id_}/approvals",
    response_model=s.ApprovalPage,
    summary="List approvals of this immutable version",
)
async def approvals(
    org_id: uuid.UUID, id_: uuid.UUID, db: DB, user: Actor, limit: Limit = 20, offset: Offset = 0
) -> s.ApprovalPage:
    return await service.approvals(db, user, org_id, id_, limit, offset)


@router.put(
    "/{id_}/approvals/me",
    response_model=s.StaffOfferRead,
    summary="Decide only my assigned approval",
)
async def decide(
    org_id: uuid.UUID, id_: uuid.UUID, payload: s.ApprovalDecision, db: DB, user: Actor
) -> s.OfferRead:
    return await service.decide(db, user, org_id, id_, payload)


@router.post(
    "/{id_}/send",
    response_model=s.StaffOfferRead,
    summary="Send after every active approver approved",
)
async def send(
    org_id: uuid.UUID, id_: uuid.UUID, payload: s.Expected, db: DB, user: Actor
) -> s.OfferRead:
    return await service.send(db, user, org_id, id_, payload)


@router.post(
    "/{id_}/withdraw", response_model=s.StaffOfferRead, summary="Withdraw an actionable offer"
)
async def withdraw(
    org_id: uuid.UUID, id_: uuid.UUID, payload: s.Expected, db: DB, user: Actor
) -> s.OfferRead:
    return await service.withdraw(db, user, org_id, id_, payload)


@router.post(
    "/{id_}/revisions",
    response_model=s.StaffOfferRead,
    status_code=201,
    summary="Supersede with a new draft requiring fresh approvals",
)
async def revision(
    org_id: uuid.UUID, id_: uuid.UUID, payload: s.OfferRevision, db: DB, user: Actor
) -> s.OfferRead:
    return await service.revision(db, user, org_id, id_, payload)


@router.post(
    "/{id_}/expire", response_model=s.StaffOfferRead, summary="Persist an overdue offer expiry"
)
async def expire(
    org_id: uuid.UUID, id_: uuid.UUID, payload: s.Expected, db: DB, user: Actor
) -> s.OfferRead:
    return await service.expire(db, user, org_id, id_, payload)


@router.post(
    "/{id_}/document-download",
    response_model=FileDownloadRead,
    summary="Sign a scoped private offer document",
)
async def staff_document(
    org_id: uuid.UUID, id_: uuid.UUID, db: DB, user: Actor, storage: Store
) -> FileDownloadRead:
    return await service.document(db, user, id_, storage, org_id)


@candidate_router.get(
    "", response_model=s.OfferPage, summary="List only my sent and historical offers"
)
async def own_list(
    db: DB, user: Actor, status: s.OfferStatus | None = None, limit: Limit = 20, offset: Offset = 0
) -> s.StaffOfferPage | s.OfferPage:
    return await service.listing(db, user, status=status, limit=limit, offset=offset)


@candidate_router.get(
    "/compare", response_model=s.OfferPage, summary="Compare two to five of my visible offers"
)
async def compare(
    db: DB, user: Actor, offer_ids: Annotated[list[uuid.UUID], Query(min_length=2, max_length=5)]
) -> s.OfferPage:
    return await service.compare(db, user, offer_ids)


@candidate_router.get(
    "/decline-reasons", response_model=s.DeclineReasonPage, summary="List active decline reasons"
)
async def reasons(
    db: DB, user: Actor, limit: Limit = 20, offset: Offset = 0
) -> s.DeclineReasonPage:
    return await service.reasons(db, user, limit, offset)


@candidate_router.get(
    "/{id_}", response_model=s.OfferRead, summary="Read my offer without internal approvals"
)
async def own_get(id_: uuid.UUID, db: DB, user: Actor) -> s.OfferRead:
    return await service.get(db, user, id_)


@candidate_router.post(
    "/{id_}/respond",
    response_model=s.OfferRead,
    summary="Accept or decline an unexpired current offer",
)
async def respond(id_: uuid.UUID, payload: s.OfferResponse, db: DB, user: Actor) -> s.OfferRead:
    return await service.respond(db, user, id_, payload)


@candidate_router.post(
    "/{id_}/counter", response_model=s.OfferRead, summary="Counter without mutating employer terms"
)
async def counter(id_: uuid.UUID, payload: s.OfferCounter, db: DB, user: Actor) -> s.OfferRead:
    return await service.counter(db, user, id_, payload)


@candidate_router.post(
    "/{id_}/document-download",
    response_model=FileDownloadRead,
    summary="Sign only my visible offer document",
)
async def own_document(id_: uuid.UUID, db: DB, user: Actor, storage: Store) -> FileDownloadRead:
    return await service.document(db, user, id_, storage)
