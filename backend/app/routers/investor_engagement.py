"""Engagement router (Step 9f): requests + meetings.

Investor side under ``/investors/requests`` and ``/investors/meetings``
(the caller's own firm, resolved from membership). Startup side under
``/organizations/{org_id}/investor-requests`` and
``/organizations/{org_id}/investor-meetings`` (the caller's startup).

Status/lifecycle actions are dedicated endpoints — request withdraw /
startup respond, meeting status — never free-form status updates.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.investor_engagement import MeetingStatus, RequestStatus
from app.models.user import User
from app.schemas.investor_engagement import (
    EngagementRequestCreate,
    EngagementRequestPage,
    EngagementRequestRead,
    EngagementRequestRespond,
    EngagementRequestStartupPage,
    EngagementRequestStartupRead,
    EngagementRequestUpdate,
    MeetingCreate,
    MeetingPage,
    MeetingRead,
    MeetingStatusUpdate,
    MeetingUpdate,
)
from app.services import engagement_service, organization_service

router = APIRouter(tags=["investor engagement"])


# --- investor side: requests ----------------------------------------------


@router.get(
    "/investors/requests",
    response_model=EngagementRequestPage,
    summary="List the investor's engagement requests",
)
async def list_requests(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    status: RequestStatus | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> EngagementRequestPage:
    items, total = await engagement_service.list_requests(
        db, user, status=status, limit=limit, offset=offset
    )
    return EngagementRequestPage(items=items, total=total, limit=limit, offset=offset)


@router.post(
    "/investors/requests",
    response_model=EngagementRequestRead,
    status_code=201,
    summary="Send an engagement request (intro/meeting/information)",
)
async def create_request(
    payload: EngagementRequestCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> EngagementRequestRead:
    return await engagement_service.create_request(db, user, payload)


@router.get(
    "/investors/requests/{request_id}",
    response_model=EngagementRequestRead,
    summary="One engagement request",
)
async def get_request(
    request_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> EngagementRequestRead:
    return await engagement_service.get_request(db, user, request_id)


@router.patch(
    "/investors/requests/{request_id}",
    response_model=EngagementRequestRead,
    summary="Edit the investor's request",
)
async def update_request(
    request_id: uuid.UUID,
    payload: EngagementRequestUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> EngagementRequestRead:
    return await engagement_service.update_request(db, user, request_id, payload)


@router.post(
    "/investors/requests/{request_id}/withdraw",
    response_model=EngagementRequestRead,
    summary="Withdraw an open request",
)
async def withdraw_request(
    request_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> EngagementRequestRead:
    return await engagement_service.withdraw_request(db, user, request_id)


# --- investor side: meetings ------------------------------------------------


@router.get(
    "/investors/meetings",
    response_model=MeetingPage,
    summary="List the investor's meetings",
)
async def list_meetings(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    status: MeetingStatus | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> MeetingPage:
    items, total = await engagement_service.list_meetings(
        db, user, status=status, limit=limit, offset=offset
    )
    return MeetingPage(items=items, total=total, limit=limit, offset=offset)


@router.post(
    "/investors/meetings",
    response_model=MeetingRead,
    status_code=201,
    summary="Propose a meeting (proposed)",
)
async def create_meeting(
    payload: MeetingCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MeetingRead:
    return await engagement_service.create_meeting(db, user, payload)


@router.get(
    "/investors/meetings/{meeting_id}",
    response_model=MeetingRead,
    summary="One meeting",
)
async def get_meeting(
    meeting_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MeetingRead:
    return await engagement_service.get_meeting(db, user, meeting_id)


@router.patch(
    "/investors/meetings/{meeting_id}",
    response_model=MeetingRead,
    summary="Edit a proposed/confirmed meeting",
)
async def update_meeting(
    meeting_id: uuid.UUID,
    payload: MeetingUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MeetingRead:
    return await engagement_service.update_meeting(db, user, meeting_id, payload)


@router.post(
    "/investors/meetings/{meeting_id}/status",
    response_model=MeetingRead,
    summary="Change meeting status",
)
async def transition_meeting(
    meeting_id: uuid.UUID,
    payload: MeetingStatusUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MeetingRead:
    return await engagement_service.transition_meeting(
        db, user, meeting_id, MeetingStatus(payload.status)
    )


# --- startup side: requests ------------------------------------------------


@router.get(
    "/organizations/{org_id}/investor-requests",
    response_model=EngagementRequestStartupPage,
    summary="Engagement requests received by this startup",
)
async def list_startup_requests(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    status: RequestStatus | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> EngagementRequestStartupPage:
    org = await organization_service.startup_org_or_404(db, org_id)
    items, total = await engagement_service.list_startup_requests(
        db, org, user, status=status, limit=limit, offset=offset
    )
    return EngagementRequestStartupPage(
        items=items, total=total, limit=limit, offset=offset
    )


@router.get(
    "/organizations/{org_id}/investor-requests/{request_id}",
    response_model=EngagementRequestStartupRead,
    summary="One request received by this startup",
)
async def get_startup_request(
    org_id: uuid.UUID,
    request_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> EngagementRequestStartupRead:
    org = await organization_service.startup_org_or_404(db, org_id)
    return await engagement_service.get_startup_request(db, org, user, request_id)


@router.post(
    "/organizations/{org_id}/investor-requests/{request_id}/respond",
    response_model=EngagementRequestStartupRead,
    summary="Accept or decline a request",
)
async def respond_to_request(
    org_id: uuid.UUID,
    request_id: uuid.UUID,
    payload: EngagementRequestRespond,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> EngagementRequestStartupRead:
    org = await organization_service.startup_org_or_404(db, org_id)
    return await engagement_service.respond_to_request(
        db,
        org,
        user,
        request_id,
        decision=payload.decision,
        response_note=payload.response_note,
        decline_reason=payload.decline_reason,
    )


# --- startup side: meetings ------------------------------------------------


@router.get(
    "/organizations/{org_id}/investor-meetings",
    response_model=MeetingPage,
    summary="Meetings scheduled with this startup",
)
async def list_startup_meetings(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    status: MeetingStatus | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> MeetingPage:
    org = await organization_service.startup_org_or_404(db, org_id)
    items, total = await engagement_service.list_startup_meetings(
        db, org, user, status=status, limit=limit, offset=offset
    )
    return MeetingPage(items=items, total=total, limit=limit, offset=offset)


@router.patch(
    "/organizations/{org_id}/investor-meetings/{meeting_id}",
    response_model=MeetingRead,
    summary="Edit/re-propose a meeting (confirmed -> proposed)",
)
async def update_startup_meeting(
    org_id: uuid.UUID,
    meeting_id: uuid.UUID,
    payload: MeetingUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MeetingRead:
    org = await organization_service.startup_org_or_404(db, org_id)
    return await engagement_service.update_startup_meeting(
        db, org, user, meeting_id, payload
    )


@router.post(
    "/organizations/{org_id}/investor-meetings/{meeting_id}/status",
    response_model=MeetingRead,
    summary="Change meeting status (startup side)",
)
async def transition_startup_meeting(
    org_id: uuid.UUID,
    meeting_id: uuid.UUID,
    payload: MeetingStatusUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MeetingRead:
    org = await organization_service.startup_org_or_404(db, org_id)
    return await engagement_service.transition_startup_meeting(
        db, org, user, meeting_id, MeetingStatus(payload.status)
    )


__all__ = [
    "create_meeting",
    "create_request",
    "get_meeting",
    "get_request",
    "get_startup_request",
    "list_meetings",
    "list_requests",
    "list_startup_meetings",
    "list_startup_requests",
    "respond_to_request",
    "transition_meeting",
    "transition_startup_meeting",
    "update_meeting",
    "update_request",
    "update_startup_meeting",
    "withdraw_request",
]
