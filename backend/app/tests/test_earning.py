"""Step 8h tests: mentor earnings.

Covers, per AGENTS.md section 7 and the 8h plan:

- happy path: completing a PAID session creates exactly one earning, with
  ``net == gross - commission - tds`` and status ``pending``,
- idempotency: completing the same session twice cannot double-pay it, and
  a free/zero-fee session creates nothing,
- the arithmetic, including the approved 0% defaults and the rounding rule,
- 401 on both routes without a token,
- 403: a startup role cannot read the mentor's ledger (it is not theirs),
- isolation: a mentor sees ONLY their own rows, even with rows for another
  mentor in the same database,
- validation: an unknown status filter, and pagination bounds,
- the DB CHECK: an inconsistent row is refused by the database itself, not
  merely by the service.
"""

import re
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.earning import EarningStatus, MentorEarning
from app.models.session import MentoringSession
from app.services import earning_service

PASSWORD = "Str0ng!Password99"
GOAL = "Help us sharpen pricing and the go-to-market motion"


def _code() -> str:
    from app.services import email_service

    assert email_service.SENT_EMAILS, "expected a verification email"
    match = re.search(r"(\d{6})", email_service.SENT_EMAILS[-1]["body"])
    assert match, "no 6-digit code in the email body"
    return match.group(1)


async def _signup(client: AsyncClient, email: str, role: str = "startup") -> dict:
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": PASSWORD,
            "display_name": email.split("@")[0].title(),
            "role": role,
        },
    )
    assert resp.status_code == 201, resp.text
    await client.post("/api/v1/auth/verify-email", json={"email": email, "code": _code()})
    login = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    me = await client.get("/api/v1/users/me", headers=headers)
    return {"email": email, "headers": headers, "id": me.json()["id"]}


async def _mentor(client: AsyncClient, email: str) -> dict:
    auth = await _signup(client, email, role="mentor")
    saved = await client.patch(
        "/api/v1/mentor-profile/me",
        json={"headline": "Advisor", "accepting_requests": True},
        headers=auth["headers"],
    )
    assert saved.status_code == 200, saved.text
    return auth


async def _org(client: AsyncClient, owner: dict, name: str = "Acme") -> str:
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": name, "type": "startup"},
        headers=owner["headers"],
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _pair(client: AsyncClient, tag: str = "h8") -> dict:
    founder = await _signup(client, f"founder-{tag}@h8.dev")
    mentor = await _mentor(client, f"mentor-{tag}@h8.dev")
    org_id = await _org(client, founder, f"Co {tag}")
    created = await client.post(
        f"/api/v1/organizations/{org_id}/mentorships",
        json={"mentor_id": mentor["id"], "goal": GOAL},
        headers=founder["headers"],
    )
    assert created.status_code == 201, created.text
    mid = created.json()["id"]
    accepted = await client.post(
        f"/api/v1/mentorships/{mid}/accept", json={}, headers=mentor["headers"]
    )
    assert accepted.status_code == 200, accepted.text
    return {"founder": founder, "mentor": mentor, "org_id": org_id, "mid": mid}


def _at(days: int = 5) -> str:
    when = (datetime.now(UTC) + timedelta(days=days)).replace(
        hour=15, minute=0, second=0, microsecond=0
    )
    return when.isoformat()


async def _complete_session(
    client: AsyncClient, ctx: dict, *, fee: str | None = "5000.00"
) -> dict:
    """Schedule a session (optionally with a fee) and complete it as the mentor."""
    payload: dict = {"scheduled_at": _at(), "duration_min": 45, "topic": "Go-to-market and pricing"}
    if fee is not None:
        payload["fee_amount"] = fee
    created = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json=payload,
        headers=ctx["mentor"]["headers"],
    )
    assert created.status_code == 201, created.text
    sid = created.json()["id"]
    done = await client.post(
        f"/api/v1/sessions/{sid}/complete",
        json={"summary": "Reviewed the pricing model and next experiments."},
        headers=ctx["mentor"]["headers"],
    )
    assert done.status_code == 200, done.text
    return done.json()


# ------------------------------------------------------------------ happy path


async def test_completing_a_paid_session_creates_one_earning(
    client: AsyncClient,
) -> None:
    ctx = await _pair(client, "paid")
    await _complete_session(client, ctx, fee="5000.00")

    listed = await client.get(
        "/api/v1/mentor/earnings", headers=ctx["mentor"]["headers"]
    )
    assert listed.status_code == 200, listed.text
    assert listed.json()["total"] == 1
    row = listed.json()["items"][0]
    assert Decimal(row["gross_amount"]) == Decimal("5000.00")
    # Approved Q2a: both rates default to 0, so net == gross and the
    # arithmetic is honest rather than guessed.
    assert Decimal(row["commission_amount"]) == Decimal("0.00")
    assert Decimal(row["tds_amount"]) == Decimal("0.00")
    assert Decimal(row["net_amount"]) == Decimal("5000.00")
    assert row["status"] == "pending"
    assert row["currency"] == "INR"
    assert row["payout_batch_id"] is None
    # Joined display context (D3): the table can name the startup and the
    # session without one extra call per row.
    assert row["startup_name"] == "Co paid"
    assert row["session_topic"] == "Go-to-market and pricing"


async def test_summary_totals(client: AsyncClient) -> None:
    ctx = await _pair(client, "sum")
    await _complete_session(client, ctx, fee="5000.00")

    resp = await client.get(
        "/api/v1/mentor/earnings/summary", headers=ctx["mentor"]["headers"]
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert Decimal(body["pending_amount"]) == Decimal("5000.00")
    assert Decimal(body["paid_amount"]) == Decimal("0.00")
    assert Decimal(body["lifetime_amount"]) == Decimal("5000.00")
    assert body["pending_count"] == 1
    assert body["session_count"] == 1


async def test_empty_summary_is_zero_not_error(client: AsyncClient) -> None:
    mentor = await _mentor(client, "empty@h8.dev")
    resp = await client.get("/api/v1/mentor/earnings/summary", headers=mentor["headers"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert Decimal(body["pending_amount"]) == Decimal("0.00")
    assert Decimal(body["lifetime_amount"]) == Decimal("0.00")
    assert body["pending_count"] == 0


async def test_free_session_creates_no_earning(client: AsyncClient) -> None:
    ctx = await _pair(client, "free")
    await _complete_session(client, ctx, fee=None)
    resp = await client.get("/api/v1/mentor/earnings", headers=ctx["mentor"]["headers"])
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 0


async def test_zero_fee_creates_no_earning(client: AsyncClient) -> None:
    ctx = await _pair(client, "zero")
    await _complete_session(client, ctx, fee="0.00")
    resp = await client.get("/api/v1/mentor/earnings", headers=ctx["mentor"]["headers"])
    assert resp.json()["total"] == 0


async def test_recompleting_cannot_double_pay(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """A second completion attempt must not create a second earning.

    The route refuses the transition anyway, so the guard is also exercised
    directly on the service: that is the layer 14f and any future worker
    will call.
    """
    ctx = await _pair(client, "dupe")
    body = await _complete_session(client, ctx, fee="1000.00")

    again = await client.post(
        f"/api/v1/sessions/{body['id']}/complete",
        json={"summary": "Trying to complete twice."},
        headers=ctx["mentor"]["headers"],
    )
    assert again.status_code == 409, again.text

    session_row = await db_session.get(MentoringSession, uuid.UUID(body["id"]))
    assert session_row is not None
    second = await earning_service.record_for_session(
        db_session, session_row, uuid.UUID(ctx["mentor"]["id"])
    )
    assert second is None
    await db_session.commit()

    listed = await client.get(
        "/api/v1/mentor/earnings", headers=ctx["mentor"]["headers"]
    )
    assert listed.json()["total"] == 1


# ------------------------------------------------------------------ arithmetic


def test_compute_amounts_rounds_half_up(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "MENTOR_COMMISSION_PCT", Decimal("10"))
    monkeypatch.setattr(settings, "MENTOR_TDS_PCT", Decimal("2"))
    # 1000: commission 100.00, tds 20.00, net 880.00
    assert earning_service.compute_amounts(Decimal("1000.00")) == (
        Decimal("100.00"),
        Decimal("20.00"),
        Decimal("880.00"),
    )
    # 33.33: commission 3.333 -> 3.33, tds 0.6666 -> 0.67 (half-up),
    # net is derived FROM those, so the CHECK always holds.
    commission, tds, net = earning_service.compute_amounts(Decimal("33.33"))
    assert commission == Decimal("3.33")
    assert tds == Decimal("0.67")
    assert net == Decimal("33.33") - commission - tds


def test_default_rates_are_zero() -> None:
    """Q2a: no rate is invented. Finance/legal supply them before 14f."""
    from app.core.config import get_settings

    settings = get_settings()
    assert settings.MENTOR_COMMISSION_PCT == Decimal("0")
    assert settings.MENTOR_TDS_PCT == Decimal("0")


async def test_database_refuses_inconsistent_math(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """The CHECK is real: net must equal what the parts say."""
    ctx = await _pair(client, "check")
    await _complete_session(client, ctx, fee="500.00")
    db_session.add(
        MentorEarning(
            mentor_id=uuid.UUID(ctx["mentor"]["id"]),
            session_id=None,
            gross_amount=Decimal("100.00"),
            commission_amount=Decimal("0.00"),
            tds_amount=Decimal("0.00"),
            net_amount=Decimal("999.00"),  # lies
            currency="INR",
            status=EarningStatus.pending,
            earned_on=datetime.now(UTC).date(),
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()


# ------------------------------------------------------------------ authz


async def test_requires_auth(client: AsyncClient) -> None:
    for path in ("/api/v1/mentor/earnings", "/api/v1/mentor/earnings/summary"):
        resp = await client.get(path)
        assert resp.status_code == 401, (path, resp.text)


@pytest.mark.parametrize(
    "path", ["/api/v1/mentor/earnings", "/api/v1/mentor/earnings/summary"]
)
async def test_startup_role_forbidden(client: AsyncClient, path: str) -> None:
    """A startup founder has no business reading a mentor's ledger."""
    founder = await _signup(client, f"founder-x{uuid.uuid4().hex[:6]}@h8.dev")
    resp = await client.get(path, headers=founder["headers"])
    assert resp.status_code == 403, resp.text


async def test_a_mentor_sees_only_their_own_rows(client: AsyncClient) -> None:
    a = await _pair(client, "iso-a")
    b = await _pair(client, "iso-b")
    await _complete_session(client, a, fee="1111.00")
    await _complete_session(client, b, fee="2222.00")

    only_a = await client.get("/api/v1/mentor/earnings", headers=a["mentor"]["headers"])
    assert only_a.status_code == 200, only_a.text
    assert only_a.json()["total"] == 1
    assert Decimal(only_a.json()["items"][0]["net_amount"]) == Decimal("1111.00")

    summary_a = await client.get(
        "/api/v1/mentor/earnings/summary", headers=a["mentor"]["headers"]
    )
    assert Decimal(summary_a.json()["lifetime_amount"]) == Decimal("1111.00")


# ------------------------------------------------------------------ filters


async def test_status_filter_and_pagination(client: AsyncClient) -> None:
    ctx = await _pair(client, "filt")
    for _ in range(3):
        await _complete_session(client, ctx, fee="100.00")

    pending = await client.get(
        "/api/v1/mentor/earnings?status=pending", headers=ctx["mentor"]["headers"]
    )
    assert pending.status_code == 200, pending.text
    assert pending.json()["total"] == 3

    paid = await client.get(
        "/api/v1/mentor/earnings?status=paid", headers=ctx["mentor"]["headers"]
    )
    assert paid.status_code == 200, paid.text
    assert paid.json()["total"] == 0

    paged = await client.get(
        "/api/v1/mentor/earnings?limit=2&offset=0", headers=ctx["mentor"]["headers"]
    )
    assert len(paged.json()["items"]) == 2
    assert paged.json()["total"] == 3


@pytest.mark.parametrize(
    "query",
    ["status=bogus", "limit=0", "limit=51", "offset=-1"],
)
async def test_query_validation(client: AsyncClient, query: str) -> None:
    mentor = await _mentor(client, f"q-{uuid.uuid4().hex[:6]}@h8.dev")
    resp = await client.get(f"/api/v1/mentor/earnings?{query}", headers=mentor["headers"])
    assert resp.status_code == 422, resp.text


async def test_rate_limit(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "EARNING_READ_LIMIT", 1)
    mentor = await _mentor(client, "rate@h8.dev")
    first = await client.get("/api/v1/mentor/earnings", headers=mentor["headers"])
    assert first.status_code == 200, first.text
    blocked = await client.get("/api/v1/mentor/earnings", headers=mentor["headers"])
    assert blocked.status_code == 429, blocked.text
