"""Diligence router (Step 9k): checklists + items.

Investor-side only under ``/investors/diligence`` — diligence data is
private to the investor firm, so there is NO startup-side route. The
caller's firm is resolved from membership; rows are org-scoped (a
foreign-org row is a 404).
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.diligence import DiligenceItemType
from app.models.user import User
from app.schemas.diligence import (
    DiligenceChecklistCreate,
    DiligenceChecklistPage,
    DiligenceChecklistRead,
    DiligenceChecklistUpdate,
    DiligenceItemCreate,
    DiligenceItemPage,
    DiligenceItemRead,
    DiligenceItemUpdate,
)
from app.services import diligence_service

router = APIRouter(tags=["diligence"])


@router.get(
    "/investors/diligence",
    response_model=DiligenceChecklistPage,
    summary="List the investor's diligence checklists",
)
async def list_checklists(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> DiligenceChecklistPage:
    items, total = await diligence_service.list_checklists(
        db, user, limit=limit, offset=offset
    )
    return DiligenceChecklistPage(items=items, total=total, limit=limit, offset=offset)


@router.post(
    "/investors/diligence",
    response_model=DiligenceChecklistRead,
    status_code=201,
    summary="Open a diligence workspace (idempotent per startup)",
)
async def create_checklist(
    payload: DiligenceChecklistCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> DiligenceChecklistRead:
    return await diligence_service.create_checklist(
        db,
        user,
        startup_org_id=payload.startup_org_id,
        round_id=payload.round_id,
        deal_id=payload.deal_id,
        notes=payload.notes,
    )


@router.get(
    "/investors/diligence/{checklist_id}",
    response_model=DiligenceChecklistRead,
    summary="One diligence checklist",
)
async def get_checklist(
    checklist_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> DiligenceChecklistRead:
    return await diligence_service.get_checklist(db, user, checklist_id)


@router.patch(
    "/investors/diligence/{checklist_id}",
    response_model=DiligenceChecklistRead,
    summary="Update status, notes or scorecard",
)
async def update_checklist(
    checklist_id: uuid.UUID,
    payload: DiligenceChecklistUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> DiligenceChecklistRead:
    return await diligence_service.update_checklist(
        db,
        user,
        checklist_id,
        overall_status=payload.overall_status,
        notes=payload.notes,
        scorecard=payload.scorecard,
    )


@router.get(
    "/investors/diligence/{checklist_id}/items",
    response_model=DiligenceItemPage,
    summary="List items of a checklist",
)
async def list_items(
    checklist_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    item_type: DiligenceItemType | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> DiligenceItemPage:
    items, total = await diligence_service.list_items(
        db, user, checklist_id, item_type=item_type, limit=limit, offset=offset
    )
    return DiligenceItemPage(items=items, total=total, limit=limit, offset=offset)


@router.post(
    "/investors/diligence/{checklist_id}/items",
    response_model=DiligenceItemRead,
    status_code=201,
    summary="Add a checklist line, question or finding",
)
async def create_item(
    checklist_id: uuid.UUID,
    payload: DiligenceItemCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> DiligenceItemRead:
    return await diligence_service.create_item(
        db,
        user,
        checklist_id,
        item_type=payload.item_type,
        title=payload.title,
        severity=payload.severity,
        status=payload.status,
        due_on=payload.due_on,
        response=payload.response,
    )


@router.patch(
    "/investors/diligence/{checklist_id}/items/{item_id}",
    response_model=DiligenceItemRead,
    summary="Update a diligence item",
)
async def update_item(
    checklist_id: uuid.UUID,
    item_id: uuid.UUID,
    payload: DiligenceItemUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> DiligenceItemRead:
    return await diligence_service.update_item(
        db,
        user,
        checklist_id,
        item_id,
        title=payload.title,
        severity=payload.severity,
        status=payload.status,
        due_on=payload.due_on,
        response=payload.response,
    )


@router.delete(
    "/investors/diligence/{checklist_id}/items/{item_id}",
    status_code=204,
    summary="Soft-delete a diligence item",
)
async def delete_item(
    checklist_id: uuid.UUID,
    item_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> None:
    await diligence_service.delete_item(db, user, checklist_id, item_id)


__all__ = [
    "create_checklist",
    "create_item",
    "delete_item",
    "list_checklists",
    "list_items",
    "update_checklist",
    "update_item",
]
