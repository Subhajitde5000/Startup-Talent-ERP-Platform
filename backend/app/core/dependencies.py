"""FastAPI dependencies: current user + role guards.

Deny by default. Every protected route uses get_current_user;
role-restricted routes additionally use require_role(...).
"""

from typing import Annotated

import jwt
from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    account_inactive,
    account_suspended,
    forbidden,
    invalid_token,
)
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import AccountStatus, User, UserRole, UserRoleRow


def _bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise invalid_token("Missing or invalid Authorization header.")
    return authorization.split(" ", 1)[1].strip()


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    token = _bearer_token(authorization)
    try:
        user_id = decode_access_token(token)
    except jwt.ExpiredSignatureError:
        from app.core.exceptions import token_expired

        raise token_expired() from None
    except jwt.InvalidTokenError:
        raise invalid_token() from None

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or user.deleted_at is not None:
        raise invalid_token("Invalid token.")
    if user.status == AccountStatus.suspended:
        raise account_suspended()
    if user.status in (AccountStatus.deactivated, AccountStatus.deleted):
        raise account_inactive()
    return user


def require_role(*roles: UserRole):
    """Dependency factory: user must hold at least one of the given roles."""

    async def _check(
        db: Annotated[AsyncSession, Depends(get_db)],
        user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        result = await db.execute(
            select(UserRoleRow).where(
                UserRoleRow.user_id == user.id,
                UserRoleRow.revoked_at.is_(None),
                UserRoleRow.role.in_(list(roles)),
            )
        )
        if result.scalar_one_or_none() is None:
            raise forbidden("You do not have permission to perform this action.")
        return user

    return _check
