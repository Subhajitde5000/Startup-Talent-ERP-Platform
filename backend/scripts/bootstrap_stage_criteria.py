"""Bootstrap the readiness + stage exit criteria (Steps 5f and 5i/5j).

Run (from backend/):

    .venv/bin/python scripts/bootstrap_stage_criteria.py

This is a thin, explicit entry point over
``readiness_service.bootstrap_criteria``, which has bootstrapped both
audiences since 5i:

- the six ``/startup/readiness`` items (``is_exit_criterion=False``), and
- the 25 stage exit criteria, five per stage (``is_exit_criterion=True``).

Idempotent by ``code``: missing rows are inserted, existing rows are
updated in place, and nothing is deleted. Re-running is a no-op.

Like ``bootstrap_readiness.py`` this is **not** dev-only — both audiences
are reference data the whole startup workspace depends on, and schema.sql
defines the table for production too. It is still never run from a
migration (AGENTS.md: migrations carry schema, not data).
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import async_session_factory, engine  # noqa: E402
from app.services import readiness_service  # noqa: E402


async def bootstrap() -> None:
    try:
        async with async_session_factory() as session:
            inserted, updated = await readiness_service.bootstrap_criteria(session)
            total = len(readiness_service.ALL_CRITERIA_SPEC)
            exits = len(readiness_service._EXIT_CRITERIA_SPEC)
            print(
                f"criteria: {total} in spec ({exits} stage exit criteria), "
                f"{inserted} inserted, {updated} updated"
            )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(bootstrap())
