"""Step 5h tests: startup discovery, visibility by viewer class, filters.

Covers, per AGENTS.md section 7 and the 5h plan:
- happy path (anonymous + signed-in) and pagination/sort,
- validation errors (bad sort/stage/limit, over-long q/sector/city),
- 401 (signed-in list without a token),
- the visibility matrix: every one of the four ``profile_visibility``
  values against anonymous / jobseeker / investor / mentor / member,
- section toggles (summary_public, traction_public, readiness_public) on
  discovery cards, including the previously-unenforced readiness toggle,
- cross-organization leakage: a private startup never appears to an
  outsider, and a member of ANOTHER org gets no extra access,
- mass assignment: discovery is read-only, so the 5a server-controlled
  fields are proven to stay out of the payload and to stay unwritable
  through the profile PATCH that feeds discovery.

Only visible rows are asserted; "not visible" always means ABSENT from the
list (and 404 on the detail read), never a redacted item.
"""

import re
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.startup import StartupProfile
from app.tests.conftest import TestSessionFactory

PASSWORD = "Str0ng!Password99"

VISIBILITIES = ["private", "mentors", "mentors_and_investors", "public"]


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


async def _create_org(
    client: AsyncClient, auth: dict, *, name: str = "Acme Rockets", type_: str = "startup"
) -> dict:
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": name, "type": type_},
        headers=auth["headers"],
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _patch_profile(
    client: AsyncClient, auth: dict, org_id: str, payload: dict
) -> dict:
    resp = await client.patch(
        f"/api/v1/organizations/{org_id}/startup-profile",
        json=payload,
        headers=auth["headers"],
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _patch_org(client: AsyncClient, auth: dict, org_id: str, payload: dict) -> dict:
    resp = await client.patch(
        f"/api/v1/organizations/{org_id}", json=payload, headers=auth["headers"]
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _make_startup(
    client: AsyncClient,
    email: str,
    *,
    name: str,
    visibility: str = "public",
    **profile: object,
) -> dict:
    """A founder + their startup profile, returned with its slug."""
    auth = await _signup_verified(client, email, role="startup")
    org = await _create_org(client, auth, name=name)
    await _patch_profile(
        client, auth, org["id"], {"profile_visibility": visibility, **profile}
    )
    return {"auth": auth, "org": org, "slug": org["slug"], "name": name}


async def _list(
    client: AsyncClient, auth: dict | None = None, **params: str | int
) -> dict:
    headers = auth["headers"] if auth else {}
    resp = await client.get("/api/v1/startups", params=params, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _public_list(client: AsyncClient, **params: str | int) -> dict:
    resp = await client.get("/api/v1/public/startups", params=params)
    assert resp.status_code == 200, resp.text
    return resp.json()


def _slugs(page: dict) -> set[str]:
    return {item["slug"] for item in page["items"]}


async def _set_stored_field(org_id: str, **values: object) -> None:
    """Write a SERVER-CONTROLLED column out of band.

    ``mentor_verified`` / ``readiness_score`` have no client-facing write
    path by design (5a), and the readiness/mentor flows that own them are
    later steps. Tests therefore set them on the row directly, exactly like
    test_readiness does for the same fields.
    """
    async with TestSessionFactory() as session:
        row = (
            await session.execute(
                select(StartupProfile).where(
                    StartupProfile.org_id == uuid.UUID(org_id)
                )
            )
        ).scalar_one()
        for field, value in values.items():
            setattr(row, field, value)
        await session.commit()


# --- anonymous discovery: happy path ---------------------------------------


@pytest.mark.asyncio
async def test_public_list_returns_public_startups(client: AsyncClient) -> None:
    a = await _make_startup(
        client,
        "founder-a@example.com",
        name="Alpha Labs",
        tagline="Cheap solar",
        stage="prototype",
        sector="Climate",
    )
    await _patch_org(client, a["auth"], a["org"]["id"], {"city": "Kolkata"})

    page = await _public_list(client)
    assert page["total"] == 1
    assert page["limit"] == 20
    assert page["offset"] == 0
    item = page["items"][0]
    assert item["slug"] == a["slug"]
    assert item["name"] == "Alpha Labs"
    assert item["tagline"] == "Cheap solar"
    assert item["stage"] == "prototype"
    assert item["sector"] == "Climate"
    assert item["city"] == "Kolkata"
    # D6: membership of the list already implies visibility.
    assert "visible_to_public" not in item
    assert "visibility" not in item


@pytest.mark.asyncio
async def test_public_list_empty_when_nothing_public(client: AsyncClient) -> None:
    await _make_startup(
        client, "founder-b@example.com", name="Hidden Inc", visibility="private"
    )
    page = await _public_list(client)
    assert page["items"] == []
    assert page["total"] == 0


@pytest.mark.asyncio
async def test_public_list_excludes_non_live_orgs(client: AsyncClient) -> None:
    """type/status/deleted filters mirror the 5a detail read."""
    live = await _make_startup(client, "live@example.com", name="Live Co")
    other = await _signup_verified(client, "employer@example.com", role="employer")
    await _create_org(client, other, name="Not A Startup", type_="employer")

    page = await _public_list(client)
    assert _slugs(page) == {live["slug"]}


# --- the visibility matrix -------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize("visibility", VISIBILITIES)
async def test_anonymous_sees_only_public(client: AsyncClient, visibility: str) -> None:
    startup = await _make_startup(
        client, f"anon-{visibility}@example.com", name=f"Co {visibility}", visibility=visibility
    )
    page = await _public_list(client)
    if visibility == "public":
        assert _slugs(page) == {startup["slug"]}
    else:
        assert page["items"] == []
        assert page["total"] == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("visibility", VISIBILITIES)
async def test_jobseeker_sees_only_public(client: AsyncClient, visibility: str) -> None:
    startup = await _make_startup(
        client, f"js-{visibility}@example.com", name=f"Co {visibility}", visibility=visibility
    )
    viewer = await _signup_verified(client, "seeker@example.com", role="jobseeker")
    page = await _list(client, viewer)
    if visibility == "public":
        assert _slugs(page) == {startup["slug"]}
    else:
        assert page["items"] == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("visibility", "visible"),
    [
        ("private", False),
        ("mentors", False),
        ("mentors_and_investors", True),
        ("public", True),
    ],
)
async def test_investor_sees_mentors_and_investors(
    client: AsyncClient, visibility: str, visible: bool
) -> None:
    startup = await _make_startup(
        client, f"inv-{visibility}@example.com", name=f"Co {visibility}", visibility=visibility
    )
    viewer = await _signup_verified(client, "inv@example.com", role="investor")
    page = await _list(client, viewer)
    assert (_slugs(page) == {startup["slug"]}) is visible


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("visibility", "visible"),
    [
        ("private", False),
        ("mentors", True),
        ("mentors_and_investors", True),
        ("public", True),
    ],
)
async def test_mentor_sees_mentors(
    client: AsyncClient, visibility: str, visible: bool
) -> None:
    startup = await _make_startup(
        client, f"men-{visibility}@example.com", name=f"Co {visibility}", visibility=visibility
    )
    viewer = await _signup_verified(client, "mentor@example.com", role="mentor")
    page = await _list(client, viewer)
    assert (_slugs(page) == {startup["slug"]}) is visible


@pytest.mark.asyncio
async def test_member_sees_own_private_startup_only(client: AsyncClient) -> None:
    """``private`` means own-workspace-only: members still see their own row
    (it is their own data), and no outsider does."""
    mine = await _make_startup(
        client, "owner@example.com", name="My Private Co", visibility="private"
    )
    page = await _list(client, mine["auth"])
    assert _slugs(page) == {mine["slug"]}
    # ...but it is absent for every other class, anonymous included.
    assert (await _public_list(client))["items"] == []
    other = await _signup_verified(client, "other-founder@example.com", role="startup")
    assert (await _list(client, other))["items"] == []


@pytest.mark.asyncio
async def test_member_of_other_org_gets_no_extra_access(client: AsyncClient) -> None:
    """Cross-organization: being a member of org A grants nothing on org B,
    even when both founders share the ``startup`` role."""
    hidden = await _make_startup(
        client, "b-founder@example.com", name="B Hidden", visibility="mentors"
    )
    outsider = await _signup_verified(client, "a-founder@example.com", role="startup")
    await _create_org(client, outsider, name="A Co")
    assert hidden["slug"] not in _slugs(await _list(client, outsider))


@pytest.mark.asyncio
async def test_detail_read_still_404s_for_non_public(client: AsyncClient) -> None:
    """The 5a detail contract is unchanged by this step."""
    startup = await _make_startup(
        client, "detail@example.com", name="Detail Co", visibility="mentors"
    )
    viewer = await _signup_verified(client, "mentor2@example.com", role="mentor")
    # The mentor finds it in discovery...
    assert startup["slug"] in _slugs(await _list(client, viewer))
    # ...but the anonymous detail read is still a 404 (5a rule).
    resp = await client.get(f"/api/v1/public/startups/{startup['slug']}")
    assert resp.status_code == 404


# --- section toggles -------------------------------------------------------


@pytest.mark.asyncio
async def test_summary_and_traction_toggles_on_card(client: AsyncClient) -> None:
    await _make_startup(
        client,
        "toggles@example.com",
        name="Toggle Co",
        tagline="Kept",
        traction_summary="Hidden traction",
        summary_public=False,
        traction_public=False,
    )
    # The org summary is part of the gated summary section.
    auth_org = (await _public_list(client))["items"][0]
    assert auth_org["tagline"] == "Kept"  # core survives
    assert auth_org["summary"] is None
    assert auth_org["traction_summary"] is None


@pytest.mark.asyncio
async def test_summary_shown_when_toggle_on(client: AsyncClient) -> None:
    startup = await _make_startup(client, "sum@example.com", name="Sum Co")
    await _patch_org(
        client, startup["auth"], startup["org"]["id"], {"summary": "We build rockets."}
    )
    item = (await _public_list(client))["items"][0]
    assert item["summary"] == "We build rockets."


@pytest.mark.asyncio
async def test_readiness_toggle_now_enforced(client: AsyncClient) -> None:
    """``readiness_public`` was stored but enforced nowhere before 5h."""
    startup = await _make_startup(
        client, "ready@example.com", name="Ready Co", readiness_public=True
    )
    await _set_stored_field(startup["org"]["id"], readiness_score=72)

    item = (await _public_list(client))["items"][0]
    assert item["readiness_score"] == 72

    # Toggle it off: the score disappears from the card.
    await _patch_profile(
        client, startup["auth"], startup["org"]["id"], {"readiness_public": False}
    )
    item = (await _public_list(client))["items"][0]
    assert item["readiness_score"] is None


@pytest.mark.asyncio
async def test_mentor_verified_badge_is_public(client: AsyncClient) -> None:
    startup = await _make_startup(client, "badge@example.com", name="Badge Co")
    item = (await _public_list(client))["items"][0]
    assert item["mentor_verified"] is False  # never true by default

    await _set_stored_field(startup["org"]["id"], mentor_verified=True)
    item = (await _public_list(client))["items"][0]
    assert item["mentor_verified"] is True


# --- filters ---------------------------------------------------------------


@pytest.mark.asyncio
async def test_filter_by_stage(client: AsyncClient) -> None:
    idea = await _make_startup(client, "s1@example.com", name="Idea Co", stage="idea")
    growth = await _make_startup(client, "s2@example.com", name="Grow Co", stage="growth")

    assert _slugs(await _public_list(client, stage="growth")) == {growth["slug"]}
    assert _slugs(await _public_list(client, stage="idea")) == {idea["slug"]}
    assert (await _public_list(client, stage="mature"))["items"] == []


@pytest.mark.asyncio
async def test_filter_by_sector_is_case_insensitive(client: AsyncClient) -> None:
    fin = await _make_startup(client, "f1@example.com", name="Pay Co", sector="Fintech")
    await _make_startup(client, "f2@example.com", name="Farm Co", sector="Agritech")

    assert _slugs(await _public_list(client, sector="fintech")) == {fin["slug"]}
    assert _slugs(await _public_list(client, sector="FINTECH")) == {fin["slug"]}


@pytest.mark.asyncio
async def test_filter_by_location(client: AsyncClient) -> None:
    """``location`` is ``organizations.city`` (5a deviation), matched
    case-insensitively."""
    a = await _make_startup(client, "l1@example.com", name="Kolkata Co")
    await _patch_org(client, a["auth"], a["org"]["id"], {"city": "Kolkata"})
    b = await _make_startup(client, "l2@example.com", name="Pune Co")
    await _patch_org(client, b["auth"], b["org"]["id"], {"city": "Pune"})

    assert _slugs(await _public_list(client, city="kolkata")) == {a["slug"]}
    assert (await _public_list(client, city="Delhi"))["items"] == []


@pytest.mark.asyncio
async def test_text_search(client: AsyncClient) -> None:
    a = await _make_startup(
        client, "q1@example.com", name="Solaris Energy", tagline="Rooftop solar"
    )
    await _make_startup(client, "q2@example.com", name="Aqua Farms", tagline="Fish feed")

    assert _slugs(await _public_list(client, q="solar")) == {a["slug"]}
    assert _slugs(await _public_list(client, q="SOLAR")) == {a["slug"]}
    # Multiple terms are ANDed.
    assert _slugs(await _public_list(client, q="solaris rooftop")) == {a["slug"]}
    assert (await _public_list(client, q="solaris aqua"))["items"] == []


@pytest.mark.asyncio
async def test_text_search_escapes_like_wildcards(client: AsyncClient) -> None:
    """A literal '%' must not act as a wildcard (LIKE injection)."""
    a = await _make_startup(client, "w1@example.com", name="50% Off Labs")
    await _make_startup(client, "w2@example.com", name="Plain Co")

    assert _slugs(await _public_list(client, q="50%")) == {a["slug"]}
    # '%' alone must be a LITERAL: unescaped it would match every row, so
    # only the startup whose name actually contains '%' may come back.
    assert _slugs(await _public_list(client, q="%")) == {a["slug"]}
    # Same for '_': only rows containing a literal underscore.
    assert (await _public_list(client, q="_"))["items"] == []


@pytest.mark.asyncio
async def test_filters_combine(client: AsyncClient) -> None:
    match = await _make_startup(
        client, "c1@example.com", name="Match Co", stage="growth", sector="SaaS"
    )
    await _make_startup(
        client, "c2@example.com", name="Wrong Stage", stage="idea", sector="SaaS"
    )
    await _make_startup(
        client, "c3@example.com", name="Wrong Sector", stage="growth", sector="Fintech"
    )

    page = await _public_list(client, stage="growth", sector="SaaS")
    assert _slugs(page) == {match["slug"]}


@pytest.mark.asyncio
async def test_filters_cannot_reveal_hidden_rows(client: AsyncClient) -> None:
    """Filters narrow the visible set; they never widen it."""
    await _make_startup(
        client,
        "secret@example.com",
        name="Secret Co",
        visibility="private",
        stage="growth",
        sector="SaaS",
    )
    page = await _public_list(client, stage="growth", sector="SaaS", q="secret")
    assert page["items"] == []
    assert page["total"] == 0


# --- pagination and sorting ------------------------------------------------


@pytest.mark.asyncio
async def test_pagination_total_and_stable_order(client: AsyncClient) -> None:
    created = [
        await _make_startup(client, f"p{i}@example.com", name=f"Co {i:02d}")
        for i in range(5)
    ]
    expected = {s["slug"] for s in created}

    first = await _public_list(client, limit=2, offset=0)
    second = await _public_list(client, limit=2, offset=2)
    third = await _public_list(client, limit=2, offset=4)

    assert first["total"] == second["total"] == third["total"] == 5
    seen = [i["slug"] for p in (first, second, third) for i in p["items"]]
    assert len(seen) == 5
    assert len(set(seen)) == 5  # no repeats / no skips
    assert set(seen) == expected


@pytest.mark.asyncio
async def test_sort_by_name(client: AsyncClient) -> None:
    await _make_startup(client, "n1@example.com", name="Zebra Co")
    await _make_startup(client, "n2@example.com", name="Apple Co")

    asc = (await _public_list(client, sort="name", order="asc"))["items"]
    assert [i["name"] for i in asc] == ["Apple Co", "Zebra Co"]
    desc = (await _public_list(client, sort="name", order="desc"))["items"]
    assert [i["name"] for i in desc] == ["Zebra Co", "Apple Co"]


@pytest.mark.asyncio
async def test_sort_by_stage_uses_enum_rank(client: AsyncClient) -> None:
    """Lexicographic order would give idea < growth incorrectly; the rank
    order is idea, prototype, early_revenue, growth, mature."""
    await _make_startup(client, "st1@example.com", name="G", stage="growth")
    await _make_startup(client, "st2@example.com", name="I", stage="idea")
    await _make_startup(client, "st3@example.com", name="M", stage="mature")

    items = (await _public_list(client, sort="stage", order="asc"))["items"]
    assert [i["stage"] for i in items] == ["idea", "growth", "mature"]


@pytest.mark.asyncio
async def test_offset_beyond_total_returns_empty_page(client: AsyncClient) -> None:
    await _make_startup(client, "one@example.com", name="Only Co")
    page = await _public_list(client, offset=100)
    assert page["items"] == []
    assert page["total"] == 1


# --- authentication --------------------------------------------------------


@pytest.mark.asyncio
async def test_signed_in_list_requires_token(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/startups")
    assert resp.status_code == 401
    assert "error" in resp.json()


@pytest.mark.asyncio
async def test_signed_in_list_rejects_bad_token(client: AsyncClient) -> None:
    resp = await client.get(
        "/api/v1/startups", headers={"Authorization": "Bearer not-a-token"}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_public_list_needs_no_token_and_ignores_one(client: AsyncClient) -> None:
    """A token is not required; when present it must not widen the
    ANONYMOUS endpoint (it stays the public directory)."""
    await _make_startup(client, "priv@example.com", name="Priv Co", visibility="mentors")
    mentor = await _signup_verified(client, "mt@example.com", role="mentor")

    anon = await _public_list(client)
    with_token = await client.get(
        "/api/v1/public/startups", headers=mentor["headers"]
    )
    assert anon["total"] == with_token.json()["total"] == 0


# --- validation errors -----------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "params",
    [
        {"limit": 0},
        {"limit": 51},
        {"offset": -1},
        {"sort": "nope"},
        {"order": "sideways"},
        {"stage": "series_z"},
        {"q": "x" * 101},
        {"sector": "x" * 101},
        {"city": "x" * 101},
    ],
)
async def test_invalid_query_params_422(client: AsyncClient, params: dict) -> None:
    resp = await client.get("/api/v1/public/startups", params=params)
    assert resp.status_code == 422, (params, resp.text)


@pytest.mark.asyncio
async def test_invalid_query_params_422_signed_in(client: AsyncClient) -> None:
    viewer = await _signup_verified(client, "v@example.com", role="investor")
    resp = await client.get("/api/v1/startups", params={"limit": 999}, headers=viewer["headers"])
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_query_is_bounded_at_the_edge_and_trimmed(
    client: AsyncClient,
) -> None:
    """Over-long input is rejected at the boundary (422, not a 500 or a
    silent full scan); a padded value within the limit still works because
    the service trims it before searching."""
    over = await client.get("/api/v1/public/startups", params={"q": "a" * 200})
    assert over.status_code == 422

    ok = await _public_list(client, q="   " + "a" * 60 + "   ")
    assert ok["total"] == 0


# --- mass assignment / server-controlled fields ----------------------------


@pytest.mark.asyncio
async def test_discovery_payload_exposes_no_private_columns(client: AsyncClient) -> None:
    await _make_startup(client, "cols@example.com", name="Cols Co")
    item = (await _public_list(client))["items"][0]
    for forbidden in (
        "org_id",
        "profile_visibility",
        "summary_public",
        "traction_public",
        "readiness_public",
        "contacts_public",
        "funding_public",
        "round_public",
        "team_public",
        "created_at",
        "updated_at",
    ):
        assert forbidden not in item, forbidden


@pytest.mark.asyncio
async def test_server_controlled_fields_still_unwritable(client: AsyncClient) -> None:
    """Discovery reads what the profile PATCH writes; that write path must
    keep rejecting mass assignment (5a contract, re-asserted here because
    discovery would otherwise surface anything the PATCH let through)."""
    startup = await _make_startup(client, "ma@example.com", name="MA Co")
    for field, value in (
        ("mentor_verified", True),
        ("readiness_score", 99),
        ("org_id", "00000000-0000-0000-0000-000000000000"),
    ):
        resp = await client.patch(
            f"/api/v1/organizations/{startup['org']['id']}/startup-profile",
            json={field: value},
            headers=startup["auth"]["headers"],
        )
        assert resp.status_code == 422, (field, resp.text)

    item = (await _public_list(client))["items"][0]
    assert item["mentor_verified"] is False
    assert item["readiness_score"] is None


@pytest.mark.asyncio
async def test_no_write_methods_on_discovery(client: AsyncClient) -> None:
    """Discovery is read-only: POST/PATCH/DELETE do not exist."""
    for path in ("/api/v1/public/startups", "/api/v1/startups"):
        assert (await client.post(path, json={})).status_code == 405
        assert (await client.put(path, json={})).status_code == 405
        assert (await client.patch(path, json={})).status_code == 405
        # DELETE is 405 on the public list; on the member list the token
        # check runs first, so a 401 is equally proof that no write exists.
        assert (await client.delete(path, headers={})).status_code in (401, 405)


@pytest.mark.asyncio
async def test_get_discoverable_startup_visibility(client: AsyncClient) -> None:
    """GET /startups/{identifier} enforces the same visibility policy as the list."""
    startup = await _make_startup(
        client,
        "mentor_only@example.com",
        name="Mentor Target Co",
        visibility="mentors",
        tagline="Building for mentors",
        problem="Hard problems",
        solution="Great solutions",
    )
    slug = startup["slug"]
    org_id = startup["org"]["id"]

    # 1. Anonymous -> 401
    anon_resp = await client.get(f"/api/v1/startups/{slug}")
    assert anon_resp.status_code == 401

    # 2. Jobseeker -> 404 (mentors-only startup not visible to jobseeker)
    jobseeker_auth = await _signup_verified(
        client, "js_disco@example.com", role="jobseeker"
    )
    js_resp = await client.get(
        f"/api/v1/startups/{slug}", headers=jobseeker_auth["headers"]
    )
    assert js_resp.status_code == 404
    assert js_resp.json()["error"]["code"] == "STARTUP_NOT_FOUND"

    # 3. Mentor -> 200 by slug and by org_id
    mentor_auth = await _signup_verified(
        client, "mentor_disco@example.com", role="mentor"
    )
    await client.patch(
        "/api/v1/mentor-profile/me",
        json={"headline": "Growth Advisor", "accepting_requests": True},
        headers=mentor_auth["headers"],
    )
    mentor_resp_slug = await client.get(
        f"/api/v1/startups/{slug}", headers=mentor_auth["headers"]
    )
    assert mentor_resp_slug.status_code == 200, mentor_resp_slug.text
    detail = mentor_resp_slug.json()
    assert detail["name"] == "Mentor Target Co"
    assert detail["tagline"] == "Building for mentors"
    assert detail["problem"] == "Hard problems"
    assert detail["solution"] == "Great solutions"
    assert detail["id"] == org_id
    assert detail["is_member"] is False
    assert detail["existing_mentorship_id"] is None
    assert detail["existing_mentorship_status"] is None

    # Fetching by uuid identifier also works
    mentor_resp_id = await client.get(
        f"/api/v1/startups/{org_id}", headers=mentor_auth["headers"]
    )
    assert mentor_resp_id.status_code == 200
    assert mentor_resp_id.json()["slug"] == slug

    # When a mentorship request exists between this mentor and startup:
    mentor_me = (await client.get("/api/v1/users/me", headers=mentor_auth["headers"])).json()
    req_resp = await client.post(
        f"/api/v1/organizations/{org_id}/mentorships",
        json={"mentor_id": mentor_me["id"], "goal": "Scale engineering team"},
        headers=startup["auth"]["headers"],
    )
    assert req_resp.status_code == 201, req_resp.text
    mentorship_id = req_resp.json()["id"]

    # Re-fetch as mentor: existing_mentorship_id is now populated!
    mentor_after = (
        await client.get(f"/api/v1/startups/{slug}", headers=mentor_auth["headers"])
    ).json()
    assert mentor_after["existing_mentorship_id"] == mentorship_id
    assert mentor_after["existing_mentorship_status"] == "requested"


