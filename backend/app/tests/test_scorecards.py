"""7e contracts: real auth/tenant fixtures, private ratings and frozen job rubrics."""

import asyncio
import uuid
from datetime import UTC, datetime

import pytest
import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.core.config import get_settings
from app.main import create_app
from app.models.activity import ActivityEvent
from app.models.job_application import JobApplication
from app.models.organization import Organization, OrganizationMember
from app.models.scorecard import ApplicationScore, Scorecard, ScorecardCriterion
from app.models.user import User, UserRoleRow
from app.tests.conftest import TEST_DATABASE_URL, TestSessionFactory
from app.tests.test_applicant_pipeline import base, member, path, pipeline
from app.tests.test_funding_rounds import _create_org, _signup_verified
from app.tests.test_job_applications import apply
from app.tests.test_job_discovery import marketplace
from app.tests.test_jobs import action, jobs_workspace, new_job

__all__ = ["pipeline", "marketplace", "jobs_workspace"]


def cards(w):
    return f"/api/v1/organizations/{w['org']['id']}/scorecards"


def content(**changes):
    return {
        "name": "Engineering rubric",
        "criteria": [
            {
                "name": "Technical",
                "weight": 3,
                "anchors": ["Basic", "Developing", "Capable", "Strong", "Exceptional"],
            },
            {"name": "Communication", "weight": 1},
        ],
        **changes,
    }


async def template(client, w, **changes):
    response = await client.post(cards(w), headers=w["headers"], json=content(**changes))
    assert response.status_code == 201, response.text
    return response.json()


async def select_card(client, w, card, expect=200):
    response = await client.put(
        base(w) + "/scorecard", headers=w["headers"], json={"template_id": card["id"]}
    )
    assert response.status_code == expect, response.text
    return response.json()


async def put(client, w, scores, *, headers=None):
    return await client.put(
        path(w) + "/scores/me", headers=headers or w["headers"], json={"scores": scores}
    )


def rating(w, value=5, *, criterion=0, note=None):
    return {"criterion_id": w["rubric"]["criteria"][criterion]["id"], "score": value, "note": note}


@pytest_asyncio.fixture
async def rubric(client, pipeline):
    card = await template(client, pipeline)
    return {**pipeline, "template": card, "rubric": await select_card(client, pipeline, card)}


async def test_templates_crud_pagination_and_independent_copies(client, pipeline):
    w = pipeline
    first = await template(client, w, name=" Alpha rubric ")
    second = await template(client, w, name="Beta rubric")
    selected = await select_card(client, w, first)
    assert selected["id"] != first["id"] and selected["source_scorecard_id"] == first["id"]
    assert selected["job_id"] == w["job"]["id"] and selected["locked_at"] is None
    assert not {c["id"] for c in first["criteria"]} & {c["id"] for c in selected["criteria"]}
    assert (await select_card(client, w, first))["id"] == selected["id"]
    changed = await client.patch(
        cards(w) + "/" + first["id"],
        headers=w["headers"],
        json={"name": "Edited source", "criteria": [{"name": "New source criterion"}]},
    )
    assert changed.status_code == 200
    assert (await client.get(base(w) + "/scorecard", headers=w["headers"])).json()[
        "criteria"
    ] == selected["criteria"]
    page = await client.get(cards(w), headers=w["headers"], params={"limit": 1, "sort": "name"})
    assert page.json()["total"] == 2 and page.json()["has_more"]
    assert page.json()["items"][0]["id"] == second["id"]
    next_page = (
        await client.get(
            cards(w), headers=w["headers"], params={"limit": 1, "offset": 1, "sort": "name"}
        )
    ).json()
    assert next_page["items"][0]["id"] == first["id"] and not next_page["has_more"]
    assert (await client.get(cards(w), headers=w["headers"], params={"q": "NO MATCH"})).json()[
        "items"
    ] == []
    assert (await client.get(cards(w), headers=w["headers"], params={"kind": "jobs"})).json()[
        "total"
    ] == 1
    patch = await client.patch(
        cards(w) + "/" + selected["id"],
        headers=w["headers"],
        json={"criteria": [{"name": "Revised before scoring"}]},
    )
    assert patch.status_code == 200
    await select_card(client, w, second)
    assert (
        await client.get(cards(w) + "/" + selected["id"], headers=w["headers"])
    ).status_code == 404
    for _ in range(2):
        assert (
            await client.delete(cards(w) + "/" + first["id"], headers=w["headers"])
        ).status_code == 204
    assert (await client.get(cards(w) + "/" + first["id"], headers=w["headers"])).status_code == 404
    assert (await client.get(base(w) + "/scorecard", headers=w["headers"])).status_code == 200


async def test_own_scores_private_notes_exact_aggregates_and_permanent_lock(
    client, rubric, db_session
):
    w = rubric
    admin = await member(client, w, role="admin")
    own = await put(client, w, [rating(w, note="OWNER SECRET")])
    assert own.status_code == 200, own.text
    read = own.json()
    assert read["scorecard"]["locked_at"]
    assert read["evaluation"]["coverage_pct"] == "50.000"
    assert read["evaluation"]["weighted_mean"] == "5.000"
    assert read["evaluation"]["aggregates"][1] == {
        "criterion_id": w["rubric"]["criteria"][1]["id"],
        "rating_count": 0,
        "mean": None,
    }
    original = read["evaluation"]["own_scores"][0]
    repeated = await put(client, w, [rating(w, note="OWNER SECRET")])
    assert repeated.json()["evaluation"]["own_scores"][0] == original
    peer = await put(
        client,
        w,
        [rating(w, 1, note="ADMIN SECRET"), rating(w, 4, criterion=1)],
        headers=admin["headers"],
    )
    assert peer.status_code == 200 and "OWNER SECRET" not in peer.text
    assert peer.json()["evaluation"]["weighted_mean"] == "3.250"
    owner = await client.get(path(w) + "/scores", headers=w["headers"])
    assert "ADMIN SECRET" not in owner.text and "interviewer_id" not in owner.text
    assert owner.json()["evaluation"]["aggregates"][0]["rating_count"] == 2
    assert owner.json()["evaluation"]["rated_criteria"] == 2
    assert (await put(client, w, [])).json()["evaluation"]["weighted_mean"] == "1.750"
    assert (await put(client, w, [], headers=admin["headers"])).json()["evaluation"][
        "weighted_mean"
    ] is None
    assert (
        await client.patch(
            cards(w) + "/" + w["rubric"]["id"], headers=w["headers"], json={"name": "Rewrite"}
        )
    ).status_code == 409
    assert (
        await client.delete(cards(w) + "/" + w["rubric"]["id"], headers=w["headers"])
    ).status_code == 409
    another = await template(client, w, name="Another rubric")
    await select_card(client, w, another, expect=409)
    restored = await put(client, w, [rating(w, 2)])
    assert restored.json()["evaluation"]["own_scores"][0]["id"] == original["id"]
    # Replacements do not write application notes/stages or score text into audit.
    events = list(
        (
            await db_session.execute(
                select(ActivityEvent).where(
                    ActivityEvent.event_type == "application_scores_updated"
                )
            )
        ).scalars()
    )
    assert len(events) == 5
    assert all("SECRET" not in str(e.data) + e.summary for e in events)
    assert (await client.get(path(w), headers=w["headers"])).json()["stage"] == "applied"


async def test_missing_scorecard_and_empty_ratings_do_not_lock(client, pipeline):
    w = pipeline
    assert (await client.get(base(w) + "/scorecard", headers=w["headers"])).status_code == 404
    assert (await client.get(path(w) + "/scores", headers=w["headers"])).status_code == 404
    card = await template(client, w)
    selected = await select_card(client, w, card)
    response = await put(client, w, [])
    assert response.status_code == 200 and response.json()["scorecard"]["locked_at"] is None
    assert response.json()["evaluation"]["weighted_mean"] is None
    assert response.json()["evaluation"]["coverage_pct"] == "0.000"
    assert (
        await client.delete(cards(w) + "/" + selected["id"], headers=w["headers"])
    ).status_code == 204


@pytest.mark.parametrize(
    "payload",
    [
        {"name": " "},
        {"criteria": []},
        {"criteria": [{"name": "x"}] * 21},
        {"criteria": [{"name": "x"}, {"name": " X "}]},
        {"criteria": [{"name": "x", "weight": 0}]},
        {"criteria": [{"name": "x", "weight": 101}]},
        {"criteria": [{"name": "x", "weight": True}]},
        {"criteria": [{"name": "x", "anchors": [" "]}]},
        {"criteria": [{"name": "x", "anchors": ["a"] * 6}]},
        {"is_platform": True},
        {"org_id": str(uuid.uuid4())},
        {"job_id": str(uuid.uuid4())},
        {"id": str(uuid.uuid4())},
        {"locked_at": "2026-11-23T00:00:00Z"},
        {"deleted_at": None},
        {"source_scorecard_id": str(uuid.uuid4())},
        {"updated_at": "2026-11-23T00:00:00Z"},
        {"criteria": [{"name": "x", "id": str(uuid.uuid4())}]},
    ],
)
async def test_create_validation_and_mass_assignment(client, jobs_workspace, payload):
    w = jobs_workspace
    assert (
        await client.post(cards(w), headers=w["headers"], json=content(**payload))
    ).status_code == 422


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"name": None},
        {"criteria": None},
        {"criteria": []},
        {"name": " "},
        {"job_id": str(uuid.uuid4())},
        {"locked_at": None},
        {"is_platform": True},
        {"created_at": "2026-11-23"},
    ],
)
async def test_patch_validation(client, rubric, payload):
    assert (
        await client.patch(
            cards(rubric) + "/" + rubric["rubric"]["id"], headers=rubric["headers"], json=payload
        )
    ).status_code == 422


@pytest.mark.parametrize(
    "changes",
    [
        {"score": 0},
        {"score": 6},
        {"score": 2.5},
        {"score": True},
        {"score": "3"},
        {"note": "n" * 2001},
        {"interviewer_id": str(uuid.uuid4())},
        {"application_id": str(uuid.uuid4())},
        {"id": str(uuid.uuid4())},
        {"updated_at": "2026-11-23"},
    ],
)
async def test_rating_validation_and_mass_assignment(client, rubric, changes):
    assert (await put(client, rubric, [{**rating(rubric), **changes}])).status_code == 422
    assert (await client.get(base(rubric) + "/scorecard", headers=rubric["headers"])).json()[
        "locked_at"
    ] is None


async def test_duplicate_and_foreign_criteria_are_atomic(client, rubric):
    w = rubric
    assert (await put(client, w, [rating(w), rating(w)])).status_code == 422
    other = await template(client, w, name="Wrong rubric")
    for foreign in (
        other["criteria"][0]["id"],
        w["template"]["criteria"][0]["id"],
        str(uuid.uuid4()),
    ):
        result = await put(client, w, [rating(w), {"criterion_id": foreign, "score": 3}])
        assert result.status_code == 422
    assert (await client.get(path(w) + "/scores", headers=w["headers"])).json()["evaluation"][
        "own_scores"
    ] == []
    assert (await put(client, w, [rating(w)] * 21)).status_code == 422
    assert (
        await client.put(
            path(w) + "/scores/me",
            headers=w["headers"],
            json={"scores": [], "author_id": w["user_id"]},
        )
    ).status_code == 422


@pytest.mark.parametrize(
    "role,read,write", [("admin", 200, 200), ("member", 404, 404), ("viewer", 403, 403)]
)
async def test_roles_and_assigned_scope(client, rubric, role, read, write):
    w = rubric
    actor = await member(client, w, role=role)
    assert (await client.get(path(w) + "/scores", headers=actor["headers"])).status_code == read
    assert (await put(client, w, [rating(w)], headers=actor["headers"])).status_code == write
    assert (await client.post(cards(w), headers=actor["headers"], json=content())).status_code == (
        201 if role == "admin" else 403
    )
    if role == "member":
        assert (
            await client.patch(path(w), headers=w["headers"], json={"assignee_id": actor["id"]})
        ).status_code == 200
        assert (await put(client, w, [rating(w)], headers=actor["headers"])).status_code == 200
        assert (
            await client.put(
                base(w) + "/scorecard",
                headers=actor["headers"],
                json={"template_id": w["template"]["id"]},
            )
        ).status_code == 403
        assert (
            await client.patch(path(w), headers=w["headers"], json={"assignee_id": None})
        ).status_code == 200
        assert (await client.get(path(w) + "/scores", headers=actor["headers"])).status_code == 404


async def test_job_owner_can_score_without_assignment(client, rubric):
    w = rubric
    actor = await member(client, w)
    assert (
        await client.patch(base(w), headers=w["headers"], json={"owner_id": actor["id"]})
    ).status_code == 200
    assert (await put(client, w, [rating(w)], headers=actor["headers"])).status_code == 200


async def test_cross_tenant_job_template_criterion_and_application_references(client, rubric):
    w = rubric
    outsider = await _signup_verified(client, "score-outsider@example.com", "employer")
    org = await _create_org(client, outsider, name="Other company", type_="employer")
    other = {
        **w,
        "org": org,
        "headers": outsider["headers"],
        "base": f"/api/v1/organizations/{org['id']}/jobs",
    }
    other["job"] = await new_job(client, other)
    foreign = await template(client, other)
    await select_card(client, w, foreign, expect=404)
    assert (
        await put(client, w, [{"criterion_id": foreign["criteria"][0]["id"], "score": 3}])
    ).status_code == 422
    assert (
        await client.get(cards(w) + "/" + foreign["id"], headers=w["headers"])
    ).status_code == 404
    assert (
        await client.patch(
            cards(w) + "/" + foreign["id"], headers=w["headers"], json={"name": "attack"}
        )
    ).status_code == 404
    assert (
        await client.delete(cards(w) + "/" + foreign["id"], headers=w["headers"])
    ).status_code == 404
    assert (
        await client.put(
            base(other) + "/scorecard",
            headers=w["headers"],
            json={"template_id": w["template"]["id"]},
        )
    ).status_code in {403, 404}
    assert (
        await client.get(
            cards(w), headers=w["headers"], params={"kind": "jobs", "job_id": other["job"]["id"]}
        )
    ).status_code == 404
    substituted = f"{base(other)}/applications/{w['app']['id']}/scores"
    assert (await client.get(substituted, headers=other["headers"])).status_code == 404
    assert (
        await client.put(substituted + "/me", headers=other["headers"], json={"scores": []})
    ).status_code == 404
    assert (await client.get(cards(w), headers=outsider["headers"])).status_code in {403, 404}


async def test_all_endpoints_require_auth_and_candidate_is_not_reviewer(client, rubric):
    w = rubric
    routes = [
        ("GET", cards(w), None),
        ("POST", cards(w), content()),
        ("GET", cards(w) + "/" + w["template"]["id"], None),
        ("PATCH", cards(w) + "/" + w["template"]["id"], {"name": "changed"}),
        ("DELETE", cards(w) + "/" + w["template"]["id"], None),
        ("GET", base(w) + "/scorecard", None),
        ("PUT", base(w) + "/scorecard", {"template_id": w["template"]["id"]}),
        ("GET", path(w) + "/scores", None),
        ("PUT", path(w) + "/scores/me", {"scores": []}),
        (
            "GET",
            base(w)
            + "/compare?application_ids="
            + w["app"]["id"]
            + "&application_ids="
            + str(uuid.uuid4()),
            None,
        ),
    ]
    for method, url, payload in routes:
        assert (await client.request(method, url, json=payload)).status_code == 401
        assert (
            await client.request(method, url, headers=w["candidate"]["headers"], json=payload)
        ).status_code in {403, 404}


@pytest.mark.parametrize("state", ["closed", "archived", "withdrawn", "rejected", "hired"])
async def test_readonly_jobs_and_terminal_applications(client, rubric, db_session, state):
    w = rubric
    if state in {"closed", "archived"}:
        await action(client, w, w["job"], "close")
        if state == "archived":
            await action(client, w, w["job"], "archive")
        assert (
            await client.patch(
                cards(w) + "/" + w["rubric"]["id"], headers=w["headers"], json={"name": "change"}
            )
        ).status_code == 409
    else:
        row = await db_session.get(JobApplication, uuid.UUID(w["app"]["id"]))
        row.stage = state
        if state == "withdrawn":
            row.withdrawn_at = datetime.now(UTC)
        await db_session.commit()
    assert (await put(client, w, [rating(w)])).status_code == 409
    assert (await client.get(path(w) + "/scores", headers=w["headers"])).status_code == 200


async def test_compare_blind_projection_order_scope_and_peer_note_privacy(
    client, rubric, db_session
):
    w = rubric
    other_candidate = await _signup_verified(
        client, "comparison-candidate@example.com", "jobseeker"
    )
    second = await apply(
        client, {**w, "candidate": other_candidate}, cover_note="Secret identifying prose"
    )
    row = await db_session.get(JobApplication, uuid.UUID(second["id"]))
    row.is_blind = True
    await db_session.commit()
    await put(client, w, [rating(w, 4, note="PRIVATE OWNER")])
    admin = await member(client, w, role="admin")
    response = await client.get(
        base(w) + "/compare",
        headers=admin["headers"],
        params=[("application_ids", second["id"]), ("application_ids", w["app"]["id"])],
    )
    assert response.status_code == 200, response.text
    result = response.json()
    assert [item["applicant"]["id"] for item in result["items"]] == [second["id"], w["app"]["id"]]
    assert result["items"][0]["applicant"]["profile"] is None
    assert result["items"][0]["applicant"]["is_blind"]
    assert (
        other_candidate["email"] not in response.text and "Secret identifying" not in response.text
    )
    assert "PRIVATE OWNER" not in response.text
    assert result["items"][1]["evaluation"]["weighted_mean"] == "4.000"
    scoped = await member(client, w)
    await client.patch(path(w), headers=w["headers"], json={"assignee_id": scoped["id"]})
    assert (
        await client.get(
            base(w) + "/compare",
            headers=scoped["headers"],
            params=[("application_ids", second["id"]), ("application_ids", w["app"]["id"])],
        )
    ).status_code == 404
    assert (
        await client.get(
            base(w) + "/compare",
            headers=w["headers"],
            params=[("application_ids", w["app"]["id"])] * 2,
        )
    ).status_code == 422
    for length in (1, 6):
        assert (
            await client.get(
                base(w) + "/compare",
                headers=w["headers"],
                params=[("application_ids", str(uuid.uuid4())) for _ in range(length)],
            )
        ).status_code == 422


@pytest.mark.parametrize(
    "field,value",
    [
        ("limit", 101),
        ("limit", 0),
        ("offset", -1),
        ("sort", "salary"),
        ("kind", "platform"),
        ("q", "x" * 101),
    ],
)
async def test_bounded_lists(client, jobs_workspace, field, value):
    assert (
        await client.get(
            cards(jobs_workspace), headers=jobs_workspace["headers"], params={field: value}
        )
    ).status_code == 422


@pytest.mark.parametrize("change", ["global_role", "membership", "email", "organization"])
async def test_revoked_hiring_access(client, rubric, db_session, change):
    w = rubric
    if change == "global_role":
        row = (
            await db_session.execute(
                select(UserRoleRow).where(
                    UserRoleRow.user_id == uuid.UUID(w["user_id"]), UserRoleRow.role == "employer"
                )
            )
        ).scalar_one()
        row.revoked_at = datetime.now(UTC)
    elif change == "membership":
        row = (
            await db_session.execute(
                select(OrganizationMember).where(
                    OrganizationMember.user_id == uuid.UUID(w["user_id"]),
                    OrganizationMember.org_id == uuid.UUID(w["org"]["id"]),
                )
            )
        ).scalar_one()
        row.status = "inactive"
    elif change == "email":
        row = await db_session.get(User, uuid.UUID(w["user_id"]))
        row.email_verified_at = None
    else:
        row = await db_session.get(Organization, uuid.UUID(w["org"]["id"]))
        row.status = "suspended"
    await db_session.commit()
    assert (await client.get(path(w) + "/scores", headers=w["headers"])).status_code in {403, 404}
    assert (await put(client, w, [rating(w)])).status_code in {403, 404}


async def test_rate_body_limits_and_openapi(client, rubric, monkeypatch):
    w = rubric
    monkeypatch.setattr(get_settings(), "APPLICANT_WRITE_LIMIT", 1)
    from app.services.rate_limiter import rate_limiter

    rate_limiter.reset()
    assert (await put(client, w, [])).status_code == 200
    assert (await put(client, w, [])).status_code == 429
    monkeypatch.setattr(get_settings(), "APPLICANT_READ_LIMIT", 1)
    rate_limiter.reset()
    assert (await client.get(cards(w), headers=w["headers"])).status_code == 200
    assert (await client.get(cards(w), headers=w["headers"])).status_code == 429
    oversized = await client.post(
        cards(w),
        headers={**w["headers"], "Content-Type": "application/json"},
        content=b"{" + b" " * 65536 + b"}",
    )
    assert oversized.status_code == 413
    operations = [
        operation
        for path_ in create_app().openapi()["paths"].values()
        for operation in path_.values()
        if isinstance(operation, dict) and "scorecards" in operation.get("tags", [])
    ]
    assert len(operations) == 10
    assert all(
        "401" in operation["responses"] and "422" in operation["responses"]
        for operation in operations
    )


async def test_database_rating_and_live_job_uniqueness_constraints(client, rubric, db_session):
    w = rubric
    bad = ApplicationScore(
        application_id=uuid.UUID(w["app"]["id"]),
        criterion_id=uuid.UUID(w["rubric"]["criteria"][0]["id"]),
        interviewer_id=uuid.UUID(w["user_id"]),
        score=6,
    )
    db_session.add(bad)
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()
    db_session.add(
        Scorecard(
            org_id=uuid.UUID(w["org"]["id"]), job_id=uuid.UUID(w["job"]["id"]), name="Duplicate"
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()
    criterion = await db_session.get(
        ScorecardCriterion, uuid.UUID(w["rubric"]["criteria"][0]["id"])
    )
    criterion.weight = 0
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()


@pytest.mark.skipif(not TEST_DATABASE_URL.startswith("postgresql"), reason="PostgreSQL row locks")
async def test_postgres_concurrent_own_replacements_and_freeze(client, rubric, db_session):
    w = rubric
    responses = await asyncio.gather(put(client, w, [rating(w, 1)]), put(client, w, [rating(w, 5)]))
    assert all(response.status_code == 200 for response in responses)
    total = (
        await db_session.execute(select(func.count()).select_from(ApplicationScore))
    ).scalar_one()
    assert total == 1
    assert (await client.get(base(w) + "/scorecard", headers=w["headers"])).json()["locked_at"]


@pytest.mark.skipif(not TEST_DATABASE_URL.startswith("postgresql"), reason="PostgreSQL row locks")
async def test_postgres_first_rating_serializes_with_rubric_edit(client, rubric):
    w = rubric
    # A locked request waiting on a job/rubric must re-check the current permanent lock.
    async with TestSessionFactory() as db:
        await db.execute(
            select(Scorecard).where(Scorecard.id == uuid.UUID(w["rubric"]["id"])).with_for_update()
        )
        task = asyncio.create_task(
            client.patch(
                cards(w) + "/" + w["rubric"]["id"],
                headers=w["headers"],
                json={"name": "Rewrite while waiting"},
            )
        )
        await asyncio.sleep(0.05)
        row = await db.get(Scorecard, uuid.UUID(w["rubric"]["id"]))
        row.locked_at = datetime.now(UTC)
        await db.commit()
        result = await task
    assert result.status_code == 409


@pytest.mark.parametrize("held_roles", [("startup",), ("employer",), ("startup", "employer")])
async def test_startup_organizations_accept_compatible_single_or_multiple_roles(
    client, rubric, db_session, held_roles
):
    w = rubric
    org = await db_session.get(Organization, uuid.UUID(w["org"]["id"]))
    org.type = "startup"
    current = (
        await db_session.execute(
            select(UserRoleRow).where(
                UserRoleRow.user_id == uuid.UUID(w["user_id"]), UserRoleRow.role == "employer"
            )
        )
    ).scalar_one()
    if "employer" not in held_roles:
        current.revoked_at = datetime.now(UTC)
    if "startup" in held_roles:
        db_session.add(
            UserRoleRow(user_id=uuid.UUID(w["user_id"]), role="startup", is_primary=False)
        )
    await db_session.commit()
    assert (await client.get(cards(w), headers=w["headers"])).status_code == 200
    assert (await put(client, w, [rating(w)])).status_code == 200
    assert (await client.get(path(w) + "/scores", headers=w["headers"])).status_code == 200


async def test_deleted_applications_are_not_scoreable_or_comparable(client, rubric, db_session):
    w = rubric
    row = await db_session.get(JobApplication, uuid.UUID(w["app"]["id"]))
    row.deleted_at = datetime.now(UTC)
    await db_session.commit()
    assert (await put(client, w, [rating(w)])).status_code == 404
    assert (await client.get(path(w) + "/scores", headers=w["headers"])).status_code == 404
    assert (
        await client.get(
            base(w) + "/compare",
            headers=w["headers"],
            params=[("application_ids", w["app"]["id"]), ("application_ids", str(uuid.uuid4()))],
        )
    ).status_code == 404


async def test_blind_scoring_does_not_reveal_or_change_submitted_application(
    client, rubric, db_session
):
    w = rubric
    row = await db_session.get(JobApplication, uuid.UUID(w["app"]["id"]))
    row.is_blind = True
    await db_session.commit()
    assert (await put(client, w, [rating(w)])).status_code == 200
    visible = (await client.get(path(w), headers=w["headers"])).json()
    assert visible["is_blind"] and visible["profile"] is None and visible["stage"] == "applied"
    own = await client.get(
        f"/api/v1/applications/{w['app']['id']}", headers=w["candidate"]["headers"]
    )
    assert (
        own.status_code == 200 and "own_scores" not in own.text and "weighted_mean" not in own.text
    )


async def test_paused_job_remains_scoreable_and_template_archival_preserves_rubric(client, rubric):
    w = rubric
    await action(client, w, w["job"], "pause")
    assert (
        await client.delete(cards(w) + "/" + w["template"]["id"], headers=w["headers"])
    ).status_code == 204
    assert (await put(client, w, [rating(w)])).status_code == 200
    assert (await client.get(base(w) + "/scorecard", headers=w["headers"])).json()["criteria"] == w[
        "rubric"
    ]["criteria"]
