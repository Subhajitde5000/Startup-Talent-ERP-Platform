"""9h: grants do not leak files, colleague access, NDA evidence or audit data."""

import uuid
from datetime import timedelta

import pytest
import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.data_room import DataRoomDocument
from app.models.data_room_access import DataRoomAccessRequest, DocumentView
from app.models.file import File
from app.models.organization import Organization, OrganizationMember
from app.models.user import UserRoleRow
from app.services.data_room_service import now
from app.tests.conftest import TestSessionFactory
from app.tests.test_files import PDF, uploaded
from app.tests.test_task_labels import _create_org, _invite_member, _signup_verified

pytest_plugins = ["app.tests.test_data_rooms"]
INVESTOR_REQUESTS = "/api/v1/investors/data-room-access-requests"


@pytest_asyncio.fixture
async def applicant(client, workspace):
    actor = await _signup_verified(client, "investor@test.dev", role="investor")
    org = await _create_org(client, actor, name="Investor firm", type_="investor_firm")
    result = await client.post(
        INVESTOR_REQUESTS,
        headers=actor["headers"],
        json={"startup_org_id": workspace["org"]["id"], "message": "Please review my request."},
    )
    assert result.status_code == 201, result.text
    return dict(actor=actor, org=org, request=result.json())


async def approve(client, w, a, **extra):
    response = await client.post(
        w["base"] + f"/access-requests/{a['request']['id']}/decisions",
        headers=w["owner"]["headers"],
        json={"action": "approve", "scope": [w["folder"]["id"]], **extra},
    )
    assert response.status_code == 200, response.text
    return response.json()


def content(w):
    return f"/api/v1/data-room-documents/{w['doc']['id']}/content"


async def test_personal_grant_happy_path_audit_and_generic_file_no_bypass(
    client, workspace, applicant
):
    w, a = workspace, applicant
    h = a["actor"]["headers"]
    assert (await client.get(content(w), headers=h)).status_code == 404
    grant = await approve(client, w, a)
    assert grant["status"] == "approved" and grant["decided_by"] and grant["expires_at"]
    summary = await client.get(f"/api/v1/investors/data-rooms/{w['org']['id']}", headers=h)
    assert summary.status_code == 200, summary.text
    folders = (
        await client.get(f"/api/v1/investors/data-rooms/{w['org']['id']}/folders", headers=h)
    ).json()
    assert folders["total"] == 1 and "parent_id" not in folders["items"][0]
    docs = (
        await client.get(f"/api/v1/investors/data-rooms/{w['org']['id']}/documents", headers=h)
    ).json()
    assert docs["total"] == 1
    for field in ["file_id", "view_count", "updated_by"]:
        assert field not in docs["items"][0]
    retrieved = await client.get(
        content(w), headers={**h, "x-forwarded-for": "1.2.3.4", "user-agent": "a" * 1000}
    )
    assert retrieved.status_code == 200 and retrieved.content == PDF
    assert "no-store" in retrieved.headers["cache-control"]
    assert retrieved.headers["x-content-type-options"] == "nosniff"
    for suffix, method in [("", "get"), ("/download-url", "post"), ("/confirm", "post")]:
        assert (
            await client.request(
                method,
                f"/api/v1/files/{w['file_id']}" + suffix,
                headers=h,
                json={} if method == "post" else None,
            )
        ).status_code == 404
    assert (await client.get(w["base"] + "/document-views", headers=h)).status_code == 404
    audit = (await client.get(w["base"] + "/document-views", headers=w["owner"]["headers"])).json()
    assert audit["total"] == 1 and audit["items"][0]["ip"] != "1.2.3.4"
    assert len(audit["items"][0]["user_agent"]) == 512
    assert (await client.get(w["base"] + "/documents", headers=w["owner"]["headers"])).json()[
        "items"
    ][0]["view_count"] == 1
    again = await client.post(INVESTOR_REQUESTS, headers=h, json={"startup_org_id": w["org"]["id"]})
    assert again.json()["id"] == a["request"]["id"]
    assert (await client.get(INVESTOR_REQUESTS + "?status=approved&limit=1", headers=h)).json()[
        "total"
    ] == 1


async def test_nda_pin_acceptance_and_policy_change(client, workspace, applicant):
    w, a = workspace, applicant
    nda = await uploaded(
        client, w["owner"], w["storage"], org=w["org"], kind="legal", name="agreement.pdf"
    )
    assert (
        await client.put(
            w["base"],
            headers=w["owner"]["headers"],
            json={"nda_required": True, "nda_file_id": nda},
        )
    ).status_code == 200
    grant = await approve(client, w, a)
    h = a["actor"]["headers"]
    rid = a["request"]["id"]
    assert grant["nda_file_id"] == nda and grant["nda_checksum"]
    assert (await client.get(content(w), headers=h)).status_code == 404
    terms = await client.get(INVESTOR_REQUESTS + f"/{rid}/nda-content", headers=h)
    assert terms.status_code == 200 and terms.content == PDF
    # Changing the room policy does not silently mutate a grant's agreement.
    other = await uploaded(
        client, w["owner"], w["storage"], org=w["org"], kind="legal", name="new-agreement.pdf"
    )
    await client.put(w["base"], headers=w["owner"]["headers"], json={"nda_file_id": other})
    body = {
        "nda_file_id": nda,
        "nda_checksum": grant["nda_checksum"],
        "legal_name": "Investor Name",
        "agreed": True,
        "purpose_agreed": True,
    }
    assert (
        await client.post(
            INVESTOR_REQUESTS + f"/{rid}/nda-acceptances",
            headers=h,
            json={**body, "nda_file_id": other},
        )
    ).status_code == 409
    for field, value in [
        ("agreed", False),
        ("purpose_agreed", False),
        ("legal_name", " "),
        ("agreed", "true"),
    ]:
        assert (
            await client.post(
                INVESTOR_REQUESTS + f"/{rid}/nda-acceptances",
                headers=h,
                json={**body, field: value},
            )
        ).status_code == 422
    signed = await client.post(INVESTOR_REQUESTS + f"/{rid}/nda-acceptances", headers=h, json=body)
    assert signed.status_code == 200 and signed.json()["nda_signed_at"], signed.text
    assert (
        await client.post(INVESTOR_REQUESTS + f"/{rid}/nda-acceptances", headers=h, json=body)
    ).json()["nda_signed_at"].removesuffix("Z") == signed.json()["nda_signed_at"].removesuffix("Z")
    assert (
        await client.post(
            INVESTOR_REQUESTS + f"/{rid}/nda-acceptances",
            headers=h,
            json={**body, "legal_name": "Changed"},
        )
    ).status_code == 409
    assert (await client.get(content(w), headers=h)).status_code == 200
    assert (
        await client.delete("/api/v1/files/" + nda, headers=w["owner"]["headers"])
    ).status_code == 409


async def test_scope_private_documents_and_history_not_exposed(client, workspace, applicant):
    w, a = workspace, applicant
    h = a["actor"]["headers"]
    owner = w["owner"]["headers"]
    await approve(client, w, a)
    child = await client.post(
        w["base"] + "/folders",
        headers=owner,
        json={"name": "Child", "parent_id": w["folder"]["id"]},
    )
    childdoc = await client.post(
        w["base"] + "/documents",
        headers=owner,
        json={
            "name": "Nested",
            "folder_id": child.json()["id"],
            "file_id": w["file_id"],
            "visibility": "approved_investors",
        },
    )
    assert (
        await client.get(f"/api/v1/data-room-documents/{childdoc.json()['id']}/content", headers=h)
    ).status_code == 404
    assert (
        await client.get(
            f"/api/v1/investors/data-rooms/{w['org']['id']}/documents?folder_id={child.json()['id']}",
            headers=h,
        )
    ).status_code == 404
    versions = (
        await client.get(w["base"] + f"/documents/{w['doc']['id']}/versions", headers=owner)
    ).json()["items"]
    nextfile = await uploaded(
        client, w["owner"], w["storage"], org=w["org"], kind="pitch_deck", name="v2.pdf"
    )
    await client.post(
        w["base"] + f"/documents/{w['doc']['id']}/versions",
        headers=owner,
        json={"file_id": nextfile},
    )
    assert (
        await client.get(content(w) + "?version_id=" + versions[0]["id"], headers=h)
    ).status_code == 404
    assert (
        await client.get(content(w) + "?version_id=" + versions[0]["id"], headers=owner)
    ).status_code == 200
    await client.patch(
        w["base"] + f"/documents/{w['doc']['id']}", headers=owner, json={"visibility": "private"}
    )
    assert (await client.get(content(w), headers=h)).status_code == 404
    assert (
        await client.get(f"/api/v1/investors/data-rooms/{w['org']['id']}/documents", headers=h)
    ).json()["total"] == 0


@pytest.mark.parametrize("action", ["deny", "revoke", "expire"])
async def test_lifecycle_terminal_transitions_and_reapplication(
    client, workspace, applicant, action
):
    w, a = workspace, applicant
    h = a["actor"]["headers"]
    rid = a["request"]["id"]
    url = w["base"] + f"/access-requests/{rid}/decisions"
    if action != "deny":
        await approve(client, w, a)
    if action == "expire":
        async with TestSessionFactory() as db:
            row = await db.get(DataRoomAccessRequest, uuid.UUID(rid))
            row.expires_at = now() - timedelta(seconds=1)
            await db.commit()
        assert (await client.get(content(w), headers=h)).status_code == 404
        assert (await client.get(INVESTOR_REQUESTS + "/" + rid, headers=h)).json()[
            "status"
        ] == "expired"
    else:
        assert (
            await client.post(url, headers=w["owner"]["headers"], json={"action": action})
        ).status_code == 200
    assert (await client.get(content(w), headers=h)).status_code == 404
    assert (
        await client.post(
            url,
            headers=w["owner"]["headers"],
            json={"action": "approve", "scope": [w["folder"]["id"]]},
        )
    ).status_code == 409
    new = await client.post(INVESTOR_REQUESTS, headers=h, json={"startup_org_id": w["org"]["id"]})
    assert new.status_code == 201 and new.json()["id"] != rid
    assert new.json()["nda_signed_at"] is None


async def test_other_person_same_firm_and_cross_org_requests(client, workspace, applicant):
    w, a = workspace, applicant
    await approve(client, w, a)
    colleague = await _signup_verified(client, "colleague@test.dev", role="investor")
    await _invite_member(client, a["actor"], colleague, a["org"], "member")
    assert (await client.get(content(w), headers=colleague["headers"])).status_code == 404
    assert (
        await client.get(INVESTOR_REQUESTS + "/" + a["request"]["id"], headers=colleague["headers"])
    ).status_code == 404
    assert (await client.get(INVESTOR_REQUESTS, headers=colleague["headers"])).json()["total"] == 0
    outsider = await _signup_verified(client, "outside@test.dev")
    assert (
        await client.post(
            w["base"] + f"/access-requests/{a['request']['id']}/decisions",
            headers=outsider["headers"],
            json={"action": "revoke"},
        )
    ).status_code == 404
    assert (
        await client.post(
            INVESTOR_REQUESTS, headers=outsider["headers"], json={"startup_org_id": w["org"]["id"]}
        )
    ).status_code == 403


@pytest.mark.parametrize("role", ["member", "viewer"])
async def test_no_access_management_by_startup_member_or_viewer(client, workspace, applicant, role):
    w, a = workspace, applicant
    actor = await _signup_verified(client, "teammate@test.dev")
    await _invite_member(client, w["owner"], actor, w["org"], role)
    for suffix in ["/access-requests", "/document-views"]:
        assert (await client.get(w["base"] + suffix, headers=actor["headers"])).status_code == 403
    assert (
        await client.post(
            w["base"] + f"/access-requests/{a['request']['id']}/decisions",
            headers=actor["headers"],
            json={"action": "deny"},
        )
    ).status_code == 403


@pytest.mark.parametrize(
    "mutation",
    [
        "room_inactive",
        "startup_suspended",
        "firm_suspended",
        "membership_removed",
        "role_revoked",
        "file_infected",
        "document_deleted",
    ],
)
async def test_effective_access_rechecked_on_each_read(client, workspace, applicant, mutation):
    w, a = workspace, applicant
    await approve(client, w, a)
    async with TestSessionFactory() as db:
        if mutation == "room_inactive":
            from app.models.data_room import DataRoom

            row = await db.get(DataRoom, uuid.UUID(w["room"]["id"]))
            row.is_active = False
        elif mutation in ["startup_suspended", "firm_suspended"]:
            row = await db.get(
                Organization,
                uuid.UUID(w["org"]["id"] if mutation == "startup_suspended" else a["org"]["id"]),
            )
            row.status = "suspended"
        elif mutation == "membership_removed":
            row = (
                await db.execute(
                    select(OrganizationMember).where(
                        OrganizationMember.org_id == uuid.UUID(a["org"]["id"])
                    )
                )
            ).scalar_one()
            row.deleted_at = now()
        elif mutation == "role_revoked":
            row = (
                await db.execute(
                    select(UserRoleRow).where(
                        UserRoleRow.user_id == uuid.UUID(a["request"]["requester_id"])
                    )
                )
            ).scalar_one()
            row.revoked_at = now()
        elif mutation == "file_infected":
            row = await db.get(File, uuid.UUID(w["file_id"]))
            row.scan_status = "infected"
            row.upload_status = "rejected"
        else:
            row = await db.get(DataRoomDocument, uuid.UUID(w["doc"]["id"]))
            row.deleted_at = now()
        await db.commit()
    assert (await client.get(content(w), headers=a["actor"]["headers"])).status_code in [403, 404]


async def test_storage_and_audit_failures_never_count_or_serve(
    client, workspace, applicant, monkeypatch
):
    w, a = workspace, applicant
    h = a["actor"]["headers"]
    await approve(client, w, a)
    w["storage"].fail = True
    assert (await client.get(content(w), headers=h)).status_code == 503
    w["storage"].fail = False
    original = AsyncSession.commit

    async def fail_audit(self):
        if any(isinstance(row, DocumentView) for row in self.new):
            raise RuntimeError("injected audit failure")
        await original(self)

    monkeypatch.setattr(AsyncSession, "commit", fail_audit)
    with pytest.raises(RuntimeError, match="injected audit failure"):
        await client.get(content(w), headers=h)
    async with TestSessionFactory() as db:
        assert (await db.execute(select(func.count(DocumentView.id)))).scalar_one() == 0
        row = await db.get(DataRoomDocument, uuid.UUID(w["doc"]["id"]))
        assert row.view_count == 0


@pytest.mark.parametrize(
    "field,value",
    [
        ("requester_id", str(uuid.uuid4())),
        ("requester_org", str(uuid.uuid4())),
        ("status", "approved"),
        ("nda_signed_at", "2026-11-23T00:00:00Z"),
        ("scope", []),
        ("decided_by", str(uuid.uuid4())),
        ("expires_at", "2026-11-23T00:00:00Z"),
    ],
)
async def test_request_mass_assignment(client, workspace, applicant, field, value):
    assert (
        await client.post(
            INVESTOR_REQUESTS,
            headers=applicant["actor"]["headers"],
            json={"startup_org_id": workspace["org"]["id"], field: value},
        )
    ).status_code == 422


@pytest.mark.parametrize(
    "body",
    [
        {"action": "approve", "scope": []},
        {"action": "approve", "scope": [str(uuid.uuid4())]},
        {"action": "approve", "scope": [str(uuid.uuid4())], "expires_at": "2020-01-01"},
        {"action": "approved"},
        {"action": "deny", "scope": []},
        {"action": "deny", "decided_by": str(uuid.uuid4())},
    ],
)
async def test_decision_validation(client, workspace, applicant, body):
    r = await client.post(
        workspace["base"] + f"/access-requests/{applicant['request']['id']}/decisions",
        headers=workspace["owner"]["headers"],
        json=body,
    )
    assert r.status_code == 422, r.text


# Exercise every new endpoint's authentication boundary without creating fixtures.
R = str(uuid.uuid4())
S = f"/api/v1/organizations/{R}/data-room"
AUTH_ROUTES = [
    ("GET", S),
    ("PUT", S),
    ("GET", S + "/folders"),
    ("POST", S + "/folders"),
    ("PATCH", S + "/folders/" + R),
    ("DELETE", S + "/folders/" + R),
    ("GET", S + "/documents"),
    ("POST", S + "/documents"),
    ("PATCH", S + "/documents/" + R),
    ("DELETE", S + "/documents/" + R),
    ("GET", S + "/documents/" + R + "/versions"),
    ("POST", S + "/documents/" + R + "/versions"),
    ("POST", INVESTOR_REQUESTS),
    ("GET", INVESTOR_REQUESTS),
    ("GET", INVESTOR_REQUESTS + "/" + R),
    ("GET", S + "/access-requests"),
    ("POST", S + "/access-requests/" + R + "/decisions"),
    ("GET", INVESTOR_REQUESTS + "/" + R + "/nda-content"),
    ("POST", INVESTOR_REQUESTS + "/" + R + "/nda-acceptances"),
    ("GET", "/api/v1/investors/data-rooms/" + R),
    ("GET", "/api/v1/investors/data-rooms/" + R + "/folders"),
    ("GET", "/api/v1/investors/data-rooms/" + R + "/documents"),
    ("GET", "/api/v1/data-room-documents/" + R + "/content"),
    ("GET", S + "/document-views"),
]


@pytest.mark.parametrize("method,path", AUTH_ROUTES)
async def test_all_routes_require_auth(client, method, path):
    assert (
        await client.request(method, path, json={} if method in ["POST", "PATCH", "PUT"] else None)
    ).status_code == 401


@pytest.mark.parametrize("kind", ["scope", "nda", "request"])
async def test_cross_room_references(client, workspace, applicant, kind):
    w, a = workspace, applicant
    owner = await _signup_verified(client, "second-startup@test.dev")
    org = await _create_org(client, owner, name="Other startup")
    base = f"/api/v1/organizations/{org['id']}/data-room"
    await client.put(base, headers=owner["headers"], json={})
    folder = (
        await client.post(
            base + "/folders", headers=owner["headers"], json={"name": "Other folder"}
        )
    ).json()
    if kind == "scope":
        result = await client.post(
            w["base"] + f"/access-requests/{a['request']['id']}/decisions",
            headers=w["owner"]["headers"],
            json={"action": "approve", "scope": [folder["id"]]},
        )
        assert result.status_code == 422
    elif kind == "nda":
        nda = await uploaded(client, owner, w["storage"], org=org, kind="legal")
        assert (
            await client.put(w["base"], headers=w["owner"]["headers"], json={"nda_file_id": nda})
        ).status_code == 422
    else:
        assert (
            await client.post(
                base + f"/access-requests/{a['request']['id']}/decisions",
                headers=owner["headers"],
                json={"action": "deny"},
            )
        ).status_code == 404
    assert (
        await client.get(
            INVESTOR_REQUESTS + "/" + a["request"]["id"], headers=a["actor"]["headers"]
        )
    ).json()["status"] == "pending"


@pytest.mark.parametrize("failure", ["missing", "checksum", "mime", "size"])
async def test_storage_integrity_failures(client, workspace, applicant, failure):
    w, a = workspace, applicant
    await approve(client, w, a)
    async with TestSessionFactory() as db:
        file = await db.get(File, uuid.UUID(w["file_id"]))
        key = file.storage_key
    if failure == "missing":
        w["storage"].objects.pop(key)
    else:
        w["storage"].objects[key] = (
            b"x" * len(PDF) if failure == "checksum" else PDF + b"x" if failure == "size" else PDF,
            "text/html" if failure == "mime" else "application/pdf",
        )
    result = await client.get(content(w), headers=a["actor"]["headers"])
    assert result.status_code == 503 and "provider" not in result.text
    async with TestSessionFactory() as db:
        assert (await db.execute(select(func.count(DocumentView.id)))).scalar_one() == 0


async def test_action_and_content_limits(client, workspace, applicant, monkeypatch):
    from app.core.config import get_settings
    from app.services.rate_limiter import rate_limiter

    w, a = workspace, applicant
    await approve(client, w, a)
    monkeypatch.setattr(get_settings(), "DATA_ROOM_REQUEST_LIMIT", 1)
    monkeypatch.setattr(get_settings(), "DATA_ROOM_CONTENT_LIMIT", 1)
    rate_limiter.reset()
    assert (
        await client.post(
            INVESTOR_REQUESTS,
            headers=a["actor"]["headers"],
            json={"startup_org_id": w["org"]["id"]},
        )
    ).status_code == 201
    limited = await client.post(
        INVESTOR_REQUESTS, headers=a["actor"]["headers"], json={"startup_org_id": w["org"]["id"]}
    )
    assert limited.status_code == 429 and limited.json()["error"]["code"] == "RATE_LIMITED"
    assert (await client.get(content(w), headers=a["actor"]["headers"])).status_code == 200
    assert (await client.get(content(w), headers=a["actor"]["headers"])).status_code == 429


@pytest.mark.parametrize(
    "field,value",
    [
        ("nda_signed_at", "2026-11-23T00:00:00Z"),
        ("requester_id", str(uuid.uuid4())),
        ("ip", "1.2.3.4"),
        ("decided_at", "2026-11-23T00:00:00Z"),
    ],
)
async def test_nda_mass_assignment(client, workspace, applicant, field, value):
    result = await client.post(
        INVESTOR_REQUESTS + f"/{applicant['request']['id']}/nda-acceptances",
        headers=applicant["actor"]["headers"],
        json={
            "nda_file_id": str(uuid.uuid4()),
            "nda_checksum": "a" * 64,
            "legal_name": "Test Person",
            "agreed": True,
            "purpose_agreed": True,
            field: value,
        },
    )
    assert result.status_code == 422


async def test_access_decisions_are_audited_without_message_or_nda_name(
    client, workspace, applicant
):
    from app.models.activity import ActivityEvent

    await approve(client, workspace, applicant)
    await client.post(
        workspace["base"] + f"/access-requests/{applicant['request']['id']}/decisions",
        headers=workspace["owner"]["headers"],
        json={"action": "revoke"},
    )
    async with TestSessionFactory() as db:
        events = (
            (
                await db.execute(
                    select(ActivityEvent).where(
                        ActivityEvent.entity_id == uuid.UUID(applicant["request"]["id"])
                    )
                )
            )
            .scalars()
            .all()
        )
        assert [e.data["action"] for e in events] == ["requested", "approved", "revoked"]
        assert all(set(e.data) == {"action"} for e in events)


async def test_new_grant_never_reactivates_old_nda_endpoints(client, workspace, applicant):
    w, a = workspace, applicant
    nda = await uploaded(client, w["owner"], w["storage"], org=w["org"], kind="legal")
    await client.put(
        w["base"], headers=w["owner"]["headers"], json={"nda_required": True, "nda_file_id": nda}
    )
    old = await approve(client, w, a)
    await client.post(
        w["base"] + f"/access-requests/{old['id']}/decisions",
        headers=w["owner"]["headers"],
        json={"action": "revoke"},
    )
    new = (
        await client.post(
            INVESTOR_REQUESTS,
            headers=a["actor"]["headers"],
            json={"startup_org_id": w["org"]["id"]},
        )
    ).json()
    await approve(client, w, {**a, "request": new})
    h = a["actor"]["headers"]
    assert (
        await client.get(INVESTOR_REQUESTS + f"/{old['id']}/nda-content", headers=h)
    ).status_code == 404
    body = {
        "nda_file_id": nda,
        "nda_checksum": old["nda_checksum"],
        "legal_name": "Test Person",
        "agreed": True,
        "purpose_agreed": True,
    }
    assert (
        await client.post(INVESTOR_REQUESTS + f"/{old['id']}/nda-acceptances", headers=h, json=body)
    ).status_code == 404
    assert (
        await client.get(INVESTOR_REQUESTS + f"/{new['id']}/nda-content", headers=h)
    ).status_code == 200
    assert (
        await client.post(INVESTOR_REQUESTS + f"/{new['id']}/nda-acceptances", headers=h, json=body)
    ).status_code == 200


async def test_nda_rate_budget_is_enforced(client, workspace, applicant, monkeypatch):
    from app.core.config import get_settings
    from app.services.rate_limiter import rate_limiter

    w, a = workspace, applicant
    await approve(client, w, a)
    monkeypatch.setattr(get_settings(), "DATA_ROOM_NDA_LIMIT", 1)
    rate_limiter.reset()
    body = {
        "nda_file_id": str(uuid.uuid4()),
        "nda_checksum": "a" * 64,
        "legal_name": "Test Person",
        "agreed": True,
        "purpose_agreed": True,
    }
    url = INVESTOR_REQUESTS + f"/{a['request']['id']}/nda-acceptances"
    assert (await client.post(url, headers=a["actor"]["headers"], json=body)).status_code == 409
    assert (await client.post(url, headers=a["actor"]["headers"], json=body)).status_code == 429


async def test_authorized_frontend_projections_and_startup_filter(client, workspace, applicant):
    w, a = workspace, applicant
    headers = a["actor"]["headers"]
    response = (
        await client.get(INVESTOR_REQUESTS + "/" + a["request"]["id"], headers=headers)
    ).json()
    assert response["startup_org_id"] == w["org"]["id"]
    assert response["startup_name"] == w["org"]["name"]
    assert response["requester_name"] and response["requester_org_name"] == a["org"]["name"]
    result = await client.get(
        INVESTOR_REQUESTS + f"?startup_org_id={w['org']['id']}", headers=headers
    )
    assert (
        result.json()["total"] == 1
        and result.json()["items"][0]["startup_name"] == w["org"]["name"]
    )
    result = await client.get(
        INVESTOR_REQUESTS + f"?startup_org_id={uuid.uuid4()}", headers=headers
    )
    assert result.json()["total"] == 0
    result = await client.get(w["base"] + "/access-requests", headers=w["owner"]["headers"])
    assert result.json()["items"][0]["requester_org_name"] == a["org"]["name"]
    await approve(client, w, a)
    await client.get(content(w), headers=headers)
    view = (await client.get(w["base"] + "/document-views", headers=w["owner"]["headers"])).json()[
        "items"
    ][0]
    assert (
        view["document_name"] == w["doc"]["name"]
        and view["viewer_name"] == response["requester_name"]
    )
    assert (await client.get(w["base"] + "/document-views", headers=headers)).status_code == 404
    for field in ["startup_name", "startup_org_id", "requester_name", "requester_org_name"]:
        assert (
            await client.post(
                INVESTOR_REQUESTS,
                headers=headers,
                json={"startup_org_id": w["org"]["id"], field: "forged"},
            )
        ).status_code == 422
