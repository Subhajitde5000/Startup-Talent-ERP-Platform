"""Readiness router (Step 5f).

Thin routes (AGENTS.md section 3): the actor always comes from the auth
dependency; path params are uuid.UUID so malformed ids 422 before any
service code runs. Membership, org scoping (IDOR), the status state
machine and the score roll-up live in readiness_service.

Sign-off and reject are the only routes that require the platform
``admin`` role (plan D3); mentor sign-off arrives with Step 8.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_role
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.readiness import (
    ReadinessBoard,
    ReadinessCriterionRead,
    ReadinessRead,
    ReadinessReject,
    ReadinessUpdate,
)
from app.services import readiness_service

router = APIRouter(tags=["readiness"])


@router.get(
    "/readiness/criteria",
    response_model=list[ReadinessCriterionRead],
    summary="List readiness criteria (reference data)",
)
async def list_criteria(
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[User, Depends(get_current_user)],
) -> list[ReadinessCriterionRead]:
    """The checklist text itself, without any organization's state."""
    return await readiness_service.list_criteria(db)


@router.get(
    "/organizations/{org_id}/readiness",
    response_model=ReadinessBoard,
    summary="Readiness board for a startup",
)
async def get_board(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> ReadinessBoard:
    """Criteria + this organization's state + the score summary.

    Any active member may read (viewers included)."""
    return await readiness_service.get_board(db, user, org_id)


@router.get(
    "/organizations/{org_id}/readiness/{criterion_id}",
    response_model=ReadinessRead,
    summary="Read one readiness item",
)
async def get_item(
    org_id: uuid.UUID,
    criterion_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> ReadinessRead:
    return await readiness_service.get_item(db, user, org_id, criterion_id)


@router.patch(
    "/organizations/{org_id}/readiness/{criterion_id}",
    response_model=ReadinessRead,
    summary="Update evidence and notes",
)
async def update_evidence(
    org_id: uuid.UUID,
    criterion_id: uuid.UUID,
    payload: ReadinessUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> ReadinessRead:
    """Owner/admin/member (viewer 403). ``status`` and ``score`` are not
    accepted here — they belong to the transition routes (422)."""
    return await readiness_service.update_evidence(
        db, user, org_id, criterion_id, payload
    )


@router.post(
    "/organizations/{org_id}/readiness/{criterion_id}/submit",
    response_model=ReadinessRead,
    summary="Submit a readiness item for review",
)
async def submit(
    org_id: uuid.UUID,
    criterion_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> ReadinessRead:
    """Evidence is required; an illegal transition is 409."""
    return await readiness_service.submit(db, user, org_id, criterion_id)


@router.post(
    "/organizations/{org_id}/readiness/{criterion_id}/withdraw",
    response_model=ReadinessRead,
    summary="Withdraw a submitted readiness item",
)
async def withdraw(
    org_id: uuid.UUID,
    criterion_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> ReadinessRead:
    return await readiness_service.withdraw(db, user, org_id, criterion_id)


@router.post(
    "/organizations/{org_id}/readiness/{criterion_id}/sign-off",
    response_model=ReadinessRead,
    summary="Sign off a submitted readiness item (platform admin)",
)
async def sign_off(
    org_id: uuid.UUID,
    criterion_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role(UserRole.admin))],
) -> ReadinessRead:
    """Platform admin only (plan D3). Mentor sign-off is switched on in
    Step 8, once a mentorship relationship exists. No startup member can
    hold the admin role, so self-sign-off is impossible."""
    return await readiness_service.sign_off(db, user, org_id, criterion_id)


@router.post(
    "/organizations/{org_id}/readiness/{criterion_id}/reject",
    response_model=ReadinessRead,
    summary="Reject a submitted readiness item (platform admin)",
)
async def reject(
    org_id: uuid.UUID,
    criterion_id: uuid.UUID,
    payload: ReadinessReject,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role(UserRole.admin))],
) -> ReadinessRead:
    """Platform admin only; the reason is stored in ``notes``."""
    return await readiness_service.reject(db, user, org_id, criterion_id, payload)
