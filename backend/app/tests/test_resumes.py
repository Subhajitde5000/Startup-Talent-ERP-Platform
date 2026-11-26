"""Step 7n resume builder tests: CRUD, sections, ordering, duplicate, default, security."""

import uuid

from sqlalchemy import select

from app.models.profile import Skill
from app.models.talent import TalentProfile
from app.tests.test_funding_rounds import _signup_verified
from app.tests.test_job_discovery import marketplace
from app.tests.test_jobs import jobs_workspace

__all__ = ["marketplace", "jobs_workspace"]


async def test_resume_crud_sections_duplicate_default_and_delete(client, db_session):
    seeker = await _signup_verified(client, "resume-owner@forma.dev", "jobseeker")
    h = seeker["headers"]
    seeker_id = uuid.UUID((await client.get("/api/v1/users/me", headers=h)).json()["id"])

    # Seed two skills in DB
    s1 = Skill(name="Python", category="Backend")
    s2 = Skill(name="FastAPI", category="Backend")
    db_session.add_all([s1, s2])
    await db_session.flush()

    # Ensure TalentProfile exists to verify resume_id sync
    tp = TalentProfile(user_id=seeker_id)
    db_session.add(tp)
    await db_session.commit()

    # Create
    r = await client.post(
        "/api/v1/resumes",
        headers=h,
        json={
            "title": "Backend Engineer Resume",
            "target_role": "Senior Backend Engineer",
            "summary": "6+ years building distributed Python APIs.",
            "template": "Modern Clean",
        },
    )
    assert r.status_code == 201, r.text
    res = r.json()
    rid = res["id"]
    assert res["source"] == "manual"
    assert res["is_default"] is False
    assert res["ats_score"] is None

    # Replace experiences (ordered)
    exp_resp = await client.put(
        f"/api/v1/resumes/{rid}/experiences",
        headers=h,
        json={
            "items": [
                {
                    "role_title": "Staff Engineer",
                    "company": "Acme",
                    "period_label": "2023 - Present",
                    "bullets": ["Scaled APIs to 10k rps"],
                },
                {
                    "role_title": "Software Engineer",
                    "company": "Beta",
                    "started_on": "2020-01-01",
                    "ended_on": "2022-12-31",
                    "bullets": ["Built async pipelines"],
                },
            ]
        },
    )
    assert exp_resp.status_code == 200, exp_resp.text
    exps = exp_resp.json()["experiences"]
    assert [e["role_title"] for e in exps] == ["Staff Engineer", "Software Engineer"]
    assert [e["display_order"] for e in exps] == [0, 1]

    # Replace education
    edu_resp = await client.put(
        f"/api/v1/resumes/{rid}/education",
        headers=h,
        json={
            "items": [
                {
                    "degree": "B.Tech CS",
                    "school": "IIT Delhi",
                    "year_label": "2016 - 2020",
                }
            ]
        },
    )
    assert edu_resp.status_code == 200, edu_resp.text
    assert len(edu_resp.json()["education"]) == 1

    # Replace skills (deduplicates cleanly)
    sk_resp = await client.put(
        f"/api/v1/resumes/{rid}/skills",
        headers=h,
        json={"skill_ids": [str(s1.id), str(s2.id), str(s1.id)]},
    )
    assert sk_resp.status_code == 200, sk_resp.text
    assert {s["name"] for s in sk_resp.json()["skills"]} == {"Python", "FastAPI"}

    # Set default + verify talent_profiles.resume_id synced
    def_resp = await client.post(f"/api/v1/resumes/{rid}/set-default", headers=h)
    assert def_resp.status_code == 200, def_resp.text
    assert def_resp.json()["is_default"] is True

    db_session.expire_all()
    tp_row = (
        await db_session.execute(select(TalentProfile).where(TalentProfile.user_id == seeker_id))
    ).scalar_one()
    assert str(tp_row.resume_id) == rid

    # Duplicate
    dup_resp = await client.post(f"/api/v1/resumes/{rid}/duplicate", headers=h)
    assert dup_resp.status_code == 201, dup_resp.text
    dup = dup_resp.json()
    dup_id = dup["id"]
    assert dup_id != rid
    assert dup["title"] == "Backend Engineer Resume (Copy)"
    assert dup["is_default"] is False
    assert len(dup["experiences"]) == 2
    assert len(dup["education"]) == 1
    assert len(dup["skills"]) == 2

    # Set duplicate as default -> clears original default
    def2 = await client.post(f"/api/v1/resumes/{dup_id}/set-default", headers=h)
    assert def2.status_code == 200
    orig_after = (await client.get(f"/api/v1/resumes/{rid}", headers=h)).json()
    assert orig_after["is_default"] is False

    # Update metadata
    patch = await client.patch(
        f"/api/v1/resumes/{rid}",
        headers=h,
        json={"title": "Updated Title", "summary": "New summary"},
    )
    assert patch.status_code == 200
    assert patch.json()["title"] == "Updated Title"
    assert patch.json()["summary"] == "New summary"

    # List + search + summary + export
    listed = (await client.get("/api/v1/resumes?q=Updated", headers=h)).json()
    assert listed["total"] == 1
    assert listed["items"][0]["id"] == rid

    summary = (await client.get("/api/v1/resumes/summary", headers=h)).json()
    assert summary["total"] == 2
    assert summary["primary_count"] == 1
    assert summary["avg_ats_score"] is None

    exported = (await client.get(f"/api/v1/resumes/{rid}/export", headers=h)).json()
    assert exported["id"] == rid
    assert "exported_at" in exported

    # Soft delete default resume -> clears talent_profiles.resume_id
    del_resp = await client.delete(f"/api/v1/resumes/{dup_id}", headers=h)
    assert del_resp.status_code == 204
    assert (await client.get(f"/api/v1/resumes/{dup_id}", headers=h)).status_code == 404

    db_session.expire_all()
    tp_after = (
        await db_session.execute(select(TalentProfile).where(TalentProfile.user_id == seeker_id))
    ).scalar_one()
    assert tp_after.resume_id is None


async def test_resume_security_auth_idor_mass_assignment_and_validation(client, marketplace):
    w = marketplace
    seeker1 = w["candidate"]
    seeker2 = await _signup_verified(client, "other-seeker@forma.dev", "jobseeker")
    employer_headers = w["headers"]

    r = await client.post(
        "/api/v1/resumes",
        headers=seeker1["headers"],
        json={"title": "Private Resume"},
    )
    assert r.status_code == 201
    rid = r.json()["id"]

    # 401 unauthenticated & 403 wrong role across all 7n endpoints
    endpoints = [
        ("POST", "/api/v1/resumes", {"title": "x"}),
        ("GET", "/api/v1/resumes", None),
        ("GET", "/api/v1/resumes/summary", None),
        ("GET", f"/api/v1/resumes/{rid}", None),
        ("PATCH", f"/api/v1/resumes/{rid}", {"title": "y"}),
        ("DELETE", f"/api/v1/resumes/{rid}", None),
        ("POST", f"/api/v1/resumes/{rid}/duplicate", None),
        ("PUT", f"/api/v1/resumes/{rid}/experiences", {"items": []}),
        ("PUT", f"/api/v1/resumes/{rid}/education", {"items": []}),
        ("PUT", f"/api/v1/resumes/{rid}/skills", {"skill_ids": []}),
        ("POST", f"/api/v1/resumes/{rid}/set-default", None),
        ("GET", f"/api/v1/resumes/{rid}/export", None),
    ]
    for method, url, payload in endpoints:
        assert (await client.request(method, url, json=payload)).status_code == 401
        assert (
            await client.request(method, url, headers=employer_headers, json=payload)
        ).status_code == 403

    # IDOR: another job seeker always gets 404 (no existence oracle)
    for method, url, payload in endpoints[3:]:
        resp = await client.request(method, url, headers=seeker2["headers"], json=payload)
        assert resp.status_code == 404, f"{method} {url} -> {resp.status_code}"

    # Mass-assignment guards (422)
    for bad_field in ("user_id", "ats_score", "is_default", "source", "created_at", "deleted_at"):
        assert (
            await client.post(
                "/api/v1/resumes",
                headers=seeker1["headers"],
                json={"title": "Test", bad_field: "hack"},
            )
        ).status_code == 422
        assert (
            await client.patch(
                f"/api/v1/resumes/{rid}",
                headers=seeker1["headers"],
                json={bad_field: "hack"},
            )
        ).status_code == 422

    # Validation errors (422)
    assert (
        await client.post("/api/v1/resumes", headers=seeker1["headers"], json={"title": "   "})
    ).status_code == 422
    assert (
        await client.post(
            "/api/v1/resumes", headers=seeker1["headers"], json={"title": "a" * 121}
        )
    ).status_code == 422
    assert (
        await client.put(
            f"/api/v1/resumes/{rid}/experiences",
            headers=seeker1["headers"],
            json={
                "items": [
                    {
                        "role_title": "Eng",
                        "company": "Co",
                        "started_on": "2023-01-01",
                        "ended_on": "2022-01-01",
                    }
                ]
            },
        )
    ).status_code == 422
    assert (
        await client.put(
            f"/api/v1/resumes/{rid}/skills",
            headers=seeker1["headers"],
            json={"skill_ids": [str(uuid.uuid4())]},
        )
    ).status_code == 422


async def test_resume_rate_limit(client, settings, monkeypatch):
    seeker = await _signup_verified(client, "rl-seeker@forma.dev", "jobseeker")
    monkeypatch.setattr(settings, "RESUME_WRITE_LIMIT", 1)
    r1 = await client.post("/api/v1/resumes", headers=seeker["headers"], json={"title": "One"})
    assert r1.status_code == 201
    r2 = await client.post("/api/v1/resumes", headers=seeker["headers"], json={"title": "Two"})
    assert r2.status_code == 429
