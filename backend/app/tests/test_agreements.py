"""Step 8g tests: mentor agreements.

Covers, per AGENTS.md section 7 and the approved 8g plan:

- happy path: draft -> send -> mentor signs -> startup signs, with the
  version, signer and phase stamped by the server; linked records and the
  mentor-only fee breakdown are derived; activity rows are written;
- versions: a change proposal needs a reason, a newer SENT version
  supersedes an older sent one, a newer SIGNED version supersedes the one
  in force;
- validation: money/equity/currency/cadence/type/dates/terms/reason limits;
- 401 on every route without a token;
- 403: member writes/signs, viewer reads, wrong password (REAUTH_FAILED),
  non-mentor on the mentor list;
- 404: outsider, another mentor, another startup, the other side's draft;
- cross-organization: a mentorship id from another startup in the path;
- mass assignment: every server-owned field is rejected;
- states: only drafts change, only sent versions sign, only signed
  versions terminate, paused mentorships cannot sign (Q7);
- Q5: an agreement in force sets the session fee;
- Q6: ending or cancelling the mentorship closes its agreements;
- signing is rate limited (5 per 15 minutes).
"""

import uuid
from decimal import Decimal
from typing import Any

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityEvent
from app.tests.test_deliverable import _member
from app.tests.test_session import GOAL, PASSWORD, _at, _mentor, _org, _pair, _signup

API = "/api/v1"
TERMS = {
    "agreement_type": "per_session",
    "fee_amount": "3000.00",
    "currency": "INR",
    "cadence": "monthly",
    "equity_pct": "0.25",
    "terms": "Focus on go-to-market and pricing. Two sessions per month.",
}
REASON = "Moving from monthly to fortnightly sessions."


async def _draft(client: AsyncClient, ctx: dict, who: str = "mentor", **over) -> dict:
    resp = await client.post(
        f"{API}/mentorships/{ctx['mid']}/agreements",
        json={**TERMS, **over},
        headers=ctx[who]["headers"],
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _send(client: AsyncClient, ctx: dict, aid: str, who: str = "mentor") -> dict:
    resp = await client.post(f"{API}/agreements/{aid}/send", headers=ctx[who]["headers"])
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _sign(client: AsyncClient, actor: dict, aid: str) -> dict:
    resp = await client.post(
        f"{API}/agreements/{aid}/sign",
        json={"current_password": PASSWORD},
        headers=actor["headers"],
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _signed(client: AsyncClient, ctx: dict, **over) -> dict:
    a = await _draft(client, ctx, **over)
    await _send(client, ctx, a["id"])
    await _sign(client, ctx["mentor"], a["id"])
    return await _sign(client, ctx["founder"], a["id"])


# ------------------------------------------------------------------ happy path


async def test_full_lifecycle(client: AsyncClient, db_session: AsyncSession) -> None:
    ctx = await _pair(client, "agr-life")
    member = await _member(client, ctx["founder"], ctx["org_id"], "m-agr-life@d8.dev", "member")
    draft = await _draft(client, ctx)
    assert draft["status"] == "draft" and draft["version"] is None
    assert draft["proposed_by_side"] == "mentor" and draft["can_edit"] is True
    assert draft["party"]["startup_name"] == "Co agr-life"

    # The other side cannot see a draft at all.
    assert (
        await client.get(f"{API}/agreements/{draft['id']}", headers=ctx["founder"]["headers"])
    ).status_code == 404
    listed = await client.get(
        f"{API}/mentorships/{ctx['mid']}/agreements", headers=ctx["founder"]["headers"]
    )
    assert listed.json()["total"] == 0

    sent = await _send(client, ctx, draft["id"])
    assert sent["status"] == "sent" and sent["version"] == 1 and sent["sent_at"]
    founder_view = await client.get(
        f"{API}/agreements/{draft['id']}", headers=ctx["founder"]["headers"]
    )
    assert founder_view.json()["can_sign"] is True
    assert founder_view.json()["fee_breakdown"] is None
    member_view = await client.get(f"{API}/agreements/{draft['id']}", headers=member["headers"])
    assert member_view.status_code == 200 and member_view.json()["can_sign"] is False

    half = await _sign(client, ctx["mentor"], draft["id"])
    assert half["status"] == "sent" and half["mentor_signed_at"] and not half["startup_signed_at"]
    again = await client.post(
        f"{API}/agreements/{draft['id']}/sign",
        json={"current_password": PASSWORD},
        headers=ctx["mentor"]["headers"],
    )
    assert again.status_code == 409 and again.json()["error"]["code"] == "ALREADY_SIGNED"

    full = await _sign(client, ctx["founder"], draft["id"])
    assert full["status"] == "signed" and full["phase"] == "active"
    assert full["startup_signed_by_name"] == "Founder-Agr-Life"
    assert full["can_terminate"] is True and full["can_sign"] is False

    detail = await client.get(f"{API}/agreements/{draft['id']}", headers=ctx["mentor"]["headers"])
    body = detail.json()
    assert body["fee_breakdown"]["gross_amount"] == "3000.00"
    assert Decimal(body["fee_breakdown"]["net_amount"]) == Decimal("3000")  # 8h rates are 0
    assert body["linked_records"]["completed_sessions"] == 0

    # Q5: the session fee comes from the agreement, never from the client.
    rejected = await client.post(
        f"{API}/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": _at(), "duration_min": 45, "fee_amount": "0"},
        headers=ctx["mentor"]["headers"],
    )
    assert rejected.status_code == 422
    assert rejected.json()["error"]["details"][0]["loc"] == ["body", "fee_amount"]
    session = await client.post(
        f"{API}/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": _at(), "duration_min": 45},
        headers=ctx["mentor"]["headers"],
    )
    assert session.status_code == 201, session.text
    assert Decimal(session.json()["fee_amount"]) == Decimal("3000")
    done = await client.post(
        f"{API}/sessions/{session.json()['id']}/complete",
        json={"summary": "Pricing review with concrete next steps."},
        headers=ctx["mentor"]["headers"],
    )
    assert done.status_code == 200, done.text
    linked = (
        await client.get(f"{API}/agreements/{draft['id']}", headers=ctx["founder"]["headers"])
    ).json()["linked_records"]
    assert linked == {"completed_sessions": 1, "billed_amount": "3000.00", "currency": "INR"}

    events = (
        (
            await db_session.execute(
                select(ActivityEvent.event_type).where(
                    ActivityEvent.entity_id == uuid.UUID(draft["id"])
                )
            )
        )
        .scalars()
        .all()
    )
    assert sorted(events) == ["agreement_sent", "agreement_signed", "agreement_signed"]


async def test_versions_supersede(client: AsyncClient) -> None:
    ctx = await _pair(client, "agr-ver")
    v1 = await _signed(client, ctx)

    no_reason = await client.post(
        f"{API}/mentorships/{ctx['mid']}/agreements",
        json={**TERMS, "cadence": "fortnightly"},
        headers=ctx["founder"]["headers"],
    )
    assert no_reason.status_code == 422
    assert no_reason.json()["error"]["details"][0]["loc"] == ["body", "change_reason"]

    v2 = await _draft(client, ctx, "founder", cadence="fortnightly", change_reason=REASON)
    # The mentor may draft their own counter at the same time.
    v3 = await _draft(client, ctx, "mentor", fee_amount="3500.00", change_reason=REASON)
    v2 = await _send(client, ctx, v2["id"], "founder")
    assert v2["version"] == 2 and v2["previous_version_id"] == v1["id"]
    v3 = await _send(client, ctx, v3["id"], "mentor")
    assert v3["version"] == 3

    history = await client.get(
        f"{API}/mentorships/{ctx['mid']}/agreements", headers=ctx["mentor"]["headers"]
    )
    states = [(i["version"], i["status"]) for i in history.json()["items"]]
    assert states == [(3, "sent"), (2, "superseded"), (1, "signed")]

    await _sign(client, ctx["mentor"], v3["id"])
    await _sign(client, ctx["founder"], v3["id"])
    history = await client.get(
        f"{API}/mentorships/{ctx['mid']}/agreements", headers=ctx["founder"]["headers"]
    )
    states = [(i["version"], i["status"]) for i in history.json()["items"]]
    assert states == [(3, "signed"), (2, "superseded"), (1, "superseded")]
    v1_now = history.json()["items"][2]
    assert v1_now["end_reason"] == "Replaced by version 3." and v1_now["phase"] is None


async def test_patch_and_discard_draft(client: AsyncClient) -> None:
    ctx = await _pair(client, "agr-patch")
    draft = await _draft(client, ctx)
    url = f"{API}/agreements/{draft['id']}"
    patched = await client.patch(
        url, json={"agreement_type": "pro_bono"}, headers=ctx["mentor"]["headers"]
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["fee_amount"] is None  # switching to pro bono clears the fee
    bad = await client.patch(url, json={"fee_amount": "10.00"}, headers=ctx["mentor"]["headers"])
    assert bad.status_code == 422
    cleared = await client.patch(
        url, json={"agreement_type": None}, headers=ctx["mentor"]["headers"]
    )
    assert cleared.status_code == 422
    assert (await client.delete(url, headers=ctx["founder"]["headers"])).status_code == 404
    assert (await client.delete(url, headers=ctx["mentor"]["headers"])).status_code == 204
    assert (await client.get(url, headers=ctx["mentor"]["headers"])).status_code == 404


async def test_mentor_list_filters(client: AsyncClient) -> None:
    ctx = await _pair(client, "agr-list")
    other = await _pair(client, "agr-list2")
    mine = await _draft(client, ctx)
    await _send(client, ctx, mine["id"])
    theirs = await _draft(client, ctx, "founder", change_reason=REASON)
    url = f"{API}/mentor/agreements"
    allv = await client.get(url, headers=ctx["mentor"]["headers"])
    # The startup's draft is invisible to the mentor.
    assert [i["id"] for i in allv.json()["items"]] == [mine["id"]]
    awaiting = await client.get(url, params={"awaiting_me": True}, headers=ctx["mentor"]["headers"])
    assert awaiting.json()["total"] == 1
    proposed = await client.get(
        url, params={"proposed_by_me": True}, headers=ctx["mentor"]["headers"]
    )
    assert proposed.json()["total"] == 1
    await _send(client, ctx, theirs["id"], "founder")
    awaiting = await client.get(url, params={"awaiting_me": True}, headers=ctx["mentor"]["headers"])
    assert [i["version"] for i in awaiting.json()["items"]] == [2]
    page = await client.get(url, params={"limit": 1}, headers=ctx["mentor"]["headers"])
    assert page.json()["total"] == 2 and len(page.json()["items"]) == 1
    signed_only = await client.get(
        url, params={"status": "signed"}, headers=ctx["mentor"]["headers"]
    )
    assert signed_only.json()["total"] == 0
    # Another mentor never sees these.
    assert (await client.get(url, headers=other["mentor"]["headers"])).json()["total"] == 0
    assert (await client.get(url, headers=ctx["founder"]["headers"])).status_code == 403


# ------------------------------------------------------------------ validation


async def test_create_validation(client: AsyncClient) -> None:
    ctx = await _pair(client, "agr-val")
    url = f"{API}/mentorships/{ctx['mid']}/agreements"
    cases: list[tuple[dict[str, Any], str]] = [
        ({"fee_amount": None}, "fee_amount"),
        ({"agreement_type": "pro_bono"}, "fee_amount"),
        ({"fee_amount": "0"}, "fee_amount"),
        ({"fee_amount": "-5"}, "fee_amount"),
        ({"fee_amount": "10.001"}, "fee_amount"),
        ({"fee_amount": "1234567890123.00"}, "fee_amount"),
        ({"equity_pct": "101"}, "equity_pct"),
        ({"currency": "inr"}, "currency"),
        ({"cadence": "daily"}, "cadence"),
        ({"agreement_type": "retainer"}, "agreement_type"),
        ({"starts_on": "2027-02-01", "ends_on": "2027-01-01"}, "ends_on"),
        ({"terms": "x" * 10_001}, "terms"),
        ({"change_reason": "too short"}, "change_reason"),
    ]
    for override, field in cases:
        resp = await client.post(url, json={**TERMS, **override}, headers=ctx["mentor"]["headers"])
        assert resp.status_code == 422, (override, resp.text)
        locs = [d["loc"][-1] for d in resp.json()["error"]["details"]]
        assert field in [str(x) for x in locs] or any(field in str(d) for d in locs), (
            override,
            resp.json(),
        )
    pro_bono = await client.post(
        url,
        json={"agreement_type": "pro_bono", "terms": "Monthly check-ins, no fee."},
        headers=ctx["mentor"]["headers"],
    )
    assert pro_bono.status_code == 201 and pro_bono.json()["fee_amount"] is None


async def test_action_body_validation(client: AsyncClient) -> None:
    ctx = await _pair(client, "agr-body")
    a = await _signed(client, ctx)
    url = f"{API}/agreements/{a['id']}"
    short = await client.post(
        f"{url}/terminate", json={"reason": "short"}, headers=ctx["founder"]["headers"]
    )
    assert short.status_code == 422
    draft = await _draft(client, ctx, change_reason=REASON)
    await _send(client, ctx, draft["id"])
    missing = await client.post(
        f"{API}/agreements/{draft['id']}/sign", json={}, headers=ctx["founder"]["headers"]
    )
    assert missing.status_code == 422


# -------------------------------------------------------------- authentication


async def test_every_route_requires_auth(client: AsyncClient) -> None:
    ctx = await _pair(client, "agr-401")
    a = await _draft(client, ctx)
    aid, mid = a["id"], ctx["mid"]
    calls = [
        ("POST", f"{API}/mentorships/{mid}/agreements", TERMS),
        ("GET", f"{API}/mentorships/{mid}/agreements", None),
        ("GET", f"{API}/mentor/agreements", None),
        ("GET", f"{API}/agreements/{aid}", None),
        ("PATCH", f"{API}/agreements/{aid}", {"cadence": "weekly"}),
        ("DELETE", f"{API}/agreements/{aid}", None),
        ("POST", f"{API}/agreements/{aid}/send", None),
        ("POST", f"{API}/agreements/{aid}/sign", {"current_password": PASSWORD}),
        ("POST", f"{API}/agreements/{aid}/terminate", {"reason": "No longer needed here."}),
    ]
    for method, url, body in calls:
        resp = await client.request(method, url, json=body)
        assert resp.status_code == 401, (method, url, resp.status_code)


# --------------------------------------------------------------- authorization


async def test_roles_member_viewer_admin(client: AsyncClient) -> None:
    ctx = await _pair(client, "agr-roles")
    member = await _member(client, ctx["founder"], ctx["org_id"], "m-agr-roles@d8.dev", "member")
    viewer = await _member(client, ctx["founder"], ctx["org_id"], "v-agr-roles@d8.dev", "viewer")
    admin = await _member(client, ctx["founder"], ctx["org_id"], "a-agr-roles@d8.dev", "admin")
    a = await _draft(client, ctx)
    await _send(client, ctx, a["id"])
    url = f"{API}/agreements/{a['id']}"
    list_url = f"{API}/mentorships/{ctx['mid']}/agreements"

    assert (await client.get(list_url, headers=member["headers"])).status_code == 200
    assert (
        await client.post(list_url, json={**TERMS, "change_reason": REASON}, headers=member["headers"])
    ).status_code == 403
    sign = {"current_password": PASSWORD}
    assert (await client.post(f"{url}/sign", json=sign, headers=member["headers"])).status_code == 403

    for call in (
        client.get(list_url, headers=viewer["headers"]),
        client.get(url, headers=viewer["headers"]),
        client.post(list_url, json={**TERMS, "change_reason": REASON}, headers=viewer["headers"]),
        client.post(f"{url}/sign", json=sign, headers=viewer["headers"]),
    ):
        assert (await call).status_code == 403

    # An admin signs for the startup.
    await _sign(client, ctx["mentor"], a["id"])
    signed = await _sign(client, admin, a["id"])
    assert signed["status"] == "signed" and signed["startup_signed_by_name"] == "A-Agr-Roles"
    terminate = {"reason": "Engagement scope has changed."}
    assert (
        await client.post(f"{url}/terminate", json=terminate, headers=member["headers"])
    ).status_code == 403

    # The workspace card is hidden from a viewer and shown to a member.
    ws = f"{API}/mentorships/{ctx['mid']}/workspace"
    assert (await client.get(ws, headers=viewer["headers"])).json()["agreement"] is None
    card = (await client.get(ws, headers=member["headers"])).json()["agreement"]
    assert card["current"]["id"] == a["id"] and card["pending"] is None


async def test_wrong_password_and_sign_rate_limit(client: AsyncClient) -> None:
    ctx = await _pair(client, "agr-pw")
    a = await _draft(client, ctx)
    await _send(client, ctx, a["id"])
    url = f"{API}/agreements/{a['id']}/sign"
    for _ in range(5):
        resp = await client.post(
            url, json={"current_password": "Wrong!Password99"}, headers=ctx["founder"]["headers"]
        )
        assert resp.status_code == 403 and resp.json()["error"]["code"] == "REAUTH_FAILED"
    limited = await client.post(
        url, json={"current_password": PASSWORD}, headers=ctx["founder"]["headers"]
    )
    assert limited.status_code == 429
    fetched = await client.get(f"{API}/agreements/{a['id']}", headers=ctx["founder"]["headers"])
    assert fetched.json()["startup_signed_at"] is None


async def test_outsiders_get_404(client: AsyncClient) -> None:
    ctx = await _pair(client, "agr-out")
    outsider = await _signup(client, "outsider-agr@d8.dev")
    other_mentor = await _mentor(client, "othermentor-agr@d8.dev")
    a = await _draft(client, ctx)
    await _send(client, ctx, a["id"])
    aid = a["id"]
    for actor in (outsider, other_mentor):
        h = actor["headers"]
        for resp in (
            await client.get(f"{API}/agreements/{aid}", headers=h),
            await client.get(f"{API}/mentorships/{ctx['mid']}/agreements", headers=h),
            await client.post(f"{API}/mentorships/{ctx['mid']}/agreements", json=TERMS, headers=h),
            await client.patch(f"{API}/agreements/{aid}", json={"cadence": "weekly"}, headers=h),
            await client.delete(f"{API}/agreements/{aid}", headers=h),
            await client.post(f"{API}/agreements/{aid}/send", headers=h),
            await client.post(
                f"{API}/agreements/{aid}/sign", json={"current_password": PASSWORD}, headers=h
            ),
            await client.post(
                f"{API}/agreements/{aid}/terminate",
                json={"reason": "Trying to end someone else's deal."},
                headers=h,
            ),
        ):
            assert resp.status_code == 404, resp.text
    unknown = await client.get(f"{API}/agreements/{uuid.uuid4()}", headers=ctx["mentor"]["headers"])
    assert unknown.status_code == 404


async def test_cross_organization(client: AsyncClient) -> None:
    """Same mentor, two startups: neither startup reaches the other's terms."""
    ctx = await _pair(client, "agr-xa")
    founder_b = await _signup(client, "founder-agr-xb@d8.dev")
    org_b = await _org(client, founder_b, "Co agr-xb")
    created = await client.post(
        f"{API}/organizations/{org_b}/mentorships",
        json={"mentor_id": ctx["mentor"]["id"], "goal": GOAL},
        headers=founder_b["headers"],
    )
    mid_b = created.json()["id"]
    await client.post(f"{API}/mentorships/{mid_b}/accept", json={}, headers=ctx["mentor"]["headers"])
    a = await _signed(client, ctx)
    hb = founder_b["headers"]
    assert (await client.get(f"{API}/agreements/{a['id']}", headers=hb)).status_code == 404
    assert (
        await client.get(f"{API}/mentorships/{ctx['mid']}/agreements", headers=hb)
    ).status_code == 404
    assert (
        await client.post(
            f"{API}/agreements/{a['id']}/terminate",
            json={"reason": "Not my agreement at all."},
            headers=hb,
        )
    ).status_code == 404
    # Startup A cannot draft on startup B's mentorship.
    assert (
        await client.post(
            f"{API}/mentorships/{mid_b}/agreements", json=TERMS, headers=ctx["founder"]["headers"]
        )
    ).status_code == 404
    # B's own list is empty, and A's agreement does not force B's session fee.
    assert (await client.get(f"{API}/mentorships/{mid_b}/agreements", headers=hb)).json()[
        "total"
    ] == 0
    session_b = await client.post(
        f"{API}/mentorships/{mid_b}/sessions",
        json={"scheduled_at": _at(days=6), "duration_min": 45, "fee_amount": "500"},
        headers=ctx["mentor"]["headers"],
    )
    assert session_b.status_code == 201, session_b.text


async def test_mass_assignment_rejected(client: AsyncClient) -> None:
    ctx = await _pair(client, "agr-mass")
    url = f"{API}/mentorships/{ctx['mid']}/agreements"
    forged = {
        "status": "signed",
        "version": 7,
        "previous_version_id": str(uuid.uuid4()),
        "proposed_by_side": "startup",
        "created_by": ctx["founder"]["id"],
        "mentorship_id": str(uuid.uuid4()),
        "id": str(uuid.uuid4()),
        "sent_at": "2026-01-01T00:00:00Z",
        "mentor_signed_at": "2026-01-01T00:00:00Z",
        "startup_signed_at": "2026-01-01T00:00:00Z",
        "startup_signed_by": ctx["founder"]["id"],
        "ended_at": "2026-01-01T00:00:00Z",
        "ended_by": ctx["founder"]["id"],
        "end_reason": "forged",
        "created_at": "2026-01-01T00:00:00Z",
    }
    for key, value in forged.items():
        resp = await client.post(url, json={**TERMS, key: value}, headers=ctx["mentor"]["headers"])
        assert resp.status_code == 422, (key, resp.text)
    a = await _draft(client, ctx)
    for key in ("status", "version", "mentor_signed_at", "proposed_by_side"):
        resp = await client.patch(
            f"{API}/agreements/{a['id']}", json={key: forged[key]}, headers=ctx["mentor"]["headers"]
        )
        assert resp.status_code == 422, (key, resp.text)
    await _send(client, ctx, a["id"])
    resp = await client.post(
        f"{API}/agreements/{a['id']}/sign",
        json={"current_password": PASSWORD, "startup_signed_at": "2026-01-01T00:00:00Z"},
        headers=ctx["mentor"]["headers"],
    )
    assert resp.status_code == 422


# ----------------------------------------------------------------- state rules


async def test_state_rules(client: AsyncClient) -> None:
    ctx = await _pair(client, "agr-state")
    a = await _draft(client, ctx)
    url = f"{API}/agreements/{a['id']}"
    h = ctx["mentor"]["headers"]
    sign = {"current_password": PASSWORD}
    assert (await client.post(f"{url}/sign", json=sign, headers=h)).status_code == 409
    dup = await client.post(f"{API}/mentorships/{ctx['mid']}/agreements", json=TERMS, headers=h)
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "DRAFT_EXISTS"
    await _send(client, ctx, a["id"])
    assert (await client.patch(url, json={"cadence": "weekly"}, headers=h)).status_code == 409
    assert (await client.delete(url, headers=h)).status_code == 409
    assert (await client.post(f"{url}/send", headers=h)).status_code == 409
    terminate = {"reason": "Ending before it ever started."}
    assert (await client.post(f"{url}/terminate", json=terminate, headers=h)).status_code == 409

    # Q7: drafting works while paused, signing does not.
    paused = await client.post(f"{API}/mentorships/{ctx['mid']}/pause", json={}, headers=h)
    assert paused.status_code == 200, paused.text
    blocked = await client.post(f"{url}/sign", json=sign, headers=h)
    assert blocked.status_code == 409 and blocked.json()["error"]["code"] == "INVALID_STATE"
    founder_draft = await client.post(
        f"{API}/mentorships/{ctx['mid']}/agreements",
        json={**TERMS, "change_reason": REASON},
        headers=ctx["founder"]["headers"],
    )
    assert founder_draft.status_code == 201


async def test_requested_mentorship_cannot_draft(client: AsyncClient) -> None:
    founder = await _signup(client, "founder-agr-req@d8.dev")
    mentor = await _mentor(client, "mentor-agr-req@d8.dev")
    org = await _org(client, founder, "Co agr-req")
    created = await client.post(
        f"{API}/organizations/{org}/mentorships",
        json={"mentor_id": mentor["id"], "goal": GOAL},
        headers=founder["headers"],
    )
    resp = await client.post(
        f"{API}/mentorships/{created.json()['id']}/agreements",
        json=TERMS,
        headers=mentor["headers"],
    )
    assert resp.status_code == 409 and resp.json()["error"]["code"] == "INVALID_STATE"


async def test_terminate_frees_the_session_fee(client: AsyncClient) -> None:
    ctx = await _pair(client, "agr-term")
    a = await _signed(client, ctx)
    ended = await client.post(
        f"{API}/agreements/{a['id']}/terminate",
        json={"reason": "Switching to an informal arrangement."},
        headers=ctx["founder"]["headers"],
    )
    assert ended.status_code == 200, ended.text
    assert ended.json()["status"] == "terminated" and ended.json()["phase"] is None
    assert ended.json()["end_reason"] == "Switching to an informal arrangement."
    session = await client.post(
        f"{API}/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": _at(), "duration_min": 45, "fee_amount": "1000"},
        headers=ctx["mentor"]["headers"],
    )
    assert session.status_code == 201 and Decimal(session.json()["fee_amount"]) == Decimal("1000")


async def test_future_agreement_is_scheduled(client: AsyncClient) -> None:
    ctx = await _pair(client, "agr-future")
    a = await _signed(client, ctx, starts_on="2099-01-01")
    assert a["phase"] == "scheduled"
    session = await client.post(
        f"{API}/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": _at(), "duration_min": 45, "fee_amount": "100"},
        headers=ctx["mentor"]["headers"],
    )
    assert session.status_code == 201, session.text


async def test_ending_the_mentorship_closes_agreements(client: AsyncClient) -> None:
    ctx = await _pair(client, "agr-end")
    signed = await _signed(client, ctx)
    sent = await _draft(client, ctx, change_reason=REASON)
    await _send(client, ctx, sent["id"])
    draft = await _draft(client, ctx, "founder", change_reason=REASON)
    ended = await client.post(
        f"{API}/mentorships/{ctx['mid']}/end", json={}, headers=ctx["founder"]["headers"]
    )
    assert ended.status_code == 200, ended.text
    h = ctx["founder"]["headers"]
    for aid in (signed["id"], sent["id"]):
        body = (await client.get(f"{API}/agreements/{aid}", headers=h)).json()
        assert body["status"] == "terminated" and body["end_reason"] == "Mentorship ended."
    assert (await client.get(f"{API}/agreements/{draft['id']}", headers=h)).status_code == 404


async def test_cancelling_the_mentorship_closes_agreements(client: AsyncClient) -> None:
    ctx = await _pair(client, "agr-cancel")
    signed = await _signed(client, ctx)
    cancelled = await client.post(
        f"{API}/mentorships/{ctx['mid']}/cancel", json={}, headers=ctx["mentor"]["headers"]
    )
    assert cancelled.status_code == 200, cancelled.text
    body = (
        await client.get(f"{API}/agreements/{signed['id']}", headers=ctx["mentor"]["headers"])
    ).json()
    assert body["status"] == "terminated" and body["can_terminate"] is False
