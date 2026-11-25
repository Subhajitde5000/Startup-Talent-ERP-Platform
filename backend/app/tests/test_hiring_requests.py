"""Step 7i hiring requests: lifecycle happy paths, plan rules (submit /
approve / reject / convert), 7r org types, and security.

Reuses the 7a/7d fixtures plus the funding-round member helpers — no
parallel fixture system.
"""

import uuid

from sqlalchemy import select

from app.core.config import get_settings
from app.models.activity import ActivityEvent
from app.models.job import Job
from app.services.rate_limiter import rate_limiter
from app.tests.test_applicant_pipeline import member, pipeline
from app.tests.test_funding_rounds import _make_org_with_members
from app.tests.test_job_discovery import marketplace
from app.tests.test_jobs import jobs_workspace

__all__ = ["pipeline", "marketplace", "jobs_workspace"]


def path(org_id, suffix=""):
    return f"/api/v1/organizations/{org_id}/hiring-requests{suffix}"


def url(request_id, suffix=""):
    return f"/api/v1/hiring-requests/{request_id}{suffix}"


def content(**overrides):
    return {
        "role_title": "Backend Engineer",
        "department": "engineering",
        "headcount": 2,
        "urgency": "high",
        "budget_amount": "2400000.00",
        **overrides,
    }


async def create(client, w, expect=201, **overrides):
    response = await client.post(
        path(w["org"]["id"]), headers=w["headers"], json=content(**overrides)
    )
    assert response.status_code == expect, response.text
    return response.json() if expect == 201 else {}


async def approve(client, w, request_id, auth=None, expect=200):
    response = await client.post(
        url(request_id, "/approve"), headers=(auth or w)["headers"]
    )
    assert response.status_code == expect, response.text
    return response.json() if expect == 200 else {}


async def user_id(client, actor):
    return (await client.get("/api/v1/users/me", headers=actor["headers"])).json()["id"]


async def test_create_submit_approve_convert_happy_path(client, marketplace, db_session):
    w = marketplace
    created = await create(
        client, w, submit=True, approver_id=w["user_id"], target_start="2026-04-01"
    )
    assert created["status"] == "pending"
    assert created["requested_by"] == w["user_id"]
    assert created["approver_id"] == w["user_id"]
    assert created["approver_name"]  # projection, not just the id
    assert created["requested_by_name"]
    assert created["job_id"] is None
    assert created["headcount"] == 2 and created["urgency"] == "high"

    read = await client.get(url(created["id"]), headers=w["headers"])
    assert read.status_code == 200 and read.json()["id"] == created["id"]

    listing = await client.get(
        path(w["org"]["id"], "?status=pending"), headers=w["headers"]
    )
    assert listing.status_code == 200, listing.text
    page = listing.json()
    assert page["total"] >= 1
    assert any(item["id"] == created["id"] for item in page["items"])
    assert page["limit"] == 50 and page["has_more"] is False

    decided = await approve(client, w, created["id"])
    assert decided["status"] == "approved"

    converted = await client.post(url(created["id"], "/convert"), headers=w["headers"])
    assert converted.status_code == 201, converted.text
    job = converted.json()
    assert job["status"] == "draft"
    assert job["title"] == "Backend Engineer"
    assert job["department"] == "engineering"
    assert job["openings"] == 2  # headcount -> openings
    assert float(job["salary_max"]) == 2400000.0  # budget -> salary_max
    assert job["show_salary_publicly"] is False  # internal budget stays internal

    after = (await client.get(url(created["id"]), headers=w["headers"])).json()
    assert after["status"] == "fulfilled"
    assert after["job_id"] == job["id"]

    # The server-only link lives on the job row (never a JobCreate field).
    linked = (
        await db_session.execute(
            select(Job.request_id).where(Job.id == uuid.UUID(job["id"]))
        )
    ).scalar_one()
    assert linked == uuid.UUID(created["id"])

    # Frozen after convert: content edits and a second convert 409.
    frozen = await client.patch(
        url(created["id"]), headers=w["headers"], json={"headcount": 5}
    )
    assert frozen.status_code == 409 and frozen.json()["error"]["code"] == "REQUEST_FROZEN"
    again = await client.post(url(created["id"], "/convert"), headers=w["headers"])
    assert again.status_code == 409 and again.json()["error"]["code"] == "REQUEST_NOT_APPROVED"

    events = list(
        (
            await db_session.execute(
                select(ActivityEvent.event_type).where(
                    ActivityEvent.entity_type == "hiring_request",
                    ActivityEvent.entity_id == uuid.UUID(created["id"]),
                )
            )
        ).scalars()
    )
    assert "hiring_request_created" in events
    assert "hiring_request_approved" in events
    assert "hiring_request_converted" in events


async def test_draft_edit_submit_and_cancel(client, marketplace):
    w = marketplace
    created = await create(client, w)  # submit=False -> draft
    assert created["status"] == "draft"

    edited = await client.patch(
        url(created["id"]),
        headers=w["headers"],
        json={"headcount": 4, "budget_amount": "1500000.00", "department": "product"},
    )
    assert edited.status_code == 200, edited.text
    row = edited.json()
    assert row["headcount"] == 4 and row["department"] == "product"

    submitted = await client.patch(
        url(created["id"]), headers=w["headers"], json={"status": "pending"}
    )
    assert submitted.status_code == 200 and submitted.json()["status"] == "pending"

    # Submitting again is an invalid transition, not a silent no-op.
    resubmit = await client.patch(
        url(created["id"]), headers=w["headers"], json={"status": "pending"}
    )
    assert resubmit.status_code == 409
    assert resubmit.json()["error"]["code"] == "REQUEST_INVALID_TRANSITION"

    cancelled = await client.patch(
        url(created["id"]), headers=w["headers"], json={"status": "cancelled"}
    )
    assert cancelled.status_code == 200 and cancelled.json()["status"] == "cancelled"

    # A cancelled request is frozen and cannot be decided.
    edit_after = await client.patch(
        url(created["id"]), headers=w["headers"], json={"headcount": 9}
    )
    assert edit_after.status_code == 409
    assert (
        await client.post(url(created["id"], "/approve"), headers=w["headers"])
    ).status_code == 409


async def test_member_can_draft_submit_cancel_but_not_approve_or_convert(
    client, marketplace
):
    w = marketplace
    actor = await member(
        client, w, role="member", global_role="employer", email="req-member@example.com"
    )

    created = await create(client, {"org": w["org"], "headers": actor["headers"]})
    assert created["status"] == "draft"
    assert created["requested_by"] is not None

    submitted = await client.patch(
        url(created["id"]), headers=actor["headers"], json={"status": "pending"}
    )
    assert submitted.status_code == 200

    # No designated approver -> only owner/admin may decide.
    denied = await client.post(url(created["id"], "/approve"), headers=actor["headers"])
    assert denied.status_code == 403

    owner_decided = await approve(client, w, created["id"])
    assert owner_decided["status"] == "approved"

    convert = await client.post(url(created["id"], "/convert"), headers=actor["headers"])
    assert convert.status_code == 403  # owner/admin only

    # A member may cancel their own open request...
    own = await create(client, {"org": w["org"], "headers": actor["headers"]})
    cancel = await client.patch(
        url(own["id"]), headers=actor["headers"], json={"status": "cancelled"}
    )
    assert cancel.status_code == 200

    # ...but not someone else's.
    other = await create(client, w)
    theirs = await client.patch(
        url(other["id"]), headers=actor["headers"], json={"status": "cancelled"}
    )
    assert theirs.status_code == 403

    # A member can never designate an approver (create or patch).
    denied_create = await client.post(
        path(w["org"]["id"]),
        headers=actor["headers"],
        json=content(approver_id=w["user_id"]),
    )
    assert denied_create.status_code == 403
    denied_patch = await client.patch(
        url(other["id"]), headers=actor["headers"], json={"approver_id": w["user_id"]}
    )
    assert denied_patch.status_code == 403


async def test_viewer_jobseeker_and_unauthenticated_are_blocked(client, marketplace):
    w = marketplace
    created = await create(client, w)
    viewer = await member(
        client, w, role="viewer", global_role="employer", email="req-viewer@example.com"
    )

    assert (
        await client.get(path(w["org"]["id"]), headers=viewer["headers"])
    ).status_code == 403
    denied_create = await client.post(
        path(w["org"]["id"]), headers=viewer["headers"], json=content()
    )
    assert denied_create.status_code == 403
    assert (
        await client.get(url(created["id"]), headers=viewer["headers"])
    ).status_code == 403

    # Jobseeker (candidate) can never touch hiring requests.
    candidate = w["candidate"]["headers"]
    assert (await client.get(path(w["org"]["id"]), headers=candidate)).status_code == 403

    # Unauthenticated -> 401 everywhere.
    assert (await client.get(path(w["org"]["id"]))).status_code == 401
    assert (await client.get(url(created["id"]))).status_code == 401
    assert (await client.post(url(created["id"], "/approve"))).status_code == 401


async def test_cross_org_ids_and_references(client, marketplace):
    w = marketplace
    created = await create(client, w)
    other = await _make_org_with_members(client, suffix=uuid.uuid4().hex[:8])

    # Row routes: an outsider resolves foreign ids as 404 (no oracle).
    outsider = other["owner"]
    for response in (
        await client.get(url(created["id"]), headers=outsider["headers"]),
        await client.patch(
            url(created["id"]), headers=outsider["headers"], json={"headcount": 9}
        ),
        await client.post(url(created["id"], "/approve"), headers=outsider["headers"]),
        await client.post(url(created["id"], "/convert"), headers=outsider["headers"]),
    ):
        assert response.status_code == 404, response.text

    # Org-prefixed routes: outsider gets the established 403.
    assert (
        await client.get(path(w["org"]["id"]), headers=outsider["headers"])
    ).status_code == 403
    assert (
        await client.post(
            path(w["org"]["id"]), headers=outsider["headers"], json=content()
        )
    ).status_code == 403

    # Cross-org payload reference -> 422 with loc on the field: the other
    # org's member is not a member of this one.
    other_member_id = await user_id(client, other["member"])
    cross = await client.post(
        path(w["org"]["id"]),
        headers=w["headers"],
        json=content(approver_id=other_member_id),
    )
    assert cross.status_code == 422, cross.text
    assert cross.json()["error"]["details"][0]["loc"] == ["body", "approver_id"]

    # 7r: a startup org gets the same endpoints (create -> approve).
    startup_request = await create(
        client, {"org": other["org"], "headers": other["owner"]["headers"]}
    )
    assert startup_request["status"] == "draft"
    submitted = await client.patch(
        url(startup_request["id"]),
        headers=other["owner"]["headers"],
        json={"status": "pending"},
    )
    assert submitted.status_code == 200
    decided = await approve(client, other, startup_request["id"], auth=other["owner"])
    assert decided["status"] == "approved"


async def test_validation_and_mass_assignment(client, marketplace):
    w = marketplace

    for bad in (
        {"headcount": 0},
        {"role_title": "   "},
        {"urgency": "asap"},
        {"currency": "inr"},
        {"budget_amount": 123.45},
        {"submit": "maybe"},
    ):
        response = await client.post(
            path(w["org"]["id"]), headers=w["headers"], json=content(**bad)
        )
        assert response.status_code == 422, (bad, response.text)

    # Server-controlled columns are never accepted (extra="forbid").
    for field in ("id", "org_id", "requested_by", "status", "created_at", "job_id"):
        response = await client.post(
            path(w["org"]["id"]),
            headers=w["headers"],
            json=content(**{field: str(uuid.uuid4())}),
        )
        assert response.status_code == 422, (field, response.text)

    created = await create(client, w)
    for field in ("id", "org_id", "requested_by", "created_at", "job_id"):
        response = await client.patch(
            url(created["id"]),
            headers=w["headers"],
            json={field: str(uuid.uuid4())},
        )
        assert response.status_code == 422, (field, response.text)

    # Status intents are a closed Literal — "approved" can never be typed
    # in by a client.
    response = await client.patch(
        url(created["id"]), headers=w["headers"], json={"status": "approved"}
    )
    assert response.status_code == 422


async def test_approver_rules(client, marketplace):
    w = marketplace
    viewer = await member(
        client, w, role="viewer", global_role="employer", email="approver-viewer@example.com"
    )
    admin = await member(
        client, w, role="admin", global_role="employer", email="approver-admin@example.com"
    )
    plain = await member(
        client, w, role="member", global_role="employer", email="approver-plain@example.com"
    )
    viewer_id = await user_id(client, viewer)
    admin_id = await user_id(client, admin)
    plain_id = await user_id(client, plain)
    unknown_id = str(uuid.uuid4())  # unknown user -> 422, never a silent ignore

    # Viewer / unknown / plain member cannot be designated; admin can.
    for approver, expect in (
        (viewer_id, 422),
        (unknown_id, 422),
        (plain_id, 422),
        (admin_id, 201),
    ):
        response = await client.post(
            path(w["org"]["id"]),
            headers=w["headers"],
            json=content(approver_id=approver, submit=True),
        )
        assert response.status_code == expect, (approver, response.text)
        if expect == 201:
            designated = response.json()

    # Non-designated owner cannot decide; the designated admin can.
    denied = await client.post(url(designated["id"], "/approve"), headers=w["headers"])
    assert denied.status_code == 403
    decided = await approve(client, w, designated["id"], auth=admin)
    assert decided["status"] == "approved"

    # Reassignment while pending moves the right to decide.
    pending = await create(client, w, submit=True, approver_id=w["user_id"])
    reassigned = await client.patch(
        url(pending["id"]), headers=w["headers"], json={"approver_id": admin_id}
    )
    assert reassigned.status_code == 200, reassigned.text
    old_denied = await client.post(
        url(pending["id"], "/approve"), headers=w["headers"]
    )
    assert old_denied.status_code == 403
    new_ok = await approve(client, w, pending["id"], auth=admin)
    assert new_ok["status"] == "approved"


async def test_wrong_state_transitions(client, marketplace):
    w = marketplace
    draft = await create(client, w)

    # approve/reject need pending; convert needs approved.
    assert (
        await client.post(url(draft["id"], "/approve"), headers=w["headers"])
    ).status_code == 409
    assert (
        await client.post(url(draft["id"], "/reject"), headers=w["headers"])
    ).status_code == 409
    assert (
        await client.post(url(draft["id"], "/convert"), headers=w["headers"])
    ).status_code == 409

    pending = await create(client, w, submit=True)
    rejected = await client.post(url(pending["id"], "/reject"), headers=w["headers"])
    assert rejected.status_code == 200 and rejected.json()["status"] == "rejected"
    # A decided request stays decided.
    assert (
        await client.post(url(pending["id"], "/approve"), headers=w["headers"])
    ).status_code == 409
    # Content is frozen once rejected.
    assert (
        await client.patch(
            url(pending["id"]), headers=w["headers"], json={"headcount": 3}
        )
    ).status_code == 409

    # Cancel is only legal from draft|pending.
    approved = await create(client, w, submit=True)
    await approve(client, w, approved["id"])
    assert (
        await client.patch(
            url(approved["id"]), headers=w["headers"], json={"status": "cancelled"}
        )
    ).status_code == 409


async def test_read_and_write_rate_limits(client, marketplace, monkeypatch):
    w = marketplace
    rate_limiter.reset()
    monkeypatch.setattr(get_settings(), "HIRING_REQUEST_READ_LIMIT", 1)
    assert (await client.get(path(w["org"]["id"]), headers=w["headers"])).status_code == 200
    assert (await client.get(path(w["org"]["id"]), headers=w["headers"])).status_code == 429

    rate_limiter.reset()
    monkeypatch.setattr(get_settings(), "HIRING_REQUEST_READ_LIMIT", 120)
    monkeypatch.setattr(get_settings(), "HIRING_REQUEST_WRITE_LIMIT", 1)
    first = await client.post(path(w["org"]["id"]), headers=w["headers"], json=content())
    assert first.status_code == 201, first.text
    second = await client.post(path(w["org"]["id"]), headers=w["headers"], json=content())
    assert second.status_code == 429, second.text


async def test_form_fields_round_trip_validate_and_carry_into_job(client, marketplace):
    """0046 GAP fields from /employer/requests/new: stored, validated
    (enums, owner-type hiring manager, skills list), editable while open,
    and carried into the draft job on convert — justification/why_now stay
    internal to the request."""
    w = marketplace
    actor = await member(
        client, w, role="member", global_role="employer", email="req-form-member@example.com"
    )
    actor_id = await user_id(client, actor)
    created = await create(
        client,
        w,
        employment_type="contract",
        work_mode="hybrid",
        hiring_manager_id=actor_id,
        skills=["  React ", "react", "Type   Script", "Kotlin-7i-Unique"],
        why_now="skill_gap",
        justification="  Needed for the Q1 platform rewrite.  ",
    )
    assert created["employment_type"] == "contract"
    assert created["work_mode"] == "hybrid"
    assert created["hiring_manager_id"] == actor_id
    assert created["hiring_manager_name"]
    # Whitespace collapsed, case-insensitive duplicates dropped.
    assert created["skills"] == ["React", "Type Script", "Kotlin-7i-Unique"]
    assert created["why_now"] == "skill_gap"
    assert created["justification"] == "Needed for the Q1 platform rewrite."

    # Defaults when omitted.
    plain = await create(client, w)
    assert plain["employment_type"] == "full_time" and plain["work_mode"] == "onsite"
    assert plain["skills"] == [] and plain["hiring_manager_id"] is None
    assert plain["why_now"] is None and plain["justification"] is None

    # Validation: enums, lengths, and owner-type hiring manager.
    for body, loc in (
        ({"employment_type": "gig"}, ["body", "employment_type"]),
        ({"work_mode": "moon"}, ["body", "work_mode"]),
        ({"why_now": "vibes"}, ["body", "why_now"]),
        ({"justification": "x" * 2001}, ["body", "justification"]),
        ({"skills": ["x"] * 21}, ["body", "skills"]),
        ({"skills": ["y" * 81]}, ["body", "skills", 0]),
    ):
        bad = await client.post(path(w["org"]["id"]), headers=w["headers"], json=content(**body))
        assert bad.status_code == 422, (body, bad.text)
        assert bad.json()["error"]["details"][0]["loc"] == loc, bad.text
    viewer = await member(
        client, w, role="viewer", global_role="employer", email="req-form-viewer@example.com"
    )
    other = await _make_org_with_members(client, suffix=uuid.uuid4().hex[:8])
    for bad_id in (await user_id(client, viewer), await user_id(client, other["member"])):
        bad = await client.post(
            path(w["org"]["id"]), headers=w["headers"], json=content(hiring_manager_id=bad_id)
        )
        assert bad.status_code == 422, bad.text
        assert bad.json()["error"]["details"][0]["loc"] == ["body", "hiring_manager_id"]

    # Editable while open (member-level), clearable.
    edited = await client.patch(
        url(plain["id"]),
        headers=w["headers"],
        json={"work_mode": "remote", "skills": ["Go"], "why_now": "growth"},
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["work_mode"] == "remote" and edited.json()["skills"] == ["Go"]
    cleared = await client.patch(
        url(created["id"]), headers=w["headers"], json={"hiring_manager_id": None, "why_now": None}
    )
    assert cleared.status_code == 200
    assert cleared.json()["hiring_manager_id"] is None and cleared.json()["why_now"] is None
    restored = await client.patch(
        url(created["id"]), headers=w["headers"], json={"hiring_manager_id": actor_id}
    )
    assert restored.status_code == 200

    # Convert carries the fields into the draft job.
    await client.patch(url(created["id"]), headers=w["headers"], json={"status": "pending"})
    await approve(client, w, created["id"])
    converted = await client.post(url(created["id"], "/convert"), headers=w["headers"])
    assert converted.status_code == 201, converted.text
    job = converted.json()
    assert job["employment_type"] == "contract"
    assert job["work_mode"] == "hybrid"
    assert job["owner_id"] == actor_id
    assert sorted(skill["name"].lower() for skill in job["skills"]) == [
        "kotlin-7i-unique",
        "react",
        "type script",
    ]
    assert all(skill["is_required"] for skill in job["skills"])
    assert "Q1 platform rewrite" not in (job.get("description") or "")
