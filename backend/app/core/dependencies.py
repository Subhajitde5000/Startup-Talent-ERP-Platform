import uuid
from collections.abc import Callable
from typing import Any

import redis.asyncio as aioredis
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import Settings, get_settings
from app.core.exceptions import AuthenticationError, AuthorizationError
from app.core.rate_limit import get_redis_client
from app.core.security import decode_access_token
from app.db.engine import get_db
from app.models.user import AccountStatus, User, UserRoleEnum

http_bearer = HTTPBearer(auto_error=False)


async def get_redis() -> aioredis.Redis:
    return await get_redis_client()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(http_bearer),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    if not credentials or not credentials.credentials:
        raise AuthenticationError("Authentication token is missing.")

    payload = decode_access_token(credentials.credentials, settings)
    sub = payload.get("sub")
    if not sub:
        raise AuthenticationError("Invalid token payload.")

    try:
        user_id = uuid.UUID(sub)
    except ValueError:
        raise AuthenticationError("Invalid user identity in token.") from None

    user = await db.scalar(
        select(User)
        .options(selectinload(User.roles))
        .where(User.id == user_id, User.deleted_at.is_(None))
    )

    if not user:
        raise AuthenticationError("User not found.")

    # Requirement 8: get_current_user checks account status on every request
    if user.status == AccountStatus.suspended:
        raise AuthorizationError("Account is suspended.")
    if user.status in (AccountStatus.deactivated, AccountStatus.deleted):
        raise AuthenticationError("Account is no longer active.")

    return user


def require_role(*allowed_roles: UserRoleEnum) -> Callable[..., Any]:
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_roles = {
            r.role for r in current_user.roles if r.revoked_at is None
        }
        if not any(role in user_roles for role in allowed_roles):
            raise AuthorizationError(
                f"Operation requires one of the following roles: {[r.value for r in allowed_roles]}"
            )
        return current_user

    return role_checker
