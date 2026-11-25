"""Step 7e contracts: scorecard templates, scores and compare.

Real auth and organization/application fixtures from earlier steps; only
the shared rate limiter is reset per test (conftest autouse).
"""

import uuid

from sqlalchemy import select

from app.core.config import get_settings
from app.main import create_app
from app.models.activity import ActivityEvent
from app.models.scorecard import ApplicationScore, ScorecardCriterion
from app.tests.test_applicant_pipeline import member, move, pipeline
from app.tests.test_funding_rounds import _create_org, _signup_verified
from app.tests.test_job_applications import apply
from app.tests.test_job_discovery import marketplace
from app.tests.test_jobs import action, jobs_workspace, new_job

__all__ = ["marketplace", "jobs_workspace", "pipeline"]


def base(w) -> str:
    return f"{w['base'].removesuffix('/jobs')}/scorecards"


def scores_path(w) -> str:
    return f"{w['base']}/{w['job']['id']}/applications/{w['app']['id']}/scores"


def compare_path(w) -> str:
    return f"{w['base']}/{w['job']['id']}/compare"


def card_payload(**overrides):
    return {
        "name": "Engineering rubric",
        "criteria": [
            {"name": "System design", "weight": 3, "anchors": ["junior", "senior"]},
            {"name": "Communication", "weight": 2},
        ],
        **overrides,
    }


async def make_card(client, w, **overrides):
    response = await client.post(base(w), headers=w["headers"], json=card_payload(**overrides))
    assert response.status_code == 201, response.text
    return response.json()


async def put_scores(client, w, scores, headers=None):
    return await client.put(
        scores_path(w), headers=headers or w["headers"], json={"scores": scores}
    )


async def test_scorecard_lifecycle_scope_and_roles(client, pipeline, db_session):
    w = pipeline
    assert (await client.get(base(w))).status_code == 401

    card = await make_card(client, w)
    assert card["is_platform"] is False and card["org_id"] == w["org"]["id"]
    assert len(card["criteria"]) == 2
    assert [c["display_order"] for c in card["criteria"]] == [0, 1]
    assert card["criteria"][0]["anchors"] == ["junior", "senior"]

    # Reads: member yes, viewer and outsider no.
    reader = await member(client, w, role="member", email="sc-reader@example.com")
    viewer = await member(client, w, role="viewer", email="sc-viewer@example.com")
    outsider = await _signup_verified(client, "sc-outsider@example.com", "employer")
    assert (
        await client.get(f"{base(w)}/{card['id']}", headers=reader["headers"])
    ).status_code == 200
    for headers in (viewer["headers"], outsider["headers"]):
        assert (await client.get(base(w), headers=headers)).status_code == 403

    # Writes: owner/admin only.
    denied = card_payload(name="Member attempt")
    assert (await client.post(base(w), headers=reader["headers"], json=denied)).status_code == 403
    assert (
        await client.patch(
            f"{base(w)}/{card['id']}", headers=viewer["headers"], json={"name": "Nope"}
        )
    ).status_code == 403
    assert (
        await client.delete(f"{base(w)}/{card['id']}", headers=reader["headers"])
    ).status_code == 403

    page = (await client.get(base(w), headers=w["headers"])).json()
    assert page["total"] == 1 and page["items"][0]["id"] == card["id"]
    filtered = (await client.get(base(w) + "?q=rubric", headers=w["headers"])).json()
    assert filtered["total"] == 1
    assert (await client.get(base(w) + "?q=missing", headers=w["headers"])).json()["total"] == 0

    # Replace-set patch: keep+update first, drop second (unscored), add one.
    patched = await client.patch(
        f"{base(w)}/{card['id']}",
        headers=w["headers"],
        json={
            "name": "Design rubric",
            "criteria": [
                {
                    "id": card["criteria"][0]["id"],
                    "name": "System design",
                    "weight": 5,
                    "anchors": [],
                },
                {"name": "Culture add", "weight": 1},
            ],
        },
    )
    assert patched.status_code == 200, patched.text
    updated = patched.json()
    assert updated["name"] == "Design rubric" and len(updated["criteria"]) == 2
    assert updated["criteria"][0]["id"] == card["criteria"][0]["id"]
    assert updated["criteria"][0]["weight"] == 5
    assert updated["criteria"][1]["id"] != card["criteria"][1]["id"]

    # Soft delete hides the card but keeps criteria/scores reachable.
    assert (await client.delete(f"{base(w)}/{card['id']}", headers=w["headers"])).status_code == 204
    assert (await client.get(base(w), headers=w["headers"])).json()["total"] == 0
    assert (await client.get(f"{base(w)}/{card['id']}", headers=w["headers"])).status_code == 404
    assert (await client.delete(f"{base(w)}/{card['id']}", headers=w["headers"])).status_code == 404
    kept = (
        await db_session.execute(
            select(ScorecardCriterion).where(
                ScorecardCriterion.scorecard_id == uuid.UUID(card["id"])
            )
        )
    ).scalars()
    assert len(list(kept)) == 2
    events = (
        (
            await db_session.execute(
                select(ActivityEvent).where(
                    ActivityEvent.org_id == uuid.UUID(w["org"]["id"]),
                    ActivityEvent.event_type.in_(
                        [
                            "scorecard_created",
                            "scorecard_updated",
                            "scorecard_deleted",
                        ]
                    ),
                )
            )
        )
        .scalars()
        .all()
    )
    assert sorted(event.event_type for event in events) == [
        "scorecard_created",
        "scorecard_deleted",
        "scorecard_updated",
    ]


async def test_scorecard_validation_mass_assignment_and_foreign_ids(client, pipeline, db_session):
    w = pipeline
    # Field validation.
    for payload in (
        card_payload(name="   "),
        card_payload(criteria=[{"name": "x", "weight": 0}]),
        card_payload(criteria=[{"name": "x", "weight": 101}]),
        card_payload(criteria=[{"name": "x", "weight": 1, "anchors": ["  "]}]),
        card_payload(criteria=[{"name": "x", "weight": 1, "anchors": ["a" * 201]}]),
        card_payload(criteria=[{"name": "x"}] * 31),
        card_payload(criteria=[]),
    ):
        response = await client.post(base(w), headers=w["headers"], json=payload)
        assert response.status_code == 422, response.text

    # Mass assignment on server-controlled fields.
    for forbidden in (
        {"is_platform": True},
        {"org_id": str(uuid.uuid4())},
        {"id": str(uuid.uuid4())},
        {"created_at": "2020-01-01T00:00:00Z"},
        {"criteria": [{"name": "x", "weight": 1, "display_order": 9}]},
    ):
        payload = card_payload()
        payload.update(forbidden)
        response = await client.post(base(w), headers=w["headers"], json=payload)
        assert response.status_code == 422, (forbidden, response.text)

    # Cross-organization job reference -> 404, never a silent attach.
    other = await _create_org(client, w["actor"], name="Other Employer", type_="employer")
    other_workspace = {**w, "org": other, "base": f"/api/v1/organizations/{other['id']}/jobs"}
    other_job = await new_job(client, other_workspace)
    assert (
        await client.post(
            base(w),
            headers=w["headers"],
            json=card_payload(job_id=other_job["id"]),
        )
    ).status_code == 404

    # Unknown/foreign criterion ids on a patch -> field-located 422.
    card = await make_card(client, w)
    foreign = await client.post(base(w), headers=w["headers"], json=card_payload(name="Foreign"))
    foreign_criterion = foreign.json()["criteria"][0]["id"]
    response = await client.patch(
        f"{base(w)}/{card['id']}",
        headers=w["headers"],
        json={
            "criteria": [
                {"id": foreign_criterion, "name": "x", "weight": 1},
            ]
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["loc"] == ["body", "criteria", 0, "id"]

    # Empty / null patches.
    for payload in ({}, {"name": None}, {"criteria": None}, {"criteria": []}):
        assert (
            await client.patch(f"{base(w)}/{card['id']}", headers=w["headers"], json=payload)
        ).status_code == 422

    # Over-long body is rejected before validation.
    too_big = await client.post(
        base(w),
        headers=w["headers"],
        json={"name": "x" * (65 * 1024), "criteria": [{"name": "y", "weight": 1}]},
    )
    assert too_big.status_code == 413, too_big.text


async def test_scores_replace_set_totals_and_mass_assignment(client, pipeline, db_session):
    w = pipeline
    card = await make_card(client, w)
    first, second = (criterion["id"] for criterion in card["criteria"])

    created = await put_scores(
        client,
        w,
        [
            {"criterion_id": first, "score": 5, "note": " Strong design "},
            {"criterion_id": second, "score": 3},
        ],
    )
    assert created.status_code == 200, created.text
    body = created.json()
    # (5*3 + 3*2) / (3+2) = 4.2
    assert body["weighted_total"] == 4.2 and body["my_weighted_total"] == 4.2
    by_id = {item["criterion_id"]: item for item in body["items"]}
    assert by_id[first]["my_score"] == 5 and by_id[first]["average"] == 5
    assert by_id[first]["scores"][0]["note"] == "Strong design"
    assert by_id[first]["scores"][0]["interviewer_id"] == w["user_id"]

    # Replace-set: re-scoring one criterion updates in place (unique index),
    # and dropping a criterion clears only my row for it.
    replaced = await put_scores(client, w, [{"criterion_id": first, "score": 4}])
    assert replaced.status_code == 200, replaced.text
    assert len(replaced.json()["items"]) == 1
    assert replaced.json()["weighted_total"] == 4.0
    rows = (
        (
            await db_session.execute(
                select(ApplicationScore).where(
                    ApplicationScore.application_id == uuid.UUID(w["app"]["id"])
                )
            )
        )
        .scalars()
        .all()
    )
    assert (
        len(rows) == 1 and rows[0].score == 4 and rows[0].interviewer_id == uuid.UUID(w["user_id"])
    )

    # Clear with an empty replace-set.
    cleared = await put_scores(client, w, [])
    assert cleared.status_code == 200
    assert cleared.json()["items"] == [] and cleared.json()["weighted_total"] is None
    after_clear = await client.get(scores_path(w), headers=w["headers"])
    assert after_clear.status_code == 200 and after_clear.json()["items"] == []

    # Score bounds, duplicates and non-integers.
    for scores in (
        [{"criterion_id": first, "score": 0}],
        [{"criterion_id": first, "score": 6}],
        [{"criterion_id": first, "score": "5"}],
        [{"criterion_id": first, "score": True}],
        [{"criterion_id": first, "score": 5}, {"criterion_id": first, "score": 4}],
        [{"criterion_id": str(uuid.uuid4()), "score": 5}],
        [{"criterion_id": first, "score": 5, "note": "x" * 2001}],
        [{"criterion_id": first, "score": 5, "interviewer_id": str(uuid.uuid4())}],
    ):
        response = await put_scores(client, w, scores)
        assert response.status_code == 422, (scores, response.text)

    # Cross-organization criterion: field-located 422, no write.
    other = await _create_org(client, w["actor"], name="Score Foreign Org", type_="employer")
    other_workspace = {**w, "org": other, "base": f"/api/v1/organizations/{other['id']}/jobs"}
    foreign_card = await make_card(client, other_workspace)
    response = await put_scores(
        client,
        w,
        [{"criterion_id": foreign_card["criteria"][0]["id"], "score": 5}],
    )
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["loc"] == [
        "body",
        "scores",
        0,
        "criterion_id",
    ]

    # A criterion from a soft-deleted template stops accepting new scores.
    live = await make_card(client, w, name="Temporary")
    live_criterion = live["criteria"][0]["id"]
    assert (await client.delete(f"{base(w)}/{live['id']}", headers=w["headers"])).status_code == 204
    assert (
        await put_scores(client, w, [{"criterion_id": live_criterion, "score": 3}])
    ).status_code == 422


async def test_scores_scope_cross_org_and_readonly(client, pipeline):
    w = pipeline
    card = await make_card(client, w)
    criterion = card["criteria"][0]["id"]
    payload = [{"criterion_id": criterion, "score": 4}]

    # An unassigned ordinary member sees nothing (404), not someone else's scores.
    plain = await member(client, w, role="member", email="sc-plain@example.com")
    assert (await client.get(scores_path(w), headers=plain["headers"])).status_code == 404
    assert (await put_scores(client, w, payload, headers=plain["headers"])).status_code == 404

    # Once assigned, the same member can read and score.
    assigned = await client.patch(
        f"{w['base']}/{w['job']['id']}/applications/{w['app']['id']}",
        headers=w["headers"],
        json={"assignee_id": plain["id"]},
    )
    assert assigned.status_code == 200, assigned.text
    assert (await client.get(scores_path(w), headers=plain["headers"])).status_code == 200
    assert (await put_scores(client, w, payload, headers=plain["headers"])).status_code == 200

    # Viewer and outsider: 403. Wrong ids: 404.
    viewer = await member(client, w, role="viewer", email="sc-viewer2@example.com")
    outsider = await _signup_verified(client, "sc-outsider2@example.com", "employer")
    for headers in (viewer["headers"], outsider["headers"]):
        assert (await client.get(scores_path(w), headers=headers)).status_code == 403

    other = await _create_org(client, w["actor"], name="Score Other Org", type_="employer")
    other_base = f"/api/v1/organizations/{other['id']}/jobs"
    other_job = await new_job(client, {**w, "org": other, "base": other_base})
    foreign_scores = f"{other_base}/{other_job['id']}/applications/{uuid.uuid4()}/scores"
    assert (await client.get(foreign_scores, headers=w["headers"])).status_code == 404
    # This application under another org's job path -> 404 (job lookup first).
    wrong_org = f"{other_base}/{other_job['id']}/applications/{w['app']['id']}/scores"
    assert (await client.get(wrong_org, headers=w["headers"])).status_code == 404
    # Unknown application under this job -> 404.
    unknown = f"{w['base']}/{w['job']['id']}/applications/{uuid.uuid4()}/scores"
    assert (await client.get(unknown, headers=w["headers"])).status_code == 404
    # Unknown scorecard id under this org -> 404.
    assert (await client.get(f"{base(w)}/{uuid.uuid4()}", headers=w["headers"])).status_code == 404

    # Terminal application and closed job are read-only for writes.
    rejected = await move(client, w, "rejected", rejected_reason="other", rejection_detail="x")
    assert rejected.status_code == 200, rejected.text
    assert (await put_scores(client, w, payload)).status_code == 409
    assert (await client.get(scores_path(w), headers=w["headers"])).status_code == 200

    # A second applicant lets us test the closed-job guard while the first
    # application stays terminal.
    candidate = await _signup_verified(client, "sc-second@example.com", "jobseeker")
    second_app = await apply(client, {**w, "candidate": candidate})
    second_scores = f"{w['base']}/{w['job']['id']}/applications/{second_app['id']}/scores"
    assert (
        await client.put(
            second_scores,
            headers=w["headers"],
            json={"scores": [{"criterion_id": criterion, "score": 5}]},
        )
    ).status_code == 200
    await action(client, w, w["job"], "close")
    closed = await client.put(
        second_scores,
        headers=w["headers"],
        json={"scores": [{"criterion_id": criterion, "score": 3}]},
    )
    assert closed.status_code == 409
    assert closed.json()["error"]["code"] == "PIPELINE_READ_ONLY"


async def test_compare_projection_scope_and_blind_safety(client, pipeline):
    w = pipeline
    card = await make_card(client, w)
    first, second = (criterion["id"] for criterion in card["criteria"])

    candidate = await _signup_verified(client, "sc-compare@example.com", "jobseeker")
    second_app = await apply(client, {**w, "candidate": candidate})

    assert (await put_scores(client, w, [{"criterion_id": first, "score": 5}])).status_code == 200
    assert (
        await put_scores(
            client,
            w,
            [{"criterion_id": first, "score": 4}, {"criterion_id": second, "score": 2}],
            headers=None,
        )
    ).status_code == 200
    # Score the second application as a different interviewer so averages differ.
    other_scorer = await member(client, w, role="member", email="sc-scorer@example.com")
    me = (await client.get("/api/v1/users/me", headers=other_scorer["headers"])).json()
    assigned = await client.patch(
        f"{w['base']}/{w['job']['id']}/applications/{second_app['id']}",
        headers=w["headers"],
        json={"assignee_id": me["id"]},
    )
    assert assigned.status_code == 200, assigned.text
    assert (
        await client.put(
            f"{w['base']}/{w['job']['id']}/applications/{second_app['id']}/scores",
            headers=other_scorer["headers"],
            json={"scores": [{"criterion_id": first, "score": 2}]},
        )
    ).status_code == 200

    too_few = await client.get(
        compare_path(w) + f"?application_ids={w['app']['id']}", headers=w["headers"]
    )
    assert too_few.status_code == 422

    query = f"?application_ids={w['app']['id']}&application_ids={second_app['id']}"
    body = (await client.get(compare_path(w) + query, headers=w["headers"])).json()
    assert body["job_id"] == w["job"]["id"] and body["job_title"] == w["job"]["title"]
    assert [c["criterion_id"] for c in body["criteria"]] == [first, second]
    assert len(body["items"]) == 2
    mine, theirs = body["items"]
    assert mine["application_id"] == w["app"]["id"]
    assert mine["label"] and not mine["is_blind"]
    assert isinstance(mine["skills"], list) and "profile" not in mine
    assert mine["salary_expectation"] == "1400000.50" or mine["salary_expectation"] is None
    for item in body["items"]:
        for key in ("applicant_id", "profile_snapshot", "job_snapshot", "cover_note"):
            assert key not in item
    cells = {cell["criterion_id"]: cell for cell in theirs["scores"]}
    assert cells[first]["average"] == 2 and cells[first]["scored_count"] == 1

    # Unknown / foreign application ids -> 404, no existence oracle.
    assert (
        await client.get(
            compare_path(w) + f"?application_ids={w['app']['id']}&application_ids={uuid.uuid4()}",
            headers=w["headers"],
        )
    ).status_code == 404
    other = await _create_org(client, w["actor"], name="Compare Other", type_="employer")
    other_base = f"/api/v1/organizations/{other['id']}/jobs"
    other_job = await new_job(client, {**w, "org": other, "base": other_base})
    assert (
        await client.get(
            compare_path(w)
            + f"?application_ids={w['app']['id']}&application_ids={other_job['id']}",
            headers=w["headers"],
        )
    ).status_code in (404, 422)

    # Authorization: viewer 403, outsider 403, unassigned member 404.
    viewer = await member(client, w, role="viewer", email="sc-cmp-viewer@example.com")
    outsider = await _signup_verified(client, "sc-cmp-outsider@example.com", "employer")
    plain = await member(client, w, role="member", email="sc-cmp-plain@example.com")
    for headers, expected in (
        (viewer["headers"], 403),
        (outsider["headers"], 403),
        (plain["headers"], 404),
    ):
        assert (await client.get(compare_path(w) + query, headers=headers)).status_code == expected


async def test_compare_blind_rows_are_projected_safely(client, marketplace):
    w = marketplace
    # Enable blind review before a second application exists on a fresh job.
    job = await new_job(client, w, title="Blind role")
    await action(client, w, job, "publish")
    settings_url = f"{w['base']}/{job['id']}/review-settings"
    assert (
        await client.patch(settings_url, headers=w["headers"], json={"blind_review_enabled": True})
    ).status_code == 200
    blind_app = await apply(client, {**w, "job": job})
    second_candidate = await _signup_verified(client, "sc-blind2@example.com", "jobseeker")
    second = await apply(client, {**w, "job": job, "candidate": second_candidate})
    # `is_blind` is employer-internal; confirm it through the 7d projection.
    detail = await client.get(
        f"{w['base']}/{job['id']}/applications/{blind_app['id']}",
        headers=w["headers"],
    )
    assert detail.status_code == 200 and detail.json()["is_blind"] is True

    query = f"?application_ids={blind_app['id']}&application_ids={second['id']}"
    body = (
        await client.get(f"{w['base']}/{job['id']}/compare{query}", headers=w["headers"])
    ).json()
    for item in body["items"]:
        assert item["is_blind"] is True
        assert item["label"].startswith("Candidate ")
        assert item["skills"] is None and item["headline"] is None
        # Structured review data stays available, identity does not.
        assert item["stage"] == "applied"
        for key in ("profile", "applicant_id", "cover_note"):
            assert key not in item


async def test_rates_limits_and_openapi(client, pipeline, monkeypatch):
    w = pipeline
    for query in ("limit=101", "limit=0", "offset=-1", "q=" + "x" * 101):
        assert (await client.get(base(w) + "?" + query, headers=w["headers"])).status_code == 422
    assert (
        await client.get(
            compare_path(w) + f"?application_ids={w['app']['id']}", headers=w["headers"]
        )
    ).status_code == 422

    # Each limiter key is exercised in isolation: writes first (fresh key),
    # then reads, then the shared 7d applicant-write budget.
    monkeypatch.setattr(get_settings(), "SCORECARD_WRITE_LIMIT", 1)
    first_card = await client.post(base(w), headers=w["headers"], json=card_payload(name="First"))
    assert first_card.status_code == 201, first_card.text
    second = await client.post(base(w), headers=w["headers"], json=card_payload(name="Second"))
    assert second.status_code == 429

    monkeypatch.setattr(get_settings(), "SCORECARD_READ_LIMIT", 1)
    listed = await client.get(base(w), headers=w["headers"])
    assert listed.status_code == 200
    assert (await client.get(base(w), headers=w["headers"])).status_code == 429

    # Application score writes share the 7d applicant budget.
    monkeypatch.setattr(get_settings(), "APPLICANT_WRITE_LIMIT", 1)
    criterion = first_card.json()["criteria"][0]["id"]
    first = await put_scores(client, w, [{"criterion_id": criterion, "score": 3}])
    assert first.status_code == 200, first.text
    again = await put_scores(client, w, [{"criterion_id": criterion, "score": 4}])
    assert again.status_code == 429

    schema = create_app().openapi()
    operations = [
        operation
        for item in schema["paths"].values()
        for operation in item.values()
        if isinstance(operation, dict) and "scorecards" in operation.get("tags", [])
    ]
    assert len(operations) == 8
    assert all(
        all(str(code) in op["responses"] for code in (401, 403, 404, 413, 422, 429))
        for op in operations
    )


async def test_scorecard_requires_verified_active_hiring_account(client, pipeline, db_session):
    w = pipeline
    from app.models.organization import Organization
    from app.models.user import User

    org = await db_session.get(Organization, uuid.UUID(w["org"]["id"]))
    org.status = "suspended"
    await db_session.commit()
    assert (await client.get(base(w), headers=w["headers"])).status_code == 404

    org.status = "active"
    await db_session.commit()
    user = (
        await db_session.execute(select(User).where(User.id == uuid.UUID(w["user_id"])))
    ).scalar_one()
    user.email_verified_at = None
    await db_session.commit()
    assert (await client.get(base(w), headers=w["headers"])).status_code == 403
