from collections.abc import AsyncGenerator

import pytest_asyncio
import redis.asyncio as aioredis
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.core.config import Settings, get_settings
from app.core.rate_limit import get_redis_client
from app.core.security import hash_password
from app.db.engine import get_session_factory
from app.main import app
from app.models.user import (
    AccountStatus,
    AuthSession,
    EmailVerificationToken,
    LoginAttempt,
    PasswordResetToken,
    ReviewState,
    User,
    UserRole,
    UserRoleEnum,
)


@pytest_asyncio.fixture(scope="session")
def settings() -> Settings:
    return get_settings()


@pytest_asyncio.fixture(scope="session")
async def redis_client(settings: Settings) -> AsyncGenerator[aioredis.Redis, None]:
    client = await get_redis_client(settings)
    yield client


async def _cleanup(redis_client: aioredis.Redis) -> None:
    session_factory = get_session_factory()
    async with session_factory() as session:
        await session.execute(delete(LoginAttempt))
        await session.execute(delete(EmailVerificationToken))
        await session.execute(delete(PasswordResetToken))
        await session.execute(delete(AuthSession))
        await session.execute(delete(UserRole))
        await session.execute(delete(User))
        await session.commit()
    await redis_client.flushdb()


@pytest_asyncio.fixture(autouse=True)
async def clean_database_and_redis(redis_client: aioredis.Redis) -> AsyncGenerator[None, None]:
    await _cleanup(redis_client)
    yield
    await _cleanup(redis_client)


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def verified_jobseeker_user() -> User:
    async with get_session_factory()() as session:
        user = User(
            primary_email="jobseeker@example.com",
            password_hash=hash_password("Password123!"),
            display_name="Job Seeker One",
            avatar_initials="JS",
            status=AccountStatus.active,
            verification=ReviewState.verified,
        )
        session.add(user)
        await session.flush()

        role = UserRole(
            user_id=user.id,
            role=UserRoleEnum.jobseeker,
            is_primary=True,
        )
        session.add(role)
        await session.commit()
        await session.refresh(user)
        return user


@pytest_asyncio.fixture
async def verified_startup_user() -> User:
    async with get_session_factory()() as session:
        user = User(
            primary_email="founder@startup.io",
            password_hash=hash_password("Founder123!"),
            display_name="Startup Founder",
            avatar_initials="SF",
            status=AccountStatus.active,
            verification=ReviewState.verified,
        )
        session.add(user)
        await session.flush()

        role = UserRole(
            user_id=user.id,
            role=UserRoleEnum.startup,
            is_primary=True,
        )
        session.add(role)
        await session.commit()
        await session.refresh(user)
        return user


@pytest_asyncio.fixture
async def suspended_user() -> User:
    async with get_session_factory()() as session:
        user = User(
            primary_email="suspended@example.com",
            password_hash=hash_password("Password123!"),
            display_name="Suspended Person",
            avatar_initials="SP",
            status=AccountStatus.suspended,
            verification=ReviewState.unverified,
        )
        session.add(user)
        await session.flush()

        role = UserRole(
            user_id=user.id,
            role=UserRoleEnum.jobseeker,
            is_primary=True,
        )
        session.add(role)
        await session.commit()
        await session.refresh(user)
        return user
