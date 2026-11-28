"""Step 8g router: mentor agreements.

Three prefixes, matching how an agreement is addressed:

- ``/mentorships/{id}/agreements``  create and list inside one engagement;
- ``/agreements/{id}``              one version and its actions;
- ``/mentor/agreements``            the mentor's list across engagements.

Thin layer (AGENTS.md section 3): every authorization decision, including
404-for-outsiders and 403-for-viewers, lives in ``agreement_service``.
"""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_role
from app.db.session import get_db
from app.models.agreement import AgreementStatus
from app.models.user import User, UserRole
from app.schemas.agreement import (
    AgreementCreate,
    AgreementDetail,
    AgreementPage,
    AgreementRead,
    AgreementSign,
    AgreementTerminate,
    AgreementUpdate,
)
from app.services import agreement_service

router = APIRouter(tags=["agreements"])

DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
Mentor = Annotated[User, Depends(require_role(UserRole.mentor))]
Limit = Annotated[int, Query(ge=1, le=50)]
Offset = Annotated[int, Query(ge=0)]

_NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"description": "Not found, not a participant, or another side's draft."}}
_VIEWER: dict[int | str, dict[str, Any]] = {403: {"description": "A startup viewer, or a member trying to write or sign."}}
_STATE: dict[int | str, dict[str, Any]] = {409: {"description": "Wrong agreement or mentorship state (INVALID_STATE)."}}


@router.post(
    "/mentorships/{mentorship_id}/agreements",
    response_model=AgreementRead,
    status_code=201,
    summary="Draft an agreement or a new version",
    responses={**_NOT_FOUND, **_VIEWER, **_STATE, 422: {"description": "Invalid terms."}},
)
async def create_agreement(
    mentorship_id: uuid.UUID, payload: AgreementCreate, db: DB, user: CurrentUser
) -> AgreementRead:
    return await agreement_service.create(db, user, mentorship_id, payload)


@router.get(
    "/mentorships/{mentorship_id}/agreements",
    response_model=AgreementPage,
    summary="Version history of a mentorship's agreement",
    responses={**_NOT_FOUND, **_VIEWER},
)
async def list_mentorship_agreements(
    mentorship_id: uuid.UUID,
    db: DB,
    user: CurrentUser,
    status: AgreementStatus | None = None,
    limit: Limit = 20,
    offset: Offset = 0,
) -> AgreementPage:
    return await agreement_service.list_for_mentorship(
        db, user, mentorship_id, status=status, limit=limit, offset=offset
    )


@router.get(
    "/mentor/agreements",
    response_model=AgreementPage,
    summary="The mentor's agreements across all mentorships",
)
async def list_mentor_agreements(
    db: DB,
    user: Mentor,
    status: AgreementStatus | None = None,
    awaiting_me: Annotated[
        bool, Query(description="Sent and still waiting for the mentor's signature.")
    ] = False,
    proposed_by_me: Annotated[
        bool, Query(description="Drafts and sent versions the mentor proposed.")
    ] = False,
    limit: Limit = 20,
    offset: Offset = 0,
) -> AgreementPage:
    return await agreement_service.list_for_mentor(
        db,
        user,
        status=status,
        awaiting_me=awaiting_me,
        proposed_by_me=proposed_by_me,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/agreements/{agreement_id}",
    response_model=AgreementDetail,
    summary="One agreement version with derived linked records",
    responses={**_NOT_FOUND, **_VIEWER},
)
async def get_agreement(agreement_id: uuid.UUID, db: DB, user: CurrentUser) -> AgreementDetail:
    return await agreement_service.get(db, user, agreement_id)


@router.patch(
    "/agreements/{agreement_id}",
    response_model=AgreementRead,
    summary="Edit your side's draft",
    responses={**_NOT_FOUND, **_VIEWER, **_STATE},
)
async def update_agreement(
    agreement_id: uuid.UUID, payload: AgreementUpdate, db: DB, user: CurrentUser
) -> AgreementRead:
    return await agreement_service.update(db, user, agreement_id, payload)


@router.delete(
    "/agreements/{agreement_id}",
    status_code=204,
    summary="Discard your side's draft",
    responses={**_NOT_FOUND, **_VIEWER, **_STATE},
)
async def discard_agreement(agreement_id: uuid.UUID, db: DB, user: CurrentUser) -> Response:
    await agreement_service.discard(db, user, agreement_id)
    return Response(status_code=204)


@router.post(
    "/agreements/{agreement_id}/send",
    response_model=AgreementRead,
    summary="Send your draft for signature",
    responses={**_NOT_FOUND, **_VIEWER, **_STATE},
)
async def send_agreement(agreement_id: uuid.UUID, db: DB, user: CurrentUser) -> AgreementRead:
    return await agreement_service.send(db, user, agreement_id)


@router.post(
    "/agreements/{agreement_id}/sign",
    response_model=AgreementRead,
    summary="Sign your side (re-enter your password)",
    responses={
        **_NOT_FOUND,
        403: {"description": "Viewer/member, or REAUTH_FAILED for a wrong password."},
        **_STATE,
        429: {"description": "Too many signing attempts."},
    },
)
async def sign_agreement(
    agreement_id: uuid.UUID, payload: AgreementSign, db: DB, user: CurrentUser
) -> AgreementRead:
    return await agreement_service.sign(db, user, agreement_id, payload)


@router.post(
    "/agreements/{agreement_id}/terminate",
    response_model=AgreementRead,
    summary="Terminate a signed agreement",
    responses={**_NOT_FOUND, **_VIEWER, **_STATE},
)
async def terminate_agreement(
    agreement_id: uuid.UUID, payload: AgreementTerminate, db: DB, user: CurrentUser
) -> AgreementRead:
    return await agreement_service.terminate(db, user, agreement_id, payload)
