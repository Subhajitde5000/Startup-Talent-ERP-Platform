"""Step 7p/7q practice interviews & AI rubric scoring (LangGraph + Groq) tests."""

import uuid

from sqlalchemy import select

from app.models.ai_usage import AiUsageEvent
from app.models.practice import PracticeDrill
from app.models.profile import UserReadiness
from app.services.ai_practice_service import PracticeScoreOutput, PracticeTurnOutput
from app.tests.test_funding_rounds import _signup_verified


async def _seed_drill(db_session, *, active: bool = True) -> PracticeDrill:
    drill = PracticeDrill(
        category="Product Thinking",
        title="Design an ATM for children",
        difficulty="medium",
        duration_min=15,
        description="First-principles user empathy and safety constraints.",
        prompts=[
            "Who are the primary users?",
            "What safety constraints matter most?",
            "How would you handle feedback?",
        ],
        rubric={"focus": ["clarity", "empathy"]},
        is_active=active,
    )
    db_session.add(drill)
    await db_session.commit()
    await db_session.refresh(drill)
    return drill


async def test_practice_full_flow_and_ai_scoring(
    client, db_session, settings, monkeypatch
):
    seeker = await _signup_verified(client, "seeker_p1@forma.dev", role="jobseeker")
    h = seeker["headers"]
    me_resp = await client.get("/api/v1/users/me", headers=h)
    seeker_id = uuid.UUID(me_resp.json()["id"])

    # Seed UserReadiness to verify practice_score sync
    readiness = UserReadiness(
        user_id=seeker_id,
        profile_complete=80,
        resume_score=70,
        practice_score=0,
        overall_score=50,
    )
    db_session.add(readiness)
    drill = await _seed_drill(db_session, active=True)
    await _seed_drill(db_session, active=False)

    # 1. List & get drills (inactive hidden)
    drills_resp = await client.get("/api/v1/practice/drills", headers=h)
    assert drills_resp.status_code == 200
    assert drills_resp.json()["total"] == 1
    assert drills_resp.json()["items"][0]["id"] == str(drill.id)

    drill_get = await client.get(f"/api/v1/practice/drills/{drill.id}", headers=h)
    assert drill_get.status_code == 200
    assert drill_get.json()["title"] == drill.title

    # 2. Get rubric
    rubric_resp = await client.get("/api/v1/practice/rubric", headers=h)
    assert rubric_resp.status_code == 200
    assert len(rubric_resp.json()["criteria"]) == 4

    # 3. Create session from drill
    create_resp = await client.post(
        "/api/v1/practice/sessions",
        headers=h,
        json={"drill_id": str(drill.id), "question_count": 3},
    )
    assert create_resp.status_code == 201, create_resp.text
    sess = create_resp.json()
    sid = sess["id"]
    assert sess["status"] == "scheduled"
    assert len(sess["questions"]) == 3

    # 4. Start session -> seeds first interviewer turn
    start_resp = await client.post(f"/api/v1/practice/sessions/{sid}/start", headers=h)
    assert start_resp.status_code == 200
    assert start_resp.json()["status"] == "in_progress"
    assert len(start_resp.json()["turns"]) == 1
    assert start_resp.json()["turns"][0]["speaker"] == "interviewer"

    # 5. Submit candidate turn (mock LangGraph + Groq)
    monkeypatch.setattr(settings, "GROQ_API_KEY", "test-groq-key")

    async def _fake_turn_graph(*, context_text, model_name, api_key):
        assert "children aged 6 to 12" in context_text
        return (
            PracticeTurnOutput(
                reply="Great framing. How would you prevent accidental large withdrawals?",
                is_follow_up=False,
            ),
            210,
            45,
        )

    monkeypatch.setattr(
        "app.services.ai_practice_service.run_practice_turn_graph", _fake_turn_graph
    )

    turn_resp = await client.post(
        f"/api/v1/practice/sessions/{sid}/turns",
        headers=h,
        json={"content": "Primary users are children aged 6 to 12 with parental oversight."},
    )
    assert turn_resp.status_code == 201, turn_resp.text
    t_data = turn_resp.json()
    assert t_data["candidate_turn"]["speaker"] == "candidate"
    assert t_data["interviewer_turn"]["speaker"] == "interviewer"
    assert t_data["ai_notice"]

    # 6. Score session (mock LangGraph + Groq)
    async def _fake_score_graph(*, transcript_text, model_name, api_key):
        assert "children aged 6 to 12" in transcript_text
        return (
            PracticeScoreOutput(
                clarity=80,
                structure=90,
                empathy=85,
                technical_rigor=80,
                feedback="Strong user empathy and clear safety framing.",
                clarity_note="Concise response.",
                structure_note="Clear STAR structure.",
                empathy_note="Good focus on child safety.",
                technical_rigor_note="Solid guardrail concepts.",
            ),
            420,
            120,
        )

    monkeypatch.setattr(
        "app.services.ai_practice_service.run_practice_score_graph", _fake_score_graph
    )

    score_resp = await client.post(
        f"/api/v1/practice/sessions/{sid}/score",
        headers=h,
        json={"duration_sec": 300},
    )
    assert score_resp.status_code == 200, score_resp.text
    rep = score_resp.json()
    # Weighted: 90*0.30 + 80*0.35 + 85*0.20 + 80*0.15 = 27 + 28 + 17 + 12 = 84
    assert rep["session"]["score"] == 84
    assert rep["session"]["status"] == "completed"
    assert len(rep["dimensions"]) == 4

    # 7. Get report, history, summary
    got_rep = await client.get(f"/api/v1/practice/sessions/{sid}/report", headers=h)
    assert got_rep.status_code == 200
    assert got_rep.json()["session"]["score"] == 84

    hist = await client.get("/api/v1/practice/sessions", headers=h)
    assert hist.status_code == 200
    assert hist.json()["total"] == 1

    summ = await client.get("/api/v1/practice/sessions/summary", headers=h)
    assert summ.status_code == 200
    assert summ.json()["completed_sessions"] == 1
    assert summ.json()["avg_score"] == 84
    assert summ.json()["total_practice_min"] == 5

    # Verify AiUsageEvent rows + UserReadiness sync
    events = (
        (
            await db_session.execute(
                select(AiUsageEvent).where(AiUsageEvent.user_id == seeker_id)
            )
        )
        .scalars()
        .all()
    )
    assert {e.feature for e in events} == {"practice_turn", "practice_score"}

    await db_session.refresh(readiness)
    assert readiness.practice_score == 84

    # 8. Soft delete -> 404 afterward
    del_resp = await client.delete(f"/api/v1/practice/sessions/{sid}", headers=h)
    assert del_resp.status_code == 204
    assert (await client.get(f"/api/v1/practice/sessions/{sid}", headers=h)).status_code == 404


async def test_practice_auth_idor_and_validation(client, db_session, settings, monkeypatch):
    # 401 unauthenticated
    assert (await client.get("/api/v1/practice/drills")).status_code == 401
    assert (await client.get("/api/v1/practice/sessions")).status_code == 401
    assert (await client.get("/api/v1/practice/rubric")).status_code == 401

    # 403 wrong role (employer)
    emp = await _signup_verified(client, "emp_p1@forma.dev", role="employer")
    assert (await client.get("/api/v1/practice/drills", headers=emp["headers"])).status_code == 403
    assert (
        await client.post(
            "/api/v1/practice/sessions",
            headers=emp["headers"],
            json={"target_role": "PM"},
        )
    ).status_code == 403

    # Two job seekers: IDOR checks -> 404
    s1 = await _signup_verified(client, "seeker_a@forma.dev", role="jobseeker")
    s2 = await _signup_verified(client, "seeker_b@forma.dev", role="jobseeker")

    created = await client.post(
        "/api/v1/practice/sessions",
        headers=s1["headers"],
        json={"target_role": "Backend Engineer", "question_count": 3},
    )
    assert created.status_code == 201
    sid = created.json()["id"]

    # Foreign seeker gets 404 on every endpoint
    assert (await client.get(f"/api/v1/practice/sessions/{sid}", headers=s2["headers"])).status_code == 404
    assert (
        await client.post(f"/api/v1/practice/sessions/{sid}/start", headers=s2["headers"])
    ).status_code == 404
    assert (
        await client.post(
            f"/api/v1/practice/sessions/{sid}/turns",
            headers=s2["headers"],
            json={"content": "Trying to inject a turn"},
        )
    ).status_code == 404
    assert (
        await client.post(f"/api/v1/practice/sessions/{sid}/score", headers=s2["headers"])
    ).status_code == 404
    assert (
        await client.get(f"/api/v1/practice/sessions/{sid}/report", headers=s2["headers"])
    ).status_code == 404
    assert (
        await client.delete(f"/api/v1/practice/sessions/{sid}", headers=s2["headers"])
    ).status_code == 404

    # Mass-assignment / extra fields -> 422
    assert (
        await client.post(
            "/api/v1/practice/sessions",
            headers=s1["headers"],
            json={"target_role": "PM", "score": 100, "status": "completed"},
        )
    ).status_code == 422
    assert (
        await client.post(
            f"/api/v1/practice/sessions/{sid}/turns",
            headers=s1["headers"],
            json={"content": "Valid answer", "speaker": "interviewer"},
        )
    ).status_code == 422

    # Blank turn -> 422
    assert (
        await client.post(
            f"/api/v1/practice/sessions/{sid}/turns",
            headers=s1["headers"],
            json={"content": "   "},
        )
    ).status_code == 422

    # Scoring before any candidate turn -> 422
    assert (
        await client.post(f"/api/v1/practice/sessions/{sid}/score", headers=s1["headers"])
    ).status_code == 422

    # Missing GROQ_API_KEY -> 503 AI_UNCONFIGURED
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    ai_resp = await client.post(
        f"/api/v1/practice/sessions/{sid}/turns",
        headers=s1["headers"],
        json={"content": "My answer about distributed caching."},
    )
    assert ai_resp.status_code == 503
    assert ai_resp.json()["error"]["code"] == "AI_UNCONFIGURED"


async def test_practice_video_mode_scoring(client, db_session, settings, monkeypatch):
    seeker = await _signup_verified(client, "seeker_vid@forma.dev", role="jobseeker")
    h = seeker["headers"]

    monkeypatch.setattr(settings, "GROQ_API_KEY", "test-groq-key")

    async def _fake_turn_graph(*, context_text, model_name, api_key):
        return (
            PracticeTurnOutput(reply="Thanks, tell me more about your role.", is_follow_up=False),
            120,
            30,
        )

    async def _fake_score_graph(*, transcript_text, model_name, api_key):
        return (
            PracticeScoreOutput(
                clarity=80,
                structure=80,
                empathy=80,
                technical_rigor=80,
                feedback="Clear and confident delivery.",
                clarity_note="Well paced.",
                structure_note="Good STAR framing.",
                empathy_note="Strong ownership.",
                technical_rigor_note="Solid depth.",
            ),
            300,
            90,
        )

    monkeypatch.setattr(
        "app.services.ai_practice_service.run_practice_turn_graph", _fake_turn_graph
    )
    monkeypatch.setattr(
        "app.services.ai_practice_service.run_practice_score_graph", _fake_score_graph
    )

    # 1. Create text-mode session and verify video scores are rejected
    text_sess = await client.post(
        "/api/v1/practice/sessions",
        headers=h,
        json={"target_role": "Backend Engineer", "question_count": 2},
    )
    assert text_sess.status_code == 201
    assert text_sess.json()["is_video_mode"] is False
    text_sid = text_sess.json()["id"]
    await client.post(
        f"/api/v1/practice/sessions/{text_sid}/turns",
        headers=h,
        json={"content": "I built an async API gateway."},
    )
    bad_video_on_text = await client.post(
        f"/api/v1/practice/sessions/{text_sid}/score",
        headers=h,
        json={"confidence_score": 85},
    )
    assert bad_video_on_text.status_code == 422

    # 2. Create video-mode session
    vid_sess = await client.post(
        "/api/v1/practice/sessions",
        headers=h,
        json={"target_role": "Backend Engineer", "question_count": 2, "is_video_mode": True},
    )
    assert vid_sess.status_code == 201
    assert vid_sess.json()["is_video_mode"] is True
    vid_sid = vid_sess.json()["id"]

    await client.post(f"/api/v1/practice/sessions/{vid_sid}/start", headers=h)
    await client.post(
        f"/api/v1/practice/sessions/{vid_sid}/turns",
        headers=h,
        json={"content": "I led the migration to async PostgreSQL pools."},
    )

    # Out-of-range video score -> 422
    out_of_range = await client.post(
        f"/api/v1/practice/sessions/{vid_sid}/score",
        headers=h,
        json={"confidence_score": 105},
    )
    assert out_of_range.status_code == 422

    # Mass-assignment on answer quality field -> 422
    mass_assign = await client.post(
        f"/api/v1/practice/sessions/{vid_sid}/score",
        headers=h,
        json={"confidence_score": 90, "clarity": 100},
    )
    assert mass_assign.status_code == 422

    # Valid 7-dimension scoring:
    # 80*0.15 + 80*0.15 + 80*0.20 + 80*0.10 + 90*0.15 + 80*0.15 + 100*0.10
    # = 12 + 12 + 16 + 8 + 13.5 + 12 + 10 = 83.5 -> 84
    score_resp = await client.post(
        f"/api/v1/practice/sessions/{vid_sid}/score",
        headers=h,
        json={
            "duration_sec": 180,
            "confidence_score": 90,
            "body_language_score": 80,
            "communication_score": 100,
        },
    )
    assert score_resp.status_code == 200, score_resp.text
    rep = score_resp.json()
    assert rep["session"]["is_video_mode"] is True
    assert rep["session"]["confidence_score"] == 90
    assert rep["session"]["body_language_score"] == 80
    assert rep["session"]["communication_score"] == 100
    assert rep["session"]["score"] == 84
    assert len(rep["dimensions"]) == 7
    assert {d["key"] for d in rep["dimensions"]} == {
        "structure",
        "technical_rigor",
        "empathy",
        "clarity",
        "confidence",
        "body_language",
        "communication",
    }

    got_rep = await client.get(f"/api/v1/practice/sessions/{vid_sid}/report", headers=h)
    assert got_rep.status_code == 200
    assert len(got_rep.json()["dimensions"]) == 7


async def test_practice_gemini_tts(client, settings, monkeypatch):
    # 401 unauthenticated
    assert (
        await client.post("/api/v1/practice/tts", json={"text": "Hello"})
    ).status_code == 401

    # 403 wrong role
    emp = await _signup_verified(client, "emp_tts@forma.dev", role="employer")
    assert (
        await client.post("/api/v1/practice/tts", headers=emp["headers"], json={"text": "Hello"})
    ).status_code == 403

    seeker = await _signup_verified(client, "seeker_tts@forma.dev", role="jobseeker")
    h = seeker["headers"]

    # 503 when GEMINI_API_KEY missing
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    unconf = await client.post("/api/v1/practice/tts", headers=h, json={"text": "Hello"})
    assert unconf.status_code == 503
    assert unconf.json()["error"]["code"] == "AI_UNCONFIGURED"

    # 422 blank text or extra fields
    assert (
        await client.post("/api/v1/practice/tts", headers=h, json={"text": "   "})
    ).status_code == 422
    assert (
        await client.post(
            "/api/v1/practice/tts", headers=h, json={"text": "Hi", "extra": "nope"}
        )
    ).status_code == 422

    # 200 happy path with mocked Gemini PCM response -> WAV output
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-gemini-key")

    async def _fake_gemini_tts(*, text, voice, model_name, api_key):
        assert "Tell me about yourself" in text
        assert voice == "Kore"
        return b"\x00\x00\x01\x00" * 10, "audio/L16;codec=pcm;rate=24000"

    monkeypatch.setattr("app.services.ai_practice_service._call_gemini_tts", _fake_gemini_tts)

    ok_resp = await client.post(
        "/api/v1/practice/tts",
        headers=h,
        json={"text": "Tell me about yourself.", "voice": "Kore"},
    )
    assert ok_resp.status_code == 200
    assert ok_resp.headers["content-type"].startswith("audio/wav")
    assert ok_resp.content[:4] == b"RIFF"
    assert ok_resp.content[8:12] == b"WAVE"
