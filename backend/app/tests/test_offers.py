"""Step 7g job offers: lifecycle, plan rules (D1-D5, D10, D11) and security.

Reuses the 7a/7c/7d fixtures (jobs_workspace -> marketplace -> pipeline,
``member``, ``move``, ``apply``) — no parallel fixture system.
"""

import uuid
from datetime import date, timedelta

from sqlalchemy import select

from app.models.activity import ActivityEvent
from app.services import offer_service
from app.tests.test_applicant_pipeline import member, move, pipeline
from app.tests.test_files import file_env, uploaded
from app.tests.test_funding_rounds import _create_org, _signup_verified
from app.tests.test_job_applications import apply
from app.tests.test_job_discovery import hdr, marketplace
from app.tests.test_jobs import action, jobs_workspace, new_job

__all__ = ["pipeline", "marketplace", "jobs_workspace", "file_env"]

LIVE = {"draft", "sent", "countered"}


def offers_path(w):
    return (
        f"/api/v1/organizations/{w['org']['id']}/jobs/{w['job']['id']}"
        f"/applications/{w['app']['id']}/offers"
    )


def offer_url(offer_id, suffix=""):
    return f"/api/v1/offers/{offer_id}{suffix}"


def defaults(**overrides):
    return {
        "title": "Senior Backend Engineer",
        "base_salary": "1800000.00",
        "currency": "INR",
        "start_date": "2027-02-01",
        "expires_on": str(date.today() + timedelta(days=14)),
        **overrides,
    }


async def create_offer(client, w, expect=201, **overrides):
    response = await client.post(
        offers_path(w), headers=w["headers"], json=defaults(**overrides)
    )
    assert response.status_code == expect, response.text
    return response.json()


async def withdraw_live(client, w):
    page = (
        await client.get(
            f"/api/v1/organizations/{w['org']['id']}/offers", headers=w["headers"]
        )
    ).json()
    for row in page["items"]:
        if row["status"] in LIVE:
            response = await client.post(
                offer_url(row["id"], "/withdraw"), headers=w["headers"]
            )
            assert response.status_code == 200, response.text


async def stage_of(client, w, headers=None):
    row = (
        await client.get(
            f"/api/v1/applications/{w['app']['id']}", headers=headers or hdr(w)
        )
    ).json()
    return row["stage"]


async def offer_events(db_session, entity_id):
    return list(
        (
            await db_session.execute(
                select(ActivityEvent).where(
                    ActivityEvent.entity_type == "job_offer",
                    ActivityEvent.entity_id == uuid.UUID(str(entity_id)),
                )
            )
        )
        .scalars()
        .all()
    )


async def test_draft_send_accept_lifecycle(client, pipeline, db_session):
    w = pipeline
    offer = await create_offer(client, w)
    assert offer["status"] == "draft"
    assert offer["application_id"] == w["app"]["id"]
    assert offer["job_id"] == w["job"]["id"]
    assert offer["owner_id"] == w["user_id"]  # D1: defaults to the creator
    assert offer["currency"] == "INR" and offer["responded_at"] is None

    patched = await client.patch(
        offer_url(offer["id"]),
        headers=w["headers"],
        json={"base_salary": "2000000.00", "bonus_amount": "100000.00"},
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["base_salary"] == "2000000.00"

    page = (
        await client.get(
            f"/api/v1/organizations/{w['org']['id']}/offers", headers=w["headers"]
        )
    ).json()
    assert page["total"] == 1 and page["items"][0]["id"] == offer["id"]

    sent = await client.post(offer_url(offer["id"], "/send"), headers=w["headers"])
    assert sent.status_code == 200, sent.text
    assert sent.json()["status"] == "sent"
    # D11: send moves the application to ``offered``.
    assert await stage_of(client, w) == "offered"

    cand_page = (
        await client.get(
            f"/api/v1/applications/{w['app']['id']}/offers", headers=hdr(w)
        )
    ).json()
    assert cand_page["total"] == 1 and cand_page["items"][0]["status"] == "sent"
    single = (
        await client.get(
            f"/api/v1/applications/{w['app']['id']}/offers/{offer['id']}",
            headers=hdr(w),
        )
    ).json()
    assert single["id"] == offer["id"]

    accepted = await client.post(
        offer_url(offer["id"], "/accept"), headers=hdr(w)
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["status"] == "accepted"
    assert accepted.json()["responded_at"]
    # D11: accept leaves the stage on ``offered``.
    assert await stage_of(client, w) == "offered"

    detail = await client.get(offer_url(offer["id"]), headers=w["headers"])
    assert detail.status_code == 200 and detail.json()["status"] == "accepted"

    events = await offer_events(db_session, offer["id"])
    assert sorted(event.event_type for event in events) == [
        "offer_accepted",
        "offer_created",
        "offer_sent",
        "offer_updated",
    ]


async def test_patch_only_draft_extend_expiry_on_sent(client, pipeline):
    w = pipeline
    offer = await create_offer(client, w, title="Draft Title")
    renamed = await client.patch(
        offer_url(offer["id"]), headers=w["headers"], json={"title": "Renamed"}
    )
    assert renamed.status_code == 200 and renamed.json()["title"] == "Renamed"

    await client.post(offer_url(offer["id"], "/send"), headers=w["headers"])
    frozen = await client.patch(
        offer_url(offer["id"]), headers=w["headers"], json={"title": "Stolen"}
    )
    assert frozen.status_code == 409, frozen.text
    assert frozen.json()["error"]["code"] == "OFFER_FROZEN"
    # D3: extend-expiry is the single exception after send.
    new_expiry = str(date.today() + timedelta(days=30))
    extended = await client.patch(
        offer_url(offer["id"]), headers=w["headers"], json={"expires_on": new_expiry}
    )
    assert extended.status_code == 200, extended.text
    assert extended.json()["expires_on"] == new_expiry

    await client.post(offer_url(offer["id"], "/accept"), headers=hdr(w))
    terminal = await client.patch(
        offer_url(offer["id"]), headers=w["headers"], json={"expires_on": new_expiry}
    )
    assert terminal.status_code == 409, terminal.text
    assert terminal.json()["error"]["code"] == "OFFER_NOT_EDITABLE"
    # An empty patch is a no-op, not an error.
    noop = await client.patch(offer_url(offer["id"]), headers=w["headers"], json={})
    assert noop.status_code == 200 and noop.json()["status"] == "accepted"


async def test_one_live_offer_per_application(client, pipeline):
    w = pipeline
    first = await create_offer(client, w)
    clash = await client.post(offers_path(w), headers=w["headers"], json=defaults())
    assert clash.status_code == 409, clash.text
    assert clash.json()["error"]["code"] == "OFFER_EXISTS"

    withdrawn = await client.post(
        offer_url(first["id"], "/withdraw"), headers=w["headers"]
    )
    assert withdrawn.status_code == 200
    second = await create_offer(client, w)
    assert second["id"] != first["id"]
    page = (
        await client.get(
            f"/api/v1/organizations/{w['org']['id']}/offers", headers=w["headers"]
        )
    ).json()
    # History (withdrawn) stays visible; only live rows collide.
    assert page["total"] == 2
    assert {row["status"] for row in page["items"]} == {"draft", "withdrawn"}


async def test_withdraw_reverts_offered_stage(client, pipeline, db_session):
    w = pipeline
    offer = await create_offer(client, w)
    assert await stage_of(client, w) == "applied"
    await client.post(offer_url(offer["id"], "/send"), headers=w["headers"])
    assert await stage_of(client, w) == "offered"

    withdrawn = await client.post(
        offer_url(offer["id"], "/withdraw"), headers=w["headers"]
    )
    assert withdrawn.status_code == 200, withdrawn.text
    assert withdrawn.json()["status"] == "withdrawn"
    # D11: withdraw reverts ``offered`` -> ``interview``.
    assert await stage_of(client, w) == "interview"
    history = (
        await client.get(
            f"{w['base']}/{w['job']['id']}/applications/{w['app']['id']}/stage-events",
            headers=w["headers"],
        )
    ).json()
    moves = [item["to_stage"] for item in history["items"]]
    assert "offered" in moves and "interview" in moves

    again = await client.post(
        offer_url(offer["id"], "/withdraw"), headers=w["headers"]
    )
    assert again.status_code == 409, again.text
    # The live slot is free again.
    assert (await create_offer(client, w))["status"] == "draft"


async def test_decline_requires_seeded_reason(client, pipeline, db_session):
    w = pipeline
    await offer_service.seed_decline_reasons(db_session)
    reasons = (
        await client.get("/api/v1/offer-decline-reasons", headers=hdr(w))
    ).json()
    assert len(reasons) == 5
    assert {row["code"] for row in reasons} >= {"compensation", "other"}

    offer = await create_offer(client, w)
    await client.post(offer_url(offer["id"], "/send"), headers=w["headers"])

    unknown = await client.post(
        offer_url(offer["id"], "/decline"),
        headers=hdr(w),
        json={"decline_reason_id": str(uuid.uuid4())},
    )
    assert unknown.status_code == 422, unknown.text
    details = unknown.json()["error"]["details"]
    assert any(detail.get("loc") == ["body", "decline_reason_id"] for detail in details)

    no_note = await client.post(
        offer_url(offer["id"], "/decline"),
        headers=hdr(w),
        json={"decline_reason_id": reasons[0]["id"], "note": "free text"},
    )
    assert no_note.status_code == 422, no_note.text

    declined = await client.post(
        offer_url(offer["id"], "/decline"),
        headers=hdr(w),
        json={"decline_reason_id": reasons[0]["id"]},
    )
    assert declined.status_code == 200, declined.text
    assert declined.json()["status"] == "declined"
    assert declined.json()["decline_reason_id"] == reasons[0]["id"]
    assert declined.json()["responded_at"]
    # D11: decline does not move the stage.
    assert await stage_of(client, w) == "offered"

    repeat = await client.post(
        offer_url(offer["id"], "/decline"),
        headers=hdr(w),
        json={"decline_reason_id": reasons[0]["id"]},
    )
    assert repeat.status_code == 409, repeat.text
    late = await client.post(offer_url(offer["id"], "/accept"), headers=hdr(w))
    assert late.status_code == 409, late.text


async def test_lazy_expiry_writes_one_audit_row(client, pipeline, db_session):
    w = pipeline
    past = str(date.today() - timedelta(days=1))
    offer = await create_offer(client, w, expires_on=past)
    # Drafts never expire lazily — only sent/countered do.
    assert (await client.get(offer_url(offer["id"]), headers=w["headers"])).json()[
        "status"
    ] == "draft"
    await client.post(offer_url(offer["id"], "/send"), headers=w["headers"])

    first_read = await client.get(offer_url(offer["id"]), headers=w["headers"])
    assert first_read.json()["status"] == "expired"
    second_read = await client.get(offer_url(offer["id"]), headers=w["headers"])
    assert second_read.json()["status"] == "expired"

    expiries = [
        event
        for event in await offer_events(db_session, offer["id"])
        if event.event_type == "offer_expired"
    ]
    assert len(expiries) == 1, [event.summary for event in expiries]

    late = await client.post(offer_url(offer["id"], "/accept"), headers=hdr(w))
    assert late.status_code == 409, late.text


async def test_auth_roles_and_org_isolation(client, pipeline):
    w = pipeline
    offer = await create_offer(client, w)

    # 401 everywhere without a token.
    for method, path, body in [
        ("get", f"/api/v1/organizations/{w['org']['id']}/offers", None),
        ("post", offers_path(w), defaults()),
        ("get", offer_url(offer["id"]), None),
        ("post", offer_url(offer["id"], "/send"), None),
        ("get", f"/api/v1/applications/{w['app']['id']}/offers", None),
        ("get", "/api/v1/offer-decline-reasons", None),
    ]:
        response = await client.request(method, path, json=body)
        assert response.status_code == 401, response.text

    # Ordinary member: reads yes, writes no (plan D1).
    member_actor = await member(client, w, role="member")
    assert (
        await client.post(
            offers_path(w), headers=member_actor["headers"], json=defaults()
        )
    ).status_code == 403
    assert (
        await client.post(
            offer_url(offer["id"], "/send"), headers=member_actor["headers"]
        )
    ).status_code == 403
    assert (
        await client.get(
            f"/api/v1/organizations/{w['org']['id']}/offers",
            headers=member_actor["headers"],
        )
    ).status_code == 200
    assert (
        await client.get(offer_url(offer["id"]), headers=member_actor["headers"])
    ).status_code == 200

    # Viewers are outside the read set entirely.
    viewer = await member(client, w, role="viewer")
    assert (
        await client.get(
            f"/api/v1/organizations/{w['org']['id']}/offers",
            headers=viewer["headers"],
        )
    ).status_code == 403
    assert (
        await client.get(offer_url(offer["id"]), headers=viewer["headers"])
    ).status_code == 403

    # Wrong global role on the org path.
    seeker = await _signup_verified(client, "offer-seeker@example.com", "jobseeker")
    assert (
        await client.get(
            f"/api/v1/organizations/{w['org']['id']}/offers",
            headers=seeker["headers"],
        )
    ).status_code == 403
    # Employers are not candidates: the candidate routes are 403 for them.
    assert (
        await client.get(
            f"/api/v1/applications/{w['app']['id']}/offers", headers=w["headers"]
        )
    ).status_code == 403

    # Another organization sees nothing of this offer: 404, no oracle.
    outsider = await _signup_verified(client, "offer-outsider@example.com", "employer")
    await _create_org(client, outsider, type_="employer")
    for method, path, body in [
        ("get", offer_url(offer["id"]), None),
        ("patch", offer_url(offer["id"]), {"title": "Stolen"}),
        ("post", offer_url(offer["id"], "/send"), None),
        ("post", offer_url(offer["id"], "/withdraw"), None),
    ]:
        response = await client.request(
            method, path, headers=outsider["headers"], json=body
        )
        assert response.status_code == 404, response.text
    # ...and the org path names the membership failure (established contract).
    assert (
        await client.get(
            f"/api/v1/organizations/{w['org']['id']}/offers",
            headers=outsider["headers"],
        )
    ).status_code == 403

    # Another candidate cannot read this application's offers.
    other = await _signup_verified(client, "offer-other@example.com", "jobseeker")
    assert (
        await client.get(
            f"/api/v1/applications/{w['app']['id']}/offers",
            headers=other["headers"],
        )
    ).status_code == 404
    assert (
        await client.post(
            offer_url(offer["id"], "/accept"), headers=other["headers"]
        )
    ).status_code == 404


async def test_cross_org_references_are_field_errors(client, pipeline):
    w = pipeline
    candidate_id = (
        await client.get("/api/v1/users/me", headers=hdr(w))
    ).json()["id"]

    # Payload references must be active members of THIS organization.
    for field, value in [
        ("owner_id", candidate_id),
        ("document_file_id", str(uuid.uuid4())),
    ]:
        response = await client.post(
            offers_path(w), headers=w["headers"], json=defaults(**{field: value})
        )
        assert response.status_code == 422, response.text
        details = response.json()["error"]["details"]
        assert any(detail.get("loc") == ["body", field] for detail in details)

    # A viewer may be a member but can never own an offer (7a rule).
    viewer = await member(client, w, role="viewer")
    viewer_id = viewer["id"]
    response = await client.post(
        offers_path(w), headers=w["headers"], json=defaults(owner_id=viewer_id)
    )
    assert response.status_code == 422, response.text
    assert any(
        detail.get("loc") == ["body", "owner_id"]
        for detail in response.json()["error"]["details"]
    )

    # A plain member is a valid owner (D1: any active non-viewer member).
    plain = await member(client, w, role="member")
    offer = await create_offer(client, w, owner_id=plain["id"])
    assert offer["owner_id"] == plain["id"]
    patch = await client.patch(
        offer_url(offer["id"]),
        headers=w["headers"],
        json={"owner_id": candidate_id},
    )
    assert patch.status_code == 422, patch.text
    assert any(
        detail.get("loc") == ["body", "owner_id"]
        for detail in patch.json()["error"]["details"]
    )


async def test_mass_assignment_is_rejected(client, pipeline):
    w = pipeline
    # Server-owned fields on create.
    response = await client.post(
        offers_path(w),
        headers=w["headers"],
        json=defaults(
            status="accepted",
            id=str(uuid.uuid4()),
            application_id=str(uuid.uuid4()),
            responded_at="2026-01-01T00:00:00Z",
            decline_reason_id=str(uuid.uuid4()),
            created_at="2026-01-01T00:00:00Z",
        ),
    )
    assert response.status_code == 422, response.text
    locs = [detail.get("loc") for detail in response.json()["error"]["details"]]
    assert ["body", "status"] in locs

    offer = await create_offer(client, w)
    # ``status`` never moves through PATCH — send does.
    response = await client.patch(
        offer_url(offer["id"]), headers=w["headers"], json={"status": "accepted"}
    )
    assert response.status_code == 422, response.text
    # ...and not through the candidate routes either.
    await client.post(offer_url(offer["id"], "/send"), headers=w["headers"])
    response = await client.post(
        offer_url(offer["id"], "/accept"),
        headers=hdr(w),
        json={"status": "declined"},
    )
    assert response.status_code == 422, response.text


async def test_validation_errors(client, pipeline):
    w = pipeline
    bad_payloads = [
        defaults(base_salary="-1"),
        defaults(base_salary="1234567890123.456"),
        defaults(equity_pct="101"),
        defaults(currency="RUPEE"),
        defaults(title="   "),
        defaults(start_date="not-a-date"),
    ]
    for payload in bad_payloads:
        response = await client.post(offers_path(w), headers=w["headers"], json=payload)
        assert response.status_code == 422, (payload, response.text)

    missing = {key: value for key, value in defaults().items() if key != "start_date"}
    response = await client.post(offers_path(w), headers=w["headers"], json=missing)
    assert response.status_code == 422, response.text

    # Currency is normalised to upper case (the pattern runs after).
    normalized = await client.post(
        offers_path(w), headers=w["headers"], json=defaults(currency="inr")
    )
    assert normalized.status_code == 201, normalized.text
    assert normalized.json()["currency"] == "INR"


async def test_closed_job_and_terminal_application_are_read_only(client, pipeline):
    w = pipeline
    # Terminal application first (the job is still open).
    assert (
        await move(client, w, "review", expected_stage="applied")
    ).status_code == 200
    rejected = await move(
        client, w, "rejected", "review",
        rejected_reason="other", rejection_detail="Role no longer open",
    )
    assert rejected.status_code == 200, rejected.text
    response = await client.post(offers_path(w), headers=w["headers"], json=defaults())
    assert response.status_code == 409, response.text
    assert response.json()["error"]["code"] == "APPLICATION_READ_ONLY"

    # Closed job: the pipeline (and therefore offer creation) is read-only.
    closed = await action(client, w, w["job"], "close")
    assert closed["status"] == "closed"
    response = await client.post(offers_path(w), headers=w["headers"], json=defaults())
    assert response.status_code == 409, response.text
    assert response.json()["error"]["code"] == "PIPELINE_READ_ONLY"


async def test_offer_letter_attach_download_and_detach(client, pipeline, file_env):
    storage, _ = file_env
    w = pipeline
    file_id = await uploaded(
        client, w["actor"], storage, org=w["org"], kind="document",
        name="offer-letter.pdf",
    )
    offer = await create_offer(client, w, document_file_id=file_id)
    assert offer["document_file_id"] == file_id

    # D8: the employer downloads through the generic Step 4 route.
    download = await client.post(
        f"/api/v1/files/{file_id}/download-url", headers=w["headers"], json={}
    )
    assert download.status_code == 200, download.text

    # Soft-deleting the file detaches it from the offer in the same
    # transaction (the file_service change for 7g/7h).
    deleted = await client.delete(f"/api/v1/files/{file_id}", headers=w["headers"])
    assert deleted.status_code == 204, deleted.text
    detail = await client.get(offer_url(offer["id"]), headers=w["headers"])
    assert detail.json()["document_file_id"] is None


async def test_candidate_scoping_across_applications(client, pipeline):
    w = pipeline
    offer = await create_offer(client, w)
    await client.post(offer_url(offer["id"], "/send"), headers=w["headers"])

    job2 = await new_job(client, w, title="Second Role")
    await action(client, w, job2, "publish")
    app2 = await apply(client, {**w, "job": job2})

    # My own second application sees no offers yet...
    empty = (
        await client.get(
            f"/api/v1/applications/{app2['id']}/offers", headers=hdr(w)
        )
    ).json()
    assert empty["total"] == 0
    # ...and the first application's offer is 404 under it.
    cross = await client.get(
        f"/api/v1/applications/{app2['id']}/offers/{offer['id']}", headers=hdr(w)
    )
    assert cross.status_code == 404, cross.text


async def test_offer_read_projects_display_fields(client, pipeline):
    """G1: job_title / company_name / candidate_name / owner_name everywhere."""
    w = pipeline
    offer = await create_offer(client, w)

    detail = (await client.get(offer_url(offer["id"]), headers=w["headers"])).json()
    assert detail["job_title"] == w["job"]["title"]
    assert detail["company_name"]
    assert detail["candidate_name"]
    assert detail["owner_name"]

    page = (
        await client.get(
            f"/api/v1/organizations/{w['org']['id']}/offers", headers=w["headers"]
        )
    ).json()
    row = next(r for r in page["items"] if r["id"] == offer["id"])
    assert row["job_title"] == w["job"]["title"]
    assert row["company_name"] and row["candidate_name"] and row["owner_name"]


async def test_blind_application_hides_candidate_name(client, pipeline):
    """G1: a masked (blind) application never leaks the candidate name."""
    w = pipeline
    job2 = await new_job(client, w, title="Blind Role")
    await action(client, w, job2, "publish")
    settings = await client.patch(
        f"{w['base']}/{job2['id']}/review-settings",
        headers=w["headers"],
        json={"blind_review_enabled": True},
    )
    assert settings.status_code == 200, settings.text
    app2 = await apply(client, {**w, "job": job2})
    created = await client.post(
        f"{w['base']}/{job2['id']}/applications/{app2['id']}/offers",
        headers=w["headers"],
        json=defaults(),
    )
    assert created.status_code == 201, created.text

    detail = (
        await client.get(offer_url(created.json()["id"]), headers=w["headers"])
    ).json()
    assert detail["candidate_name"] is None
    assert detail["job_title"] == "Blind Role"


async def test_mine_aggregate_and_draft_privacy(client, pipeline):
    """G2/G3/G4: /offers/mine spans applications; drafts stay hidden; the
    owning candidate can read the bare offer id once it is sent."""
    w = pipeline
    draft = await create_offer(client, w)

    # Draft: invisible on every candidate read path.
    per_app = (
        await client.get(
            f"/api/v1/applications/{w['app']['id']}/offers", headers=hdr(w)
        )
    ).json()
    assert per_app["total"] == 0
    assert (
        await client.get(offer_url(draft["id"]), headers=hdr(w))
    ).status_code == 404
    assert (await client.get("/api/v1/offers/mine", headers=hdr(w))).json()[
        "total"
    ] == 0

    sent = await client.post(offer_url(draft["id"], "/send"), headers=w["headers"])
    assert sent.status_code == 200, sent.text

    # Sent: visible on /mine and on the bare id (G4 ownership-first read).
    mine = (await client.get("/api/v1/offers/mine", headers=hdr(w))).json()
    assert mine["total"] == 1
    assert mine["items"][0]["id"] == draft["id"]
    assert mine["items"][0]["job_title"] and mine["items"][0]["company_name"]
    bare = await client.get(offer_url(draft["id"]), headers=hdr(w))
    assert bare.status_code == 200, bare.text

    # The aggregate spans a second application too.
    job2 = await new_job(client, w, title="Second Role")
    await action(client, w, job2, "publish")
    app2 = await apply(client, {**w, "job": job2})
    second = await client.post(
        f"{w['base']}/{job2['id']}/applications/{app2['id']}/offers",
        headers=w["headers"],
        json=defaults(),
    )
    assert second.status_code == 201, second.text
    await client.post(
        offer_url(second.json()["id"], "/send"), headers=w["headers"]
    )
    mine = (await client.get("/api/v1/offers/mine", headers=hdr(w))).json()
    assert mine["total"] == 2


async def test_mine_requires_seeker_and_scopes_to_self(client, pipeline):
    """G2: employer accounts are 403; another seeker sees an empty page."""
    w = pipeline
    offer = await create_offer(client, w)
    await client.post(offer_url(offer["id"], "/send"), headers=w["headers"])

    denied = await client.get("/api/v1/offers/mine", headers=w["headers"])
    assert denied.status_code == 403, denied.text

    other = await _signup_verified(client, "mine-other@example.com", "jobseeker")
    page = (await client.get("/api/v1/offers/mine", headers=other["headers"])).json()
    assert page["total"] == 0
