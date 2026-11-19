"""Bootstrap the readiness criteria (Step 5f item 1, plan D2).

Run (from backend/):

    .venv/bin/python scripts/bootstrap_readiness.py

Idempotent by ``code``: existing rows are updated in place (so wording
fixes roll out) and missing rows are inserted. Unlike ``seed_dev.py``
this is **not** dev-only — the six criteria are reference data the whole
startup workspace depends on, and schema.sql defines the table for
production too. It is still never run from a migration (AGENTS.md:
migrations carry schema, not data).

The criteria list itself lives in ``readiness_service.CRITERIA_SPEC`` so
the bootstrap is unit-tested against the same values this CLI writes.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import async_session_factory, engine  # noqa: E402
from app.services import readiness_service  # noqa: E402


async def bootstrap() -> None:
    async with async_session_factory() as db:
        inserted, updated = await readiness_service.bootstrap_criteria(db)
    print(f"Readiness criteria: {inserted} inserted, {updated} updated.")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(bootstrap())
