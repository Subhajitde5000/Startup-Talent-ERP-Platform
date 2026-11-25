"""Step 7h hires and onboarding: happy paths, plan rules (D6, D12-D14)
and security.

Reuses the 7a/7c/7d fixtures plus the 7g offer helpers — no parallel
fixture system.
"""

import uuid

from sqlalchemy import select

from app.models.activity import ActivityEvent
from app.tests.test_applicant_pipeline import member, pipeline
from app.tests.test_files import file_env, uploaded
from app.tests.test_funding_rounds import _create_org, _signup_verified
from app.tests.test_job_discovery import hdr, marketplace
from app.tests.test_jobs import jobs_workspace
from app.tests.test_offers import create_offer, offer_url

__all__ = ["pipeline", "marketplace", "jobs_workspace", "file_env"]


def hire_url(hire_id, suffix=""):
    return f"/api/v1/hires/{hire_id}{suffix}"


def hires_path(org_id):
    return f"/api/v1/organizations/{org_id}/hires"


def templates_path(org_id):
    return f"/api/v1/organizations/{org_id}/onboarding-templates"


async def accepted_offer(client, w, **offer_overrides):
    offer = await create_offer(client, w, **offer_overrides)
    sent = await client.post(offer_url(offer["id"], "/send"), headers=w["headers"])
    assert sent.status_code == 200, sent.text
    accepted = await client.post(
        offer_url(offer["id"], "/accept"), headers=hdr(w)
    )
    assert accepted.status_code == 200, accepted.text
    return offer


async def make_template(client, w, **overrides):
    payload = {
        "name": "Engineer onboarding",
        "items": [
            {
                "section": "Week 1",
                "title": "Laptop and accounts",
                "owner_role": "admin",
                "due_offset_days": 1,
            },
            {
                "section": "Week 1",
                "title": "Meet the team",
                "owner_role": "owner",
                "due_offset_days": 3,
            },
        ],
        **overrides,
    }
    response = await client.post(
        templates_path(w["org"]["id"]), headers=w["headers"], json=payload
    )
    assert response.status_code == 201, response.text
    return response.json()


async def make_hire(client, w, **hire_payload):
    offer = await accepted_offer(client, w)
    template = await make_template(client, w)
    response = await client.post(
        offer_url(offer["id"], "/hire"),
        headers=w["headers"],
        json={"template_id": template["id"], **hire_payload},
    )
    assert response.status_code == 201, response.text
    return response.json(), template, offer


async def test_hire_from_accepted_offer_with_template(client, pipeline, db_session):
    w = pipeline
    template = await make_template(client, w)
    assert template["is_platform"] is False  # D6: org rows are never platform
    assert [item["display_order"] for item in template["items"]] == [0, 1]

    # D12: department defaults from the job (set it on the job first).
    patched_job = await client.patch(
        f"{w['base']}/{w['job']['id']}",
        headers=w["headers"],
        json={"department": "engineering"},
    )
    assert patched_job.status_code == 200, patched_job.text

    offer = await accepted_offer(client, w)
    response = await client.post(
        offer_url(offer["id"], "/hire"),
        headers=w["headers"],
        json={"template_id": template["id"]},
    )
    assert response.status_code == 201, response.text
    hire = response.json()
    assert hire["status"] == "pending_onboarding"
    assert hire["application_id"] == w["app"]["id"]
    assert hire["offer_id"] == offer["id"]
    assert hire["org_id"] == w["org"]["id"]
    assert hire["user_id"] is not None
    assert hire["email"] == w["candidate"]["email"]
    assert hire["department"] == "engineering"
    # D12 defaults: start date from the offer, manager/owner = job owner.
    assert hire["start_date"] == "2027-02-01"
    assert hire["manager_id"] == w["user_id"] and hire["owner_id"] == w["user_id"]

    # D11: hire creation moves the application to ``hired``.
    app = (
        await client.get(f"/api/v1/applications/{w['app']['id']}", headers=hdr(w))
    ).json()
    assert app["stage"] == "hired"

    detail = await client.get(hire_url(hire["id"]), headers=w["headers"])
    assert detail.status_code == 200 and detail.json()["id"] == hire["id"]
    page = (await client.get(hires_path(w["org"]["id"]), headers=w["headers"])).json()
    assert page["total"] == 1 and page["items"][0]["id"] == hire["id"]

    # Checklist copied from the template; due dates = start_date + offset.
    items = (
        await client.get(hire_url(hire["id"], "/onboarding-items"), headers=w["headers"])
    ).json()
    assert items["total"] == 2
    assert [row["title"] for row in items["items"]] == [
        "Laptop and accounts",
        "Meet the team",
    ]
    assert items["items"][0]["due_on"] == "2027-02-02"
    assert items["items"][1]["due_on"] == "2027-02-04"
    assert items["items"][0]["owner_id"] is None
    assert items["items"][0]["status"] == "pending"

    # D12: one hire per application.
    duplicate = await client.post(
        offer_url(offer["id"], "/hire"), headers=w["headers"], json={}
    )
    assert duplicate.status_code == 409, duplicate.text
    assert duplicate.json()["error"]["code"] == "HIRE_EXISTS"

    # Lifecycle (D14 values) through PATCH.
    onboarding = await client.patch(
        hire_url(hire["id"]), headers=w["headers"], json={"status": "onboarding"}
    )
    assert onboarding.status_code == 200 and onboarding.json()["status"] == "onboarding"
    active = await client.patch(
        hire_url(hire["id"]), headers=w["headers"], json={"status": "active"}
    )
    assert active.status_code == 200 and active.json()["status"] == "active"
    backwards = await client.patch(
        hire_url(hire["id"]), headers=w["headers"], json={"status": "onboarding"}
    )
    assert backwards.status_code == 409, backwards.text
    assert backwards.json()["error"]["code"] == "HIRE_INVALID_STATE"

    # Filters.
    filtered = (
        await client.get(
            hires_path(w["org"]["id"]) + "?status=active", headers=w["headers"]
        )
    ).json()
    assert filtered["total"] == 1
    filtered = (
        await client.get(
            hires_path(w["org"]["id"]) + "?status=pending_onboarding",
            headers=w["headers"],
        )
    ).json()
    assert filtered["total"] == 0

    events = list(
        (
            await db_session.execute(
                select(ActivityEvent).where(
                    ActivityEvent.entity_type == "hire",
                    ActivityEvent.entity_id == uuid.UUID(hire["id"]),
                )
            )
        )
        .scalars()
        .all()
    )
    assert any(event.event_type == "hire_created" for event in events)


async def test_hire_requires_an_accepted_offer(client, pipeline):
    w = pipeline
    draft = await create_offer(client, w)
    response = await client.post(
        offer_url(draft["id"], "/hire"), headers=w["headers"], json={}
    )
    assert response.status_code == 409, response.text
    assert response.json()["error"]["code"] == "OFFER_NOT_ACCEPTED"

    await client.post(offer_url(draft["id"], "/send"), headers=w["headers"])
    response = await client.post(
        offer_url(draft["id"], "/hire"), headers=w["headers"], json={}
    )
    assert response.status_code == 409, response.text


async def test_hire_auth_roles_and_org_isolation(client, pipeline):
    w = pipeline
    hire, _, offer = await make_hire(client, w)

    # 401 without a token.
    for method, path, body in [
        ("get", hires_path(w["org"]["id"]), None),
        ("get", hire_url(hire["id"]), None),
        ("post", offer_url(offer["id"], "/hire"), {}),
        ("get", templates_path(w["org"]["id"]), None),
    ]:
        response = await client.request(method, path, json=body)
        assert response.status_code == 401, response.text

    # Ordinary member: reads yes, writes no.
    member_actor = await member(client, w, role="member")
    assert (
        await client.get(hire_url(hire["id"]), headers=member_actor["headers"])
    ).status_code == 200
    assert (
        await client.patch(
            hire_url(hire["id"]),
            headers=member_actor["headers"],
            json={"status": "onboarding"},
        )
    ).status_code == 403
    assert (
        await client.post(
            offer_url(offer["id"], "/hire"),
            headers=member_actor["headers"],
            json={},
        )
    ).status_code == 403
    assert (
        await client.post(
            templates_path(w["org"]["id"]),
            headers=member_actor["headers"],
            json={"name": "Nope"},
        )
    ).status_code == 403

    # Viewer: outside the read set.
    viewer = await member(client, w, role="viewer")
    assert (
        await client.get(hires_path(w["org"]["id"]), headers=viewer["headers"])
    ).status_code == 403

    # Wrong global role.
    seeker = await _signup_verified(client, "hire-seeker@example.com", "jobseeker")
    assert (
        await client.get(hires_path(w["org"]["id"]), headers=seeker["headers"])
    ).status_code == 403

    # Another organization: 404 on every bare id (no oracle), 403 on the
    # org path (established contract).
    outsider = await _signup_verified(client, "hire-outsider@example.com", "employer")
    await _create_org(client, outsider, type_="employer")
    for method, path, body in [
        ("get", hire_url(hire["id"]), None),
        ("patch", hire_url(hire["id"]), {"status": "active"}),
        ("get", hire_url(hire["id"], "/onboarding-items"), None),
        ("get", hire_url(hire["id"], "/documents"), None),
        ("post", offer_url(offer["id"], "/hire"), {}),
    ]:
        response = await client.request(
            method, path, headers=outsider["headers"], json=body
        )
        assert response.status_code == 404, response.text
    assert (
        await client.get(
            hires_path(w["org"]["id"]), headers=outsider["headers"]
        )
    ).status_code == 403
    assert (
        await client.get(
            templates_path(w["org"]["id"]), headers=outsider["headers"]
        )
    ).status_code == 403


async def test_hire_cross_org_references_and_mass_assignment(client, pipeline):
    w = pipeline
    template = await make_template(client, w)
    offer = await accepted_offer(client, w)
    # A valid hire first, so every later attempt below must fail before
    # the unique-application guard would otherwise answer 409.
    valid = await client.post(
        offer_url(offer["id"], "/hire"),
        headers=w["headers"],
        json={"template_id": template["id"]},
    )
    assert valid.status_code == 201, valid.text
    candidate_id = (await client.get("/api/v1/users/me", headers=hdr(w))).json()["id"]
    viewer = await member(client, w, role="viewer")

    # Foreign/unknown payload references are 422 with loc [body, field].
    for field, value in [
        ("template_id", str(uuid.uuid4())),
        ("manager_id", candidate_id),
        ("owner_id", viewer["id"]),
    ]:
        response = await client.post(
            offer_url(offer["id"], "/hire"),
            headers=w["headers"],
            json={field: value},
        )
        assert response.status_code == 422, (field, response.text)
        details = response.json()["error"]["details"]
        assert any(detail.get("loc") == ["body", field] for detail in details)

    # A template from ANOTHER organization is a field error, not a leak.
    outsider = await _signup_verified(client, "tpl-outsider@example.com", "employer")
    foreign_org = await _create_org(client, outsider, type_="employer")
    foreign_template = await client.post(
        templates_path(foreign_org["id"]),
        headers=outsider["headers"],
        json={"name": "Foreign"},
    )
    assert foreign_template.status_code == 201, foreign_template.text
    response = await client.post(
        offer_url(offer["id"], "/hire"),
        headers=w["headers"],
        json={"template_id": foreign_template.json()["id"]},
    )
    assert response.status_code == 422, response.text
    assert any(
        detail.get("loc") == ["body", "template_id"]
        for detail in response.json()["error"]["details"]
    )

    # Server-controlled fields are never client-writable.
    response = await client.post(
        offer_url(offer["id"], "/hire"),
        headers=w["headers"],
        json={
            "org_id": w["org"]["id"],
            "user_id": candidate_id,
            "application_id": w["app"]["id"],
            "status": "active",
        },
    )
    assert response.status_code == 422, response.text
    locs = [detail.get("loc") for detail in response.json()["error"]["details"]]
    assert ["body", "status"] in locs

    hire = (await client.get(hires_path(w["org"]["id"]), headers=w["headers"])).json()[
        "items"
    ][0]
    response = await client.patch(
        hire_url(hire["id"]),
        headers=w["headers"],
        json={"application_id": w["app"]["id"], "status": "cancelled"},
    )
    assert response.status_code == 422, response.text

    # Explicit null start_date is rejected (NOT NULL column).
    response = await client.patch(
        hire_url(hire["id"]), headers=w["headers"], json={"start_date": None}
    )
    assert response.status_code == 422, response.text


async def test_onboarding_item_updates(client, pipeline):
    w = pipeline
    hire, template, _ = await make_hire(client, w)
    items = (
        await client.get(hire_url(hire["id"], "/onboarding-items"), headers=w["headers"])
    ).json()
    item = items["items"][0]

    patched = await client.patch(
        hire_url(hire["id"], f"/onboarding-items/{item['id']}"),
        headers=w["headers"],
        json={
            "status": "in_progress",
            "note": "Ordered from IT",
            "owner_id": w["user_id"],
            "due_on": "2027-02-05",
        },
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["status"] == "in_progress"
    assert patched.json()["note"] == "Ordered from IT"
    assert patched.json()["owner_id"] == w["user_id"]
    assert patched.json()["due_on"] == "2027-02-05"

    waived = await client.patch(
        hire_url(hire["id"], f"/onboarding-items/{item['id']}"),
        headers=w["headers"],
        json={"status": "waived"},
    )
    assert waived.status_code == 200 and waived.json()["status"] == "waived"

    # section/title are template snapshots — never client-writable.
    response = await client.patch(
        hire_url(hire["id"], f"/onboarding-items/{item['id']}"),
        headers=w["headers"],
        json={"section": "Hacked"},
    )
    assert response.status_code == 422, response.text

    # Cross-org owner reference.
    candidate_id = (await client.get("/api/v1/users/me", headers=hdr(w))).json()["id"]
    response = await client.patch(
        hire_url(hire["id"], f"/onboarding-items/{item['id']}"),
        headers=w["headers"],
        json={"owner_id": candidate_id},
    )
    assert response.status_code == 422, response.text
    assert any(
        detail.get("loc") == ["body", "owner_id"]
        for detail in response.json()["error"]["details"]
    )

    # Unknown item id (and another hire's item) are 404.
    response = await client.patch(
        hire_url(hire["id"], f"/onboarding-items/{uuid.uuid4()}"),
        headers=w["headers"],
        json={"status": "done"},
    )
    assert response.status_code == 404, response.text

    # Template replace-set: the posted list is the whole checklist.
    replaced = await client.patch(
        templates_path(w["org"]["id"]) + f"/{template['id']}",
        headers=w["headers"],
        json={
            "items": [
                {"section": "Day 1", "title": "Handbook", "due_offset_days": 0}
            ]
        },
    )
    assert replaced.status_code == 200, replaced.text
    assert len(replaced.json()["items"]) == 1
    assert replaced.json()["items"][0]["display_order"] == 0
    # The hire's copied items are untouched by later template edits.
    items_after = (
        await client.get(hire_url(hire["id"], "/onboarding-items"), headers=w["headers"])
    ).json()
    assert items_after["total"] == 2


async def test_hire_documents_lifecycle_and_download(client, pipeline, file_env):
    storage, _ = file_env
    w = pipeline
    hire, _, _ = await make_hire(client, w)

    created = await client.post(
        hire_url(hire["id"], "/documents"),
        headers=w["headers"],
        json={
            "name": "PAN card",
            "purpose": "payroll",
            "retention": "7 years",
            "due_on": "2027-02-10",
        },
    )
    assert created.status_code == 201, created.text
    doc = created.json()
    assert doc["status"] == "requested"  # server-owned initial state
    assert doc["requested_by"] == w["user_id"]

    # Status moves forward only (D14 vocabulary, plan table).
    response = await client.patch(
        f"/api/v1/documents/{doc['id']}",
        headers=w["headers"],
        json={"status": "verified"},
    )
    assert response.status_code == 409, response.text
    assert response.json()["error"]["code"] == "DOCUMENT_INVALID_STATE"
    received = await client.patch(
        f"/api/v1/documents/{doc['id']}",
        headers=w["headers"],
        json={"status": "received"},
    )
    assert received.status_code == 200 and received.json()["status"] == "received"

    # Attach a real Step 4 organization document file (D13).
    file_id = await uploaded(
        client, w["actor"], storage, org=w["org"], kind="document", name="pan.pdf"
    )
    attached = await client.patch(
        f"/api/v1/documents/{doc['id']}",
        headers=w["headers"],
        json={"file_id": file_id, "status": "verified"},
    )
    assert attached.status_code == 200, attached.text
    assert attached.json()["file_id"] == file_id
    assert attached.json()["status"] == "verified"

    # Terminal-ish: verified never moves back.
    response = await client.patch(
        f"/api/v1/documents/{doc['id']}",
        headers=w["headers"],
        json={"status": "requested"},
    )
    assert response.status_code == 409, response.text

    # Download through the scoped route (D8 employer-side equivalent).
    download = await client.post(
        f"/api/v1/documents/{doc['id']}/download", headers=w["headers"], json={}
    )
    assert download.status_code == 200, download.text
    assert download.json()["url"] and download.json()["file_name"] == "pan.pdf"
    assert storage.downloads, "storage should have signed a download"

    # Foreign file id is a field error; mass assignment is rejected.
    response = await client.patch(
        f"/api/v1/documents/{doc['id']}",
        headers=w["headers"],
        json={"file_id": str(uuid.uuid4())},
    )
    assert response.status_code == 422, response.text
    assert any(
        detail.get("loc") == ["body", "file_id"]
        for detail in response.json()["error"]["details"]
    )
    response = await client.patch(
        f"/api/v1/documents/{doc['id']}",
        headers=w["headers"],
        json={"requested_by": w["user_id"], "hire_id": str(uuid.uuid4())},
    )
    assert response.status_code == 422, response.text

    # Another organization cannot touch the document.
    outsider = await _signup_verified(client, "doc-outsider@example.com", "employer")
    await _create_org(client, outsider, type_="employer")
    response = await client.patch(
        f"/api/v1/documents/{doc['id']}",
        headers=outsider["headers"],
        json={"status": "expired"},
    )
    assert response.status_code == 404, response.text
    response = await client.post(
        f"/api/v1/documents/{doc['id']}/download",
        headers=outsider["headers"],
        json={},
    )
    assert response.status_code == 404, response.text

    page = (
        await client.get(hire_url(hire["id"], "/documents"), headers=w["headers"])
    ).json()
    assert page["total"] == 1 and page["items"][0]["id"] == doc["id"]

    # Document without a file: download is 404.
    second = await client.post(
        hire_url(hire["id"], "/documents"),
        headers=w["headers"],
        json={"name": "Offer letter copy"},
    )
    assert second.status_code == 201, second.text
    response = await client.post(
        f"/api/v1/documents/{second.json()['id']}/download",
        headers=w["headers"],
        json={},
    )
    assert response.status_code == 404, response.text


async def test_onboarding_template_crud_validation_and_scope(client, pipeline):
    w = pipeline
    template = await make_template(client, w)

    page = (
        await client.get(
            templates_path(w["org"]["id"]) + "?q=engineer", headers=w["headers"]
        )
    ).json()
    assert page["total"] == 1
    empty = (
        await client.get(
            templates_path(w["org"]["id"]) + "?q=zzzz", headers=w["headers"]
        )
    ).json()
    assert empty["total"] == 0

    detail = await client.get(
        templates_path(w["org"]["id"]) + f"/{template['id']}", headers=w["headers"]
    )
    assert detail.status_code == 200 and detail.json()["name"] == "Engineer onboarding"

    renamed = await client.patch(
        templates_path(w["org"]["id"]) + f"/{template['id']}",
        headers=w["headers"],
        json={"name": "  Renamed template  "},
    )
    assert renamed.status_code == 200 and renamed.json()["name"] == "Renamed template"
    assert len(renamed.json()["items"]) == 2  # name-only patch keeps items

    # is_platform and display_order are server-owned (422).
    response = await client.post(
        templates_path(w["org"]["id"]),
        headers=w["headers"],
        json={"name": "Sneaky", "is_platform": True},
    )
    assert response.status_code == 422, response.text
    response = await client.post(
        templates_path(w["org"]["id"]),
        headers=w["headers"],
        json={
            "name": "Sneaky",
            "items": [{"section": "S", "title": "T", "display_order": 5}],
        },
    )
    assert response.status_code == 422, response.text
    response = await client.patch(
        templates_path(w["org"]["id"]) + f"/{template['id']}",
        headers=w["headers"],
        json={"name": None},
    )
    assert response.status_code == 422, response.text

    # Unknown template id on my org path is 404 (no oracle); another
    # organization addressing this org path is 403 (org-path contract).
    outsider = await _signup_verified(client, "tpl-scope@example.com", "employer")
    await _create_org(client, outsider, type_="employer")
    response = await client.get(
        templates_path(w["org"]["id"]) + f"/{uuid.uuid4()}",
        headers=w["headers"],
    )
    assert response.status_code == 404, response.text
    response = await client.patch(
        templates_path(w["org"]["id"]) + f"/{template['id']}",
        headers=outsider["headers"],
        json={"name": "Stolen"},
    )
    assert response.status_code == 403, response.text
    # ...and the org id itself is never readable through this route.
    response = await client.get(
        templates_path(w["org"]["id"]), headers=outsider["headers"]
    )
    assert response.status_code == 403, response.text

    # Pagination.
    await make_template(client, w, name="Second template", items=[])
    limited = (
        await client.get(
            templates_path(w["org"]["id"]) + "?limit=1", headers=w["headers"]
        )
    ).json()
    assert limited["total"] == 2 and limited["has_more"] is True


async def test_hire_read_projects_job_title_and_checklist(client, pipeline):
    """G5/G6: job_title + checklist counts on create, detail and list."""
    w = pipeline
    hire, template, offer = await make_hire(client, w)
    assert hire["job_title"] == w["job"]["title"]
    assert hire["checklist_total"] == 2
    assert hire["checklist_done"] == 0

    detail = (await client.get(hire_url(hire["id"]), headers=w["headers"])).json()
    assert detail["job_title"] == w["job"]["title"]
    assert detail["checklist_total"] == 2
    assert detail["checklist_done"] == 0

    page = (
        await client.get(hires_path(w["org"]["id"]), headers=w["headers"])
    ).json()
    row = next(r for r in page["items"] if r["id"] == hire["id"])
    assert row["job_title"] == w["job"]["title"]
    assert row["checklist_total"] == 2 and row["checklist_done"] == 0

    # Ticking an item moves the counter.
    items = (
        await client.get(
            hire_url(hire["id"], "/onboarding-items"), headers=w["headers"]
        )
    ).json()
    first = items["items"][0]
    patched = await client.patch(
        hire_url(hire["id"], f"/onboarding-items/{first['id']}"),
        headers=w["headers"],
        json={"status": "done"},
    )
    assert patched.status_code == 200, patched.text
    detail = (await client.get(hire_url(hire["id"]), headers=w["headers"])).json()
    assert detail["checklist_done"] == 1
    assert detail["checklist_total"] == 2
