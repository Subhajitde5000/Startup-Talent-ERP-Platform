"""Step 7f interview API tests.

Covers the plan's acceptance matrix: schedule → respond → complete →
feedback happy path; validation (timezone, past slots, meeting URLs,
panelist eligibility, mass-assignment, body limit); lifecycle state
machine and panelist conflict; scope rules (owner/admin/job-owner write,
member/panelist reads, viewer 403, outsider 404, cross-org 404/422);
candidate own-application view without feedback or internal fields; rate
limits and the OpenAPI operation set.
"""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from app.core.config import get_settings
from app.main import create_app
from app.models.activity import ActivityEvent
from app.tests.test_applicant_pipeline import member, move, pipeline
from app.tests.test_funding_rounds import _create_org, _signup_verified
from app.tests.test_job_applications import apply
from app.tests.test_job_discovery import marketplace
from app.tests.test_jobs import action, jobs_workspace

# Fixtures are referenced only in test signatures; re-export them so
# pytest and ruff both see the names (same pattern as test_scorecards).
__all__ = ["jobs_workspace", "marketplace", "pipeline"]


def _base(w: dict[str, Any]) -> str:
    return f"/api/v1/organizations/{w['org']['id']}"


def _app_path(w: dict[str, Any]) -> str:
    return f"{_base(w)}/jobs/{w['job']['id']}/applications/{w['app']['id']}"


def _future(**delta: int) -> str:
    return (datetime.now(UTC) + timedelta(**delta)).isoformat()


async def _me(client, headers: dict) -> str:
    return (await client.get("/api/v1/users/me", headers=headers)).json()["id"]


async def _schedule(
    client, w, headers, panelists: list[str], *, when: str, duration: int = 45, **extra
):
    return await client.post(
        f"{_app_path(w)}/interviews",
        headers=headers,
        json={
            "round_name": "Panel round",
            "format": "video",
            "scheduled_at": when,
            "duration_min": duration,
            "meeting_url": "https://meet.example.com/room",
            "interviewer_ids": panelists,
            **extra,
        },
    )


async def test_schedule_respond_complete_feedback_and_lists(client, pipeline, db_session):
    w = pipeline
    owner_headers = w["headers"]
    owner_id = await _me(client, owner_headers)
    panelist = await member(client, w, email="int-panel@example.com")
    when = _future(hours=2)

    created = await _schedule(client, w, owner_headers, [owner_id, panelist["id"]], when=when)
    assert created.status_code == 201, created.text
    row = created.json()
    interview_id = row["id"]
    assert row["status"] == "scheduled"
    assert row["is_blind"] is False
    assert row["candidate_label"]
    sides = {p["side"]: p for p in row["participants"]}
    assert set(sides) == {"candidate", "interviewer"}
    assert sides["candidate"]["response"] is None
    assert {p["user_id"] for p in row["participants"] if p["side"] == "interviewer"} == {
        owner_id,
        panelist["id"],
    }
    assert row["needs_my_feedback"] is False  # not completed yet

    # Plan D8: scheduling never moves the application stage.
    detail_app = await client.get(_app_path(w), headers=owner_headers)
    assert detail_app.status_code == 200
    assert detail_app.json()["stage"] == "applied"
    events = (
        await db_session.execute(
            ActivityEvent.__table__.select().where(
                ActivityEvent.event_type == "interview_scheduled",
                ActivityEvent.org_id == UUID(w["org"]["id"]),
            )
        )
    ).all()
    assert len(events) >= 1

    # Either side answers for itself only.
    ok = await client.put(
        f"/api/v1/interviews/{interview_id}/respond",
        headers=panelist["headers"],
        json={"response": "accepted"},
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["response"] == "accepted"
    assert ok.json()["user_id"] == panelist["id"]
    tentative = await client.put(
        f"/api/v1/interviews/{interview_id}/respond",
        headers=w["candidate"]["headers"],
        json={"response": "tentative"},
    )
    assert tentative.status_code == 200, tentative.text

    before = await client.get(f"{_base(w)}/interviews/{interview_id}", headers=owner_headers)
    assert before.status_code == 200
    assert (
        next(p for p in before.json()["participants"] if p["user_id"] == panelist["id"])["response"]
        == "accepted"
    )
    assert before.json()["feedback"] == []

    # Upcoming list includes it; completed excludes it from upcoming.
    upcoming = await client.get(f"{_base(w)}/interviews?window=upcoming", headers=owner_headers)
    assert upcoming.status_code == 200
    assert interview_id in [i["id"] for i in upcoming.json()["items"]]
    by_job = await client.get(
        f"{_base(w)}/interviews?job_id={w['job']['id']}", headers=owner_headers
    )
    assert interview_id in [i["id"] for i in by_job.json()["items"]]

    # Feedback only after completion.
    early = await client.put(
        f"{_base(w)}/interviews/{interview_id}/feedback",
        headers=panelist["headers"],
        json={"recommendation": "yes", "summary": "Too early."},
    )
    assert early.status_code == 409
    assert early.json()["error"]["code"] == "INVALID_STATE"

    done = await client.post(
        f"{_base(w)}/interviews/{interview_id}/complete", headers=owner_headers
    )
    assert done.status_code == 200 and done.json()["status"] == "completed"

    # needs_feedback: panelist owes it; a non-panelist admin does not.
    owes = await client.get(
        f"{_base(w)}/interviews?needs_feedback=true", headers=panelist["headers"]
    )
    assert owes.status_code == 200
    assert interview_id in [i["id"] for i in owes.json()["items"]]
    admin = await member(client, w, role="admin", email="int-admin@example.com")
    clean = await client.get(f"{_base(w)}/interviews?needs_feedback=true", headers=admin["headers"])
    assert interview_id not in [i["id"] for i in clean.json()["items"]]

    fb = await client.put(
        f"{_base(w)}/interviews/{interview_id}/feedback",
        headers=panelist["headers"],
        json={"recommendation": "strong_yes", "summary": "Great signal."},
    )
    assert fb.status_code == 200, fb.text
    assert fb.json()["recommendation"] == "strong_yes"
    replaced = await client.put(
        f"{_base(w)}/interviews/{interview_id}/feedback",
        headers=panelist["headers"],
        json={"recommendation": "yes", "summary": "Revised after calibration."},
    )
    assert replaced.status_code == 200
    assert replaced.json()["id"] == fb.json()["id"]  # upsert, not a second row

    after = await client.get(f"{_base(w)}/interviews/{interview_id}", headers=panelist["headers"])
    assert after.status_code == 200
    assert after.json()["needs_my_feedback"] is False
    assert len(after.json()["feedback"]) == 1
    assert after.json()["feedback"][0]["author_name"]

    past = await client.get(f"{_base(w)}/interviews?window=past", headers=owner_headers)
    assert interview_id in [i["id"] for i in past.json()["items"]]
    assert interview_id not in [
        i["id"]
        for i in (
            await client.get(f"{_base(w)}/interviews?window=upcoming", headers=owner_headers)
        ).json()["items"]
    ]

    # Candidate view: interview rows, never feedback or internal reasons.
    cand_list = await client.get(
        f"/api/v1/applications/{w['app']['id']}/interviews",
        headers=w["candidate"]["headers"],
    )
    assert cand_list.status_code == 200
    items = cand_list.json()["items"]
    assert [i["id"] for i in items] == [interview_id]
    assert items[0]["company_name"] == w["org"]["name"]
    for key in ("feedback", "cancelled_reason", "needs_my_feedback", "candidate_label"):
        assert key not in items[0]
    cand_one = await client.get(
        f"/api/v1/applications/{w['app']['id']}/interviews/{interview_id}",
        headers=w["candidate"]["headers"],
    )
    assert cand_one.status_code == 200
    assert cand_one.json()["meeting_url"].startswith("https://")
    assert cand_one.json()["company_name"] == w["org"]["name"]


async def test_schedule_validation_states_and_conflicts(client, pipeline):
    w = pipeline
    owner_headers = w["headers"]
    owner_id = await _me(client, owner_headers)
    panelist = await member(client, w, email="int-vpanel@example.com")
    base_body: dict[str, Any] = {
        "round_name": "Screen",
        "format": "video",
        "scheduled_at": _future(hours=3),
        "duration_min": 30,
        "interviewer_ids": [owner_id, panelist["id"]],
    }
    url = f"{_app_path(w)}/interviews"

    # Naive and past timestamps, bad URL, bad panelists.
    naive = await client.post(
        url, headers=owner_headers, json={**base_body, "scheduled_at": "2030-05-05T10:00:00"}
    )
    assert naive.status_code == 422
    assert any("scheduled_at" in str(err["loc"]) for err in naive.json()["error"]["details"])
    past = await client.post(
        url,
        headers=owner_headers,
        json={**base_body, "scheduled_at": (datetime.now(UTC) - timedelta(hours=1)).isoformat()},
    )
    assert past.status_code == 422
    http_url = await client.post(
        url, headers=owner_headers, json={**base_body, "meeting_url": "http://x.example"}
    )
    assert http_url.status_code == 422
    empty = await client.post(url, headers=owner_headers, json={**base_body, "interviewer_ids": []})
    assert empty.status_code == 422
    dupes = await client.post(
        url,
        headers=owner_headers,
        json={**base_body, "interviewer_ids": [owner_id, owner_id]},
    )
    assert dupes.status_code == 422
    stranger = await _signup_verified(client, "int-stranger@example.com", "jobseeker")
    stranger_id = await _me(client, stranger["headers"])
    bad_member = await client.post(
        url,
        headers=owner_headers,
        json={**base_body, "interviewer_ids": [owner_id, stranger_id]},
    )
    assert bad_member.status_code == 422
    assert any(
        err["loc"][:2] == ["body", "interviewer_ids"]
        for err in bad_member.json()["error"]["details"]
    )
    candidate_id = await _me(client, w["candidate"]["headers"])
    with_candidate = await client.post(
        url,
        headers=owner_headers,
        json={**base_body, "interviewer_ids": [owner_id, candidate_id]},
    )
    assert with_candidate.status_code == 422

    # Mass-assignment on server-owned fields and oversized bodies.
    extra = await client.post(url, headers=owner_headers, json={**base_body, "status": "completed"})
    assert extra.status_code == 422
    huge = await client.post(
        url,
        headers=owner_headers,
        json={**base_body, "location": "x" * 40_000},
    )
    assert huge.status_code == 413

    # Double-booking: overlapping slot for the same panelist -> 409.
    first = await _schedule(
        client, w, owner_headers, [owner_id, panelist["id"]], when=_future(hours=4)
    )
    assert first.status_code == 201, first.text
    clash = await _schedule(client, w, owner_headers, [owner_id], when=_future(hours=4, minutes=10))
    assert clash.status_code == 409
    assert clash.json()["error"]["code"] == "INTERVIEWER_CONFLICT"
    clash_list = await _schedule(
        client,
        w,
        owner_headers,
        [panelist["id"]],
        when=_future(hours=4, minutes=20),
        duration=60,
    )
    assert clash_list.status_code == 409
    # A non-overlapping slot for the same panelist is fine.
    free = await _schedule(client, w, owner_headers, [panelist["id"]], when=_future(hours=7))
    assert free.status_code == 201, free.text

    # Closed job -> 409 (reads still work).
    await action(client, w, w["job"], "close")
    closed = await _schedule(client, w, owner_headers, [owner_id], when=_future(hours=9))
    assert closed.status_code == 409
    assert closed.json()["error"]["code"] == "PIPELINE_READ_ONLY"
    assert (await client.get(_app_path(w), headers=owner_headers)).status_code == 200


async def test_terminal_application_blocks_scheduling(client, pipeline):
    w = pipeline
    owner_headers = w["headers"]
    owner_id = await _me(client, owner_headers)
    moved = await move(
        client,
        w,
        "rejected",
        "applied",
        rejected_reason="other",
        rejection_detail="Terminal state",
    )
    assert moved.status_code == 200, moved.text
    blocked = await _schedule(client, w, owner_headers, [owner_id], when=_future(hours=5))
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "APPLICATION_READ_ONLY"


async def test_lifecycle_state_machine_and_response_reset(client, pipeline):
    w = pipeline
    owner_headers = w["headers"]
    panelist = await member(client, w, email="int-life@example.com")
    created = await _schedule(client, w, owner_headers, [panelist["id"]], when=_future(hours=6))
    assert created.status_code == 201, created.text
    iid = created.json()["id"]
    org_path = f"{_base(w)}/interviews/{iid}"

    # Mass-assignment: status changes only via actions, not PATCH.
    bad = await client.patch(org_path, headers=owner_headers, json={"status": "completed"})
    assert bad.status_code == 422

    # Respond, then move the slot: responses reset (plan D4).
    await client.put(
        f"/api/v1/interviews/{iid}/respond",
        headers=panelist["headers"],
        json={"response": "accepted"},
    )
    moved_slot = await client.patch(
        org_path,
        headers=owner_headers,
        json={"scheduled_at": _future(hours=8), "round_name": "Final round"},
    )
    assert moved_slot.status_code == 200, moved_slot.text
    assert moved_slot.json()["round_name"] == "Final round"
    assert all(p["response"] is None for p in moved_slot.json()["participants"])

    # Reschedule onto a busy slot -> conflict; completed/cancelled are frozen.
    busy_when = _future(hours=10)
    await _schedule(client, w, owner_headers, [panelist["id"]], when=busy_when, duration=45)
    clash = await client.patch(
        org_path, headers=owner_headers, json={"scheduled_at": _future(hours=10, minutes=15)}
    )
    assert clash.status_code == 409
    assert clash.json()["error"]["code"] == "INTERVIEWER_CONFLICT"

    # Empty PATCH -> 422.
    assert (await client.patch(org_path, headers=owner_headers, json={})).status_code == 422

    completed = await client.post(f"{org_path}/complete", headers=owner_headers)
    assert completed.status_code == 200
    for attempt in (
        await client.patch(org_path, headers=owner_headers, json={"round_name": "x"}),
        await client.post(f"{org_path}/cancel", headers=owner_headers, json={}),
        await client.post(f"{org_path}/complete", headers=owner_headers),
        await client.put(
            f"/api/v1/interviews/{iid}/respond",
            headers=panelist["headers"],
            json={"response": "declined"},
        ),
    ):
        assert attempt.status_code == 409
        assert attempt.json()["error"]["code"] == "INVALID_STATE"

    # Cancel works from scheduled only.
    second = await _schedule(client, w, owner_headers, [panelist["id"]], when=_future(hours=11))
    iid2 = second.json()["id"]
    cancelled = await client.post(
        f"{_base(w)}/interviews/{iid2}/cancel",
        headers=owner_headers,
        json={"reason": "Panelist unavailable."},
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    assert cancelled.json()["cancelled_reason"] == "Panelist unavailable."
    again = await client.post(
        f"{_base(w)}/interviews/{iid2}/cancel", headers=owner_headers, json={}
    )
    assert again.status_code == 409


async def test_scope_roles_and_candidate_privacy(client, pipeline):
    w = pipeline
    owner_headers = w["headers"]
    owner_id = await _me(client, owner_headers)
    panelist = await member(client, w, email="int-scope-panel@example.com")
    viewer = await member(client, w, role="viewer", email="int-viewer@example.com")
    plain = await member(client, w, email="int-plain@example.com")

    # Viewer cannot touch interviews at all.
    assert (
        await client.get(f"{_base(w)}/interviews", headers=viewer["headers"])
    ).status_code == 403
    assert (
        await _schedule(client, w, viewer["headers"], [owner_id], when=_future(hours=2))
    ).status_code == 403

    # Panelist member: reads and responds/feedback, but no lifecycle writes.
    created = await _schedule(client, w, owner_headers, [panelist["id"]], when=_future(hours=3))
    assert created.status_code == 201, created.text
    iid = created.json()["id"]
    org_path = f"{_base(w)}/interviews/{iid}"
    assert (
        await client.patch(
            org_path, headers=panelist["headers"], json={"scheduled_at": _future(hours=4)}
        )
    ).status_code == 403
    assert (
        await client.post(f"{org_path}/cancel", headers=panelist["headers"], json={})
    ).status_code == 403
    # The application is outside this member's 7d scope, so the schedule
    # attempt is a 404 before the owner/admin/job-owner rule even runs.
    assert (
        await _schedule(client, w, panelist["headers"], [owner_id], when=_future(hours=5))
    ).status_code == 404

    # Ordinary members: no interview rows until assigned or on a panel.
    plain_list = await client.get(f"{_base(w)}/interviews", headers=plain["headers"])
    assert plain_list.status_code == 200 and plain_list.json()["total"] == 0
    panel_list = await client.get(f"{_base(w)}/interviews", headers=panelist["headers"])
    assert panel_list.status_code == 200
    assert iid in [i["id"] for i in panel_list.json()["items"]]

    # Assignee sees the interview for their application.
    assigned = await client.patch(
        _app_path(w), headers=owner_headers, json={"assignee_id": plain["id"]}
    )
    assert assigned.status_code == 200, assigned.text
    assignee_list = await client.get(f"{_base(w)}/interviews", headers=plain["headers"])
    assert iid in [i["id"] for i in assignee_list.json()["items"]]
    # Assignee can see the application but still fails the D5 schedule rule.
    assert (
        await _schedule(client, w, plain["headers"], [owner_id], when=_future(hours=5))
    ).status_code == 403

    # Outsiders: org routes 403, respond 404, candidate routes 404.
    outsider = await _signup_verified(client, "int-outsider@example.com", "employer")
    assert (
        await client.get(f"{_base(w)}/interviews", headers=outsider["headers"])
    ).status_code == 403
    assert (await client.get(org_path, headers=outsider["headers"])).status_code == 403
    assert (
        await client.put(
            f"/api/v1/interviews/{iid}/respond",
            headers=outsider["headers"],
            json={"response": "accepted"},
        )
    ).status_code == 404
    assert (
        await client.get(
            f"/api/v1/applications/{w['app']['id']}/interviews",
            headers=outsider["headers"],
        )
    ).status_code == 404

    # Cross-org references: foreign org id, foreign application, foreign
    # interview id, and a panelist who is not a member of this org.
    other = await _create_org(client, w["actor"], name="Int Other Org", type_="employer")
    other_headers = w["actor"]["headers"]
    assert (
        await client.post(
            f"/api/v1/organizations/{other['id']}/jobs/{w['job']['id']}"
            f"/applications/{w['app']['id']}/interviews",
            headers=other_headers,
            json={
                "scheduled_at": _future(hours=12),
                "interviewer_ids": [owner_id],
            },
        )
    ).status_code == 404
    other_job = await client.post(
        f"{_base(w)}/jobs/{w['job']['id']}/applications/{other['id']}/interviews",
        headers=owner_headers,
        json={"scheduled_at": _future(hours=12), "interviewer_ids": [owner_id]},
    )
    assert other_job.status_code == 404
    assert (
        await client.get(f"{_base(w)}/interviews/{UUID(int=0)}", headers=owner_headers)
    ).status_code == 404
    foreign_user = await _signup_verified(client, "int-foreign@example.com", "employer")
    foreign_id = await _me(client, foreign_user["headers"])
    assert (
        await _schedule(client, w, owner_headers, [owner_id, foreign_id], when=_future(hours=13))
    ).status_code == 422

    # Candidate sees own interviews only, never feedback; another
    # candidate's application and ids are 404.
    cand = await client.get(
        f"/api/v1/applications/{w['app']['id']}/interviews",
        headers=w["candidate"]["headers"],
    )
    assert cand.status_code == 200
    assert "feedback" not in cand.json()["items"][0]
    second_candidate = await _signup_verified(client, "int-cand2@example.com", "jobseeker")
    second_app = await apply(client, {**w, "candidate": second_candidate})
    assert (
        await client.get(
            f"/api/v1/applications/{w['app']['id']}/interviews",
            headers=second_candidate["headers"],
        )
    ).status_code == 404
    assert (
        await client.get(
            f"/api/v1/applications/{second_app['id']}/interviews/{iid}",
            headers=second_candidate["headers"],
        )
    ).status_code == 404
    # The candidate cannot use employer lifecycle routes.
    assert (
        await client.post(
            f"{org_path}/cancel",
            headers=w["candidate"]["headers"],
            json={"reason": "nope"},
        )
    ).status_code == 403
    # Feedback is interviewer-only: a panelist on the candidate side is refused.
    await client.post(org_path + "/complete", headers=owner_headers)
    cand_feedback = await client.put(
        f"{org_path}/feedback",
        headers=w["candidate"]["headers"],
        json={"recommendation": "yes", "summary": "self assessment"},
    )
    assert cand_feedback.status_code == 403
    manager_feedback = await client.put(
        f"{org_path}/feedback",
        headers=owner_headers,
        json={"recommendation": "yes", "summary": "not on panel"},
    )
    assert manager_feedback.status_code == 403


async def test_interview_rates_openapi_and_auth(client, pipeline):
    import pytest

    fresh = await _signup_verified(client, "int-rate@example.com", "employer")
    org = await _create_org(client, fresh, name="Interview Rate Co", type_="employer")
    settings = get_settings()
    patch = pytest.MonkeyPatch()
    patch.setattr(settings, "INTERVIEW_WRITE_LIMIT", 5)
    patch.setattr(settings, "INTERVIEW_READ_LIMIT", 5)
    try:
        iid = str(UUID(int=7))
        path = f"/api/v1/organizations/{org['id']}/interviews/{iid}"
        for _ in range(5):
            resp = await client.patch(
                path,
                headers=fresh["headers"],
                json={"scheduled_at": _future(hours=2)},
            )
            assert resp.status_code == 404
        blocked = await client.patch(
            path, headers=fresh["headers"], json={"scheduled_at": _future(hours=2)}
        )
        assert blocked.status_code == 429
        assert blocked.json()["error"]["code"] == "RATE_LIMITED"

        # Reads: interview_read key, separate from the write budget.
        listing = f"/api/v1/organizations/{org['id']}/interviews"
        for _ in range(5):
            assert (await client.get(listing, headers=fresh["headers"])).status_code == 200
        assert (await client.get(listing, headers=fresh["headers"])).status_code == 429

        # Query validation happens before the rate gate.
        assert (
            await client.get(listing + "?window=whenever", headers=fresh["headers"])
        ).status_code == 422
        assert (
            await client.get(listing + "?status=maybe", headers=fresh["headers"])
        ).status_code == 422
        assert (await client.get(listing)).status_code == 401
    finally:
        patch.undo()

    schema = create_app().openapi()
    ops = [
        (method.upper(), path)
        for path, item in schema["paths"].items()
        for method, operation in item.items()
        if isinstance(operation, dict) and "interviews" in operation.get("tags", [])
    ]
    assert len(ops) == 10, ops
    for method, path in ops:
        assert method in {"GET", "POST", "PUT", "PATCH"}, (method, path)
        statuses = schema["paths"][path][method.lower()]["responses"]
        for code in ("401", "403", "404", "409", "413", "422", "429"):
            assert code in statuses, (method, path, code)
