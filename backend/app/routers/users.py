from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import UserMeResponse, UserRoleRead
from app.services.auth import user_to_me_response

router = APIRouter(prefix="/users", tags=["Users"])


@router.get(
    "/me",
    response_model=UserMeResponse,
    summary="Get current user profile",
)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> UserMeResponse:
    return user_to_me_response(current_user)


@router.get(
    "/me/roles",
    response_model=list[UserRoleRead],
    summary="Get roles assigned to current user",
)
async def get_my_roles(
    current_user: User = Depends(get_current_user),
) -> list[UserRoleRead]:
    return [
        UserRoleRead(
            role=r.role.value,
            is_primary=r.is_primary,
            granted_at=r.granted_at,
        )
        for r in current_user.roles
        if r.revoked_at is None
    ]
