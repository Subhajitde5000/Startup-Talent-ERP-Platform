"""Step 7j talent sourcing: search privacy, shortlists, outreach
lifecycle, plan rules (derived status, dup/applied 409s, daily budget)
and security.

Reuses the 7a/7d fixtures plus the funding-round member helpers — no
parallel fixture system.
"""

import uuid

from app.services.rate_limiter import rate_limiter
from app.tests.test_applicant_pipeline import member, pipeline
from app.tests.test_funding_rounds import _create_org, _make_org_with_members, _signup_verified
from app.tests.test_job_applications import apply
from app.tests.test_job_discovery import marketplace
from app.tests.test_jobs import content as job_content
from app.tests.test_jobs import jobs_workspace

__all__ = ["pipeline", "marketplace", "jobs_workspace"]

APPROVED_CARD_KEYS = {
    "user_id",
    "display_name",
    "avatar_initials",
    "headline",
    "current_location",
    "total_experience_yrs",
    "availability",
    "preferred_mode",
    "skills",
}
BANNED_KEYS = {
    "email",
    "phone",
    "salary_expectation",
    "summary",
    "handle",
    "avatar_url",
    "is_searchable",
    "profile_public",
    "hide_current_employer",
    "allow_outreach",
}


def search_path(org_id, suffix=""):
    return f"/api/v1/organizations/{org_id}/talent/search{suffix}"


def lists_path(org_id, suffix=""):
    return f"/api/v1/organizations/{org_id}/talent/shortlists{suffix}"


def outreach_path(org_id, suffix=""):
    return f"/api/v1/organizations/{org_id}/talent/outreach{suffix}"


def list_url(shortlist_id, suffix=""):
    return f"/api/v1/talent/shortlists/{shortlist_id}{suffix}"


async def seeker(
    client,
    email,
    *,
    headline="Backend Engineer",
    experience=4.0,
    location="Bengaluru",
    skills=("Python",),
    searchable=True,
    public=True,
):
    """Jobseeker with a talent profile; flips the two privacy switches
    through their real self-service endpoints."""
    s = await _signup_verified(client, email, "jobseeker")
    s["id"] = (await client.get("/api/v1/users/me", headers=s["headers"])).json()["id"]
    saved = await client.patch(
        "/api/v1/talent-profile/me",
        headers=s["headers"],
        json={
            "headline": headline,
            "total_experience_yrs": experience,
            "current_location": location,
            "preferred_mode": "remote",
            "availability": "flexible",
            "is_searchable": searchable,
            "skills": list(skills),
        },
    )
    assert saved.status_code == 200, saved.text
    if not public:
        flipped = await client.patch(
            "/api/v1/users/me", headers=s["headers"], json={"profile_public": False}
        )
        assert flipped.status_code == 200, flipped.text
    return s


async def make_list(client, w, name="Backend pipeline", auth=None):
    response = await client.post(
        lists_path(w["org"]["id"]),
        headers=(auth or w)["headers"],
        json={"name": name},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def invite(client, w, candidate, job=None, expect=201, auth=None, **extra):
    response = await client.post(
        outreach_path(w["org"]["id"]),
        headers=(auth or w)["headers"],
        json={
            "candidate_user_id": candidate["id"],
            "job_id": (job or w["job"])["id"],
            **extra,
        },
    )
    assert response.status_code == expect, response.text
    return response.json()


async def test_search_exposes_only_approved_fields(client, marketplace):
    w = marketplace
    senior = await seeker(
        client, "sourcing-senior@example.com", experience=6.5, skills=("Python", "Go")
    )
    junior = await seeker(
        client, "sourcing-junior@example.com", experience=3.0, skills=("Python",)
    )
    hidden_search = await seeker(
        client, "sourcing-hidden@example.com", searchable=False
    )
    hidden_public = await seeker(client, "sourcing-private@example.com", public=False)

    response = await client.get(search_path(w["org"]["id"]), headers=w["headers"])
    assert response.status_code == 200, response.text
    page = response.json()
    assert page["total"] == 2  # hidden_search and hidden_public are out
    found = {item["user_id"] for item in page["items"]}
    assert found == {senior["id"], junior["id"]}
    for item in page["items"]:
        assert set(item.keys()) == APPROVED_CARD_KEYS
        assert not (set(item.keys()) & BANNED_KEYS)
        assert item["availability"] == "flexible"
        assert isinstance(item["skills"], list)

    # q matches name/headline/location only.
    by_location = await client.get(
        search_path(w["org"]["id"], "?q=Bengaluru"), headers=w["headers"]
    )
    assert by_location.json()["total"] == 2
    no_match = await client.get(
        search_path(w["org"]["id"], "?q=nowhere-xyz"), headers=w["headers"]
    )
    assert no_match.json()["total"] == 0

    # experience bands: mid [2,5), senior [5,8), lead [8+).
    mid = await client.get(
        search_path(w["org"]["id"], "?experience=mid"), headers=w["headers"]
    )
    assert {i["user_id"] for i in mid.json()["items"]} == {junior["id"]}
    lead = await client.get(
        search_path(w["org"]["id"], "?experience=lead"), headers=w["headers"]
    )
    assert lead.json()["total"] == 0

    # skill match is exact (case-insensitive).
    go = await client.get(
        search_path(w["org"]["id"], "?skill=go"), headers=w["headers"]
    )
    assert {i["user_id"] for i in go.json()["items"]} == {senior["id"]}
    rust = await client.get(
        search_path(w["org"]["id"], "?skill=Rust"), headers=w["headers"]
    )
    assert rust.json()["total"] == 0

    # sort=experience puts the6.5-year card first.
    ordered = await client.get(
        search_path(w["org"]["id"], "?sort=experience"), headers=w["headers"]
    )
    assert ordered.json()["items"][0]["user_id"] == senior["id"]

    # A long q is a validation error, not a truncated search.
    too_long = await client.get(
        search_path(w["org"]["id"]), params={"q": "x" * 201}, headers=w["headers"]
    )
    assert too_long.status_code == 422

    # Hidden candidates stay hidden even by direct id-shaped queries.
    assert hidden_search["id"] not in found
    assert hidden_public["id"] not in found


async def test_shortlist_crud_and_member_privacy(client, marketplace):
    w = marketplace
    visible = await seeker(client, "sourcing-list-visible@example.com")
    going_private = await seeker(client, "sourcing-list-going@example.com")
    not_searchable = await seeker(
        client, "sourcing-list-hidden@example.com", searchable=False
    )

    created = await make_list(client, w)
    assert created["name"] == "Backend pipeline" and created["member_count"] == 0

    listing = await client.get(lists_path(w["org"]["id"]), headers=w["headers"])
    assert listing.status_code == 200 and listing.json()["total"] == 1

    renamed = await client.patch(
        list_url(created["id"]),
        headers=w["headers"],
        json={"name": "Q1 backend"},
    )
    assert renamed.status_code == 200 and renamed.json()["name"] == "Q1 backend"

    added = await client.post(
        list_url(created["id"], "/members"),
        headers=w["headers"],
        json={"user_id": visible["id"]},
    )
    assert added.status_code == 201, added.text
    assert set(added.json().keys()) == APPROVED_CARD_KEYS

    # Duplicate add -> 409, not a second row.
    dup = await client.post(
        list_url(created["id"], "/members"),
        headers=w["headers"],
        json={"user_id": visible["id"]},
    )
    assert dup.status_code == 409
    assert dup.json()["error"]["code"] == "ALREADY_IN_SHORTLIST"

    # Privacy gate on add: non-searchable and unknown users are 404.
    hidden = await client.post(
        list_url(created["id"], "/members"),
        headers=w["headers"],
        json={"user_id": not_searchable["id"]},
    )
    assert hidden.status_code == 404
    unknown = await client.post(
        list_url(created["id"], "/members"),
        headers=w["headers"],
        json={"user_id": str(uuid.uuid4())},
    )
    assert unknown.status_code == 404

    # Add the second candidate, then they go private: the read filters
    # them out (indistinguishable from missing).
    await client.post(
        list_url(created["id"], "/members"),
        headers=w["headers"],
        json={"user_id": going_private["id"]},
    )
    detail = await client.get(list_url(created["id"]), headers=w["headers"])
    assert detail.status_code == 200
    assert detail.json()["member_count"] == 2
    flipped = await client.patch(
        "/api/v1/users/me",
        headers=going_private["headers"],
        json={"profile_public": False},
    )
    assert flipped.status_code == 200
    after = await client.get(list_url(created["id"]), headers=w["headers"])
    assert after.json()["member_count"] == 1
    assert {m["user_id"] for m in after.json()["members"]} == {visible["id"]}

    # Remove: 204 once, 404 after.
    removed = await client.delete(
        list_url(created["id"], f"/members/{visible['id']}"), headers=w["headers"]
    )
    assert removed.status_code == 204
    again = await client.delete(
        list_url(created["id"], f"/members/{visible['id']}"), headers=w["headers"]
    )
    assert again.status_code == 404

    # Delete the list (soft): 204, then it is gone.
    deleted = await client.delete(list_url(created["id"]), headers=w["headers"])
    assert deleted.status_code == 204
    assert (await client.get(list_url(created["id"]), headers=w["headers"])).status_code == 404
    assert (await client.get(lists_path(w["org"]["id"]), headers=w["headers"])).json()["total"] == 0


async def test_shortlist_mass_assignment_validation_and_authz(client, marketplace):
    w = marketplace

    # Server-controlled columns never cross the wire (extra="forbid").
    for field in ("id", "org_id", "created_by", "deleted_at"):
        response = await client.post(
            lists_path(w["org"]["id"]),
            headers=w["headers"],
            json={"name": "X", field: str(uuid.uuid4())},
        )
        assert response.status_code == 422, (field, response.text)
    created = await make_list(client, w)
    for field in ("id", "org_id", "created_by", "member_count"):
        response = await client.patch(
            list_url(created["id"]),
            headers=w["headers"],
            json={"name": "Y", field: str(uuid.uuid4())},
        )
        assert response.status_code == 422, (field, response.text)

    blank = await client.post(
        lists_path(w["org"]["id"]), headers=w["headers"], json={"name": "   "}
    )
    assert blank.status_code == 422
    long_name = await client.post(
        lists_path(w["org"]["id"]),
        headers=w["headers"],
        json={"name": "x" * 121},
    )
    assert long_name.status_code == 422

    # Viewer: org-prefixed 403, flat row routes 403 (member exists).
    viewer = await member(
        client, w, role="viewer", global_role="employer", email="sourcing-viewer@example.com"
    )
    assert (
        await client.get(lists_path(w["org"]["id"]), headers=viewer["headers"])
    ).status_code == 403
    assert (
        await client.get(search_path(w["org"]["id"]), headers=viewer["headers"])
    ).status_code == 403
    assert (await client.get(list_url(created["id"]), headers=viewer["headers"])).status_code == 403

    # Outsider: org-prefixed 403, flat row routes 404 (no oracle).
    other = await _make_org_with_members(client, suffix=uuid.uuid4().hex[:8])
    outsider = other["owner"]
    assert (
        await client.get(lists_path(w["org"]["id"]), headers=outsider["headers"])
    ).status_code == 403
    assert (await client.get(list_url(created["id"]), headers=outsider["headers"])).status_code == 404
    assert (
        await client.patch(
            list_url(created["id"]), headers=outsider["headers"], json={"name": "stolen"}
        )
    ).status_code == 404
    assert (
        await client.delete(list_url(created["id"]), headers=outsider["headers"])
    ).status_code == 404
    assert (
        await client.post(
            list_url(created["id"], "/members"),
            headers=outsider["headers"],
            json={"user_id": str(uuid.uuid4())},
        )
    ).status_code == 404

    # Jobseeker and unauthenticated callers are blocked outright.
    candidate = w["candidate"]["headers"]
    assert (await client.get(lists_path(w["org"]["id"]), headers=candidate)).status_code == 403
    assert (await client.get(search_path(w["org"]["id"]))).status_code == 401
    assert (await client.get(list_url(created["id"]))).status_code == 401


async def test_outreach_single_history_and_errors(client, marketplace):
    w = marketplace
    invited = await seeker(client, "sourcing-invited@example.com")
    private = await seeker(client, "sourcing-invited-private@example.com", public=False)

    sent = await invite(client, w, invited, note="Saw your profile, great fit.")
    assert sent["status"] == "pending"
    assert sent["candidate_name"]  # projection, not the raw id only
    assert sent["job_title"] == w["job"]["title"]
    assert sent["note"] == "Saw your profile, great fit."

    history = await client.get(outreach_path(w["org"]["id"]), headers=w["headers"])
    assert history.status_code == 200, history.text
    page = history.json()
    assert page["total"] == 1
    assert page["items"][0]["status"] == "pending"
    # Phase-B projections: headline while visible, org-wide applied count.
    assert sent["candidate_headline"] == "Backend Engineer"
    assert page["items"][0]["candidate_headline"] == "Backend Engineer"
    assert page["applied_total"] == 0
    # Going private hides the headline from history (name stays).
    went_private = await client.patch(
        "/api/v1/users/me", headers=invited["headers"], json={"profile_public": False}
    )
    assert went_private.status_code == 200
    hidden = (await client.get(outreach_path(w["org"]["id"]), headers=w["headers"])).json()
    assert hidden["items"][0]["candidate_headline"] is None
    assert hidden["items"][0]["candidate_name"]
    restored = await client.patch(
        "/api/v1/users/me", headers=invited["headers"], json={"profile_public": True}
    )
    assert restored.status_code == 200
    assert page["daily_limit"] == 50 and page["daily_used"] == 1

    # Duplicate invite -> 409 ALREADY_INVITED.
    dup = await invite(client, w, invited, expect=409)
    assert dup["error"]["code"] == "ALREADY_INVITED"

    # Private candidate -> 404 (indistinguishable from missing).
    hidden = await invite(client, w, private, expect=404)
    assert hidden["error"]["code"] == "NOT_FOUND"

    # Unknown candidate id -> 404 too.
    ghost = await invite(
        client, w, {"id": str(uuid.uuid4())}, expect=404
    )
    assert ghost["error"]["code"] == "NOT_FOUND"

    # Validation: bad note length, missing fields, extra fields.
    long_note = await client.post(
        outreach_path(w["org"]["id"]),
        headers=w["headers"],
        json={"candidate_user_id": invited["id"], "job_id": w["job"]["id"], "note": "x" * 2001},
    )
    assert long_note.status_code == 422
    missing = await client.post(
        outreach_path(w["org"]["id"]),
        headers=w["headers"],
        json={"candidate_user_id": invited["id"]},
    )
    assert missing.status_code == 422
    extra = await client.post(
        outreach_path(w["org"]["id"]),
        headers=w["headers"],
        json={
            "candidate_user_id": invited["id"],
            "job_id": w["job"]["id"],
            "org_id": str(uuid.uuid4()),
            "sent_by": str(uuid.uuid4()),
            "status": "applied",
        },
    )
    assert extra.status_code == 422


async def test_outreach_cross_org_job_and_authz(client, marketplace):
    w = marketplace
    candidate = await seeker(client, "sourcing-cross@example.com")

    # A job id from ANOTHER org -> 422 with loc on the field.
    other_owner = await _signup_verified(client, "sourcing-other-owner@example.com", "employer")
    other_org = await _create_org(client, other_owner, type_="employer")
    other_job = await client.post(
        f"/api/v1/organizations/{other_org['id']}/jobs",
        headers=other_owner["headers"],
        json=job_content(),
    )
    assert other_job.status_code == 201, other_job.text
    cross = await client.post(
        outreach_path(w["org"]["id"]),
        headers=w["headers"],
        json={"candidate_user_id": candidate["id"], "job_id": other_job.json()["id"]},
    )
    assert cross.status_code == 422, cross.text
    assert cross.json()["error"]["details"][0]["loc"] == ["body", "job_id"]

    # Outsider org -> 403; viewer -> 403; jobseeker -> 401/403; anon -> 401.
    other = await _make_org_with_members(client, suffix=uuid.uuid4().hex[:8])
    assert (
        await client.post(
            outreach_path(w["org"]["id"]),
            headers=other["owner"]["headers"],
            json={"candidate_user_id": candidate["id"], "job_id": w["job"]["id"]},
        )
    ).status_code == 403
    viewer = await member(
        client, w, role="viewer", global_role="employer", email="sourcing-out-viewer@example.com"
    )
    assert (
        await client.post(
            outreach_path(w["org"]["id"]),
            headers=viewer["headers"],
            json={"candidate_user_id": candidate["id"], "job_id": w["job"]["id"]},
        )
    ).status_code == 403
    assert (
        await client.post(
            outreach_path(w["org"]["id"]),
            headers=w["candidate"]["headers"],
            json={"candidate_user_id": candidate["id"], "job_id": w["job"]["id"]},
        )
    ).status_code == 403
    assert (
        await client.post(
            outreach_path(w["org"]["id"]),
            json={"candidate_user_id": candidate["id"], "job_id": w["job"]["id"]},
        )
    ).status_code == 401
    assert (await client.get(outreach_path(w["org"]["id"]))).status_code == 401

    # Applied-before-invited -> 409 ALREADY_APPLIED (more informative
    # than the duplicate check).
    applied_by = await seeker(client, "sourcing-applied@example.com")
    await apply(client, {**w, "candidate": applied_by})
    applied = await invite(client, w, applied_by, expect=409)
    assert applied["error"]["code"] == "ALREADY_APPLIED"


async def test_outreach_daily_limit(client, marketplace, monkeypatch):
    w = marketplace
    first = await seeker(client, "sourcing-daily-a@example.com")
    second = await seeker(client, "sourcing-daily-b@example.com")

    from app.core.config import get_settings

    rate_limiter.reset()
    monkeypatch.setattr(get_settings(), "TALENT_OUTREACH_DAILY_LIMIT", 1)

    ok = await invite(client, w, first)
    assert ok["status"] == "pending"
    limited = await invite(client, w, second, expect=429)
    assert limited["error"]["code"] == "RATE_LIMITED"

    history = await client.get(outreach_path(w["org"]["id"]), headers=w["headers"])
    assert history.json()["daily_limit"] == 1
    assert history.json()["daily_used"] == 1


async def test_bulk_outreach_counts_and_cross_org_refs(client, marketplace):
    w = marketplace
    invited = await seeker(client, "sourcing-bulk-visible@example.com")
    going_private = await seeker(client, "sourcing-bulk-private@example.com")
    already_applied = await seeker(client, "sourcing-bulk-applied@example.com")
    pre_invited = await seeker(client, "sourcing-bulk-preinvited@example.com")

    shortlist = await make_list(client, w, name="Bulk list")
    for s in (invited, going_private, already_applied, pre_invited):
        added = await client.post(
            list_url(shortlist["id"], "/members"),
            headers=w["headers"],
            json={"user_id": s["id"]},
        )
        assert added.status_code == 201, added.text

    # State changes after the list was built:
    flipped = await client.patch(
        "/api/v1/users/me",
        headers=going_private["headers"],
        json={"profile_public": False},
    )
    assert flipped.status_code == 200
    await apply(client, {**w, "candidate": already_applied})
    single = await invite(client, w, pre_invited)
    assert single["status"] == "pending"

    bulk = await client.post(
        outreach_path(w["org"]["id"], "/bulk"),
        headers=w["headers"],
        json={
            "shortlist_id": shortlist["id"],
            "job_id": w["job"]["id"],
            "note": "Join our pipeline",
        },
    )
    assert bulk.status_code == 200, bulk.text
    counts = bulk.json()
    # invited: visible+fresh; skipped: private, already applied, dup.
    assert counts == {"invited": 1, "skipped": 3}

    history = await client.get(outreach_path(w["org"]["id"]), headers=w["headers"])
    assert history.json()["total"] == 2  # pre-invited single + bulk invite
    statuses = {
        item["candidate_user_id"]: item["status"] for item in history.json()["items"]
    }
    # The skipped (already applied) candidate has no history row — the
    # derived "applied" status belongs to invited candidates who apply
    # afterwards.
    assert already_applied["id"] not in statuses
    assert statuses[pre_invited["id"]] == "pending"
    assert statuses[invited["id"]] == "pending"

    await apply(client, {**w, "candidate": invited})
    after_apply = await client.get(
        outreach_path(w["org"]["id"]), headers=w["headers"]
    )
    derived = {
        item["candidate_user_id"]: item["status"]
        for item in after_apply.json()["items"]
    }
    assert derived[invited["id"]] == "applied"
    # applied_total counts across the org's whole history, not one page.
    one_row = await client.get(
        outreach_path(w["org"]["id"]) + "?limit=1&offset=0", headers=w["headers"]
    )
    assert one_row.json()["applied_total"] == 1 and len(one_row.json()["items"]) == 1

    # Second bulk: everyone is now a skip (dup/private/applied).
    again = await client.post(
        outreach_path(w["org"]["id"], "/bulk"),
        headers=w["headers"],
        json={"shortlist_id": shortlist["id"], "job_id": w["job"]["id"]},
    )
    assert again.json() == {"invited": 0, "skipped": 4}

    # Cross-org references in the bulk payload -> 422 with loc.
    other = await _make_org_with_members(client, suffix=uuid.uuid4().hex[:8])
    cross_list = await client.post(
        lists_path(other["org"]["id"]),
        headers=other["owner"]["headers"],
        json={"name": "Other list"},
    )
    assert cross_list.status_code == 201, cross_list.text
    foreign = await client.post(
        outreach_path(w["org"]["id"], "/bulk"),
        headers=w["headers"],
        json={
            "shortlist_id": cross_list.json()["id"],
            "job_id": w["job"]["id"],
        },
    )
    assert foreign.status_code == 422
    assert foreign.json()["error"]["details"][0]["loc"] == ["body", "shortlist_id"]

    # Mass assignment on the bulk body.
    for field in ("org_id", "sent_by", "invited"):
        response = await client.post(
            outreach_path(w["org"]["id"], "/bulk"),
            headers=w["headers"],
            json={
                "shortlist_id": shortlist["id"],
                "job_id": w["job"]["id"],
                field: str(uuid.uuid4()),
            },
        )
        assert response.status_code == 422, (field, response.text)


async def test_search_and_shortlist_rate_limits(client, marketplace, monkeypatch):
    from app.core.config import get_settings

    w = marketplace
    rate_limiter.reset()
    monkeypatch.setattr(get_settings(), "TALENT_SEARCH_LIMIT", 1)
    assert (
        await client.get(search_path(w["org"]["id"]), headers=w["headers"])
    ).status_code == 200
    assert (
        await client.get(search_path(w["org"]["id"]), headers=w["headers"])
    ).status_code == 429

    rate_limiter.reset()
    monkeypatch.setattr(get_settings(), "TALENT_SEARCH_LIMIT", 60)
    monkeypatch.setattr(get_settings(), "TALENT_SHORTLIST_WRITE_LIMIT", 1)
    first = await client.post(
        lists_path(w["org"]["id"]), headers=w["headers"], json={"name": "One"}
    )
    assert first.status_code == 201, first.text
    second = await client.post(
        lists_path(w["org"]["id"]), headers=w["headers"], json={"name": "Two"}
    )
    assert second.status_code == 429, second.text


async def test_candidate_invitations_endpoint(client, marketplace):
    w = marketplace
    target = await seeker(client, "candidate-invited@example.com")
    other = await seeker(client, "candidate-other@example.com")

    # Target candidate has no invitations initially
    empty = await client.get("/api/v1/talent/invitations", headers=target["headers"])
    assert empty.status_code == 200
    assert empty.json()["items"] == []
    assert empty.json()["total"] == 0

    # Employer sends outreach with note
    invited = await invite(
        client,
        w,
        target,
        note="We loved your background and would like you to apply.",
    )
    assert invited["status"] == "pending"

    # Target candidate now sees the invitation
    res = await client.get("/api/v1/talent/invitations", headers=target["headers"])
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    item = data["items"][0]
    assert item["job_id"] == w["job"]["id"]
    assert item["job_title"] == w["job"]["title"]
    assert item["org_name"] == w["org"]["name"]
    assert item["note"] == "We loved your background and would like you to apply."
    assert item["applied"] is False
    assert item["application_id"] is None

    # Other candidate sees nothing
    other_res = await client.get("/api/v1/talent/invitations", headers=other["headers"])
    assert other_res.status_code == 200
    assert other_res.json()["items"] == []

    # Target candidate applies to the job
    app_record = await apply(client, {**w, "candidate": target})

    # Invitation now shows applied=True with application_id
    updated_res = await client.get("/api/v1/talent/invitations", headers=target["headers"])
    assert updated_res.status_code == 200
    updated_item = updated_res.json()["items"][0]
    assert updated_item["applied"] is True
    assert updated_item["application_id"] == app_record["id"]

