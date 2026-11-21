"""Browser sessions use HttpOnly cookies and reject simple CSRF requests."""
from httpx import AsyncClient

from app.tests.test_milestones import _signup_verified


async def test_cookie_session_refresh_csrf_logout(client: AsyncClient) -> None:
    await _signup_verified(client, "browser@example.com")
    headers = {"X-Forma-Client": "browser"}
    credentials = {"email": "browser@example.com", "password": "Str0ng!Password99"}
    assert (await client.post("/api/v1/auth/browser/login", json=credentials)).status_code == 403
    res = await client.post("/api/v1/auth/browser/login", headers=headers, json=credentials)
    assert res.status_code == 200, res.text
    assert "access_token" not in res.json() and "refresh_token" not in res.json()
    assert all("HttpOnly" in c and "SameSite=strict" in c for c in res.headers.get_list("set-cookie"))
    assert (await client.get("/api/v1/users/me")).status_code == 200
    assert (await client.patch("/api/v1/users/me", json={"display_name": "CSRF"})).status_code == 403
    assert (await client.patch("/api/v1/users/me", headers=headers, json={"display_name": "Safe"})).status_code == 200
    assert (await client.post("/api/v1/auth/browser/refresh")).status_code == 403
    assert (await client.post("/api/v1/auth/browser/refresh", headers=headers)).status_code == 200
    assert (await client.post("/api/v1/auth/browser/logout", headers=headers)).status_code == 204
    assert (await client.get("/api/v1/users/me")).status_code == 401
    assert (await client.post("/api/v1/auth/browser/refresh", headers=headers)).status_code == 401


async def test_browser_csrf_cors_and_secure_cookie(client: AsyncClient) -> None:
    await _signup_verified(client, "secure-browser@example.com")
    blocked = await client.options("/api/v1/auth/browser/login", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "x-forma-client"})
    assert blocked.status_code == 400
    allowed = await client.options("/api/v1/auth/browser/login", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "x-forma-client"})
    assert allowed.status_code == 200
    response = await client.post("/api/v1/auth/browser/login", headers={"X-Forma-Client": "browser", "X-Forwarded-Proto": "https"}, json={"email": "secure-browser@example.com", "password": "Str0ng!Password99"})
    assert response.status_code == 200
    assert all("Secure" in cookie and "HttpOnly" in cookie for cookie in response.headers.get_list("set-cookie"))
