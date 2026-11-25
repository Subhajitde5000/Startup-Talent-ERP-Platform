"""7f–7h contracts against actual auth, membership and disposable DB fixtures."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import func, select

from app.models.activity import ActivityEvent
from app.models.hiring_workflow import Hire, Interview, JobOffer, OfferDeclineReason
from app.tests.conftest import TEST_DATABASE_URL
from app.tests.test_applicant_pipeline import member, move, path, pipeline
from app.tests.test_files import file_env
from app.tests.test_job_discovery import hdr, marketplace
from app.tests.test_jobs import jobs_workspace

__all__ = ["pipeline", "marketplace", "jobs_workspace"]


def root(w):
    return f"/api/v1/organizations/{w['org']['id']}"


def interviews(w):
    return root(w) + "/interviews"


def offers(w):
    return root(w) + "/job-offers"


def interview_input(w, **changes):
    return {
        "application_id": w["app"]["id"],
        "request_id": str(uuid.uuid4()),
        "round_name": "Technical",
        "scheduled_at": (datetime.now(UTC) + timedelta(days=3)).isoformat(),
        "duration_min": 45,
        "participants": [{"user_id": w["user_id"], "side": "interviewer"}],
        **changes,
    }


async def scheduled(client, w, **changes):
    result = await client.post(
        interviews(w), headers=w["headers"], json=interview_input(w, **changes)
    )
    assert result.status_code == 201, result.text
    return result.json()


def terms(**changes):
    return {
        "title": "Engineer offer",
        "base_salary": "1500000.00",
        "start_date": (datetime.now(UTC).date() + timedelta(days=30)).isoformat(),
        "expires_on": (datetime.now(UTC).date() + timedelta(days=10)).isoformat(),
        **changes,
    }


async def draft(client, w, **changes):
    result = await client.post(
        offers(w),
        headers=w["headers"],
        json={
            "application_id": w["app"]["id"],
            "request_id": str(uuid.uuid4()),
            **terms(),
            **changes,
        },
    )
    assert result.status_code == 201, result.text
    return result.json()


@pytest_asyncio.fixture
async def offer_workspace(client, pipeline):
    w = pipeline
    assert (await move(client, w, "shortlisted")).status_code == 200
    admin = await member(client, w, role="admin", email="offer-approver@example.com")
    return {**w, "approver": admin}


async def sent(client, w, **changes):
    row = await draft(client, w, **changes)
    url = offers(w) + "/" + row["id"]
    submit = await client.post(
        url + "/submit",
        headers=w["headers"],
        json={"expected_version": 1, "approver_ids": [w["approver"]["id"]]},
    )
    assert submit.status_code == 200, submit.text
    approval = await client.put(
        url + "/approvals/me",
        headers=w["approver"]["headers"],
        json={
            "expected_version": submit.json()["version"],
            "decision": "approved",
            "note": "Internal salary approval",
        },
    )
    assert approval.status_code == 200, approval.text
    result = await client.post(
        url + "/send", headers=w["headers"], json={"expected_version": approval.json()["version"]}
    )
    assert result.status_code == 200, result.text
    return result.json()


async def accepted(client, w):
    row = await sent(client, w)
    response = await client.post(
        "/api/v1/job-offers/" + row["id"] + "/respond",
        headers=hdr(w),
        json={"expected_version": row["version"], "action": "accept"},
    )
    assert response.status_code == 200, response.text
    return response.json()


async def hired(client, w, **changes):
    offer = await accepted(client, w)
    result = await client.post(
        root(w) + "/hires", headers=w["headers"], json={"offer_id": offer["id"], **changes}
    )
    assert result.status_code == 201, result.text
    return result.json()


async def test_interview_retry_attendance_and_projection(client, pipeline, db_session):
    w = pipeline
    payload = interview_input(w)
    result = await client.post(interviews(w), headers=w["headers"], json=payload)
    assert result.status_code == 201, result.text
    row = result.json()
    assert row["version"] == 1 and len(row["participants"]) == 2
    assert (await client.post(interviews(w), headers=w["headers"], json=payload)).json() == row
    assert (
        await client.post(
            interviews(w), headers=w["headers"], json={**payload, "round_name": "Different"}
        )
    ).status_code == 409
    assert (await client.get(path(w), headers=w["headers"])).json()["stage"] == "interview"
    own = "/api/v1/interviews/" + row["id"]
    read = await client.get(own, headers=hdr(w))
    assert read.status_code == 200, read.text
    assert (
        len(read.json()["participants"]) == 1
        and read.json()["participants"][0]["display_name"] == "You"
    )
    assert w["user_id"] not in read.text and "fingerprint" not in read.text
    candidate = await client.put(
        own + "/attendance/me", headers=hdr(w), json={"expected_version": 1, "response": "accepted"}
    )
    assert candidate.status_code == 200, candidate.text
    reply = await client.put(
        interviews(w) + "/" + row["id"] + "/attendance/me",
        headers=w["headers"],
        json={"expected_version": 2, "response": "accepted"},
    )
    assert reply.status_code == 200, reply.text
    assert reply.json()["status"] == "confirmed"
    assert (await client.get("/api/v1/interviews", headers=hdr(w))).json()["total"] == 1
    assert (await db_session.scalar(select(func.count()).select_from(Interview))) == 1


async def test_reschedule_overlap_and_feedback_privacy(client, pipeline, db_session):
    w = pipeline
    row = await scheduled(client, w)
    url = interviews(w) + "/" + row["id"]
    overlap = await client.post(
        interviews(w),
        headers=w["headers"],
        json=interview_input(w, scheduled_at=row["scheduled_at"]),
    )
    assert overlap.status_code == 409, overlap.text
    past = datetime.now(UTC) - timedelta(hours=2)
    assert (
        await client.post(
            url + "/transitions",
            headers=w["headers"],
            json={"expected_version": 1, "action": "complete"},
        )
    ).status_code == 409
    assert (
        await client.put(
            url + "/feedback/me",
            headers=w["headers"],
            json={"recommendation": "yes", "summary": "Private feedback"},
        )
    ).status_code == 409
    revised = await client.patch(
        url,
        headers=w["headers"],
        json={
            k: v
            for k, v in {
                **interview_input(
                    w, scheduled_at=(datetime.now(UTC) + timedelta(days=4)).isoformat()
                ),
                "expected_version": 1,
            }.items()
            if k not in {"application_id", "request_id", "participants"}
        },
    )
    assert revised.status_code == 200, revised.text
    assert revised.json()["version"] == 2
    record = await db_session.get(Interview, uuid.UUID(row["id"]))
    record.scheduled_at = past
    await db_session.commit()
    complete = await client.post(
        url + "/transitions",
        headers=w["headers"],
        json={"expected_version": 2, "action": "complete"},
    )
    assert complete.status_code == 200, complete.text
    payload = {"recommendation": "yes", "summary": "Private Zebra feedback"}
    put = await client.put(url + "/feedback/me", headers=w["headers"], json=payload)
    assert put.status_code == 200, put.text
    assert (
        await client.put(url + "/feedback/me", headers=w["headers"], json=payload)
    ).json() == put.json()
    admin = await member(client, w, role="admin")
    assert (await client.get(url + "/feedback", headers=admin["headers"])).json()["total"] == 0
    assert (await client.get(url + "/feedback", headers=w["headers"])).json()["total"] == 1
    assert (
        await client.get("/api/v1/interviews/" + row["id"] + "/feedback", headers=hdr(w))
    ).status_code in {404, 405}
    events = list((await db_session.execute(select(ActivityEvent))).scalars())
    assert "Zebra" not in str([(e.summary, e.data) for e in events])


@pytest.mark.parametrize(
    "field,value",
    [
        ("status", "completed"),
        ("created_by", str(uuid.uuid4())),
        ("duration_min", 4),
        ("scheduled_at", "2027-01-01T12:00:00"),
        ("meeting_url", "javascript:alert(1)"),
        ("meeting_url", "https://name:secret@example.com"),
        ("version", 9),
        ("round_name", " "),
        ("duration_min", True),
    ],
)
async def test_interview_strict_input(client, pipeline, field, value):
    w = pipeline
    response = await client.post(
        interviews(w), headers=w["headers"], json=interview_input(w, **{field: value})
    )
    assert response.status_code == 422, response.text


async def test_interview_access_and_refs(client, pipeline):
    w = pipeline
    row = await scheduled(client, w)
    url = interviews(w) + "/" + row["id"]
    assert (await client.get(url)).status_code == 401
    assert (await client.get(url, headers=hdr(w))).status_code == 403
    viewer = await member(client, w, role="viewer")
    assert (await client.get(url, headers=viewer["headers"])).status_code == 403
    unrelated = await member(client, w)
    assert (await client.get(url, headers=unrelated["headers"])).status_code == 404
    assert (
        await client.get(url.replace(w["org"]["id"], str(uuid.uuid4())), headers=w["headers"])
    ).status_code == 404
    result = await client.post(
        interviews(w),
        headers=w["headers"],
        json=interview_input(
            w, participants=[{"user_id": str(uuid.uuid4()), "side": "interviewer"}]
        ),
    )
    assert result.status_code == 422, result.text
    assert (
        await client.get(interviews(w), headers=w["headers"], params={"limit": 101})
    ).status_code == 422


async def test_offer_approval_send_accept_and_no_hire_until_conversion(
    client, offer_workspace, db_session
):
    w = offer_workspace
    row = await sent(client, w)
    url = offers(w) + "/" + row["id"]
    own = "/api/v1/job-offers/" + row["id"]
    read = await client.get(own, headers=hdr(w))
    assert read.status_code == 200, read.text
    assert read.json()["base_salary"] == "1500000.00"
    for private in [
        "created_by",
        "submitted_at",
        "owner_id",
        "approval",
        "document_file_id",
        "fingerprint",
    ]:
        assert private not in read.text
    response = await client.post(
        own + "/respond",
        headers=hdr(w),
        json={"expected_version": row["version"], "action": "accept"},
    )
    assert response.status_code == 200, response.text
    assert (
        await client.post(
            own + "/respond",
            headers=hdr(w),
            json={"expected_version": row["version"], "action": "accept"},
        )
    ).json() == response.json()
    assert (await client.get(path(w), headers=w["headers"])).json()["stage"] == "offered"
    assert (await db_session.scalar(select(func.count()).select_from(Hire))) == 0
    assert (
        await client.post(
            url + "/withdraw",
            headers=w["headers"],
            json={"expected_version": response.json()["version"]},
        )
    ).status_code == 409


async def test_offer_draft_freeze_independent_approval_and_revision(client, offer_workspace):
    w = offer_workspace
    row = await draft(client, w)
    url = offers(w) + "/" + row["id"]
    assert (await client.get("/api/v1/job-offers/" + row["id"], headers=hdr(w))).status_code == 404
    assert (await client.get("/api/v1/job-offers", headers=hdr(w))).json()["total"] == 0
    assert (
        await client.post(url + "/send", headers=w["headers"], json={"expected_version": 1})
    ).status_code == 409
    invalid = await client.post(
        url + "/submit",
        headers=w["headers"],
        json={"expected_version": 1, "approver_ids": [w["user_id"]]},
    )
    assert invalid.status_code == 422, invalid.text
    submit = await client.post(
        url + "/submit",
        headers=w["headers"],
        json={"expected_version": 1, "approver_ids": [w["approver"]["id"]]},
    )
    assert submit.status_code == 200, submit.text
    assert (
        await client.patch(
            url,
            headers=w["headers"],
            json={**terms(base_salary="1600000.00"), "expected_version": 2},
        )
    ).status_code == 409
    assert (
        await client.put(
            url + "/approvals/me",
            headers=w["headers"],
            json={"expected_version": 2, "decision": "approved"},
        )
    ).status_code in {404, 403}
    reject = await client.put(
        url + "/approvals/me",
        headers=w["approver"]["headers"],
        json={"expected_version": 2, "decision": "rejected"},
    )
    assert reject.status_code == 200, reject.text
    assert (
        await client.post(url + "/send", headers=w["headers"], json={"expected_version": 3})
    ).status_code == 409
    payload = {
        **terms(base_salary="1700000.00"),
        "expected_version": 3,
        "request_id": str(uuid.uuid4()),
    }
    revision = await client.post(url + "/revisions", headers=w["headers"], json=payload)
    assert revision.status_code == 201, revision.text
    assert revision.json()["terms_version"] == 2 and revision.json()["submitted_at"] is None
    assert (
        await client.post(url + "/revisions", headers=w["headers"], json=payload)
    ).json() == revision.json()


@pytest.mark.parametrize(
    "field,value",
    [
        ("base_salary", 1.5),
        ("base_salary", True),
        ("base_salary", "0"),
        ("currency", "inr"),
        ("created_by", str(uuid.uuid4())),
        ("status", "sent"),
        ("terms_version", 9),
        ("equity_pct", "100.01"),
        ("expires_on", "2000-01-01"),
        ("document_file_id", str(uuid.uuid4())),
    ],
)
async def test_offer_invalid_and_mass_assignment(client, offer_workspace, field, value):
    w = offer_workspace
    response = await client.post(
        offers(w),
        headers=w["headers"],
        json={
            "application_id": w["app"]["id"],
            "request_id": str(uuid.uuid4()),
            **terms(),
            field: value,
        },
    )
    assert response.status_code in {422, 404}, response.text


async def test_offer_counter_revision_compare_decline_and_expiry(
    client, offer_workspace, db_session
):
    w = offer_workspace
    row = await sent(client, w)
    own = "/api/v1/job-offers/" + row["id"]
    counter = await client.post(
        own + "/counter",
        headers=hdr(w),
        json={"expected_version": row["version"], "note": "Discuss compensation"},
    )
    assert counter.status_code == 200, counter.text
    # Existing immutable terms remain unchanged; a revision hides the draft from applicants.
    revision = await client.post(
        offers(w) + "/" + row["id"] + "/revisions",
        headers=w["headers"],
        json={
            **terms(base_salary="1800000.00"),
            "expected_version": counter.json()["version"],
            "request_id": str(uuid.uuid4()),
        },
    )
    assert revision.status_code == 201, revision.text
    assert (
        await client.get("/api/v1/job-offers/" + revision.json()["id"], headers=hdr(w))
    ).status_code == 404
    assert (
        await client.post(
            own + "/respond",
            headers=hdr(w),
            json={"expected_version": counter.json()["version"] + 1, "action": "accept"},
        )
    ).status_code == 409
    # Duplicate comparison IDs are rejected and draft IDs cannot be compared.
    assert (
        await client.get(
            "/api/v1/job-offers/compare",
            headers=hdr(w),
            params=[("offer_ids", row["id"]), ("offer_ids", row["id"])],
        )
    ).status_code == 422
    assert (
        await client.get(
            "/api/v1/job-offers/compare",
            headers=hdr(w),
            params=[("offer_ids", row["id"]), ("offer_ids", revision.json()["id"])],
        )
    ).status_code == 404
    reason = OfferDeclineReason(code="other", label="Other")
    db_session.add(reason)
    await db_session.commit()
    assert (await client.get("/api/v1/job-offers/decline-reasons", headers=hdr(w))).json()[
        "total"
    ] == 1


async def test_hire_copied_template_activation_and_retry(client, offer_workspace, db_session):
    w = offer_workspace
    template = await client.post(
        root(w) + "/onboarding-templates",
        headers=w["headers"],
        json={
            "name": "Engineering",
            "items": [
                {
                    "section": "IT",
                    "title": "Provision laptop",
                    "owner_role": "owner",
                    "due_offset_days": -1,
                }
            ],
        },
    )
    assert template.status_code == 201, template.text
    template = template.json()
    row = await hired(client, w, template_id=template["id"])
    url = root(w) + "/hires/" + row["id"]
    assert row["status"] == "pending_onboarding" and row["total_items"] == 1
    assert (
        await client.post(
            root(w) + "/hires",
            headers=w["headers"],
            json={"offer_id": row["offer_id"], "template_id": template["id"]},
        )
    ).json() == row
    assert (await client.get(path(w), headers=w["headers"])).json()["stage"] == "hired"
    replace = await client.put(
        root(w) + "/onboarding-templates/" + template["id"],
        headers=w["headers"],
        json={"name": "Changed", "items": []},
    )
    assert replace.status_code == 200, replace.text
    tasks = (await client.get(url + "/checklist", headers=w["headers"])).json()
    assert tasks["total"] == 1 and tasks["items"][0]["title"] == "Provision laptop"
    task = tasks["items"][0]
    done = await client.patch(
        url + "/checklist/" + task["id"],
        headers=w["headers"],
        json={"expected_version": 1, "status": "done"},
    )
    assert done.status_code == 200, done.text
    onboard = await client.post(
        url + "/transitions",
        headers=w["headers"],
        json={"expected_version": 1, "action": "onboard"},
    )
    assert onboard.status_code == 200, onboard.text
    assert (
        await client.post(
            url + "/transitions",
            headers=w["headers"],
            json={"expected_version": 2, "action": "activate"},
        )
    ).status_code == 409
    change = await client.patch(
        url,
        headers=w["headers"],
        json={"expected_version": 2, "start_date": datetime.now(UTC).date().isoformat()},
    )
    assert change.status_code == 200, change.text
    activate = await client.post(
        url + "/transitions",
        headers=w["headers"],
        json={"expected_version": 3, "action": "activate"},
    )
    assert activate.status_code == 200, activate.text
    assert activate.json()["status"] == "active"
    assert (await db_session.scalar(select(func.count()).select_from(Hire))) == 1


@pytest.mark.parametrize("closing", ["withdraw", "reject"])
async def test_application_closure_cancels_pending_workflows(
    client, offer_workspace, db_session, closing
):
    w = offer_workspace
    interview = await scheduled(client, w)
    offer = await sent(client, w)
    if closing == "withdraw":
        result = await client.post(
            "/api/v1/applications/" + w["app"]["id"] + "/withdraw", headers=hdr(w)
        )
    else:
        result = await move(
            client,
            w,
            "rejected",
            "offered",
            rejected_reason="other",
            rejection_detail="Internal reason",
        )
    assert result.status_code == 200, result.text
    assert (await client.get(interviews(w) + "/" + interview["id"], headers=w["headers"])).json()[
        "status"
    ] == "cancelled"
    assert (await client.get(offers(w) + "/" + offer["id"], headers=w["headers"])).json()[
        "status"
    ] == "withdrawn"
    assert (
        await client.post(
            "/api/v1/job-offers/" + offer["id"] + "/respond",
            headers=hdr(w),
            json={"expected_version": offer["version"], "action": "accept"},
        )
    ).status_code == 409


async def test_hire_docs_scope_and_invalid_file(client, offer_workspace):
    w = offer_workspace
    row = await hired(client, w)
    url = root(w) + "/hires/" + row["id"] + "/documents"
    payload = {
        "request_id": str(uuid.uuid4()),
        "name": "ID",
        "purpose": "Employment eligibility",
        "retention": "Delete per signed retention policy",
    }
    result = await client.post(url, headers=w["headers"], json=payload)
    assert result.status_code == 201, result.text
    document = result.json()
    assert "file_id" not in document
    assert (await client.post(url, headers=w["headers"], json=payload)).json() == document
    assert (
        await client.patch(
            url + "/" + document["id"],
            headers=w["headers"],
            json={"expected_version": 1, "action": "attach", "file_id": str(uuid.uuid4())},
        )
    ).status_code == 404
    assert (
        await client.patch(
            url + "/" + document["id"],
            headers=w["headers"],
            json={"expected_version": 1, "action": "verify"},
        )
    ).status_code == 409
    viewer = await member(client, w, role="viewer")
    assert (await client.get(url, headers=viewer["headers"])).status_code == 403
    assert (await client.get(url, headers=hdr(w))).status_code == 403


async def test_invited_panel_gets_only_interview_grant(client, pipeline, db_session):
    w = pipeline
    panel = await member(client, w, email="panel@example.com")
    row = await scheduled(client, w, participants=[{"user_id": panel["id"], "side": "interviewer"}])
    url = interviews(w) + "/" + row["id"]
    assert (await client.get(url, headers=panel["headers"])).status_code == 200
    assert (await client.get(interviews(w), headers=panel["headers"])).json()["total"] == 1
    assert (await client.get(path(w), headers=panel["headers"])).status_code == 404
    reply = await client.put(
        url + "/attendance/me",
        headers=panel["headers"],
        json={"expected_version": 1, "response": "accepted"},
    )
    assert reply.status_code == 200, reply.text
    assert (
        await client.post(
            url + "/transitions",
            headers=panel["headers"],
            json={"expected_version": 2, "action": "cancel"},
        )
    ).status_code == 404
    record = await db_session.get(Interview, uuid.UUID(row["id"]))
    record.scheduled_at = datetime.now(UTC) - timedelta(hours=2)
    await db_session.commit()
    complete = await client.post(
        url + "/transitions",
        headers=w["headers"],
        json={"expected_version": 2, "action": "complete"},
    )
    assert complete.status_code == 200, complete.text
    put = await client.put(
        url + "/feedback/me",
        headers=panel["headers"],
        json={"recommendation": "strong_yes", "summary": "Panel private recommendation"},
    )
    assert put.status_code == 200, put.text
    assert (await client.get(url + "/feedback", headers=w["headers"])).json()["total"] == 0


@pytest.mark.parametrize("action", ["accept", "decline"])
async def test_candidate_responses_work_after_job_closed(client, offer_workspace, action):
    w = offer_workspace
    row = await sent(client, w)
    from app.tests.test_jobs import action as job_action

    await job_action(client, w, w["job"], "close")
    response = await client.post(
        "/api/v1/job-offers/" + row["id"] + "/respond",
        headers=hdr(w),
        json={"expected_version": row["version"], "action": action},
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == ("accepted" if action == "accept" else "declined")
    if action == "accept":
        hire = await client.post(
            root(w) + "/hires", headers=w["headers"], json={"offer_id": row["id"]}
        )
        assert hire.status_code == 201, hire.text
        onboard = await client.post(
            root(w) + "/hires/" + hire.json()["id"] + "/transitions",
            headers=w["headers"],
            json={"expected_version": 1, "action": "onboard"},
        )
        assert onboard.status_code == 200, onboard.text


async def test_optional_decline_reason_requires_explicit_sharing(
    client, offer_workspace, db_session
):
    w = offer_workspace
    reason = OfferDeclineReason(code="compensation", label="Compensation")
    db_session.add(reason)
    await db_session.commit()
    row = await sent(client, w)
    url = "/api/v1/job-offers/" + row["id"] + "/respond"
    payload = {
        "expected_version": row["version"],
        "action": "decline",
        "decline_reason_id": str(reason.id),
        "decline_detail": "Reason voluntarily shared",
    }
    assert (await client.post(url, headers=hdr(w), json=payload)).status_code == 422
    result = await client.post(url, headers=hdr(w), json={**payload, "share_decline_reason": True})
    assert result.status_code == 200, result.text
    assert result.json()["decline_reason_id"] == str(reason.id)
    assert "voluntarily" not in str(
        [(r.summary, r.data) for r in (await db_session.execute(select(ActivityEvent))).scalars()]
    )


async def test_expired_offers_are_read_safe_and_cannot_accept(client, offer_workspace, db_session):
    w = offer_workspace
    row = await sent(client, w)
    record = await db_session.get(JobOffer, uuid.UUID(row["id"]))
    record.expires_on = datetime.now(UTC).date() - timedelta(days=1)
    await db_session.commit()
    own = "/api/v1/job-offers/" + row["id"]
    assert (await client.get(own, headers=hdr(w))).json()["status"] == "expired"
    assert (
        await client.get("/api/v1/job-offers", headers=hdr(w), params={"status": "expired"})
    ).json()["total"] == 1
    assert (
        await client.post(
            own + "/respond",
            headers=hdr(w),
            json={"expected_version": row["version"], "action": "accept"},
        )
    ).status_code == 409
    expire = await client.post(
        offers(w) + "/" + row["id"] + "/expire",
        headers=w["headers"],
        json={"expected_version": row["version"]},
    )
    assert expire.status_code == 200, expire.text
    assert (
        await client.post(
            offers(w) + "/" + row["id"] + "/expire",
            headers=w["headers"],
            json={"expected_version": row["version"]},
        )
    ).json() == expire.json()


async def test_withdraw_after_accept_keeps_history_but_blocks_hire(client, offer_workspace):
    w = offer_workspace
    row = await accepted(client, w)
    assert (
        await client.post("/api/v1/applications/" + w["app"]["id"] + "/withdraw", headers=hdr(w))
    ).status_code == 200
    assert (await client.get("/api/v1/job-offers/" + row["id"], headers=hdr(w))).json()[
        "status"
    ] == "accepted"
    response = await client.post(
        root(w) + "/hires", headers=w["headers"], json={"offer_id": row["id"]}
    )
    assert response.status_code == 409, response.text


@pytest.mark.parametrize("surface", ["offer", "hire", "template"])
async def test_surface_auth_org_role_and_object_scopes(client, offer_workspace, surface):
    w = offer_workspace
    if surface == "offer":
        record = await sent(client, w)
        url = offers(w) + "/" + record["id"]
    elif surface == "hire":
        record = await hired(client, w)
        url = root(w) + "/hires/" + record["id"]
    else:
        response = await client.post(
            root(w) + "/onboarding-templates",
            headers=w["headers"],
            json={"name": "Empty template", "items": []},
        )
        assert response.status_code == 201, response.text
        url = root(w) + "/onboarding-templates/" + response.json()["id"]
    assert (await client.get(url)).status_code == 401
    assert (await client.get(url, headers=hdr(w))).status_code == 403
    viewer = await member(client, w, role="viewer")
    assert (await client.get(url, headers=viewer["headers"])).status_code == 403
    assert (
        await client.get(url.replace(w["org"]["id"], str(uuid.uuid4())), headers=w["headers"])
    ).status_code == 404
    unrelated = await member(client, w, email="unrelated-surface@example.com")
    assert (await client.get(url, headers=unrelated["headers"])).status_code == (
        200 if surface == "template" else 404
    )


async def test_candidate_idor_and_compare_success(client, offer_workspace):
    from app.tests.test_funding_rounds import _signup_verified

    w = offer_workspace
    row = await sent(client, w)
    other = await _signup_verified(client, "different-candidate@example.com", "jobseeker")
    assert (
        await client.get("/api/v1/job-offers/" + row["id"], headers=other["headers"])
    ).status_code == 404
    assert (await client.get("/api/v1/job-offers", headers=other["headers"])).json()["total"] == 0
    revision = await client.post(
        offers(w) + "/" + row["id"] + "/revisions",
        headers=w["headers"],
        json={
            **terms(base_salary="1800000.00"),
            "request_id": str(uuid.uuid4()),
            "expected_version": row["version"],
        },
    )
    assert revision.status_code == 201, revision.text
    new = revision.json()
    url = offers(w) + "/" + new["id"]
    submit = await client.post(
        url + "/submit",
        headers=w["headers"],
        json={"expected_version": 1, "approver_ids": [w["approver"]["id"]]},
    )
    assert submit.status_code == 200, submit.text
    approved = await client.put(
        url + "/approvals/me",
        headers=w["approver"]["headers"],
        json={"expected_version": 2, "decision": "approved"},
    )
    assert approved.status_code == 200, approved.text
    assert (
        await client.post(url + "/send", headers=w["headers"], json={"expected_version": 3})
    ).status_code == 200
    compare = await client.get(
        "/api/v1/job-offers/compare",
        headers=hdr(w),
        params=[("offer_ids", new["id"]), ("offer_ids", row["id"])],
    )
    assert compare.status_code == 200, compare.text
    assert [item["id"] for item in compare.json()["items"]] == [new["id"], row["id"]]
    assert "Internal salary" not in compare.text


async def test_task_assignee_limited_updates_and_private_document_denial(client, offer_workspace):
    w = offer_workspace
    actor = await member(client, w, email="task-assignee@example.com")
    row = await hired(client, w)
    url = root(w) + "/hires/" + row["id"]
    from app.models.hiring_workflow import HireOnboardingItem
    from app.tests.conftest import TestSessionFactory

    async with TestSessionFactory() as db:
        task = HireOnboardingItem(
            hire_id=uuid.UUID(row["id"]),
            section="IT",
            title="Device",
            owner_id=uuid.UUID(actor["id"]),
            due_on=datetime.now(UTC).date(),
        )
        db.add(task)
        await db.commit()
        task_id = str(task.id)
    own = await client.get(url + "/checklist", headers=actor["headers"])
    assert own.status_code == 200, own.text
    assert own.json()["total"] == 1
    assert (await client.get(url, headers=actor["headers"])).status_code == 404
    assert (await client.get(url + "/documents", headers=actor["headers"])).status_code == 404
    for changes in [
        {"owner_id": None},
        {"due_on": datetime.now(UTC).date().isoformat()},
        {"status": "waived"},
    ]:
        assert (
            await client.patch(
                url + "/checklist/" + task_id,
                headers=actor["headers"],
                json={"expected_version": 1, **changes},
            )
        ).status_code == 403
    result = await client.patch(
        url + "/checklist/" + task_id,
        headers=actor["headers"],
        json={"expected_version": 1, "status": "done", "note": "Device provisioned"},
    )
    assert result.status_code == 200, result.text
    assert (
        await client.patch(
            url + "/checklist/" + task_id,
            headers=actor["headers"],
            json={"expected_version": 1, "status": "blocked"},
        )
    ).status_code == 409


@pytest.mark.parametrize(
    "surface,changes",
    [
        ("hire", {"status": "active"}),
        ("hire", {"org_id": str(uuid.uuid4())}),
        ("hire", {"user_id": str(uuid.uuid4())}),
        ("template", {"is_platform": True}),
        ("template", {"org_id": str(uuid.uuid4())}),
        ("document", {"file_id": str(uuid.uuid4())}),
        ("document", {"status": "verified"}),
        ("document", {"reviewed_by": str(uuid.uuid4())}),
    ],
)
async def test_hire_template_document_mass_assignment(client, offer_workspace, surface, changes):
    w = offer_workspace
    if surface == "hire":
        url = root(w) + "/hires"
        payload = {"offer_id": str(uuid.uuid4())}
    elif surface == "template":
        url = root(w) + "/onboarding-templates"
        payload = {"name": "Template", "items": []}
    else:
        url = root(w) + "/hires/" + str(uuid.uuid4()) + "/documents"
        payload = {
            "request_id": str(uuid.uuid4()),
            "name": "ID",
            "purpose": "Employment",
            "retention": "Delete after retention period",
        }
    response = await client.post(url, headers=w["headers"], json={**payload, **changes})
    assert response.status_code == 422, response.text


async def test_rate_limits_and_body_cap(client, pipeline, monkeypatch):
    from app.core.config import get_settings

    w = pipeline
    monkeypatch.setattr(get_settings(), "APPLICANT_READ_LIMIT", 1)
    assert (await client.get(interviews(w), headers=w["headers"])).status_code == 200
    assert (await client.get(interviews(w), headers=w["headers"])).status_code == 429
    response = await client.post(
        interviews(w),
        headers={**w["headers"], "Content-Type": "application/json"},
        content="x" * 65537,
    )
    assert response.status_code == 413, response.text


@pytest.mark.parametrize("workflow", ["interview", "offer", "hire"])
async def test_startup_hiring_reuses_compatible_global_role(
    client, offer_workspace, db_session, workflow
):
    from app.models.organization import Organization
    from app.models.user import UserRoleRow

    w = offer_workspace
    org = await db_session.get(Organization, uuid.UUID(w["org"]["id"]))
    org.type = "startup"
    role = (
        await db_session.execute(
            select(UserRoleRow).where(
                UserRoleRow.user_id == uuid.UUID(w["user_id"]), UserRoleRow.role == "employer"
            )
        )
    ).scalar_one()
    role.role = "startup"
    await db_session.commit()
    if workflow == "interview":
        assert (await scheduled(client, w))["status"] == "scheduled"
    elif workflow == "offer":
        assert (await sent(client, w))["status"] == "sent"
    else:
        assert (await hired(client, w))["status"] == "pending_onboarding"


async def test_private_documents_full_roundtrip_no_generic_org_visibility(
    client, offer_workspace, db_session, file_env
):
    from app.models.file import File
    from app.tests.test_files import uploaded

    w = offer_workspace
    storage, _ = file_env
    # Existing file fixture predates the inline flag; adapt only its signer, not domain behavior.
    original = storage.sign_download

    async def sign(key, name, mime, ttl, *, image=False, inline=False):
        return await original(key, name, mime, ttl, image=image)

    storage.sign_download = sign
    file_id = await uploaded(client, w["actor"], storage, kind="legal")
    hire = await hired(client, w)
    url = root(w) + "/hires/" + hire["id"] + "/documents"
    payload = {
        "request_id": str(uuid.uuid4()),
        "name": "Employment agreement",
        "purpose": "Employment contract",
        "retention": "Delete according to signed policy",
    }
    created = await client.post(url, headers=w["headers"], json=payload)
    assert created.status_code == 201, created.text
    doc_url = url + "/" + created.json()["id"]
    attach = await client.patch(
        doc_url,
        headers=w["headers"],
        json={"expected_version": 1, "action": "attach", "file_id": file_id},
    )
    assert attach.status_code == 200, attach.text
    assert attach.json()["status"] == "received"
    assert (await client.post(doc_url + "/download", headers=w["headers"])).status_code == 200
    assert (
        await client.post(doc_url + "/download", headers=w["approver"]["headers"])
    ).status_code == 200
    assert (
        await client.get("/api/v1/files/" + file_id, headers=w["approver"]["headers"])
    ).status_code == 404
    viewer = await member(client, w, role="viewer")
    assert (await client.post(doc_url + "/download", headers=viewer["headers"])).status_code == 403
    assert (
        await client.get("/api/v1/files/" + file_id, headers=viewer["headers"])
    ).status_code == 404
    verify = await client.patch(
        doc_url, headers=w["approver"]["headers"], json={"expected_version": 2, "action": "verify"}
    )
    assert verify.status_code == 200, verify.text
    assert verify.json()["status"] == "verified"
    assert (
        await client.patch(
            doc_url,
            headers=w["approver"]["headers"],
            json={"expected_version": 2, "action": "verify"},
        )
    ).json() == verify.json()
    file = await db_session.get(File, uuid.UUID(file_id))
    file.scan_status = "infected"
    file.upload_status = "rejected"
    await db_session.commit()
    assert (await client.post(doc_url + "/download", headers=w["headers"])).status_code == 409


async def test_offer_document_is_visible_only_after_send(client, offer_workspace, file_env):
    from app.tests.test_files import uploaded

    w = offer_workspace
    storage, _ = file_env
    original = storage.sign_download

    async def sign(key, name, mime, ttl, *, image=False, inline=False):
        return await original(key, name, mime, ttl, image=image)

    storage.sign_download = sign
    file_id = await uploaded(client, w["actor"], storage, kind="document")
    row = await sent(client, w, document_file_id=file_id)
    download = await client.post(
        "/api/v1/job-offers/" + row["id"] + "/document-download", headers=hdr(w)
    )
    assert download.status_code == 200, download.text
    assert (await client.get("/api/v1/files/" + file_id, headers=hdr(w))).status_code == 404


async def test_hire_invalid_cross_organization_references(client, offer_workspace):
    from app.tests.test_funding_rounds import _create_org, _signup_verified

    w = offer_workspace
    row = await accepted(client, w)
    outsider = await _signup_verified(client, "foreign-hire@example.com", "employer")
    org = await _create_org(client, outsider, type_="employer")
    foreign_root = f"/api/v1/organizations/{org['id']}"
    template = await client.post(
        foreign_root + "/onboarding-templates",
        headers=outsider["headers"],
        json={"name": "Foreign", "items": []},
    )
    assert template.status_code == 201, template.text
    assert (
        await client.post(
            root(w) + "/hires",
            headers=w["headers"],
            json={"offer_id": row["id"], "template_id": template.json()["id"]},
        )
    ).status_code == 404
    outsider_id = (await client.get("/api/v1/users/me", headers=outsider["headers"])).json()["id"]
    assert (
        await client.post(
            root(w) + "/hires",
            headers=w["headers"],
            json={"offer_id": row["id"], "owner_id": outsider_id},
        )
    ).status_code == 422
    assert (
        await client.post(
            foreign_root + "/hires", headers=outsider["headers"], json={"offer_id": row["id"]}
        )
    ).status_code == 404


async def test_revoke_approver_before_send_blocks_send(client, offer_workspace, db_session):
    from app.models.organization import OrganizationMember

    w = offer_workspace
    row = await draft(client, w)
    url = offers(w) + "/" + row["id"]
    assert (
        await client.post(
            url + "/submit",
            headers=w["headers"],
            json={"expected_version": 1, "approver_ids": [w["approver"]["id"]]},
        )
    ).status_code == 200
    assert (
        await client.put(
            url + "/approvals/me",
            headers=w["approver"]["headers"],
            json={"expected_version": 2, "decision": "approved"},
        )
    ).status_code == 200
    membership = (
        await db_session.execute(
            select(OrganizationMember).where(
                OrganizationMember.org_id == uuid.UUID(w["org"]["id"]),
                OrganizationMember.user_id == uuid.UUID(w["approver"]["id"]),
            )
        )
    ).scalar_one()
    membership.status = "suspended"
    await db_session.commit()
    response = await client.post(url + "/send", headers=w["headers"], json={"expected_version": 3})
    assert response.status_code == 422, response.text


# Imported fixture uses fake storage/scanner while exercising the actual Step 4 pipeline.

__all__ += ["file_env"]


@pytest.mark.skipif(not TEST_DATABASE_URL.startswith("postgresql"), reason="PostgreSQL row locks")
async def test_postgres_concurrent_schedule_overlap(client, pipeline, db_session):
    import asyncio

    w = pipeline
    payload = interview_input(w)
    responses = await asyncio.gather(
        client.post(interviews(w), headers=w["headers"], json=payload),
        client.post(interviews(w), headers=w["headers"], json=payload),
    )
    assert [r.status_code for r in responses] == [201, 201], [r.text for r in responses]
    assert responses[0].json()["id"] == responses[1].json()["id"]
    assert await db_session.scalar(select(func.count()).select_from(Interview)) == 1
    overlapping = {**payload, "request_id": str(uuid.uuid4())}
    result = await client.post(interviews(w), headers=w["headers"], json=overlapping)
    assert result.status_code == 409, result.text


@pytest.mark.skipif(not TEST_DATABASE_URL.startswith("postgresql"), reason="PostgreSQL row locks")
async def test_postgres_accept_vs_withdraw_serializes(client, offer_workspace, db_session):
    import asyncio

    w = offer_workspace
    row = await sent(client, w)
    accept, withdraw = await asyncio.gather(
        client.post(
            "/api/v1/job-offers/" + row["id"] + "/respond",
            headers=hdr(w),
            json={"expected_version": row["version"], "action": "accept"},
        ),
        client.post(
            offers(w) + "/" + row["id"] + "/withdraw",
            headers=w["headers"],
            json={"expected_version": row["version"]},
        ),
    )
    assert sorted([accept.status_code, withdraw.status_code]) == [200, 409], [
        accept.text,
        withdraw.text,
    ]
    await db_session.rollback()
    record = await db_session.get(JobOffer, uuid.UUID(row["id"]))
    assert record.status in {"accepted", "withdrawn"}


@pytest.mark.skipif(not TEST_DATABASE_URL.startswith("postgresql"), reason="PostgreSQL row locks")
async def test_postgres_concurrent_hire_is_one_conversion(client, offer_workspace, db_session):
    import asyncio

    from app.models.job_application import ApplicationStageEvent

    w = offer_workspace
    row = await accepted(client, w)
    responses = await asyncio.gather(
        *[
            client.post(root(w) + "/hires", headers=w["headers"], json={"offer_id": row["id"]})
            for _ in range(2)
        ]
    )
    assert [r.status_code for r in responses] == [201, 201], [r.text for r in responses]
    assert responses[0].json() == responses[1].json()
    assert await db_session.scalar(select(func.count()).select_from(Hire)) == 1
    assert (
        await db_session.scalar(
            select(func.count())
            .select_from(ApplicationStageEvent)
            .where(ApplicationStageEvent.to_stage == "hired")
        )
        == 1
    )


@pytest.mark.skipif(not TEST_DATABASE_URL.startswith("postgresql"), reason="PostgreSQL row locks")
async def test_postgres_overlap_across_jobs_uses_participant_locks(client, pipeline):
    import asyncio

    from app.tests.test_job_applications import apply
    from app.tests.test_jobs import action, new_job

    w = pipeline
    second = await new_job(client, w, title="Second vacancy")
    await action(client, w, second, "publish")
    other = {**w, "job": second}
    other["app"] = await apply(client, other)
    payload = interview_input(w)
    second_payload = interview_input(other, scheduled_at=payload["scheduled_at"])
    responses = await asyncio.gather(
        client.post(interviews(w), headers=w["headers"], json=payload),
        client.post(interviews(w), headers=w["headers"], json=second_payload),
    )
    assert sorted(r.status_code for r in responses) == [201, 409], [r.text for r in responses]


@pytest.mark.skipif(not TEST_DATABASE_URL.startswith("postgresql"), reason="PostgreSQL row locks")
async def test_postgres_competing_reschedules_do_not_lose_updates(client, pipeline):
    import asyncio

    w = pipeline
    row = await scheduled(client, w)
    url = interviews(w) + "/" + row["id"]
    first = {
        k: v
        for k, v in interview_input(w).items()
        if k not in {"participants", "application_id", "request_id"}
    }
    first.update(expected_version=1, round_name="Round A")
    second = {**first, "round_name": "Round B"}
    responses = await asyncio.gather(
        client.patch(url, headers=w["headers"], json=first),
        client.patch(url, headers=w["headers"], json=second),
    )
    assert sorted(r.status_code for r in responses) == [200, 409], [r.text for r in responses]
    assert (await client.get(url, headers=w["headers"])).json()["version"] == 2


async def test_interview_cancel_and_participant_replacement_retry(client, pipeline):
    w = pipeline
    row = await scheduled(client, w)
    url = interviews(w) + "/" + row["id"]
    panel = await member(client, w, email="new-panel@example.com")
    payload = {
        "expected_version": 1,
        "participants": [{"user_id": panel["id"], "side": "interviewer"}],
    }
    response = await client.put(url + "/participants", headers=w["headers"], json=payload)
    assert response.status_code == 200, response.text
    assert response.json()["version"] == 2
    assert (
        await client.put(url + "/participants", headers=w["headers"], json=payload)
    ).json() == response.json()
    result = await client.post(
        url + "/transitions",
        headers=w["headers"],
        json={"expected_version": 2, "action": "cancel", "reason": "Scheduling conflict"},
    )
    assert result.status_code == 200, result.text
    own = await client.get("/api/v1/interviews/" + row["id"], headers=hdr(w))
    assert (
        own.json()["status"] == "cancelled"
        and own.json()["cancelled_reason"] == "Scheduling conflict"
    )


async def test_offer_create_retries_and_live_uniqueness(client, offer_workspace, db_session):
    w = offer_workspace
    payload = {**terms(), "application_id": w["app"]["id"], "request_id": str(uuid.uuid4())}
    response = await client.post(offers(w), headers=w["headers"], json=payload)
    assert response.status_code == 201, response.text
    assert (
        await client.post(offers(w), headers=w["headers"], json=payload)
    ).json() == response.json()
    assert (
        await client.post(offers(w), headers=w["headers"], json={**payload, "title": "Different"})
    ).status_code == 409
    assert (
        await client.post(
            offers(w), headers=w["headers"], json={**payload, "request_id": str(uuid.uuid4())}
        )
    ).status_code == 409
    assert await db_session.scalar(select(func.count()).select_from(JobOffer)) == 1


async def test_hire_pending_tasks_prevent_activation_and_terminal_is_frozen(
    client, offer_workspace
):
    w = offer_workspace
    template = await client.post(
        root(w) + "/onboarding-templates",
        headers=w["headers"],
        json={"name": "Required checklist", "items": [{"section": "IT", "title": "Device"}]},
    )
    assert template.status_code == 201, template.text
    hire = await hired(client, w, template_id=template.json()["id"])
    url = root(w) + "/hires/" + hire["id"]
    start = await client.patch(
        url,
        headers=w["headers"],
        json={"expected_version": 1, "start_date": datetime.now(UTC).date().isoformat()},
    )
    assert start.status_code == 200, start.text
    assert (
        await client.post(
            url + "/transitions",
            headers=w["headers"],
            json={"expected_version": 2, "action": "onboard"},
        )
    ).status_code == 200
    assert (
        await client.post(
            url + "/transitions",
            headers=w["headers"],
            json={"expected_version": 3, "action": "activate"},
        )
    ).status_code == 409
    result = await client.post(
        url + "/transitions", headers=w["headers"], json={"expected_version": 3, "action": "cancel"}
    )
    assert result.status_code == 200, result.text
    assert (
        await client.patch(
            url, headers=w["headers"], json={"expected_version": 4, "owner_id": None}
        )
    ).status_code == 409


@pytest.mark.skipif(not TEST_DATABASE_URL.startswith("postgresql"), reason="PostgreSQL row locks")
async def test_postgres_removed_panel_grant_rechecked_after_lock_wait(
    client, pipeline, monkeypatch
):
    import asyncio

    from sqlalchemy import delete

    from app.models.hiring_workflow import InterviewParticipant
    from app.models.job import Job
    from app.services import job_service
    from app.tests.conftest import TestSessionFactory

    w = pipeline
    actor = await member(client, w, email="revoked-panel@example.com")
    row = await scheduled(client, w, participants=[{"user_id": actor["id"], "side": "interviewer"}])
    entering = asyncio.Event()
    original = job_service._job

    async def observed(*args, **kwargs):
        entering.set()
        return await original(*args, **kwargs)

    monkeypatch.setattr(job_service, "_job", observed)
    async with TestSessionFactory() as held:
        await held.execute(select(Job).where(Job.id == uuid.UUID(w["job"]["id"])).with_for_update())
        pending = asyncio.create_task(
            client.put(
                interviews(w) + "/" + row["id"] + "/attendance/me",
                headers=actor["headers"],
                json={"expected_version": 1, "response": "accepted"},
            )
        )
        try:
            await asyncio.wait_for(entering.wait(), 10)
            await held.execute(
                delete(InterviewParticipant).where(
                    InterviewParticipant.interview_id == uuid.UUID(row["id"]),
                    InterviewParticipant.user_id == uuid.UUID(actor["id"]),
                )
            )
            await held.commit()
            result = await asyncio.wait_for(pending, 10)
            assert result.status_code == 404, result.text
        finally:
            if not pending.done():
                pending.cancel()
                await asyncio.gather(pending, return_exceptions=True)


@pytest.mark.skipif(not TEST_DATABASE_URL.startswith("postgresql"), reason="PostgreSQL row locks")
async def test_postgres_removed_private_hire_grant_rechecked_after_lock_wait(
    client, offer_workspace, monkeypatch
):
    import asyncio

    from sqlalchemy import update

    from app.models.job import Job
    from app.services import job_service
    from app.tests.conftest import TestSessionFactory

    w = offer_workspace
    actor = await member(client, w, email="revoked-hire-owner@example.com")
    row = await hired(client, w, owner_id=actor["id"])
    entering = asyncio.Event()
    original = job_service._job

    async def observed(*args, **kwargs):
        entering.set()
        return await original(*args, **kwargs)

    monkeypatch.setattr(job_service, "_job", observed)
    async with TestSessionFactory() as held:
        await held.execute(select(Job).where(Job.id == uuid.UUID(w["job"]["id"])).with_for_update())
        pending = asyncio.create_task(
            client.post(
                root(w) + "/hires/" + row["id"] + "/documents",
                headers=actor["headers"],
                json={
                    "request_id": str(uuid.uuid4()),
                    "name": "ID",
                    "purpose": "Employment",
                    "retention": "Approved policy",
                },
            )
        )
        try:
            await asyncio.wait_for(entering.wait(), 10)
            await held.execute(
                update(Hire)
                .where(Hire.id == uuid.UUID(row["id"]))
                .values(owner_id=uuid.UUID(w["user_id"]))
            )
            await held.commit()
            result = await asyncio.wait_for(pending, 10)
            assert result.status_code == 404, result.text
        finally:
            if not pending.done():
                pending.cancel()
                await asyncio.gather(pending, return_exceptions=True)


async def test_interview_calendar_overflow_is_validation_not_server_error(client, pipeline):
    w = pipeline
    result = await client.post(
        interviews(w),
        headers=w["headers"],
        json=interview_input(w, scheduled_at="9999-12-31T23:59:00Z", duration_min=480),
    )
    assert result.status_code == 422, result.text


async def test_hire_due_date_overflow_rolls_back_conversion(client, offer_workspace, db_session):
    w = offer_workspace
    row = await sent(client, w, start_date="9999-12-31", expires_on="9999-12-01")
    assert (
        await client.post(
            "/api/v1/job-offers/" + row["id"] + "/respond",
            headers=hdr(w),
            json={"expected_version": row["version"], "action": "accept"},
        )
    ).status_code == 200
    template = await client.post(
        root(w) + "/onboarding-templates",
        headers=w["headers"],
        json={
            "name": "Calendar boundary",
            "items": [{"section": "IT", "title": "Device", "due_offset_days": 365}],
        },
    )
    assert template.status_code == 201, template.text
    response = await client.post(
        root(w) + "/hires",
        headers=w["headers"],
        json={"offer_id": row["id"], "template_id": template.json()["id"]},
    )
    assert response.status_code == 422, response.text
    assert await db_session.scalar(select(func.count()).select_from(Hire)) == 0
    assert (await client.get(path(w), headers=w["headers"])).json()["stage"] == "offered"


async def test_blind_withdrawal_cancellation_does_not_reveal_actor_in_org_activity(
    client, offer_workspace, db_session
):
    from app.models.job_application import JobApplication

    w = offer_workspace
    app = await db_session.get(JobApplication, uuid.UUID(w["app"]["id"]))
    app.is_blind = True
    await db_session.commit()
    row = await draft(client, w)
    result = await client.post(
        "/api/v1/applications/" + w["app"]["id"] + "/withdraw", headers=hdr(w)
    )
    assert result.status_code == 200, result.text
    events = list(
        (
            await db_session.execute(
                select(ActivityEvent).where(
                    ActivityEvent.entity_id == uuid.UUID(row["id"]),
                    ActivityEvent.event_type == "job_offer_changed",
                )
            )
        ).scalars()
    )
    closed = [event for event in events if event.data.get("action") == "application_closed"]
    assert len(closed) == 1 and closed[0].user_id is None


async def test_frontend_interview_filters_and_capabilities(client, pipeline, db_session):
    w = pipeline
    row = await scheduled(client, w, round_name="Frontend filter round")
    page = await client.get(
        interviews(w),
        headers=w["headers"],
        params={"view": "upcoming", "q": "Frontend filter", "limit": 1},
    )
    assert page.status_code == 200, page.text
    assert page.json()["total"] == 1
    item = page.json()["items"][0]
    assert item["can_manage"] is True
    assert item["company_name"]
    needs_action = await client.get(
        "/api/v1/interviews", headers=w["candidate"]["headers"], params={"view": "needs_action"}
    )
    assert needs_action.status_code == 200, needs_action.text
    assert needs_action.json()["total"] == 1
    assert needs_action.json()["items"][0]["can_manage"] is False
    assert len(needs_action.json()["items"][0]["participants"]) == 1
    excluded = await client.get(
        interviews(w),
        headers=w["headers"],
        params={"scheduled_from": (datetime.now(UTC) + timedelta(days=30)).isoformat()},
    )
    assert excluded.json()["total"] == 0
    malformed = await client.get(
        interviews(w), headers=w["headers"], params={"scheduled_from": "2026-11-01T10:00:00"}
    )
    assert malformed.status_code == 422
    hit = await db_session.get(Interview, uuid.UUID(row["id"]))
    hit.status = "completed"
    await db_session.commit()
    feedback = await client.get(
        interviews(w), headers=w["headers"], params={"view": "needs_feedback"}
    )
    assert feedback.json()["total"] == 1
    result = await client.put(
        interviews(w) + "/" + row["id"] + "/feedback/me",
        headers=w["headers"],
        json={"recommendation": "yes", "summary": "Evidence-based feedback"},
    )
    assert result.status_code == 200
    feedback = await client.get(
        interviews(w), headers=w["headers"], params={"view": "needs_feedback"}
    )
    assert feedback.json()["total"] == 0


async def test_frontend_offer_terms_submission_filter_and_hire_capabilities(
    client, offer_workspace
):
    w = offer_workspace
    row = await draft(
        client,
        w,
        payment_terms="Monthly payroll",
        notice_terms="Thirty days",
        vesting_terms="Four years",
    )
    detail = await client.get(offers(w) + "/" + row["id"], headers=w["headers"])
    assert detail.json()["payment_terms"] == "Monthly payroll"
    assert detail.json()["applicant_label"]
    assert detail.json()["pipeline_writable"] is True
    for submitted, expected in [("false", 1), ("true", 0)]:
        page = await client.get(
            offers(w), headers=w["headers"], params={"status": "draft", "submitted": submitted}
        )
        assert page.status_code == 200, page.text
        assert page.json()["total"] == expected
    result = await client.post(
        offers(w) + "/" + row["id"] + "/submit",
        headers=w["headers"],
        json={"expected_version": 1, "approver_ids": [w["approver"]["id"]]},
    )
    assert result.status_code == 200
    page = await client.get(offers(w), headers=w["headers"], params={"submitted": "true"})
    assert page.json()["total"] == 1
    assert page.json()["items"][0]["notice_terms"] == "Thirty days"
    invalid = await client.patch(
        offers(w) + "/" + row["id"],
        headers=w["headers"],
        json={**terms(), "expected_version": 2, "notice_terms": "x" * 2001},
    )
    assert invalid.status_code == 422


async def test_frontend_seed_guard_and_fill_only_graph(
    client, offer_workspace, db_session, monkeypatch
):
    import importlib
    from types import SimpleNamespace

    from app.models.hiring_workflow import HireDocument, OnboardingTemplate
    from app.models.organization import Organization
    from app.models.user import User

    seed_dev = importlib.import_module("scripts.seed_dev")

    w = offer_workspace
    owner = await db_session.get(User, uuid.UUID(w["user_id"]))
    org = await db_session.get(Organization, uuid.UUID(w["org"]["id"]))
    candidate_id = (await client.get("/api/v1/users/me", headers=w["candidate"]["headers"])).json()[
        "id"
    ]
    candidate = await db_session.get(User, uuid.UUID(candidate_id))
    approver = await db_session.get(User, uuid.UUID(w["approver"]["id"]))
    with pytest.raises(RuntimeError, match="ENVIRONMENT=development"):
        await seed_dev.seed_step7eh_workflows(db_session, org, owner, candidate)
    owner.primary_email, approver.primary_email = "employer@forma.dev", "hiring-admin@forma.dev"
    await db_session.commit()
    monkeypatch.setattr(
        seed_dev, "get_settings", lambda: SimpleNamespace(ENVIRONMENT="development")
    )
    approver.primary_email = "not-the-development-approver@example.com"
    await db_session.commit()
    await seed_dev.seed_step7eh_workflows(db_session, org, owner, candidate)
    assert await db_session.scalar(select(func.count()).select_from(JobOffer)) == 0
    approver.primary_email = "hiring-admin@forma.dev"
    await db_session.commit()
    await seed_dev.seed_step7eh_workflows(db_session, org, owner, candidate)
    offer = (
        await db_session.execute(select(JobOffer).where(JobOffer.status == "sent"))
    ).scalar_one()
    offer.notice_terms = "Edited terms must survive seeding"
    template = (await db_session.execute(select(OnboardingTemplate))).scalar_one()
    template.name = "Edited onboarding template"
    document = (await db_session.execute(select(HireDocument))).scalar_one()
    document.retention = "Edited retention"
    await db_session.commit()
    counts = {
        model: await db_session.scalar(select(func.count()).select_from(model))
        for model in (JobOffer, Hire, Interview, OnboardingTemplate, HireDocument)
    }
    await seed_dev.seed_step7eh_workflows(db_session, org, owner, candidate)
    assert counts == {
        model: await db_session.scalar(select(func.count()).select_from(model)) for model in counts
    }
    await db_session.refresh(offer)
    await db_session.refresh(template)
    await db_session.refresh(document)
    assert offer.notice_terms == "Edited terms must survive seeding"
    assert template.name == "Edited onboarding template"
    assert document.retention == "Edited retention"


async def test_frontend_offer_edit_preserves_attachment_unless_explicitly_removed(
    client, offer_workspace, file_env
):
    from app.tests.test_files import uploaded

    w = offer_workspace
    storage, _ = file_env
    file_id = await uploaded(client, w["actor"], storage, kind="document")
    row = await draft(client, w, document_file_id=file_id)
    result = await client.patch(
        offers(w) + "/" + row["id"],
        headers=w["headers"],
        json={**terms(), "expected_version": 1, "notice_terms": "Edited terms"},
    )
    assert result.status_code == 200, result.text
    assert result.json()["document_available"] is True
    result = await client.patch(
        offers(w) + "/" + row["id"],
        headers=w["headers"],
        json={**terms(), "expected_version": result.json()["version"], "document_file_id": None},
    )
    assert result.status_code == 200, result.text
    assert result.json()["document_available"] is False
