"""Step 7o ATS check and AI tailoring (LangGraph + Groq) tests."""

import uuid

from sqlalchemy import select

from app.models.ai_usage import AiUsageEvent
from app.models.profile import Skill
from app.services.ai_tailor_service import TailorStructuredOutput, _TailorSuggestion
from app.tests.test_funding_rounds import _signup_verified
from app.tests.test_job_discovery import marketplace
from app.tests.test_jobs import jobs_workspace, new_job

__all__ = ["marketplace", "jobs_workspace"]


async def test_ats_check_happy_path_and_history(client, db_session, marketplace):
    w = marketplace
    h = w["candidate"]["headers"]
    jid = w["job"]["id"]

    s1 = Skill(name="GraphQL", category="Backend")
    db_session.add(s1)
    await db_session.commit()

    r = await client.post(
        "/api/v1/resumes",
        headers=h,
        json={
            "title": "Product & Engineering Resume",
            "target_role": w["job"]["title"],
            "summary": "Experienced engineer building scalable platforms.",
        },
    )
    assert r.status_code == 201
    rid = r.json()["id"]

    await client.put(
        f"/api/v1/resumes/{rid}/experiences",
        headers=h,
        json={
            "items": [
                {
                    "role_title": "Engineer",
                    "company": "Startup",
                    "bullets": ["Built core Python services"],
                }
            ]
        },
    )
    await client.put(
        f"/api/v1/resumes/{rid}/skills",
        headers=h,
        json={"skill_ids": [str(s1.id)]},
    )

    ats_resp = await client.post(
        f"/api/v1/resumes/{rid}/ats-runs",
        headers=h,
        json={"job_id": jid},
    )
    assert ats_resp.status_code == 201, ats_resp.text
    run = ats_resp.json()
    assert run["run_type"] == "ats"
    assert 0 <= run["score"] <= 100
    assert run["job_id"] == jid
    assert run["ai_notice"] is None

    # Resume ats_score updated
    res_after = (await client.get(f"/api/v1/resumes/{rid}", headers=h)).json()
    assert res_after["ats_score"] == run["score"]

    # Summary reflects avg_ats_score
    summary = (await client.get("/api/v1/resumes/summary", headers=h)).json()
    assert summary["avg_ats_score"] == run["score"]

    # List and get run
    listed = (await client.get(f"/api/v1/resumes/{rid}/ats-runs", headers=h)).json()
    assert listed["total"] == 1
    assert listed["items"][0]["id"] == run["id"]

    got = (await client.get(f"/api/v1/resumes/{rid}/ats-runs/{run['id']}", headers=h)).json()
    assert got["id"] == run["id"]


async def test_ai_tailor_langgraph_groq_and_usage_metering(
    client, db_session, marketplace, settings, monkeypatch
):
    w = marketplace
    h = w["candidate"]["headers"]
    jid = w["job"]["id"]

    r = await client.post(
        "/api/v1/resumes",
        headers=h,
        json={"title": "AI Tailor Resume", "summary": "Product engineer."},
    )
    rid = r.json()["id"]

    # Unconfigured GROQ_API_KEY -> 503 AI_UNCONFIGURED
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    unconf = await client.post(
        f"/api/v1/resumes/{rid}/tailor",
        headers=h,
        json={"job_id": jid},
    )
    assert unconf.status_code == 503
    assert unconf.json()["error"]["code"] == "AI_UNCONFIGURED"

    # Configure key and mock run_tailor_graph
    monkeypatch.setattr(settings, "GROQ_API_KEY", "gsk_test_key_never_logged")

    async def _fake_graph(*, resume_text: str, job_text: str, model_name: str, api_key: str):
        assert api_key == "gsk_test_key_never_logged"
        assert "Product engineer." in resume_text
        return (
            TailorStructuredOutput(
                matched_keywords=["engineer"],
                missing_keywords=["Design Systems"],
                suggestions=[
                    _TailorSuggestion(
                        section="summary",
                        original="Product engineer.",
                        tailored="Product engineer experienced in scalable web apps.",
                        rationale="Aligns summary with target role.",
                    )
                ],
            ),
            120,
            45,
        )

    monkeypatch.setattr("app.services.ai_tailor_service.run_tailor_graph", _fake_graph)

    tailor_resp = await client.post(
        f"/api/v1/resumes/{rid}/tailor",
        headers=h,
        json={"job_id": jid},
    )
    assert tailor_resp.status_code == 201, tailor_resp.text
    body = tailor_resp.json()
    assert body["run_type"] == "tailor"
    assert body["score"] is None
    assert body["ai_notice"] is not None
    assert len(body["suggestions"]) == 1
    assert body["suggestions"][0]["section"] == "summary"

    # Verify ai_usage_events row recorded
    seeker_id = uuid.UUID((await client.get("/api/v1/users/me", headers=h)).json()["id"])
    usage = (
        await db_session.execute(
            select(AiUsageEvent).where(AiUsageEvent.user_id == seeker_id)
        )
    ).scalar_one()
    assert usage.feature == "resume_tailor"
    assert usage.input_tokens == 120
    assert usage.output_tokens == 45

    # Provider error -> 502
    async def _failing_graph(**kwargs):
        raise RuntimeError("Groq timeout")

    monkeypatch.setattr("app.services.ai_tailor_service.run_tailor_graph", _failing_graph)
    err_resp = await client.post(
        f"/api/v1/resumes/{rid}/tailor",
        headers=h,
        json={"job_description": "Looking for a senior engineer."},
    )
    assert err_resp.status_code == 502
    assert err_resp.json()["error"]["code"] == "AI_PROVIDER_ERROR"


async def test_ats_and_tailor_security_idor_validation_and_rate_limit(
    client, marketplace, settings, monkeypatch
):
    w = marketplace
    h1 = w["candidate"]["headers"]
    seeker2 = await _signup_verified(client, "ats-other@forma.dev", "jobseeker")
    draft_job = await new_job(client, w, title="Hidden Draft Job")

    r = await client.post("/api/v1/resumes", headers=h1, json={"title": "My Resume"})
    rid = r.json()["id"]

    ats = await client.post(f"/api/v1/resumes/{rid}/ats-runs", headers=h1, json={})
    run_id = ats.json()["id"]

    # 401 & 403
    for method, url, payload in (
        ("POST", f"/api/v1/resumes/{rid}/ats-runs", {}),
        ("GET", f"/api/v1/resumes/{rid}/ats-runs", None),
        ("GET", f"/api/v1/resumes/{rid}/ats-runs/{run_id}", None),
        ("POST", f"/api/v1/resumes/{rid}/tailor", {"job_description": "test"}),
    ):
        assert (await client.request(method, url, json=payload)).status_code == 401
        assert (
            await client.request(method, url, headers=w["headers"], json=payload)
        ).status_code == 403
        # IDOR from seeker2 -> 404
        assert (
            await client.request(method, url, headers=seeker2["headers"], json=payload)
        ).status_code == 404

    # Cross-org / draft job -> 404
    assert (
        await client.post(
            f"/api/v1/resumes/{rid}/ats-runs",
            headers=h1,
            json={"job_id": draft_job["id"]},
        )
    ).status_code == 404

    # Validation: tailor requires job_id or job_description
    assert (
        await client.post(f"/api/v1/resumes/{rid}/tailor", headers=h1, json={})
    ).status_code == 422
    assert (
        await client.post(
            f"/api/v1/resumes/{rid}/tailor",
            headers=h1,
            json={"job_description": "x" * 4001},
        )
    ).status_code == 422

    # Rate limit on AI tailor
    monkeypatch.setattr(settings, "AI_TAILOR_LIMIT", 1)
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    # First call passes rate limit and hits 503 unconfigured
    assert (
        await client.post(
            f"/api/v1/resumes/{rid}/tailor",
            headers=h1,
            json={"job_description": "Senior engineer"},
        )
    ).status_code == 503
    # Second call hits 429 rate limit
    assert (
        await client.post(
            f"/api/v1/resumes/{rid}/tailor",
            headers=h1,
            json={"job_description": "Senior engineer"},
        )
    ).status_code == 429
