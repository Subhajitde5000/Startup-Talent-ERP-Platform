"""Bootstrap platform reference data: job-offer decline reasons (7g, plan D5).

Run (from backend/):

    ../.venv/bin/python scripts/bootstrap_decline_reasons.py

- Idempotent: codes that already exist keep their values; only missing
  rows are inserted, so it is safe to run on every deploy.
- NOT dev-gated (unlike ``scripts/seed_dev.py``): these are platform
  rows every environment needs before a candidate can decline an offer.
- The vocabulary lives in ``offer_service.DECLINE_REASONS`` so the
  seeder and the service can never drift apart.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# Allow `python scripts/bootstrap_decline_reasons.py` from backend/.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


from app.db.session import async_session_factory  # noqa: E402
from app.services.offer_service import seed_decline_reasons  # noqa: E402


async def main() -> None:
    async with async_session_factory() as db:
        added = await seed_decline_reasons(db)
    print(f"offer decline reasons: {added} row(s) inserted.")


if __name__ == "__main__":
    asyncio.run(main())
