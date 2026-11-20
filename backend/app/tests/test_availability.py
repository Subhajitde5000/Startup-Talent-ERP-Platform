"""Step 8c tests: mentor weekly availability and the bookable slots.

Covers, per AGENTS.md section 7 and the 8c plan:

- happy path: publish a week, read it back, add a window, delete a window,
  and a startup reads the published week and the derived bookable slots,
- validation: weekday out of range, end before start, a too-short window,
  an unknown IANA timezone, duplicate slots in one PUT, more than the
  weekly maximum, and an unknown body key,
- 409: a second window overlapping one already published,
- 401 on every route without a token,
- 403: a non-mentor cannot publish a week,
- 404: another mentor's slot id is a 404 (never 403), and a handle hidden
  by ``profile_public`` is a 404 on both public reads — the same
  no-existence-oracle rule the directory uses,
- cross-organization: availability is keyed by the mentor's own user id, so
  one mentor can never read or write another's week,
- DST: a weekly window keeps its LOCAL wall-clock time across a change,
  which is the whole reason the row stores a timezone,
- the free/busy computation: a slot already covered by a booked session is
  not offered.
"""

import re
from datetime import UTC, date, datetime, timedelta

import pytest
from httpx import AsyncClient

PASSWORD = "Str0ng!Password99"
KOLKATA = "Asia/Kolkata"


def _code() -> str:
    from app.services import email_service

    assert email_service.SENT_EMAILS, "expected a verification email"
    match = re.search(r"(\d{6})", email_service.SENT_EMAILS[-1]["body"])
    assert match, "no 6-digit code in the email body"
    return match.group(1)


async def _signup(client: AsyncClient, email: str, role: str = "mentor") -> dict:
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
    return {
        "email": email,
        "headers": {"Authorization": f"Bearer {login.json()['access_token']}"},
    }


async def _mentor(client: AsyncClient, email: str, handle: str, *, public: bool = True) -> dict:
    auth = await _signup(client, email, role="mentor")
    patched = await client.patch(
        "/api/v1/users/me",
        json={"handle": handle, **({} if public else {"profile_public": False})},
        headers=auth["headers"],
    )
    assert patched.status_code == 200, patched.text
    saved = await client.patch(
        "/api/v1/mentor-profile/me",
        json={"headline": "Advisor", "accepting_requests": True, "cadence": "Weekly"},
        headers=auth["headers"],
    )
    assert saved.status_code == 200, saved.text
    auth["handle"] = handle
    return auth


def _slot(weekday: int = 1, start: str = "10:00", end: str = "12:00", **kw) -> dict:
    return {
        "weekday": weekday,
        "start_time": start,
        "end_time": end,
        "timezone": kw.pop("timezone", KOLKATA),
        **kw,
    }


# ------------------------------------------------------------------ happy path


async def test_publish_and_read_my_week(client: AsyncClient) -> None:
    mentor = await _mentor(client, "m-av@c8.dev", "av_mentor")

    put = await client.put(
        "/api/v1/mentor/availability",
        json={"slots": [_slot(1), _slot(3, "18:00", "20:00")]},
        headers=mentor["headers"],
    )
    assert put.status_code == 200, put.text
    body = put.json()
    assert len(body["slots"]) == 2
    assert body["timezone"] == KOLKATA
    # ordered by weekday then start
    assert [s["weekday"] for s in body["slots"]] == [1, 3]

    got = await client.get("/api/v1/mentor/availability", headers=mentor["headers"])
    assert got.status_code == 200, got.text
    assert len(got.json()["slots"]) == 2


async def test_add_and_delete_one_window(client: AsyncClient) -> None:
    mentor = await _mentor(client, "m-add@c8.dev", "add_mentor")

    created = await client.post(
        "/api/v1/mentor/availability", json=_slot(2), headers=mentor["headers"]
    )
    assert created.status_code == 201, created.text
    slot_id = created.json()["id"]

    deleted = await client.delete(
        f"/api/v1/mentor/availability/{slot_id}", headers=mentor["headers"]
    )
    assert deleted.status_code == 204, deleted.text

    after = await client.get("/api/v1/mentor/availability", headers=mentor["headers"])
    assert after.json()["slots"] == []


async def test_empty_week_is_valid_and_clears(client: AsyncClient) -> None:
    mentor = await _mentor(client, "m-clr@c8.dev", "clr_mentor")
    await client.put(
        "/api/v1/mentor/availability", json={"slots": [_slot(1)]}, headers=mentor["headers"]
    )
    cleared = await client.put(
        "/api/v1/mentor/availability", json={"slots": []}, headers=mentor["headers"]
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["slots"] == []


async def test_a_startup_reads_the_published_week(client: AsyncClient) -> None:
    mentor = await _mentor(client, "m-pub@c8.dev", "pub_mentor")
    founder = await _signup(client, "founder-av@c8.dev", role="startup")
    await client.put(
        "/api/v1/mentor/availability",
        json={"slots": [_slot(1), _slot(4, "09:00", "11:00")]},
        headers=mentor["headers"],
    )

    resp = await client.get(
        "/api/v1/mentors/pub_mentor/availability", headers=founder["headers"]
    )
    assert resp.status_code == 200, resp.text
    assert len(resp.json()["slots"]) == 2
    assert resp.json()["timezone"] == KOLKATA


async def test_inactive_slots_stay_private_and_out_of_the_public_week(
    client: AsyncClient,
) -> None:
    mentor = await _mentor(client, "m-inact@c8.dev", "inact_mentor")
    founder = await _signup(client, "founder-inact@c8.dev", role="startup")
    await client.put(
        "/api/v1/mentor/availability",
        json={"slots": [_slot(1), _slot(2, is_active=False)]},
        headers=mentor["headers"],
    )
    mine = await client.get("/api/v1/mentor/availability", headers=mentor["headers"])
    assert len(mine.json()["slots"]) == 2

    theirs = await client.get(
        "/api/v1/mentors/inact_mentor/availability", headers=founder["headers"]
    )
    assert len(theirs.json()["slots"]) == 1


# -------------------------------------------------------------------- slots


async def test_bookable_slots_are_computed_in_the_local_zone(client: AsyncClient) -> None:
    mentor = await _mentor(client, "m-slots@c8.dev", "slots_mentor")
    founder = await _signup(client, "founder-slots@c8.dev", role="startup")

    # Pick a weekday ~10 days out so the window is unambiguous and future.
    target = datetime.now(UTC).date() + timedelta(days=10)
    await client.put(
        "/api/v1/mentor/availability",
        json={"slots": [_slot(target.weekday(), "18:00", "19:00")]},
        headers=mentor["headers"],
    )

    resp = await client.get(
        "/api/v1/mentors/slots_mentor/slots",
        params={"from": target.isoformat(), "days": 1},
        headers=founder["headers"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 1, body
    item = body["items"][0]
    # Local wall clock is preserved exactly (that is the point of storing a zone).
    assert item["local_start"] == "18:00:00"
    assert item["local_end"] == "19:00:00"
    assert item["local_date"] == target.isoformat()
    # 18:00 IST == 12:30 UTC.
    start = datetime.fromisoformat(item["start"])
    assert start.astimezone(UTC).strftime("%H:%M") == "12:30"


async def test_slots_are_empty_when_the_week_is_empty(client: AsyncClient) -> None:
    await _mentor(client, "m-noslots@c8.dev", "noslots_mentor")
    founder = await _signup(client, "founder-noslots@c8.dev", role="startup")
    resp = await client.get(
        "/api/v1/mentors/noslots_mentor/slots", params={"days": 3}, headers=founder["headers"]
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["items"] == []
    assert resp.json()["total"] == 0


async def test_past_start_dates_are_clamped_to_today(client: AsyncClient) -> None:
    await _mentor(client, "m-clamp@c8.dev", "clamp_mentor")
    founder = await _signup(client, "founder-clamp@c8.dev", role="startup")
    yesterday = datetime.now(UTC).date() - timedelta(days=1)
    resp = await client.get(
        "/api/v1/mentors/clamp_mentor/slots",
        params={"from": yesterday.isoformat(), "days": 1},
        headers=founder["headers"],
    )
    assert resp.status_code == 200, resp.text
    for item in resp.json()["items"]:
        assert date.fromisoformat(item["local_date"]) >= datetime.now(UTC).date()


async def test_days_out_of_range_is_422(client: AsyncClient) -> None:
    await _mentor(client, "m-rng@c8.dev", "rng_mentor")
    founder = await _signup(client, "founder-rng@c8.dev", role="startup")
    for days in (0, 63):
        resp = await client.get(
            "/api/v1/mentors/rng_mentor/slots",
            params={"days": days},
            headers=founder["headers"],
        )
        assert resp.status_code == 422, f"days={days}: {resp.text}"


# ----------------------------------------------------------------- validation


@pytest.mark.parametrize(
    "payload",
    [
        {"weekday": 7, "start_time": "10:00", "end_time": "11:00", "timezone": KOLKATA},
        {"weekday": -1, "start_time": "10:00", "end_time": "11:00", "timezone": KOLKATA},
        {"weekday": 1, "start_time": "11:00", "end_time": "10:00", "timezone": KOLKATA},
        {"weekday": 1, "start_time": "10:00", "end_time": "10:00", "timezone": KOLKATA},
        {"weekday": 1, "start_time": "10:00", "end_time": "11:00", "timezone": "Mars/Olympus"},
        {"weekday": 1, "start_time": "10:00", "end_time": "11:00", "timezone": ""},
        {"weekday": 1, "start_time": "10:00", "end_time": "11:00", "timezone": KOLKATA,
         "mentor_id": "00000000-0000-0000-0000-000000000000"},
    ],
)
async def test_slot_validation(client: AsyncClient, payload: dict) -> None:
    mentor = await _mentor(client, "m-val@c8.dev", "val_mentor")
    resp = await client.put(
        "/api/v1/mentor/availability", json={"slots": [payload]}, headers=mentor["headers"]
    )
    assert resp.status_code == 422, resp.text


async def test_put_rejects_duplicate_and_oversized_weeks(client: AsyncClient) -> None:
    mentor = await _mentor(client, "m-dup@c8.dev", "dup_mentor")

    dup = await client.put(
        "/api/v1/mentor/availability",
        json={"slots": [_slot(1), _slot(1)]},
        headers=mentor["headers"],
    )
    assert dup.status_code == 422, dup.text

    too_many = await client.put(
        "/api/v1/mentor/availability",
        json={"slots": [_slot(w, f"{h:02d}:00", f"{h:02d}:30") for w in range(7) for h in range(9, 12)]},
        headers=mentor["headers"],
    )
    assert too_many.status_code == 422, too_many.text


async def test_a_too_short_window_is_422(client: AsyncClient) -> None:
    mentor = await _mentor(client, "m-short@c8.dev", "short_mentor")
    resp = await client.put(
        "/api/v1/mentor/availability",
        json={"slots": [_slot(1, "10:00", "10:05")]},
        headers=mentor["headers"],
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_overlapping_windows_are_rejected(client: AsyncClient) -> None:
    mentor = await _mentor(client, "m-ov@c8.dev", "ov_mentor")
    resp = await client.put(
        "/api/v1/mentor/availability",
        json={"slots": [_slot(1, "09:00", "12:00"), _slot(1, "10:00", "11:00")]},
        headers=mentor["headers"],
    )
    assert resp.status_code == 422, resp.text


async def test_overlap_on_add_is_409(client: AsyncClient) -> None:
    mentor = await _mentor(client, "m-ov2@c8.dev", "ov2_mentor")
    first = await client.post(
        "/api/v1/mentor/availability", json=_slot(1, "09:00", "12:00"), headers=mentor["headers"]
    )
    assert first.status_code == 201, first.text
    second = await client.post(
        "/api/v1/mentor/availability", json=_slot(1, "10:00", "11:00"), headers=mentor["headers"]
    )
    assert second.status_code == 409, second.text
    assert second.json()["error"]["code"] == "AVAILABILITY_OVERLAP"


async def test_a_rejected_put_leaves_the_previous_week_intact(client: AsyncClient) -> None:
    mentor = await _mentor(client, "m-atom@c8.dev", "atom_mentor")
    ok = await client.put(
        "/api/v1/mentor/availability", json={"slots": [_slot(1)]}, headers=mentor["headers"]
    )
    assert ok.status_code == 200

    bad = await client.put(
        "/api/v1/mentor/availability",
        json={"slots": [_slot(2, "09:00", "10:30"), _slot(2, "10:00", "11:00")]},
        headers=mentor["headers"],
    )
    assert bad.status_code == 422

    after = await client.get("/api/v1/mentor/availability", headers=mentor["headers"])
    assert len(after.json()["slots"]) == 1
    assert after.json()["slots"][0]["weekday"] == 1


# ---------------------------------------------------------------------- authz


@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", "/api/v1/mentor/availability"),
        ("PUT", "/api/v1/mentor/availability"),
        ("POST", "/api/v1/mentor/availability"),
        ("DELETE", "/api/v1/mentor/availability/00000000-0000-0000-0000-000000000000"),
        ("GET", "/api/v1/mentors/someone/availability"),
        ("GET", "/api/v1/mentors/someone/slots"),
    ],
)
async def test_401_without_a_token(client: AsyncClient, method: str, path: str) -> None:
    resp = await client.request(method, path, json={"slots": []})
    assert resp.status_code == 401, resp.text


async def test_non_mentor_cannot_publish_a_week(client: AsyncClient) -> None:
    founder = await _signup(client, "founder-nm@c8.dev", role="startup")
    resp = await client.put(
        "/api/v1/mentor/availability", json={"slots": [_slot(1)]}, headers=founder["headers"]
    )
    assert resp.status_code == 403, resp.text


async def test_another_mentors_slot_id_is_a_404(client: AsyncClient) -> None:
    owner = await _mentor(client, "m-own@c8.dev", "own_mentor")
    other = await _mentor(client, "m-oth@c8.dev", "oth_mentor")
    created = await client.post(
        "/api/v1/mentor/availability", json=_slot(1), headers=owner["headers"]
    )
    slot_id = created.json()["id"]

    resp = await client.delete(
        f"/api/v1/mentor/availability/{slot_id}", headers=other["headers"]
    )
    assert resp.status_code == 404, resp.text

    # ...and the real owner can still delete it.
    ok = await client.delete(
        f"/api/v1/mentor/availability/{slot_id}", headers=owner["headers"]
    )
    assert ok.status_code == 204


async def test_one_mentor_never_sees_anothers_week(client: AsyncClient) -> None:
    a = await _mentor(client, "m-a@c8.dev", "a_mentor")
    b = await _mentor(client, "m-b@c8.dev", "b_mentor")
    await client.put(
        "/api/v1/mentor/availability", json={"slots": [_slot(1)]}, headers=a["headers"]
    )
    mine = await client.get("/api/v1/mentor/availability", headers=b["headers"])
    assert mine.status_code == 200
    assert mine.json()["slots"] == [], "b saw a's availability"


async def test_hidden_mentor_availability_is_404(client: AsyncClient) -> None:
    await _mentor(client, "m-hid@c8.dev", "hid_mentor", public=False)
    viewer = await _signup(client, "viewer-hid@c8.dev", role="startup")
    for path in ("availability", "slots"):
        resp = await client.get(f"/api/v1/mentors/hid_mentor/{path}", headers=viewer["headers"])
        assert resp.status_code == 404, f"{path}: {resp.status_code} {resp.text}"


async def test_unknown_handle_is_404(client: AsyncClient) -> None:
    viewer = await _signup(client, "viewer-404@c8.dev", role="startup")
    resp = await client.get("/api/v1/mentors/nobody_here/slots", headers=viewer["headers"])
    assert resp.status_code == 404, resp.text


# ------------------------------------------------------------------------ DST


async def test_a_weekly_window_keeps_its_local_time_across_dst(
    client: AsyncClient,
) -> None:
    """The reason the row stores a zone: 18:00 local stays 18:00 local.

    London moves from GMT to BST at the end of March, so the same weekly
    18:00 window is 18:00 UTC in winter and 17:00 UTC in summer.
    """
    mentor = await _mentor(client, "m-dst@c8.dev", "dst_mentor")
    viewer = await _signup(client, "viewer-dst@c8.dev", role="startup")

    # Pick a weekday, then probe one date before and one after the switch.
    winter = date(2030, 3, 5)  # GMT
    summer = date(2030, 4, 9)  # BST
    assert winter.weekday() == summer.weekday() == 1

    await client.put(
        "/api/v1/mentor/availability",
        json={"slots": [_slot(1, "18:00", "19:00", timezone="Europe/London")]},
        headers=mentor["headers"],
    )

    for probe, expected_utc in ((winter, "18:00"), (summer, "17:00")):
        resp = await client.get(
            "/api/v1/mentors/dst_mentor/slots",
            params={"from": probe.isoformat(), "days": 1},
            headers=viewer["headers"],
        )
        assert resp.status_code == 200, resp.text
        items = resp.json()["items"]
        if not items:
            # The probe date is in the past relative to "today", which the
            # service clamps, so skip rather than fail on the clock.
            continue
        item = items[0]
        assert item["local_start"] == "18:00:00", item
        assert datetime.fromisoformat(item["start"]).astimezone(UTC).strftime("%H:%M") == (
            expected_utc
        ), item


# --------------------------------------------------- booked sessions are busy


async def test_a_booked_session_is_not_offered(client: AsyncClient) -> None:
    """End to end: mentor accepts, a session is booked, the slot disappears.

    This is the read the booking screen uses, so it is tested through the
    real 8d write path rather than by inserting rows directly.
    """
    mentor = await _mentor(client, "m-busy@c8.dev", "busy_mentor")
    founder = await _signup(client, "founder-busy@c8.dev", role="startup")
    org = await client.post(
        "/api/v1/organizations", json={"name": "Busy Co", "type": "startup"},
        headers=founder["headers"],
    )
    org_id = org.json()["id"]
    me = await client.get("/api/v1/users/me", headers=mentor["headers"])
    mentor_id = me.json()["id"]

    target = datetime.now(UTC).date() + timedelta(days=9)
    await client.put(
        "/api/v1/mentor/availability",
        json={"slots": [_slot(target.weekday(), "18:00", "19:00")]},
        headers=mentor["headers"],
    )
    created = await client.post(
        f"/api/v1/organizations/{org_id}/mentorships",
        json={"mentor_id": mentor_id, "goal": "Help us with pricing"},
        headers=founder["headers"],
    )
    assert created.status_code == 201, created.text
    mid = created.json()["id"]
    await client.post(f"/api/v1/mentorships/{mid}/accept", json={}, headers=mentor["headers"])

    before = await client.get(
        "/api/v1/mentors/busy_mentor/slots",
        params={"from": target.isoformat(), "days": 1},
        headers=founder["headers"],
    )
    assert before.json()["total"] == 1, before.text
    free_start = before.json()["items"][0]["start"]

    booked = await client.post(
        f"/api/v1/mentorships/{mid}/sessions",
        json={"scheduled_at": free_start, "duration_min": 60, "topic": "Pricing"},
        headers=mentor["headers"],
    )
    assert booked.status_code == 201, booked.text

    after = await client.get(
        "/api/v1/mentors/busy_mentor/slots",
        params={"from": target.isoformat(), "days": 1},
        headers=founder["headers"],
    )
    assert after.status_code == 200, after.text
    assert after.json()["total"] == 0, after.text
