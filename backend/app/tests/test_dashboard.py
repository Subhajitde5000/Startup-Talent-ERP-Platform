"""Step 5g tests: the read-only dashboard summary.

Covers happy path, authentication and authorization (wrong role, wrong
organization, non-member 403, non-startup org 404), the "no invented
numbers" rule (absent metrics stay absent, unavailable cards are named),
the viewer money restriction (approved D-8), per-caller task scoping (a
member never sees another person's "my tasks") and the empty state of a
brand-new organization.
"""

import re
from datetime import UTC, date, datetime, timedelta

import pytest
from httpx import AsyncClient

from app.services import email_service

PASSWORD = "Str0ng!Password99"


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


async def _create_org(
    client: AsyncClient, auth: dict, *, name: str = "Acme Rockets", type_: str = "startup"
) -> dict:
    resp = await client.post(
        "/api/v1/organizations", json={"name": name, "type": type_}, headers=auth["headers"]
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _user_id(client: AsyncClient, auth: dict) -> str:
    resp = await client.get("/api/v1/users/me", headers=auth["headers"])
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


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


def _summary_url(org_id: str) -> str:
    return f"/api/v1/organizations/{org_id}/dashboard-summary"


async def _summary(
    client: AsyncClient, auth: dict, org_id: str, expect: int = 200
) -> dict:
    resp = await client.get(_summary_url(org_id), headers=auth["headers"])
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 200 else {}


async def _create_task(
    client: AsyncClient,
    auth: dict,
    org_id: str,
    title: str,
    *,
    assignee_id: str | None = None,
    due_on: date | None = None,
) -> dict:
    payload: dict = {"title": title}
    if assignee_id is not None:
        payload["assignee_id"] = assignee_id
    if due_on is not None:
        payload["due_on"] = due_on.isoformat()
    resp = await client.post(
        f"/api/v1/organizations/{org_id}/tasks", json=payload, headers=auth["headers"]
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.fixture
async def team(client: AsyncClient) -> dict:
    owner = await _signup_verified(client, "owner@dash.dev")
    member = await _signup_verified(client, "member@dash.dev")
    viewer = await _signup_verified(client, "viewer@dash.dev")
    org = await _create_org(client, owner)
    await _invite_member(client, owner, member, org, role="member")
    await _invite_member(client, owner, viewer, org, role="viewer")
    outsider = await _signup_verified(client, "outsider@dash.dev")
    return {
        "owner": owner,
        "member": member,
        "viewer": viewer,
        "outsider": outsider,
        "org": org,
        "owner_id": await _user_id(client, owner),
        "member_id": await _user_id(client, member),
    }


# --- happy path -------------------------------------------------------------


async def test_summary_shape(client: AsyncClient, team: dict) -> None:
    body = await _summary(client, team["owner"], team["org"]["id"])
    assert body["org_id"] == team["org"]["id"]
    assert body["org_name"] == team["org"]["name"]
    assert body["my_role"] == "owner"
    for key in (
        "stage",
        "readiness",
        "tasks",
        "milestones",
        "metrics",
        "team",
        "recent_activity",
        "unavailable",
        "restricted",
    ):
        assert key in body, f"missing {key}"
    assert body["stage"]["stage"] == "idea"  # default before 5a saved anything
    assert body["team"]["active_members"] == 3


async def test_every_role_can_read(client: AsyncClient, team: dict) -> None:
    for actor in ("owner", "member", "viewer"):
        body = await _summary(client, team[actor], team["org"]["id"])
        assert body["my_role"] == {"owner": "owner", "member": "member", "viewer": "viewer"}[actor]


async def test_new_org_has_honest_empty_state(client: AsyncClient, team: dict) -> None:
    body = await _summary(client, team["owner"], team["org"]["id"])
    assert body["tasks"]["total_open"] == 0
    assert body["tasks"]["items"] == []
    assert body["milestones"]["total"] == 0
    assert body["milestones"]["next"] is None
    assert body["metrics"] == []  # never zeros
    assert body["readiness"]["criteria_signed_off"] == 0
    assert body["readiness"]["is_ready"] is False


# --- auth / authorization ---------------------------------------------------


async def test_summary_requires_auth(client: AsyncClient, team: dict) -> None:
    resp = await client.get(_summary_url(team["org"]["id"]))
    assert resp.status_code == 401


async def test_non_member_is_403(client: AsyncClient, team: dict) -> None:
    resp = await client.get(
        _summary_url(team["org"]["id"]), headers=team["outsider"]["headers"]
    )
    assert resp.status_code == 403, resp.text


async def test_non_startup_org_is_404(client: AsyncClient, team: dict) -> None:
    # Creating an employer org needs a user who holds the employer role
    # (3b rule), so this is a separate account, not the startup owner.
    employer_user = await _signup_verified(client, "employer@dash.dev", role="employer")
    employer = await _create_org(client, employer_user, name="Hire Co", type_="employer")
    resp = await client.get(
        _summary_url(employer["id"]), headers=team["owner"]["headers"]
    )
    assert resp.status_code == 404, resp.text


async def test_unknown_org_is_404(client: AsyncClient, team: dict) -> None:
    resp = await client.get(
        _summary_url("00000000-0000-0000-0000-000000000000"),
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 404, resp.text


async def test_malformed_org_id_is_422(client: AsyncClient, team: dict) -> None:
    resp = await client.get(
        "/api/v1/organizations/not-a-uuid/dashboard-summary",
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 422


# --- my tasks (per-caller scoping) ------------------------------------------


async def test_my_tasks_are_scoped_to_the_caller(client: AsyncClient, team: dict) -> None:
    org_id = team["org"]["id"]
    await _create_task(client, team["owner"], org_id, "Owner task", assignee_id=team["owner_id"])
    await _create_task(client, team["member"], org_id, "Member task", assignee_id=team["member_id"])

    owner_body = await _summary(client, team["owner"], org_id)
    member_body = await _summary(client, team["member"], org_id)
    assert [t["title"] for t in owner_body["tasks"]["items"]] == ["Owner task"]
    assert owner_body["tasks"]["total_open"] == 1
    assert [t["title"] for t in member_body["tasks"]["items"]] == ["Member task"]
    assert member_body["tasks"]["total_open"] == 1


async def test_unassigned_tasks_are_not_mine(client: AsyncClient, team: dict) -> None:
    await _create_task(client, team["owner"], team["org"]["id"], "Nobody's task")
    body = await _summary(client, team["owner"], team["org"]["id"])
    assert body["tasks"]["total_open"] == 0


async def test_due_counters(client: AsyncClient, team: dict) -> None:
    org_id = team["org"]["id"]
    today = datetime.now(UTC).date()
    await _create_task(
        client, team["owner"], org_id, "Overdue", assignee_id=team["owner_id"],
        due_on=today - timedelta(days=3),
    )
    await _create_task(
        client, team["owner"], org_id, "Today", assignee_id=team["owner_id"], due_on=today
    )
    await _create_task(
        client, team["owner"], org_id, "This week", assignee_id=team["owner_id"],
        due_on=today + timedelta(days=2),
    )
    await _create_task(
        client, team["owner"], org_id, "Next month", assignee_id=team["owner_id"],
        due_on=today + timedelta(days=40),
    )
    body = await _summary(client, team["owner"], org_id)
    tasks = body["tasks"]
    assert tasks["total_open"] == 4
    assert tasks["overdue"] == 1
    assert tasks["due_today"] == 1
    assert tasks["due_this_week"] == 2  # today + the one two days out
    flags = {t["title"]: (t["is_overdue"], t["is_due_today"]) for t in tasks["items"]}
    assert flags["Overdue"] == (True, False)
    assert flags["Today"] == (False, True)


async def test_completed_tasks_are_excluded(client: AsyncClient, team: dict) -> None:
    org_id = team["org"]["id"]
    task = await _create_task(
        client, team["owner"], org_id, "Done soon", assignee_id=team["owner_id"]
    )
    moved = await client.patch(
        f"/api/v1/organizations/{org_id}/tasks/{task['id']}/move",
        json={"status": "done"},
        headers=team["owner"]["headers"],
    )
    assert moved.status_code == 200, moved.text
    body = await _summary(client, team["owner"], org_id)
    assert body["tasks"]["total_open"] == 0


# --- milestones -------------------------------------------------------------


async def test_milestones_section(client: AsyncClient, team: dict) -> None:
    org_id = team["org"]["id"]
    today = datetime.now(UTC).date()
    for name, target, status in [
        ("Shipped", today - timedelta(days=30), "achieved"),
        ("Soon", today + timedelta(days=5), "on_track"),
        ("Later", today + timedelta(days=40), "at_risk"),
    ]:
        resp = await client.post(
            f"/api/v1/organizations/{org_id}/milestones",
            json={"name": name, "target_date": target.isoformat(), "status": status},
            headers=team["owner"]["headers"],
        )
        assert resp.status_code == 201, resp.text

    body = await _summary(client, team["owner"], org_id)
    ms = body["milestones"]
    assert ms["total"] == 3
    assert ms["achieved"] == 1
    assert ms["at_risk"] == 1
    # The next one is the nearest unfinished milestone, never the achieved one.
    assert ms["next"]["name"] == "Soon"


# --- metrics / money (D-8) --------------------------------------------------


async def _report_metric(
    client: AsyncClient, auth: dict, org_id: str, key: str, value: str
) -> None:
    today = datetime.now(UTC).date()
    resp = await client.put(
        f"/api/v1/organizations/{org_id}/metrics",
        json={
            "metric_key": key,
            "value": value,
            "period_end": (today.replace(day=1) - timedelta(days=1)).isoformat(),
        },
        headers=auth["headers"],
    )
    assert resp.status_code in (200, 201), resp.text


async def test_metrics_are_decimal_strings(client: AsyncClient, team: dict) -> None:
    org_id = team["org"]["id"]
    await _report_metric(client, team["owner"], org_id, "mrr", "480000.0000")
    body = await _summary(client, team["owner"], org_id)
    assert len(body["metrics"]) == 1
    assert body["metrics"][0]["metric_key"] == "mrr"
    assert body["metrics"][0]["value"] == "480000.0000"  # str, never float


async def test_viewer_does_not_see_money(client: AsyncClient, team: dict) -> None:
    """Approved D-8: money is withheld and named in ``restricted``."""
    org_id = team["org"]["id"]
    await _report_metric(client, team["owner"], org_id, "mrr", "480000")
    body = await _summary(client, team["viewer"], org_id)
    assert body["metrics"] == []
    assert set(body["restricted"]) == {"mrr", "burn", "runway_months"}


async def test_member_sees_money_and_has_no_restrictions(
    client: AsyncClient, team: dict
) -> None:
    org_id = team["org"]["id"]
    await _report_metric(client, team["owner"], org_id, "mrr", "480000")
    body = await _summary(client, team["member"], org_id)
    assert [m["metric_key"] for m in body["metrics"]] == ["mrr"]
    assert body["restricted"] == []


async def test_only_money_keys_appear(client: AsyncClient, team: dict) -> None:
    """The dashboard KPI row is MRR/burn/runway, not the whole metric table."""
    org_id = team["org"]["id"]
    await _report_metric(client, team["owner"], org_id, "mrr", "480000")
    await _report_metric(client, team["owner"], org_id, "customers", "12")
    body = await _summary(client, team["owner"], org_id)
    assert [m["metric_key"] for m in body["metrics"]] == ["mrr"]


# --- unavailable cards ------------------------------------------------------


async def test_unavailable_cards_name_their_step(client: AsyncClient, team: dict) -> None:
    body = await _summary(client, team["owner"], team["org"]["id"])
    keys = {card["key"]: card["step"] for card in body["unavailable"]}
    assert keys["mentor"] == "8"
    assert keys["investor_interest"] == "9"
    assert keys["hiring"] == "7"
    assert keys["documents"] == "4"
    for card in body["unavailable"]:
        assert card["reason"]  # every card explains itself


# --- activity feed ----------------------------------------------------------


async def test_activity_feed_is_newest_first(client: AsyncClient, team: dict) -> None:
    org_id = team["org"]["id"]
    task = await _create_task(client, team["owner"], org_id, "Discuss me")
    for body in ["first", "second"]:
        resp = await client.post(
            f"/api/v1/organizations/{org_id}/tasks/{task['id']}/comments",
            json={"body": body},
            headers=team["owner"]["headers"],
        )
        assert resp.status_code == 201, resp.text

    summary = await _summary(client, team["owner"], org_id)
    summaries = [item["summary"] for item in summary["recent_activity"]]
    assert any("second" in s for s in summaries)
    # Newest first: the "second" comment appears before the "first" one.
    assert summaries.index(next(s for s in summaries if "second" in s)) < summaries.index(
        next(s for s in summaries if "first" in s)
    )
    assert all(item["actor_name"] for item in summary["recent_activity"])


async def test_activity_feed_is_org_scoped(client: AsyncClient, team: dict) -> None:
    """Events from another organization never leak into this feed."""
    their_org = await _create_org(client, team["outsider"], name="Theirs")
    their_task = await _create_task(client, team["outsider"], their_org["id"], "Theirs")
    resp = await client.post(
        f"/api/v1/organizations/{their_org['id']}/tasks/{their_task['id']}/comments",
        json={"body": "secret"},
        headers=team["outsider"]["headers"],
    )
    assert resp.status_code == 201, resp.text

    body = await _summary(client, team["owner"], team["org"]["id"])
    assert not any("secret" in item["summary"] for item in body["recent_activity"])


async def test_activity_feed_is_capped(client: AsyncClient, team: dict) -> None:
    org_id = team["org"]["id"]
    task = await _create_task(client, team["owner"], org_id, "Busy")
    for i in range(9):
        resp = await client.post(
            f"/api/v1/organizations/{org_id}/tasks/{task['id']}/comments",
            json={"body": f"comment {i}"},
            headers=team["owner"]["headers"],
        )
        assert resp.status_code == 201, resp.text
    body = await _summary(client, team["owner"], org_id)
    assert len(body["recent_activity"]) == 6


# --- readiness --------------------------------------------------------------


async def test_readiness_section_matches_the_readiness_board(
    client: AsyncClient, team: dict
) -> None:
    """The dashboard gauge must agree with 5f's own numbers."""
    org_id = team["org"]["id"]
    board = await client.get(
        f"/api/v1/organizations/{org_id}/readiness", headers=team["owner"]["headers"]
    )
    assert board.status_code == 200, board.text
    summary = board.json()["summary"]
    body = await _summary(client, team["owner"], org_id)
    assert body["readiness"]["criteria_total"] == summary["criteria_total"]
    assert body["readiness"]["criteria_signed_off"] == summary["criteria_signed_off"]
    assert body["readiness"]["readiness_pct"] == summary["readiness_pct"]
    assert body["readiness"]["signed_off_remaining"] == (
        summary["criteria_total"] - summary["criteria_signed_off"]
    )
