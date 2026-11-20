"""Alembic environment (async)."""

import asyncio
from logging.config import fileConfig

from sqlalchemy import event, pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context
from app.core.config import get_settings
from app.db.base import Base
from app.models import (  # noqa: F401  (register models for autogenerate)
    analytics,
    auth,
    metric,
    milestone,
    profile,
    readiness,
    stage,
    startup,
    task,
    task_comment,
    task_label,
    user,
)

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=get_settings().DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = get_settings().DATABASE_URL
    connectable = async_engine_from_config(
        configuration, prefix="sqlalchemy.", poolclass=pool.NullPool
    )
    # SQLite: 0003 rewrites the `users` table (unnamed legacy UNIQUE
    # constraints cannot be dropped by name). Dropping a referenced table
    # with foreign_keys=ON would cascade-delete child rows, and PRAGMA is a
    # no-op inside a transaction — so disable FK checks at connect time,
    # for this migration connection only (alembic's recommended recipe).
    if connectable.url.get_backend_name() == "sqlite":

        @event.listens_for(connectable.sync_engine, "connect")
        def _disable_sqlite_fk(dbapi_connection, _connection_record) -> None:  # type: ignore[no-untyped-def]
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=OFF")
            cursor.close()

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
