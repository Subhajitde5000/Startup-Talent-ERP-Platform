"""Step 7r & 7s: Startup hiring backend verification across 7a, 7d, 7f, 7g and 7l.

Verifies that startup organizations (``OrgType.startup``) and startup-role
users (``UserRole.startup``, without ``UserRole.employer``) share the same
hiring APIs as employers, with identical permission, cross-org IDOR,
validation and mass-assignment protections.
"""

from datetime import UTC, date, datetime, timedelta
from typing import Any

import pytest

from app.tests.test_applicant_pipeline import member, move
from app.tests.test_funding_rounds import _create_org, _signup_verified
from app.tests.test_job_applications import apply
from app.tests.test_jobs import action, new_job


def _future(**delta: int) -> str:
    return (datetime.now(UTC) + timedelta(**delta)).isoformat()


async def _me(client, headers: dict[str, str]) -> dict[str, Any]:
    resp = await client.get("/api/v1/users/me", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _startup_workspace(client, prefix: str = "sh") -> dict[str, Any]:
    owner = await _signup_verified(client, f"{prefix}-founder@example.com", "startup")
    org = await _create_org(client, owner, name=f"{prefix} Startup")
    owner_me = await _me(client, owner["headers"])
    w: dict[str, Any] = {
        "actor": owner,
        "org": org,
        "base": f"/api/v1/organizations/{org['id']}/jobs",
        "headers": owner["headers"],
        "user_id": owner_me["id"],
    }
    job = await new_job(client, w)
    await action(client, w, job, "publish")
    candidate = await _signup_verified(client, f"{prefix}-cand@example.com", "jobseeker")
    w = {**w, "job": job, "candidate": candidate}
    app_row = await apply(client, w)
    w["app"] = app_row
    return w


async def test_startup_hiring_7r_7s_happy_path(client):
    w = await _startup_workspace(client, "happy")
    org_id = w["org"]["id"]
    job_id = w["job"]["id"]
    app_id = w["app"]["id"]
    headers = w["headers"]

    panelist = await member(
        client, w, email="happy-member@example.com", role="member", global_role="startup"
    )

    # 7l: Dashboard & analytics work for startup orgs.
    dash = await client.get(f"/api/v1/organizations/{org_id}/hiring/dashboard", headers=headers)
    assert dash.status_code == 200, dash.text
    assert dash.json()["kpis"]["open_jobs"] == 1
    assert dash.json()["kpis"]["total_applicants"] == 1

    # 7a: Pause & resume job.
    paused = await action(client, w, w["job"], "pause")
    assert paused["status"] == "paused"
    resumed = await action(client, w, w["job"], "publish")
    assert resumed["status"] == "open"

    # 7d: List applicants, move stage, add note, toggle blind review on a fresh job.
    apps = await client.get(
        f"/api/v1/organizations/{org_id}/jobs/{job_id}/applications", headers=headers
    )
    assert apps.status_code == 200, apps.text
    assert apps.json()["total"] == 1

    moved = await move(client, w, "shortlisted", expected_stage="applied")
    assert moved.status_code == 200, moved.text
    assert moved.json()["stage"] == "shortlisted"

    moved_iv = await move(client, w, "interview", expected_stage="shortlisted")
    assert moved_iv.status_code == 200, moved_iv.text

    note = await client.post(
        f"/api/v1/organizations/{org_id}/jobs/{job_id}/applications/{app_id}/notes",
        headers=headers,
        json={"body": "Strong systems fundamentals."},
    )
    assert note.status_code == 201, note.text

    fresh_job = await new_job(client, w)
    blind = await client.patch(
        f"/api/v1/organizations/{org_id}/jobs/{fresh_job['id']}/review-settings",
        headers=headers,
        json={"blind_review_enabled": True},
    )
    assert blind.status_code == 200, blind.text
    assert blind.json()["blind_review_enabled"] is True

    # 7f: Schedule interview, respond, complete, submit feedback, list by window.
    when = _future(hours=2)
    iv = await client.post(
        f"/api/v1/organizations/{org_id}/jobs/{job_id}/applications/{app_id}/interviews",
        headers=panelist["headers"],
        json={
            "round_name": "Founder & Tech Chat",
            "format": "video",
            "scheduled_at": when,
            "duration_min": 45,
            "meeting_url": "https://meet.example.com/startup-room",
            "interviewer_ids": [w["user_id"], panelist["id"]],
        },
    )
    assert iv.status_code == 201, iv.text
    iv_id = iv.json()["id"]

    upcoming = await client.get(
        f"/api/v1/organizations/{org_id}/interviews?window=upcoming", headers=headers
    )
    assert upcoming.status_code == 200, upcoming.text
    assert upcoming.json()["total"] == 1

    resp_cand = await client.put(
        f"/api/v1/interviews/{iv_id}/respond",
        headers=w["candidate"]["headers"],
        json={"response": "accepted"},
    )
    assert resp_cand.status_code == 200, resp_cand.text

    completed = await client.post(
        f"/api/v1/organizations/{org_id}/interviews/{iv_id}/complete", headers=headers
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "completed"

    needs_fb = await client.get(
        f"/api/v1/organizations/{org_id}/interviews?window=needs_feedback", headers=headers
    )
    assert needs_fb.status_code == 200, needs_fb.text
    assert needs_fb.json()["total"] == 1

    fb = await client.put(
        f"/api/v1/organizations/{org_id}/interviews/{iv_id}/feedback",
        headers=headers,
        json={"recommendation": "strong_yes", "summary": "Great fit for our seed team."},
    )
    assert fb.status_code == 200, fb.text

    # 7g: Create draft offer, patch, send, candidate accepts.
    offer = await client.post(
        f"/api/v1/organizations/{org_id}/jobs/{job_id}/applications/{app_id}/offers",
        headers=headers,
        json={
            "title": "Founding Backend Engineer",
            "base_salary": "1800000.00",
            "equity_pct": "0.50",
            "currency": "INR",
            "start_date": str(date.today() + timedelta(days=30)),
            "expires_on": str(date.today() + timedelta(days=14)),
        },
    )
    assert offer.status_code == 201, offer.text
    offer_id = offer.json()["id"]
    assert offer.json()["status"] == "draft"

    patched = await client.patch(
        f"/api/v1/offers/{offer_id}",
        headers=headers,
        json={"base_salary": "2000000.00"},
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["base_salary"] == "2000000.00"

    sent = await client.post(f"/api/v1/offers/{offer_id}/send", headers=headers)
    assert sent.status_code == 200, sent.text
    assert sent.json()["status"] == "sent"

    offers_list = await client.get(
        f"/api/v1/organizations/{org_id}/offers?status=sent", headers=headers
    )
    assert offers_list.status_code == 200, offers_list.text
    assert offers_list.json()["total"] == 1

    accepted = await client.post(
        f"/api/v1/offers/{offer_id}/accept", headers=w["candidate"]["headers"]
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["status"] == "accepted"


async def test_startup_hiring_auth_roles_and_permissions(client):
    w = await _startup_workspace(client, "perms")
    org_id = w["org"]["id"]
    job_id = w["job"]["id"]
    app_id = w["app"]["id"]

    # 401 unauthenticated
    for url in (
        f"/api/v1/organizations/{org_id}/jobs",
        f"/api/v1/organizations/{org_id}/jobs/{job_id}/applications",
        f"/api/v1/organizations/{org_id}/interviews",
        f"/api/v1/organizations/{org_id}/offers",
        f"/api/v1/organizations/{org_id}/hiring/dashboard",
    ):
        assert (await client.get(url)).status_code == 401

    viewer = await member(
        client, w, email="perms-viewer@example.com", role="viewer", global_role="startup"
    )
    std_member = await member(
        client, w, email="perms-member@example.com", role="member", global_role="startup"
    )
    outsider = await _signup_verified(client, "perms-outsider@example.com", "startup")

    # Viewer can read jobs and dashboard, but gets 403 on applicants, interviews, offers and job writes.
    assert (
        await client.get(f"/api/v1/organizations/{org_id}/jobs", headers=viewer["headers"])
    ).status_code == 200
    assert (
        await client.get(
            f"/api/v1/organizations/{org_id}/hiring/dashboard", headers=viewer["headers"]
        )
    ).status_code == 200
    assert (
        await client.post(
            f"/api/v1/organizations/{org_id}/jobs",
            headers=viewer["headers"],
            json={"title": "Viewer Job"},
        )
    ).status_code == 403
    assert (
        await client.get(
            f"/api/v1/organizations/{org_id}/jobs/{job_id}/applications",
            headers=viewer["headers"],
        )
    ).status_code == 403
    assert (
        await client.get(f"/api/v1/organizations/{org_id}/interviews", headers=viewer["headers"])
    ).status_code == 403
    assert (
        await client.get(f"/api/v1/organizations/{org_id}/offers", headers=viewer["headers"])
    ).status_code == 403

    # Member with startup role cannot create jobs, toggle blind review, or create offers.
    assert (
        await client.post(
            f"/api/v1/organizations/{org_id}/jobs",
            headers=std_member["headers"],
            json={"title": "Member Job"},
        )
    ).status_code == 403
    assert (
        await client.patch(
            f"/api/v1/organizations/{org_id}/jobs/{job_id}/review-settings",
            headers=std_member["headers"],
            json={"blind_review_enabled": True},
        )
    ).status_code == 403
    assert (
        await client.post(
            f"/api/v1/organizations/{org_id}/jobs/{job_id}/applications/{app_id}/offers",
            headers=std_member["headers"],
            json={
                "title": "Engineer",
                "base_salary": "1000000.00",
                "currency": "INR",
                "start_date": str(date.today() + timedelta(days=30)),
            },
        )
    ).status_code == 403

    # Non-member startup user is rejected 403 on applicants, interviews, offers.
    assert (
        await client.get(
            f"/api/v1/organizations/{org_id}/jobs/{job_id}/applications",
            headers=outsider["headers"],
        )
    ).status_code == 403
    assert (
        await client.get(
            f"/api/v1/organizations/{org_id}/interviews", headers=outsider["headers"]
        )
    ).status_code == 403
    assert (
        await client.get(
            f"/api/v1/organizations/{org_id}/offers", headers=outsider["headers"]
        )
    ).status_code == 403

    # Non-member startup user cannot access an employer org's hiring endpoints.
    emp_owner = await _signup_verified(client, "perms-emp-owner@example.com", "employer")
    emp_org = await _create_org(client, emp_owner, type="employer", name="Employer Co")
    emp_w = {
        "org": emp_org,
        "base": f"/api/v1/organizations/{emp_org['id']}/jobs",
        "headers": emp_owner["headers"],
    }
    emp_job = await new_job(client, emp_w)
    assert (
        await client.get(
            f"/api/v1/organizations/{emp_org['id']}/jobs/{emp_job['id']}/applications",
            headers=outsider["headers"],
        )
    ).status_code == 403


async def test_startup_hiring_cross_org_idor_and_refs(client):
    org_a = await _startup_workspace(client, "orga")
    org_b = await _startup_workspace(client, "orgb")

    # Create interview and offer in org_a.
    iv = await client.post(
        f"/api/v1/organizations/{org_a['org']['id']}/jobs/{org_a['job']['id']}"
        f"/applications/{org_a['app']['id']}/interviews",
        headers=org_a["headers"],
        json={
            "round_name": "Org A Chat",
            "format": "video",
            "scheduled_at": _future(hours=3),
            "duration_min": 30,
            "interviewer_ids": [org_a["user_id"]],
        },
    )
    assert iv.status_code == 201, iv.text
    iv_id = iv.json()["id"]

    offer = await client.post(
        f"/api/v1/organizations/{org_a['org']['id']}/jobs/{org_a['job']['id']}"
        f"/applications/{org_a['app']['id']}/offers",
        headers=org_a["headers"],
        json={
            "title": "Org A Offer",
            "base_salary": "1500000.00",
            "currency": "INR",
            "start_date": str(date.today() + timedelta(days=30)),
        },
    )
    assert offer.status_code == 201, offer.text
    offer_id = offer.json()["id"]

    # Org B founder cannot access Org A resources (404 / 403).
    b_hdr = org_b["headers"]
    assert (
        await client.get(
            f"/api/v1/organizations/{org_b['org']['id']}/jobs/{org_a['job']['id']}",
            headers=b_hdr,
        )
    ).status_code == 404
    assert (
        await client.get(
            f"/api/v1/organizations/{org_b['org']['id']}/jobs/{org_b['job']['id']}"
            f"/applications/{org_a['app']['id']}",
            headers=b_hdr,
        )
    ).status_code == 404
    assert (
        await client.get(
            f"/api/v1/organizations/{org_b['org']['id']}/interviews/{iv_id}", headers=b_hdr
        )
    ).status_code == 404
    assert (await client.get(f"/api/v1/offers/{offer_id}", headers=b_hdr)).status_code == 404

    # Cross-org references in payloads return 422.
    bad_assign = await client.patch(
        f"/api/v1/organizations/{org_a['org']['id']}/jobs/{org_a['job']['id']}"
        f"/applications/{org_a['app']['id']}",
        headers=org_a["headers"],
        json={"assignee_id": org_b["user_id"]},
    )
    assert bad_assign.status_code == 422

    bad_panel = await client.post(
        f"/api/v1/organizations/{org_a['org']['id']}/jobs/{org_a['job']['id']}"
        f"/applications/{org_a['app']['id']}/interviews",
        headers=org_a["headers"],
        json={
            "round_name": "Cross-org panel",
            "format": "video",
            "scheduled_at": _future(hours=5),
            "duration_min": 30,
            "interviewer_ids": [org_b["user_id"]],
        },
    )
    assert bad_panel.status_code == 422

    bad_offer_owner = await client.post(
        f"/api/v1/organizations/{org_b['org']['id']}/jobs/{org_b['job']['id']}"
        f"/applications/{org_b['app']['id']}/offers",
        headers=b_hdr,
        json={
            "title": "Cross-org owner",
            "base_salary": "1500000.00",
            "currency": "INR",
            "start_date": str(date.today() + timedelta(days=30)),
            "owner_id": org_a["user_id"],
        },
    )
    assert bad_offer_owner.status_code == 422


@pytest.mark.parametrize(
    "endpoint,method,payload",
    [
        ("jobs", "post", {"title": "Mass Job", "status": "open"}),
        ("jobs", "post", {"title": "Mass Job", "blind_review_enabled": True}),
        (
            "applicant",
            "patch",
            {"stage": "shortlisted", "expected_stage": "applied", "stage_changed_at": _future(days=1)},
        ),
        (
            "interviews",
            "post",
            {
                "format": "video",
                "scheduled_at": _future(hours=4),
                "duration_min": 30,
                "interviewer_ids": ["SELF"],
                "status": "completed",
            },
        ),
        (
            "offers",
            "post",
            {
                "title": "Mass Offer",
                "base_salary": "1500000.00",
                "currency": "INR",
                "start_date": str(date.today() + timedelta(days=30)),
                "status": "accepted",
            },
        ),
    ],
)
async def test_startup_hiring_mass_assignment_rejected(client, endpoint, method, payload):
    w = await _startup_workspace(client, f"ma-{endpoint}")
    org_id = w["org"]["id"]
    job_id = w["job"]["id"]
    app_id = w["app"]["id"]
    body = {
        k: ([w["user_id"]] if v == ["SELF"] else v)
        for k, v in payload.items()
    }
    urls = {
        "jobs": f"/api/v1/organizations/{org_id}/jobs",
        "applicant": f"/api/v1/organizations/{org_id}/jobs/{job_id}/applications/{app_id}",
        "interviews": (
            f"/api/v1/organizations/{org_id}/jobs/{job_id}/applications/{app_id}/interviews"
        ),
        "offers": f"/api/v1/organizations/{org_id}/jobs/{job_id}/applications/{app_id}/offers",
    }
    resp = await getattr(client, method)(urls[endpoint], headers=w["headers"], json=body)
    assert resp.status_code == 422, resp.text
