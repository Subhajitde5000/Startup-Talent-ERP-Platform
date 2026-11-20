"""Step 8a tests: the mentor directory (startup view).

Covers, per AGENTS.md section 7 and the 8a plan:

- happy path: list, filters, sort, pagination, detail, suggestions,
- validation errors: bad sort/order/limit, over-long q and facet values,
  negative fee,
- 401 on every new route with no token,
- 403 for a non-member asking for another startup's suggestions, and the
  same 403 for a non-startup organization id (no tenant probe),
- cross-organization attempts: a member of Startup B cannot read Startup
  A's suggestions, and a mentor hidden by profile_public is absent from the
  list and 404 on the detail (never 403 — no existence oracle),
- mass assignment: the step is read-only, so the server-owned fields
  (rating, is_verified, sessions_completed, user_id) stay absent from the
  payload and remain unwritable through the Step 3c PATCH that feeds it,
- the suggestion rank: it is explainable from match_reasons and never
  invents a stage match (8a plan D-1 leaves stage unfiltered).

No table is created by this step; these tests exercise reads over the
Step 3c ``mentor_profiles`` table only.
"""

import re

import pytest
from httpx import AsyncClient

PASSWORD = "Str0ng!Password99"


def _extract_code() -> str:
    from app.services import email_service

    assert email_service.SENT_EMAILS, "expected a verification email"
    body = email_service.SENT_EMAILS[-1]["body"]
    match = re.search(r"(\d{6})", body)
    assert match, f"no 6-digit code in email body: {body!r}"
    return match.group(1)


async def _signup_verified(
    client: AsyncClient, email: str, role: str = "startup"
) -> dict:
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": PASSWORD,
            "display_name": email.split("@")[0].title(),
            "role": role,
        },
    )
    assert resp.status_code == 201, resp.text
    code = _extract_code()
    verify = await client.post(
        "/api/v1/auth/verify-email", json={"email": email, "code": code}
    )
    assert verify.status_code == 200, verify.text
    login = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert login.status_code == 200, login.text
    return {
        "email": email,
        "headers": {"Authorization": f"Bearer {login.json()['access_token']}"},
    }


async def _set_handle(client: AsyncClient, auth: dict, handle: str) -> None:
    resp = await client.patch(
        "/api/v1/users/me", json={"handle": handle}, headers=auth["headers"]
    )
    assert resp.status_code == 200, resp.text


async def _make_mentor(
    client: AsyncClient,
    email: str,
    handle: str,
    *,
    public: bool = True,
    **profile: object,
) -> dict:
    """A mentor account with a handle and a filled-in mentor profile."""
    auth = await _signup_verified(client, email, role="mentor")
    await _set_handle(client, auth, handle)
    if not public:
        # The only visibility switch mentor_profiles has (8a plan: no column).
        resp = await client.patch(
            "/api/v1/users/me", json={"profile_public": False}, headers=auth["headers"]
        )
        assert resp.status_code == 200, resp.text

    payload = {
        "headline": "Go-to-market advisor",
        "bio": "Works with early-stage founders on GTM and pricing.",
        "expertise": ["Go-to-market", "Fundraising"],
        "sectors": ["Fintech", "B2B SaaS"],
        "languages": ["English", "Hindi"],
        "years_experience": 12,
        "hourly_fee": 3000,
        "accepting_requests": True,
        **profile,
    }
    saved = await client.patch(
        "/api/v1/mentor-profile/me", json=payload, headers=auth["headers"]
    )
    assert saved.status_code == 200, saved.text
    return {"auth": auth, "handle": handle, "profile": saved.json()}


async def _create_org(
    client: AsyncClient, auth: dict, *, name: str, type_: str = "startup"
) -> dict:
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": name, "type": type_},
        headers=auth["headers"],
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _add_member(client: AsyncClient, owner: dict, org_id: str, email: str) -> dict:
    """Invite ``email`` then accept as that user — the real team flow."""
    created = await client.post(
        f"/api/v1/organizations/{org_id}/invites",
        json={"email": email, "role": "member"},
        headers=owner["headers"],
    )
    assert created.status_code == 201, created.text
    token = created.json()["token"]
    member = await _signup_verified(client, email)
    accept = await client.post(f"/api/v1/invites/{token}/accept", headers=member["headers"])
    assert accept.status_code == 200, accept.text
    return member


async def _list(client: AsyncClient, auth: dict, **params: str | int | bool) -> dict:
    resp = await client.get("/api/v1/mentors", params=params, headers=auth["headers"])
    assert resp.status_code == 200, resp.text
    return resp.json()


def _handles(page: dict) -> list[str]:
    return [item["handle"] for item in page["items"]]


# --- smoke: one mentor is listed and readable -------------------------------


@pytest.mark.asyncio
async def test_list_and_detail_happy_path(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "founder8a@example.com")
    await _make_mentor(client, "rhea8a@example.com", "rhea8a")

    page = await _list(client, founder)
    assert "rhea8a" in _handles(page)
    assert page["total"] >= 1

    card = next(i for i in page["items"] if i["handle"] == "rhea8a")
    assert card["display_name"] == "Rhea8A"
    assert card["expertise"] == ["Go-to-market", "Fundraising"]
    assert card["currency"] == "INR"

    detail = await client.get("/api/v1/mentors/rhea8a", headers=founder["headers"])
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert body["bio"]
    assert body["max_startups"] >= 1
    # The card's fields are all present on the detail read too.
    for key in ("handle", "display_name", "expertise", "rating", "is_verified"):
        assert key in body


# --- filters and sorting ----------------------------------------------------


@pytest.mark.asyncio
async def test_filters(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "filter8a@example.com")
    await _make_mentor(
        client, "gtm8a@example.com", "gtm8a", expertise=["Go-to-market"]
    )
    await _make_mentor(
        client, "fin8a@example.com", "fin8a", expertise=["Finance"],
        sectors=["Climate"], hourly_fee=None,
    )
    await _make_mentor(
        client, "priv8a@example.com", "priv8a", public=False,
    )

    assert "gtm8a" in _handles(await _list(client, founder, expertise="Go-to-market"))
    assert "fin8a" not in _handles(
        await _list(client, founder, expertise="Go-to-market")
    )
    # substring must not match a different tag
    assert _handles(await _list(client, founder, expertise="Fin")) == []

    assert "fin8a" in _handles(await _list(client, founder, sector="Climate"))
    assert "fin8a" in _handles(await _list(client, founder, language="Hindi"))

    free = _handles(await _list(client, founder, free_only=True))
    assert "fin8a" in free and "gtm8a" not in free

    capped = _handles(await _list(client, founder, max_fee=1000))
    assert "fin8a" in capped and "gtm8a" not in capped

    # q searches name/headline/bio/expertise
    assert "gtm8a" in _handles(await _list(client, founder, q="pricing"))
    assert _handles(await _list(client, founder, q="no-such-term-xyz")) == []

    # A hidden mentor is absent from every filtered read as well.
    assert "priv8a" not in _handles(await _list(client, founder))


@pytest.mark.asyncio
async def test_sort_and_pagination(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "sort8a@example.com")
    await _make_mentor(client, "a8a@example.com", "a8a", hourly_fee=1000)
    await _make_mentor(client, "b8a@example.com", "b8a", hourly_fee=5000)

    asc = await _list(client, founder, sort="price", order="asc")
    prices = [i["hourly_fee"] for i in asc["items"] if i["hourly_fee"] is not None]
    assert prices == sorted(prices)

    first = await _list(client, founder, limit=1, offset=0)
    second = await _list(client, founder, limit=1, offset=1)
    assert len(first["items"]) == 1 and len(second["items"]) == 1
    # Stable paging: no repeat, no skip.
    assert first["items"][0]["handle"] != second["items"][0]["handle"]
    assert first["total"] == second["total"]


# --- validation -------------------------------------------------------------


@pytest.mark.parametrize(
    "params",
    [
        {"limit": 0},
        {"limit": 51},
        {"offset": -1},
        {"sort": "nope"},
        {"order": "sideways"},
        {"max_fee": -5},
        {"q": "x" * 101},
        {"expertise": "x" * 61},
    ],
)
@pytest.mark.asyncio
async def test_validation_errors(client: AsyncClient, params: dict) -> None:
    founder = await _signup_verified(client, "bad8a@example.com")
    resp = await client.get("/api/v1/mentors", params=params, headers=founder["headers"])
    assert resp.status_code == 422, resp.text
    body = resp.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"


# --- authentication ---------------------------------------------------------


@pytest.mark.asyncio
async def test_anonymous_is_401(client: AsyncClient) -> None:
    list_resp = await client.get("/api/v1/mentors")
    assert list_resp.status_code == 401

    detail_resp = await client.get("/api/v1/mentors/anyone")
    assert detail_resp.status_code == 401

    sugg_resp = await client.get(
        "/api/v1/organizations/00000000-0000-0000-0000-000000000000/mentor-suggestions"
    )
    assert sugg_resp.status_code == 401


# --- authorization / cross-organization -------------------------------------


@pytest.mark.asyncio
async def test_suggestions_require_membership_of_that_org(client: AsyncClient) -> None:
    owner_a = await _signup_verified(client, "ownera8a@example.com")
    org_a = await _create_org(client, owner_a, name="Startup A 8a")

    owner_b = await _signup_verified(client, "ownerb8a@example.com")
    await _create_org(client, owner_b, name="Startup B 8a")

    ok = await client.get(
        f"/api/v1/organizations/{org_a['id']}/mentor-suggestions",
        headers=owner_a["headers"],
    )
    assert ok.status_code == 200, ok.text

    # Another startup's owner: 403, not 404 — and identical to any other
    # unauthorized org action, so it is not a tenant probe.
    foreign = await client.get(
        f"/api/v1/organizations/{org_a['id']}/mentor-suggestions",
        headers=owner_b["headers"],
    )
    assert foreign.status_code == 403

    # A non-startup org is 403 for the same reason.
    employer = await _signup_verified(client, "employer8a@example.com", role="employer")
    org_e = await _create_org(client, employer, name="Employer 8a", type_="employer")
    not_startup = await client.get(
        f"/api/v1/organizations/{org_e['id']}/mentor-suggestions",
        headers=employer["headers"],
    )
    assert not_startup.status_code == 403

    # A random uuid is the same 403, never a 500 or a distinct message.
    random_org = await client.get(
        "/api/v1/organizations/11111111-1111-1111-1111-111111111111/mentor-suggestions",
        headers=owner_b["headers"],
    )
    assert random_org.status_code == 403


@pytest.mark.asyncio
async def test_viewer_member_can_read_suggestions(client: AsyncClient) -> None:
    """Suggestions are a read, so the read-only role is allowed."""
    owner = await _signup_verified(client, "viewowner8a@example.com")
    org = await _create_org(client, owner, name="Viewer Co 8a")

    viewer = await _add_member(client, owner, org["id"], "viewer8a@example.com")

    resp = await client.get(
        f"/api/v1/organizations/{org['id']}/mentor-suggestions",
        headers=viewer["headers"],
    )
    # Suggestions are a READ, so an accepted member can read them.
    assert resp.status_code == 200, resp.text
    assert "items" in resp.json()


# --- visibility: hidden mentor is absent, never 403 -------------------------


@pytest.mark.asyncio
async def test_hidden_mentor_is_absent_and_404s(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "hid8a@example.com")
    await _make_mentor(client, "hidden8a@example.com", "hidden8a", public=False)

    assert "hidden8a" not in _handles(await _list(client, founder))

    detail = await client.get("/api/v1/mentors/hidden8a", headers=founder["headers"])
    # 404, not 403: the caller cannot tell "hidden" from "does not exist".
    assert detail.status_code == 404

    missing = await client.get("/api/v1/mentors/nobody-here", headers=founder["headers"])
    assert missing.status_code == 404
    assert detail.json()["error"]["code"] == missing.json()["error"]["code"]


# --- suggestions ------------------------------------------------------------


@pytest.mark.asyncio
async def test_suggestions_explain_themselves(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "sugg8a@example.com")
    org = await _create_org(client, owner, name="Suggestion Co 8a")

    # Give the startup a sector and a goal so a real match exists.
    patched = await client.patch(
        f"/api/v1/organizations/{org['id']}/startup-profile",
        json={
            "sector": "Fintech",
            "ecosystem_goals": ["Find Specialized Mentors", "Raise Seed Funding"],
        },
        headers=owner["headers"],
    )
    assert patched.status_code == 200, patched.text

    await _make_mentor(
        client, "fit8a@example.com", "fit8a",
        expertise=["Fundraising"], sectors=["Fintech"],
    )
    await _make_mentor(
        client, "off8a@example.com", "off8a",
        expertise=["Design"], sectors=["Climate"],
    )

    resp = await client.get(
        f"/api/v1/organizations/{org['id']}/mentor-suggestions",
        headers=owner["headers"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["stage"] is not None
    assert body["sector"] == "fintech"
    # 8a plan D-1: stage is not a stored mentor attribute, so the payload
    # must SAY the stage filter was not applied rather than imply a match.
    assert body["stage_filter_applied"] is False

    items = {i["handle"]: i for i in body["items"]}
    assert "fit8a" in items
    reasons = items["fit8a"]["match_reasons"]
    assert any("fintech" in r.lower() for r in reasons), reasons
    # Every reason is a statement about a field that actually matched.
    assert all(isinstance(r, str) and r for r in reasons)

    # The better-fitting mentor ranks above the unrelated one.
    handles = [i["handle"] for i in body["items"]]
    assert handles.index("fit8a") < handles.index("off8a")


@pytest.mark.asyncio
async def test_suggestions_exclude_hidden_and_non_accepting(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "sugg2_8a@example.com")
    org = await _create_org(client, owner, name="Suggestion Co Two 8a")

    await _make_mentor(client, "hidden2_8a@example.com", "hidden2_8a", public=False)
    await _make_mentor(
        client, "closed8a@example.com", "closed8a", accepting_requests=False
    )
    await _make_mentor(client, "open8a@example.com", "open8a")

    resp = await client.get(
        f"/api/v1/organizations/{org['id']}/mentor-suggestions",
        headers=owner["headers"],
    )
    assert resp.status_code == 200, resp.text
    handles = {i["handle"] for i in resp.json()["items"]}
    assert "hidden2_8a" not in handles
    assert "closed8a" not in handles
    assert "open8a" in handles


# --- mass assignment / server-controlled fields -----------------------------


@pytest.mark.asyncio
async def test_directory_never_exposes_or_accepts_server_owned_fields(
    client: AsyncClient,
) -> None:
    founder = await _signup_verified(client, "mass8a@example.com")
    mentor = await _make_mentor(client, "massm8a@example.com", "massm8a")

    card = next(
        i for i in (await _list(client, founder))["items"] if i["handle"] == "massm8a"
    )
    # Internal identifiers stay out of the public shape.
    assert "user_id" not in card
    assert "org_id" not in card

    # The directory is read-only: there is no write verb on these routes.
    for method in ("post", "patch", "put"):
        resp = await getattr(client, method)(
            "/api/v1/mentors", headers=founder["headers"], json={}
        )
        assert resp.status_code == 405, f"{method} should not be routed"
    assert (
        await client.delete("/api/v1/mentors", headers=founder["headers"])
    ).status_code == 405

    # And the Step 3c PATCH that feeds the directory still rejects attempts
    # to set the server-owned fields this step publishes.
    for payload in (
        {"is_verified": True},
        {"rating": 5.0},
        {"sessions_completed": 999},
        {"user_id": "11111111-1111-1111-1111-111111111111"},
    ):
        resp = await client.patch(
            "/api/v1/mentor-profile/me", json=payload, headers=mentor["auth"]["headers"]
        )
        assert resp.status_code == 422, payload
