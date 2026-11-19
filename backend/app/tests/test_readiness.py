"""Step 5f tests: readiness — bootstrap, board, state machine, scoring,
permissions and the deferred ``tasks.readiness_id`` link.

Covers the BUILD_PLAN 5f done-when list (evidence can be submitted, a
sign-off changes the score, a startup member can never sign off or edit
the score) plus the security matrix from the approved plan:

- happy path per transition (submit -> sign-off, submit -> withdraw,
  submit -> reject -> re-submit) and the score cached on the profile;
- validation: evidence required before submit (422), mass-assignment of
  server-controlled fields (422), over-long evidence/notes (422), blank
  rejection reason (422);
- 401 without a token on every route;
- 403 for a viewer writing, for a startup owner/admin/member calling
  sign-off or reject, and for an outsider reading/writing another org;
- 404 for an unknown criterion and for a non-startup organization;
- cross-organization ``tasks.readiness_id`` (422, never a 404 oracle);
- the idempotent criteria bootstrap (run twice: no duplicates);
- ``startup_profiles.readiness_score`` is only ever written by the server.
"""

import re
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.readiness import (
    ReadinessCriterion,
    ReadinessStatus,
    StartupReadiness,
)
from app.models.startup import StartupProfile
from app.models.user import User, UserRole, UserRoleRow
from app.services import email_service, readiness_service

PASSWORD = "Str0ng!Password99"

# Plan D2: the six approved machine keys, in page order.
EXPECTED_CODES = [
    "pitch_deck_summary",
    "business_model_economics",
    "financial_projections",
    "cap_table_legal",
    "traction_metrics",
    "data_room_complete",
]


# --- helpers ----------------------------------------------------------------


def _extract_code() -> str:
    assert email_service.SENT_EMAILS, "expected a verification email"
    body = email_service.SENT_EMAILS[-1]["body"]
    match = re.search(r"(\d{6})", body)
    assert match, f"no 6-digit code in email body: {body!r}"
    return match.group(1)


async def _signup_verified(
    client: AsyncClient, email: str, role: str = "startup"
) -> dict:
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
    code = _extract_code()
    verify = await client.post(
        "/api/v1/auth/verify-email", json={"email": email, "code": code}
    )
    assert verify.status_code == 200, verify.text
    login = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert login.status_code == 200, login.text
    return {
        "email": email,
        "headers": {"Authorization": f"Bearer {login.json()['access_token']}"},
    }


async def _make_platform_admin(
    client: AsyncClient, db_session: AsyncSession, email: str = "admin@example.com"
) -> dict:
    """Register a normal user, then grant the ``admin`` role out of band.

    The public API refuses to grant ``admin`` (test_auth covers that), so
    this mirrors how the dev seed / the future 15a bootstrap creates the
    platform admin: a direct ``user_roles`` row.
    """
    auth = await _signup_verified(client, email)
    result = await db_session.execute(
        select(User).where(User.primary_email == email)
    )
    user = result.scalar_one()
    db_session.add(
        UserRoleRow(user_id=user.id, role=UserRole.admin, is_primary=False)
    )
    await db_session.commit()
    return auth


async def _create_org(
    client: AsyncClient, auth: dict, *, name: str = "Acme Rockets", type_: str = "startup"
) -> dict:
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": name, "type": type_},
        headers=auth["headers"],
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _invite_member(
    client: AsyncClient, owner: dict, invitee: dict, org: dict, role: str = "member"
) -> None:
    resp = await client.post(
        f"/api/v1/organizations/{org['id']}/invites",
        json={"email": invitee["email"], "role": role},
        headers=owner["headers"],
    )
    assert resp.status_code == 201, resp.text
    accept = await client.post(
        f"/api/v1/invites/{resp.json()['token']}/accept", headers=invitee["headers"]
    )
    assert accept.status_code == 200, accept.text


async def _seed_criteria(db_session: AsyncSession) -> None:
    await readiness_service.bootstrap_criteria(db_session)


def _board_url(org_id: str) -> str:
    return f"/api/v1/organizations/{org_id}/readiness"


def _item_url(org_id: str, criterion_id: str, action: str = "") -> str:
    base = f"/api/v1/organizations/{org_id}/readiness/{criterion_id}"
    return f"{base}/{action}" if action else base


async def _criteria(client: AsyncClient, auth: dict) -> dict[str, dict]:
    resp = await client.get("/api/v1/readiness/criteria", headers=auth["headers"])
    assert resp.status_code == 200, resp.text
    return {row["code"]: row for row in resp.json()}


async def _first_id(client: AsyncClient, auth: dict, code: str) -> str:
    return (await _criteria(client, auth))[code]["id"]


async def _board(client: AsyncClient, auth: dict, org_id: str, expect: int = 200) -> dict:
    resp = await client.get(_board_url(org_id), headers=auth["headers"])
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 200 else {}


async def _patch(
    client: AsyncClient,
    auth: dict,
    org_id: str,
    criterion_id: str,
    payload: dict,
    expect: int = 200,
) -> dict:
    resp = await client.patch(
        _item_url(org_id, criterion_id), json=payload, headers=auth["headers"]
    )
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 200 else {}


async def _action(
    client: AsyncClient,
    auth: dict,
    org_id: str,
    criterion_id: str,
    action: str,
    payload: dict | None = None,
    expect: int = 200,
) -> dict:
    resp = await client.post(
        _item_url(org_id, criterion_id, action),
        json=payload if payload is not None else None,
        headers=auth["headers"],
    )
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 200 else {}


async def _profile_score(db_session: AsyncSession, org_id: str) -> int | None:
    result = await db_session.execute(
        select(StartupProfile.readiness_score).where(
            StartupProfile.org_id == uuid.UUID(org_id)
        )
    )
    return result.scalar_one_or_none()


async def _ready_org(
    client: AsyncClient, db_session: AsyncSession
) -> tuple[dict, dict, dict]:
    """Founder + org + seeded criteria + one item with evidence, submitted."""
    await _seed_criteria(db_session)
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    criterion_id = await _first_id(client, founder, "pitch_deck_summary")
    await _patch(
        client,
        founder,
        org["id"],
        criterion_id,
        {"evidence": "Deck v4, reviewed by two mentors."},
    )
    submitted = await _action(
        client, founder, org["id"], criterion_id, "submit"
    )
    return founder, org, submitted


# --- bootstrap / reference data ---------------------------------------------


@pytest.mark.asyncio
async def test_bootstrap_is_idempotent_and_ordered(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    # Step 5i extended this bootstrap to also publish the 25 stage exit
    # criteria (is_exit_criterion=True), so the total is 31. The six
    # readiness items below are unchanged, and they are the ones this test
    # is about.
    first = await readiness_service.bootstrap_criteria(db_session)
    assert first == (31, 0)
    second = await readiness_service.bootstrap_criteria(db_session)
    assert second == (0, 0)

    count = (
        await db_session.execute(select(func.count(ReadinessCriterion.id)))
    ).scalar_one()
    assert count == 31

    rows = (
        await db_session.execute(
            select(ReadinessCriterion)
            .where(ReadinessCriterion.is_exit_criterion.is_(False))
            .order_by(ReadinessCriterion.display_order)
        )
    ).scalars().all()
    assert [row.code for row in rows] == EXPECTED_CODES
    assert [row.display_order for row in rows] == [1, 2, 3, 4, 5, 6]
    # Plan D1: unweighted scoring, the weight column is reserved at 1.
    assert {row.weight for row in rows} == {1}
    assert all(row.is_active for row in rows)


@pytest.mark.asyncio
async def test_bootstrap_reactivates_and_updates_wording(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await readiness_service.bootstrap_criteria(db_session)
    row = (
        await db_session.execute(
            select(ReadinessCriterion).where(
                ReadinessCriterion.code == "cap_table_legal"
            )
        )
    ).scalar_one()
    row.title = "Stale wording"
    row.is_active = False
    await db_session.commit()

    inserted, updated = await readiness_service.bootstrap_criteria(db_session)
    assert (inserted, updated) == (0, 1)
    await db_session.refresh(row)
    assert row.title == "Cap table and legal basics in order"
    assert row.is_active is True


@pytest.mark.asyncio
async def test_criteria_endpoint_requires_auth_and_returns_reference_rows(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _seed_criteria(db_session)
    resp = await client.get("/api/v1/readiness/criteria")
    assert resp.status_code == 401, resp.text

    founder = await _signup_verified(client, "founder@example.com")
    rows = await _criteria(client, founder)
    assert list(rows) == EXPECTED_CODES
    row = rows["pitch_deck_summary"]
    assert row["title"] == "Pitch deck and one-page summary reviewed"
    assert row["stage"] == "prototype"
    assert row["weight"] == 1
    assert row["display_order"] == 1
    # Reference data carries no per-org state.
    assert "status" not in row and "evidence" not in row


# --- board: create-on-demand, summary, permissions ---------------------------


@pytest.mark.asyncio
async def test_board_persists_not_started_rows_and_zero_score(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _seed_criteria(db_session)
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    # No profile yet: the board is the first contact and creates it.
    assert await _profile_score(db_session, org["id"]) is None

    board = await _board(client, founder, org["id"])
    assert board["org_id"] == org["id"]
    assert [item["code"] for item in board["items"]] == EXPECTED_CODES
    assert all(item["status"] == "not_started" for item in board["items"])
    assert board["summary"] == {
        "criteria_total": 6,
        "criteria_signed_off": 0,
        "readiness_pct": 0,
        "is_ready": False,
    }
    assert await _profile_score(db_session, org["id"]) == 0

    # Plan D5: the read materialised one row per criterion...
    stored = (
        await db_session.execute(
            select(func.count(StartupReadiness.id)).where(
                StartupReadiness.org_id == uuid.UUID(org["id"])
            )
        )
    ).scalar_one()
    assert stored == 6

    # ...and a second read is stable (no duplicates, same answer).
    again = await _board(client, founder, org["id"])
    assert again["summary"] == board["summary"]
    again_stored = (
        await db_session.execute(
            select(func.count(StartupReadiness.id)).where(
                StartupReadiness.org_id == uuid.UUID(org["id"])
            )
        )
    ).scalar_one()
    assert again_stored == 6


@pytest.mark.asyncio
async def test_viewer_reads_board_but_cannot_write(client: AsyncClient, db_session) -> None:
    await _seed_criteria(db_session)
    owner = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, owner)
    viewer = await _signup_verified(client, "viewer@example.com")
    await _invite_member(client, owner, viewer, org, role="viewer")
    criterion_id = await _first_id(client, owner, "pitch_deck_summary")

    board = await _board(client, viewer, org["id"])
    assert board["summary"]["criteria_total"] == 6
    resp = await client.get(
        _item_url(org["id"], criterion_id), headers=viewer["headers"]
    )
    assert resp.status_code == 200, resp.text

    await _patch(
        client, viewer, org["id"], criterion_id, {"evidence": "nope"}, expect=403
    )
    await _action(client, viewer, org["id"], criterion_id, "submit", expect=403)
    await _action(client, viewer, org["id"], criterion_id, "withdraw", expect=403)


@pytest.mark.asyncio
async def test_non_member_and_other_org_are_forbidden_or_404(
    client: AsyncClient, db_session
) -> None:
    await _seed_criteria(db_session)
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    criterion_id = await _first_id(client, founder, "pitch_deck_summary")

    outsider = await _signup_verified(client, "outsider@example.com")
    resp = await client.get(_board_url(org["id"]), headers=outsider["headers"])
    assert resp.status_code == 403, resp.text
    resp = await client.get(
        _item_url(org["id"], criterion_id), headers=outsider["headers"]
    )
    assert resp.status_code == 403, resp.text

    # Wrong organization type is a 404, never an existence oracle.
    employer = await _signup_verified(client, "employer@example.com", role="employer")
    company = await _create_org(client, employer, name="Hiring Co", type_="employer")
    resp = await client.get(_board_url(company["id"]), headers=employer["headers"])
    assert resp.status_code == 404, resp.text

    # Unknown / inactive criteria are 404 for a legitimate member.
    resp = await client.get(
        _item_url(org["id"], str(uuid.uuid4())), headers=founder["headers"]
    )
    assert resp.status_code == 404, resp.text


@pytest.mark.asyncio
async def test_single_item_read_keeps_cached_score_set(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """A first item read creates the profile row; it must not be left NULL.

    Step 5g's dashboard reads the cached column, so 0 (never NULL) is the
    answer for a startup with no signed-off criteria (plan D1).
    """
    await _seed_criteria(db_session)
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    criterion_id = await _first_id(client, founder, "pitch_deck_summary")

    assert await _profile_score(db_session, org["id"]) is None
    resp = await client.get(
        _item_url(org["id"], criterion_id), headers=founder["headers"]
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "not_started"
    assert await _profile_score(db_session, org["id"]) == 0


# --- happy path: the whole state machine ------------------------------------


@pytest.mark.asyncio
async def test_full_lifecycle_changes_score_and_stamps_admin(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _seed_criteria(db_session)
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    admin = await _make_platform_admin(client, db_session)
    criterion_id = await _first_id(client, founder, "pitch_deck_summary")

    # 1. Evidence first: the untouched item becomes in_progress.
    item = await _patch(
        client,
        founder,
        org["id"],
        criterion_id,
        {
            "evidence": "  Deck v4 and a one-pager, reviewed by two mentors.  ",
            "notes": "Happy to walk through it.",
        },
    )
    assert item["status"] == "in_progress"
    assert item["evidence"] == "Deck v4 and a one-pager, reviewed by two mentors."
    assert item["signed_off_by"] is None
    assert item["signed_off_at"] is None

    # 2. Submit for review.
    item = await _action(client, founder, org["id"], criterion_id, "submit")
    assert item["status"] == "submitted"

    # 3. Platform admin signs off; the score moves in the same transaction.
    signed = await _action(client, admin, org["id"], criterion_id, "sign-off")
    assert signed["status"] == "signed_off"
    assert signed["signed_off_at"] is not None
    assert signed["signed_off_by"] is not None

    board = await _board(client, founder, org["id"])
    assert board["summary"] == {
        "criteria_total": 6,
        "criteria_signed_off": 1,
        "readiness_pct": 17,
        "is_ready": False,
    }
    assert await _profile_score(db_session, org["id"]) == 17

    # 4. Editing signed-off evidence re-opens the item and drops the score:
    #    no score may credit evidence that was never reviewed.
    reopened = await _patch(
        client, founder, org["id"], criterion_id, {"evidence": "Deck v5."}
    )
    assert reopened["status"] == "in_progress"
    assert reopened["signed_off_by"] is None
    assert reopened["signed_off_at"] is None
    assert await _profile_score(db_session, org["id"]) == 0


@pytest.mark.asyncio
async def test_all_criteria_signed_off_reaches_one_hundred(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _seed_criteria(db_session)
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    admin = await _make_platform_admin(client, db_session)

    for criterion_id in [
        row["id"] for row in (await _criteria(client, founder)).values()
    ]:
        await _patch(
            client, founder, org["id"], criterion_id, {"evidence": "Done."}
        )
        await _action(client, founder, org["id"], criterion_id, "submit")
        await _action(client, admin, org["id"], criterion_id, "sign-off")

    board = await _board(client, founder, org["id"])
    assert board["summary"] == {
        "criteria_total": 6,
        "criteria_signed_off": 6,
        "readiness_pct": 100,
        "is_ready": True,
    }
    assert await _profile_score(db_session, org["id"]) == 100


@pytest.mark.asyncio
async def test_withdraw_and_reject_return_to_work(client: AsyncClient, db_session) -> None:
    await _seed_criteria(db_session)
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    admin = await _make_platform_admin(client, db_session)
    criterion_id = await _first_id(client, founder, "financial_projections")

    await _patch(client, founder, org["id"], criterion_id, {"evidence": "Model v1."})
    await _action(client, founder, org["id"], criterion_id, "submit")

    withdrawn = await _action(client, founder, org["id"], criterion_id, "withdraw")
    assert withdrawn["status"] == "in_progress"

    # A withdrawn item cannot be withdrawn again (409).
    await _action(client, founder, org["id"], criterion_id, "withdraw", expect=409)

    await _action(client, founder, org["id"], criterion_id, "submit")
    rejected = await _action(
        client,
        admin,
        org["id"],
        criterion_id,
        "reject",
        {"reason": "Runway math does not match the burn."},
    )
    assert rejected["status"] == "rejected"
    assert rejected["notes"] == "Runway math does not match the burn."
    assert rejected["signed_off_by"] is None

    # Plan D6: a rejected item is reworked and re-submitted; the new
    # submission clears the old decision.
    await _patch(client, founder, org["id"], criterion_id, {"evidence": "Model v2."})
    resubmitted = await _action(client, founder, org["id"], criterion_id, "submit")
    assert resubmitted["status"] == "submitted"
    assert resubmitted["signed_off_at"] is None


@pytest.mark.asyncio
async def test_illegal_transitions_are_conflict(client: AsyncClient, db_session) -> None:
    founder, org, submitted = await _ready_org(client, db_session)
    admin = await _make_platform_admin(client, db_session)
    criterion_id = submitted["criterion_id"]

    # Double submit, sign-off of a non-submitted item, withdraw after sign-off.
    await _action(client, founder, org["id"], criterion_id, "submit", expect=409)
    second = await _first_id(client, founder, "traction_metrics")
    await _action(client, admin, org["id"], second, "sign-off", expect=409)
    await _action(client, founder, org["id"], second, "withdraw", expect=409)

    await _action(client, admin, org["id"], criterion_id, "sign-off")
    await _action(client, founder, org["id"], criterion_id, "withdraw", expect=409)
    await _action(client, admin, org["id"], criterion_id, "sign-off", expect=409)


@pytest.mark.asyncio
async def test_signed_off_item_cannot_be_rejected(client: AsyncClient, db_session) -> None:
    _, org, submitted = await _ready_org(client, db_session)
    admin = await _make_platform_admin(client, db_session)
    criterion_id = submitted["criterion_id"]

    await _action(client, admin, org["id"], criterion_id, "sign-off")
    await _action(
        client,
        admin,
        org["id"],
        criterion_id,
        "reject",
        {"reason": "Changed my mind."},
        expect=409,
    )


# --- validation --------------------------------------------------------------


@pytest.mark.asyncio
async def test_submit_without_evidence_is_422(client: AsyncClient, db_session) -> None:
    await _seed_criteria(db_session)
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    criterion_id = await _first_id(client, founder, "pitch_deck_summary")

    resp = await client.post(
        _item_url(org["id"], criterion_id, "submit"), headers=founder["headers"]
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"

    # Blank / whitespace-only evidence does not count either.
    await _patch(client, founder, org["id"], criterion_id, {"evidence": "   "})
    resp = await client.post(
        _item_url(org["id"], criterion_id, "submit"), headers=founder["headers"]
    )
    assert resp.status_code == 422, resp.text


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "field,value",
    [
        ("status", "signed_off"),
        ("score", 100),
        ("signed_off_by", "00000000-0000-0000-0000-000000000000"),
        ("evidence", "x" * 2001),
        ("notes", "x" * 2001),
    ],
)
async def test_patch_rejects_server_owned_and_oversized_fields(
    client: AsyncClient, db_session, field: str, value: object
) -> None:
    await _seed_criteria(db_session)
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    criterion_id = await _first_id(client, founder, "pitch_deck_summary")

    await _patch(client, founder, org["id"], criterion_id, {field: value}, expect=422)
    # Nothing was written by the rejected attempt.
    stored = (
        await db_session.execute(
            select(StartupReadiness).where(
                StartupReadiness.org_id == uuid.UUID(org["id"]),
                StartupReadiness.criterion_id == uuid.UUID(criterion_id),
            )
        )
    ).scalar_one_or_none()
    assert stored is None or stored.status == ReadinessStatus.not_started


@pytest.mark.asyncio
async def test_reject_requires_a_reason(client: AsyncClient, db_session) -> None:
    founder, org, submitted = await _ready_org(client, db_session)
    admin = await _make_platform_admin(client, db_session)
    criterion_id = submitted["criterion_id"]

    await _action(
        client, admin, org["id"], criterion_id, "reject", {"reason": "   "}, expect=422
    )
    await _action(client, admin, org["id"], criterion_id, "reject", {}, expect=422)
    # Still awaiting review, not silently rejected (read as the founder:
    # the platform admin is deliberately not an org member).
    board = await _board(client, founder, org["id"])
    item = next(i for i in board["items"] if i["criterion_id"] == criterion_id)
    assert item["status"] == "submitted"


@pytest.mark.asyncio
async def test_malformed_ids_are_422(client: AsyncClient, db_session) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    resp = await client.get(
        f"/api/v1/organizations/{org['id']}/readiness/not-a-uuid",
        headers=founder["headers"],
    )
    assert resp.status_code == 422, resp.text


# --- authentication / authorization -----------------------------------------


@pytest.mark.asyncio
async def test_all_routes_require_authentication(client: AsyncClient, db_session) -> None:
    await _seed_criteria(db_session)
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    criterion_id = await _first_id(client, founder, "pitch_deck_summary")

    assert (await client.get("/api/v1/readiness/criteria")).status_code == 401
    assert (await client.get(_board_url(org["id"]))).status_code == 401
    assert (
        await client.get(_item_url(org["id"], criterion_id))
    ).status_code == 401
    assert (
        await client.patch(
            _item_url(org["id"], criterion_id), json={"evidence": "x"}
        )
    ).status_code == 401
    for action in ("submit", "withdraw", "sign-off"):
        resp = await client.post(_item_url(org["id"], criterion_id, action))
        assert resp.status_code == 401, (action, resp.text)
    resp = await client.post(
        _item_url(org["id"], criterion_id, "reject"), json={"reason": "no"}
    )
    assert resp.status_code == 401, resp.text


@pytest.mark.asyncio
@pytest.mark.parametrize("org_role", ["owner", "admin", "member"])
async def test_startup_member_can_never_sign_off_or_reject(
    client: AsyncClient, db_session, org_role: str
) -> None:
    """BUILD_PLAN 5f done-when: no startup member signs off or edits scores."""
    founder, org, submitted = await _ready_org(client, db_session)
    criterion_id = submitted["criterion_id"]

    actor = founder
    if org_role != "owner":
        actor = await _signup_verified(client, f"{org_role}@example.com")
        await _invite_member(client, founder, actor, org, role=org_role)

    await _action(client, actor, org["id"], criterion_id, "sign-off", expect=403)
    await _action(
        client,
        actor,
        org["id"],
        criterion_id,
        "reject",
        {"reason": "self-review"},
        expect=403,
    )
    # The score and the status are untouched by the attempts.
    board = await _board(client, founder, org["id"])
    item = next(i for i in board["items"] if i["criterion_id"] == criterion_id)
    assert item["status"] == "submitted"
    assert board["summary"]["criteria_signed_off"] == 0
    assert await _profile_score(db_session, org["id"]) == 0


@pytest.mark.asyncio
async def test_platform_admin_cannot_edit_evidence(
    client: AsyncClient, db_session
) -> None:
    """Sign-off is a decision, not an edit: the admin is not an org member."""
    _, org, submitted = await _ready_org(client, db_session)
    admin = await _make_platform_admin(client, db_session)

    await _patch(
        client,
        admin,
        org["id"],
        submitted["criterion_id"],
        {"evidence": "Rewritten by the reviewer."},
        expect=403,
    )


@pytest.mark.asyncio
async def test_score_is_never_client_writable(client: AsyncClient, db_session) -> None:
    """The only writer of ``startup_profiles.readiness_score`` is the server."""
    founder, org, submitted = await _ready_org(client, db_session)
    admin = await _make_platform_admin(client, db_session)

    # The startup profile PATCH does not accept a score either.
    resp = await client.patch(
        f"/api/v1/organizations/{org['id']}/startup-profile",
        json={"readiness_score": 100},
        headers=founder["headers"],
    )
    assert resp.status_code == 422, resp.text

    await _action(client, admin, org["id"], submitted["criterion_id"], "sign-off")
    assert await _profile_score(db_session, org["id"]) == 17
    # And the read-only board exposes it as a derived summary only.
    board = await _board(client, founder, org["id"])
    assert "readiness_score" not in board
    assert board["summary"]["readiness_pct"] == 17


# --- the deferred tasks.readiness_id link (5c D1 -> 5f item 5) --------------


@pytest.mark.asyncio
async def test_task_can_link_a_same_org_readiness_item(
    client: AsyncClient, db_session
) -> None:
    founder, org, submitted = await _ready_org(client, db_session)
    readiness_row_id = submitted["id"]

    resp = await client.post(
        f"/api/v1/organizations/{org['id']}/tasks",
        json={"title": "Collect the deck"},
        headers=founder["headers"],
    )
    assert resp.status_code == 201, resp.text
    task = resp.json()
    # TaskCreate deliberately has no readiness_id: a new task starts unlinked.
    assert task["readiness_id"] is None

    resp = await client.patch(
        f"/api/v1/organizations/{org['id']}/tasks/{task['id']}",
        json={"readiness_id": readiness_row_id},
        headers=founder["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["readiness_id"] == readiness_row_id

    # The list read carries it back.
    page = await client.get(
        f"/api/v1/organizations/{org['id']}/tasks", headers=founder["headers"]
    )
    assert page.json()["items"][0]["readiness_id"] == readiness_row_id

    # Explicit null unlinks.
    resp = await client.patch(
        f"/api/v1/organizations/{org['id']}/tasks/{task['id']}",
        json={"readiness_id": None},
        headers=founder["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["readiness_id"] is None


@pytest.mark.asyncio
async def test_task_create_rejects_readiness_id(client: AsyncClient, db_session) -> None:
    founder, org, submitted = await _ready_org(client, db_session)
    resp = await client.post(
        f"/api/v1/organizations/{org['id']}/tasks",
        json={"title": "Bad", "readiness_id": submitted["id"]},
        headers=founder["headers"],
    )
    assert resp.status_code == 422, resp.text


@pytest.mark.asyncio
async def test_task_link_to_other_org_readiness_is_422(
    client: AsyncClient, db_session
) -> None:
    founder, org, submitted = await _ready_org(client, db_session)

    # A second founder with their own org and their own readiness row.
    other = await _signup_verified(client, "other@example.com")
    other_org = await _create_org(client, other, name="Other Rockets")
    board = await _board(client, other, other_org["id"])
    other_readiness_row = board["items"][0]["id"]

    resp = await client.post(
        f"/api/v1/organizations/{org['id']}/tasks",
        json={"title": "Cross org"},
        headers=founder["headers"],
    )
    task_id = resp.json()["id"]
    resp = await client.patch(
        f"/api/v1/organizations/{org['id']}/tasks/{task_id}",
        json={"readiness_id": other_readiness_row},
        headers=founder["headers"],
    )
    assert resp.status_code == 422, resp.text
    error = resp.json()["error"]
    assert error["details"][0]["loc"] == ["body", "readiness_id"]

    # A random (nonexistent) readiness id gets the same 422, not a 404:
    # the endpoint never reveals whether a foreign row exists.
    resp = await client.patch(
        f"/api/v1/organizations/{org['id']}/tasks/{task_id}",
        json={"readiness_id": str(uuid.uuid4())},
        headers=founder["headers"],
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["details"][0]["loc"] == ["body", "readiness_id"]
