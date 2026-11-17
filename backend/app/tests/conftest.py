"""Test fixtures: SQLite (default) or PostgreSQL DB, memory email, rate limiter.

Set FORMA_TEST_DATABASE_URL to run the same suite against PostgreSQL,
e.g. FORMA_TEST_DATABASE_URL=postgresql+asyncpg://postgres@/postgres?host=/tmp/forma-pg3
(the dedicated verification database must exist; drop_all/create_all run
per test, so point it at a scratch DB, not your real data).
"""

# ruff: noqa: E402, I001

import os
from collections.abc import AsyncGenerator

os.environ["ENVIRONMENT"] = "test"
os.environ["DEBUG"] = "false"
os.environ["EMAIL_PROVIDER"] = "memory"
os.environ["DATABASE_URL"] = os.environ.get(
    "FORMA_TEST_DATABASE_URL", "sqlite+aiosqlite:///:memory:"
)
os.environ["REDIS_URL"] = ""
os.environ["JWT_SECRET"] = "test-secret-at-least-32-characters-long"

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import create_app  # noqa: E402
from app.services import email_service  # noqa: E402
from app.services.rate_limiter import rate_limiter  # noqa: E402

TEST_DATABASE_URL = os.environ["DATABASE_URL"]

# pytest-asyncio runs each test in a fresh event loop; pooled asyncpg
# connections from a previous loop would explode ("attached to a different
# loop"). NullPool = a connection per operation, created in the current
# loop. In-memory SQLite keeps SQLAlchemy's automatic StaticPool (it needs
# ONE connection so every test sees the same :memory: database).
if TEST_DATABASE_URL.startswith("sqlite+aiosqlite:///:memory:"):
    _engine_kwargs: dict = {}
else:
    _engine_kwargs = {"poolclass": NullPool}
test_engine = create_async_engine(TEST_DATABASE_URL, future=True, **_engine_kwargs)
TestSessionFactory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(autouse=True)
async def _setup_db() -> AsyncGenerator[None, None]:
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    email_service.clear_sent_emails()
    rate_limiter.reset()
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionFactory() as session:
        yield session


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    async def _override_db() -> AsyncGenerator[AsyncSession, None]:
        async with TestSessionFactory() as session:
            yield session

    app = create_app()
    app.dependency_overrides[get_db] = _override_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def settings():
    return get_settings()
