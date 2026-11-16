"""Dev-only seed: creates the accounts the Step 2 auth screens demo with.

Run (from backend/):

    ../.venv/bin/python scripts/seed_dev.py

- Refuses to run unless ENVIRONMENT=dev — never use this in production.
- Idempotent: existing accounts are left untouched.
- All seeded accounts share one dev password (printed at the end) and are
  email-verified except `pending@forma.dev`, which exists to exercise the
  verify-email / resend flow.

This is the Step 2 replacement for the old inline demo behaviour: the UI
stays populated in development without any seed data living in migrations.
"""

from __future__ import annotations

import asyncio
import sys
from datetime import UTC, datetime
from pathlib import Path

# Allow `python scripts/seed_dev.py` from backend/ without installing the pkg.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.session import async_session_factory, engine  # noqa: E402
from app.models.user import AccountStatus, ReviewState, User, UserRole, UserRoleRow  # noqa: E402

DEV_PASSWORD = "Forma-Dev-2026!"

# (email, display name, role, verified?)
SEED_USERS = [
    ("founder@forma.dev", "Aarav Sharma", UserRole.startup, True),
    ("mentor@forma.dev", "Meera Iyer", UserRole.mentor, True),
    ("investor@forma.dev", "Rohan Kapoor", UserRole.investor, True),
    ("jobseeker@forma.dev", "Priya Nair", UserRole.jobseeker, True),
    ("employer@forma.dev", "Vikram Singh", UserRole.employer, True),
    ("pending@forma.dev", "Unverified User", UserRole.startup, False),
]


async def seed() -> None:
    settings = get_settings()
    if settings.ENVIRONMENT != "dev":
        raise SystemExit(
            f"Refusing to seed: ENVIRONMENT={settings.ENVIRONMENT!r} (this script is dev-only)."
        )

    now = datetime.now(UTC)
    created, skipped = [], []

    async with async_session_factory() as db:
        for email, name, role, verified in SEED_USERS:
            existing = (
                await db.execute(select(User).where(User.primary_email == email))
            ).scalar_one_or_none()
            if existing is not None and existing.deleted_at is None:
                skipped.append(email)
                continue

            user = User(
                primary_email=email,
                password_hash=hash_password(DEV_PASSWORD),
                display_name=name,
                locale="en-IN",
                timezone="Asia/Kolkata",
                status=AccountStatus.active if verified else AccountStatus.pending,
                verification=ReviewState.pending if verified else ReviewState.unverified,
                email_verified_at=now if verified else None,
            )
            db.add(user)
            await db.flush()
            db.add(UserRoleRow(user_id=user.id, role=role, is_primary=True))
            created.append(f"{email} ({role.value})")

        await db.commit()

    await engine.dispose()

    print("Seeded (dev only):")
    for line in created:
        print(f"  + {line}")
    for line in skipped:
        print(f"  = {line} (already exists)")
    print(f"\nPassword for all seeded accounts: {DEV_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(seed())
