"""Review access, validation, privacy and aggregate regression tests."""

from httpx import AsyncClient

from app.tests.test_session import _at, _pair, _signup


async def _completed(client: AsyncClient, ctx: dict) -> str:
    response = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json={
            "scheduled_at": _at(),
            "duration_min": 45,
            "attendees": [{"user_id": ctx["founder"]["id"]}],
        },
        headers=ctx["mentor"]["headers"],
    )
    assert response.status_code == 201, response.text
    sid = response.json()["id"]
    response = await client.post(
        f"/api/v1/sessions/{sid}/complete",
        json={"summary": "Discussed concrete next steps for the business."},
        headers=ctx["mentor"]["headers"],
    )
    assert response.status_code == 200, response.text
    return sid


async def test_review_private_once_and_withdraw(client: AsyncClient) -> None:
    ctx = await _pair(client, "review")
    sid = await _completed(client, ctx)
    url = f"/api/v1/sessions/{sid}/reviews"
    detail = await client.get(f"/api/v1/sessions/{sid}", headers=ctx["founder"]["headers"])
    assert detail.json()["can_review"] is True
    mentor_detail = await client.get(f"/api/v1/sessions/{sid}", headers=ctx["mentor"]["headers"])
    assert mentor_detail.json()["can_review"] is False
    data = {"rating": 5, "public_text": "Useful", "private_feedback": "Private"}
    assert (await client.post(url, json=data)).status_code == 401
    assert (
        await client.post(
            url, json={**data, "mentor_id": ctx["mentor"]["id"]}, headers=ctx["founder"]["headers"]
        )
    ).status_code == 422
    assert (
        await client.post(url, json={"rating": 6}, headers=ctx["founder"]["headers"])
    ).status_code == 422
    assert (await client.post(url, json=data, headers=ctx["mentor"]["headers"])).status_code == 403
    outsider = await _signup(client, "outsider-review@d8.dev")
    assert (await client.post(url, json=data, headers=outsider["headers"])).status_code == 404
    created = await client.post(url, json=data, headers=ctx["founder"]["headers"])
    assert created.status_code == 201, created.text
    rid = created.json()["id"]
    detail = await client.get(f"/api/v1/sessions/{sid}", headers=ctx["founder"]["headers"])
    assert detail.json()["can_review"] is False
    assert created.json()["public_consent"] is False
    assert (await client.post(url, json=data, headers=ctx["founder"]["headers"])).status_code == 409
    received = await client.get("/api/v1/mentor/reviews", headers=ctx["mentor"]["headers"])
    assert (
        received.status_code == 200 and received.json()["items"][0]["private_feedback"] == "Private"
    )
    assert received.json()["items"][0]["startup_name"] == "Co review"
    assert received.json()["items"][0]["session_topic"] is None
    assert (
        await client.delete(f"/api/v1/session-reviews/{rid}", headers=outsider["headers"])
    ).status_code == 404
    assert (
        await client.delete(f"/api/v1/session-reviews/{rid}", headers=ctx["founder"]["headers"])
    ).status_code == 204
    assert (await client.post(url, json=data, headers=ctx["founder"]["headers"])).status_code == 409


async def test_review_requires_completed_recorded_attendee(client: AsyncClient) -> None:
    ctx = await _pair(client, "notattendee")
    response = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": _at(), "duration_min": 45},
        headers=ctx["mentor"]["headers"],
    )
    assert response.status_code == 201, response.text
    sid = response.json()["id"]
    response = await client.post(
        f"/api/v1/sessions/{sid}/reviews", json={"rating": 4}, headers=ctx["founder"]["headers"]
    )
    assert response.status_code == 403


async def test_public_reviews_respect_consent_and_anonymity(client: AsyncClient) -> None:
    ctx = await _pair(client, "publicreview")
    sid = await _completed(client, ctx)
    created = await client.post(
        f"/api/v1/sessions/{sid}/reviews",
        json={
            "rating": 4,
            "public_text": "Excellent",
            "private_feedback": "Secret",
            "public_consent": True,
        },
        headers=ctx["founder"]["headers"],
    )
    assert created.status_code == 201, created.text
    handle = "mentorpublicreview"
    updated = await client.patch(
        "/api/v1/users/me",
        json={"handle": handle, "profile_public": True},
        headers=ctx["mentor"]["headers"],
    )
    assert updated.status_code == 200, updated.text
    public = await client.get(
        f"/api/v1/mentors/{handle}/reviews", headers=ctx["founder"]["headers"]
    )
    card = await client.get(f"/api/v1/mentors/{handle}", headers=ctx["founder"]["headers"])
    assert card.status_code == 200, card.text
    assert card.json()["rating"] is None
    assert card.json()["reviews_count"] == 1
    assert public.status_code == 200, public.text
    item = public.json()["items"][0]
    assert item["reviewer_name"] is None
    assert "private_feedback" not in item


async def test_rating_threshold_and_withdrawal(client: AsyncClient) -> None:
    ctx = await _pair(client, "threshold")
    updated = await client.patch(
        "/api/v1/users/me",
        json={"handle": "thresholdmentor", "profile_public": True},
        headers=ctx["mentor"]["headers"],
    )
    assert updated.status_code == 200, updated.text
    ids = []
    for value in (3, 4, 5):
        sid = await _completed(client, ctx)
        response = await client.post(
            f"/api/v1/sessions/{sid}/reviews",
            json={"rating": value, "public_consent": True},
            headers=ctx["founder"]["headers"],
        )
        assert response.status_code == 201, response.text
        ids.append(response.json()["id"])
    card = await client.get("/api/v1/mentors/thresholdmentor", headers=ctx["founder"]["headers"])
    assert card.status_code == 200, card.text
    assert card.json()["rating"] == 4
    assert card.json()["reviews_count"] == 3
    public = await client.get(
        "/api/v1/mentors/thresholdmentor/reviews", headers=ctx["founder"]["headers"]
    )
    assert public.status_code == 200 and public.json()["total"] == 3
    # A non-consenting rating must not change the public aggregate.
    private_sid = await _completed(client, ctx)
    private = await client.post(
        f"/api/v1/sessions/{private_sid}/reviews",
        json={"rating": 1},
        headers=ctx["founder"]["headers"],
    )
    assert private.status_code == 201, private.text
    card = await client.get("/api/v1/mentors/thresholdmentor", headers=ctx["founder"]["headers"])
    assert card.json()["rating"] == 4 and card.json()["reviews_count"] == 3
    removed = await client.delete(
        f"/api/v1/session-reviews/{ids[-1]}", headers=ctx["founder"]["headers"]
    )
    assert removed.status_code == 204
    card = await client.get("/api/v1/mentors/thresholdmentor", headers=ctx["founder"]["headers"])
    assert card.json()["rating"] is None and card.json()["reviews_count"] == 2
    # Q8: the stored rating follows the public rule, so the mentor's own
    # profile agrees with the card (2 consented reviews -> no rating yet).
    own = await client.get("/api/v1/mentor-profile/me", headers=ctx["mentor"]["headers"])
    assert own.json()["rating"] is None


async def test_unfinished_session_and_server_fields(client: AsyncClient) -> None:
    ctx = await _pair(client, "unfinished")
    response = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json={
            "scheduled_at": _at(),
            "duration_min": 45,
            "attendees": [{"user_id": ctx["founder"]["id"]}],
        },
        headers=ctx["mentor"]["headers"],
    )
    assert response.status_code == 201, response.text
    sid = response.json()["id"]
    url = f"/api/v1/sessions/{sid}/reviews"
    founder = ctx["founder"]["headers"]
    for name in ("reviewer_id", "session_id", "id", "created_at", "deleted_at"):
        response = await client.post(url, json={"rating": 5, name: "forbidden"}, headers=founder)
        assert response.status_code == 422, (name, response.text)
    assert (await client.post(url, json={"rating": 5}, headers=founder)).status_code == 409
    assert (await client.get(f"{url}/me", headers=founder)).status_code == 404
    assert (await client.get("/api/v1/mentor/reviews")).status_code == 401
    assert (await client.get("/api/v1/mentor/reviews", headers=founder)).status_code == 403


async def test_concurrent_reviews_preserve_aggregate_on_postgresql(client: AsyncClient) -> None:
    import asyncio

    import pytest

    from app.tests.conftest import TEST_DATABASE_URL

    if not TEST_DATABASE_URL.startswith("postgresql"):
        pytest.skip("row locks are only exercised on PostgreSQL")
    ctx = await _pair(client, "concurrent")
    sids = [await _completed(client, ctx) for _ in range(3)]
    responses = await asyncio.gather(
        *[
            client.post(
                f"/api/v1/sessions/{sid}/reviews",
                json={"rating": rating, "public_consent": True},
                headers=ctx["founder"]["headers"],
            )
            for sid, rating in zip(sids, (1, 5, 3), strict=True)
        ]
    )
    assert [r.status_code for r in responses] == [201, 201, 201], [r.text for r in responses]
    profile = await client.get("/api/v1/mentor-profile/me", headers=ctx["mentor"]["headers"])
    assert profile.json()["rating"] == 3


# --------------------------------------------------------- 8i close-out tests


async def _attended(client: AsyncClient, ctx: dict, attendee: dict) -> str:
    response = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": _at(), "duration_min": 45, "attendees": [{"user_id": attendee["id"]}]},
        headers=ctx["mentor"]["headers"],
    )
    assert response.status_code == 201, response.text
    sid = response.json()["id"]
    done = await client.post(
        f"/api/v1/sessions/{sid}/complete",
        json={"summary": "Discussed concrete next steps for the business."},
        headers=ctx["mentor"]["headers"],
    )
    assert done.status_code == 200, done.text
    return sid


async def test_author_can_withdraw_after_leaving_the_startup(client: AsyncClient) -> None:
    """Q9: ownership of the review is the only rule for withdrawing it."""
    from app.tests.test_deliverable import _member

    ctx = await _pair(client, "leaver")
    member = await _member(client, ctx["founder"], ctx["org_id"], "leaver-m@d8.dev", "member")
    sid = await _attended(client, ctx, member)
    created = await client.post(
        f"/api/v1/sessions/{sid}/reviews", json={"rating": 4}, headers=member["headers"]
    )
    assert created.status_code == 201, created.text
    removed = await client.delete(
        f"/api/v1/organizations/{ctx['org_id']}/members/{member['id']}",
        headers=ctx["founder"]["headers"],
    )
    assert removed.status_code in (200, 204), removed.text
    # They can no longer read the session's review endpoint...
    mine = await client.get(f"/api/v1/sessions/{sid}/reviews/me", headers=member["headers"])
    assert mine.status_code == 404
    # ...but can still take back what they wrote.
    withdrawn = await client.delete(
        f"/api/v1/session-reviews/{created.json()['id']}", headers=member["headers"]
    )
    assert withdrawn.status_code == 204
    received = await client.get("/api/v1/mentor/reviews", headers=ctx["mentor"]["headers"])
    assert received.json()["total"] == 0


async def test_viewer_attendee_cannot_review(client: AsyncClient) -> None:
    from app.tests.test_deliverable import _member

    ctx = await _pair(client, "viewerrev")
    viewer = await _member(client, ctx["founder"], ctx["org_id"], "viewerrev-v@d8.dev", "viewer")
    sid = await _attended(client, ctx, viewer)
    response = await client.post(
        f"/api/v1/sessions/{sid}/reviews", json={"rating": 5}, headers=viewer["headers"]
    )
    assert response.status_code == 403


async def test_review_routes_auth_and_cross_org(client: AsyncClient) -> None:
    ctx = await _pair(client, "xorgrev")
    other = await _pair(client, "xorgrev2")
    sid = await _completed(client, ctx)
    url = f"/api/v1/sessions/{sid}/reviews"
    created = await client.post(url, json={"rating": 4}, headers=ctx["founder"]["headers"])
    rid = created.json()["id"]
    for method, path, body in (
        ("POST", url, {"rating": 4}),
        ("GET", f"{url}/me", None),
        ("DELETE", f"/api/v1/session-reviews/{rid}", None),
        ("GET", "/api/v1/mentor/reviews", None),
        ("GET", "/api/v1/mentors/anyhandle/reviews", None),
    ):
        assert (await client.request(method, path, json=body)).status_code == 401, path
    # Another startup's founder: not found everywhere.
    h = other["founder"]["headers"]
    assert (await client.post(url, json={"rating": 1}, headers=h)).status_code == 404
    assert (await client.get(f"{url}/me", headers=h)).status_code == 404
    assert (await client.delete(f"/api/v1/session-reviews/{rid}", headers=h)).status_code == 404
    # Another mentor sees none of these reviews.
    theirs = await client.get("/api/v1/mentor/reviews", headers=other["mentor"]["headers"])
    assert theirs.json()["total"] == 0
    # A mentor with no public profile has no public review page.
    hidden = await client.get("/api/v1/mentors/nosuchhandle/reviews", headers=h)
    assert hidden.status_code == 404
    mine = await client.get(f"{url}/me", headers=ctx["founder"]["headers"])
    assert mine.status_code == 200 and mine.json()["id"] == rid


async def test_mentor_reviews_paginate(client: AsyncClient) -> None:
    ctx = await _pair(client, "pagerev")
    for rating in (3, 5):
        sid = await _completed(client, ctx)
        created = await client.post(
            f"/api/v1/sessions/{sid}/reviews",
            json={"rating": rating},
            headers=ctx["founder"]["headers"],
        )
        assert created.status_code == 201
    page = await client.get(
        "/api/v1/mentor/reviews", params={"limit": 1}, headers=ctx["mentor"]["headers"]
    )
    assert page.json()["total"] == 2 and len(page.json()["items"]) == 1
    bad = await client.get(
        "/api/v1/mentor/reviews", params={"limit": 0}, headers=ctx["mentor"]["headers"]
    )
    assert bad.status_code == 422
