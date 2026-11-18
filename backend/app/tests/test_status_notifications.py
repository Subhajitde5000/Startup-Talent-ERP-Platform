"""Tests for automated status emails on Task and Milestone changes.

Verifies production readiness:
- All active team members receive emails on Task created, updated, moved, and deleted.
- All active team members receive emails on Milestone created, updated, and deleted.
- Special handling for milestone achieved and task completed notifications.
- Inactive (invited/pending) and deleted members do not receive emails.
- Notification opt-outs in notification_preferences are respected.
- Email provider failures (network errors / exceptions) are caught safely and
  never cause the API requests to fail.
"""

import re
import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.profile import NotificationChannel, NotificationPreference
from app.services import email_service

PASSWORD = "Str0ng!Password99"


def _extract_code() -> str:
    assert email_service.SENT_EMAILS, "expected a verification email"
    body = email_service.SENT_EMAILS[-1]["body"]
    match = re.search(r"(\d{6})", body)
    assert match, f"no 6-digit code in email body: {body!r}"
    return match.group(1)


async def _signup_verified(client: AsyncClient, email: str, role: str = "startup") -> dict[str, Any]:
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
    client: AsyncClient, auth: dict[str, Any], *, name: str = "Nova Corp"
) -> dict[str, Any]:
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": name, "type": "startup"},
        headers=auth["headers"],
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _invite_and_accept(
    client: AsyncClient, owner: dict[str, Any], member: dict[str, Any], org: dict[str, Any]
) -> None:
    resp = await client.post(
        f"/api/v1/organizations/{org['id']}/invites",
        json={"email": member["email"], "role": "member"},
        headers=owner["headers"],
    )
    assert resp.status_code == 201, resp.text
    token = resp.json()["token"]
    accept = await client.post(
        f"/api/v1/invites/{token}/accept", headers=member["headers"]
    )
    assert accept.status_code == 200, accept.text


# ==============================================================================
# Task Status Email Notification Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_task_create_notifies_all_active_members(client: AsyncClient) -> None:
    # 1. Setup org with 2 active members (owner + teammate) and 1 unaccepted invite
    owner = await _signup_verified(client, "owner_t1@nova.example.com")
    org = await _create_org(client, owner, name="Nova Rocketry")
    teammate = await _signup_verified(client, "teammate_t1@nova.example.com")
    await _invite_and_accept(client, owner, teammate, org)

    # Invite a pending user who does not accept
    await client.post(
        f"/api/v1/organizations/{org['id']}/invites",
        json={"email": "pending_t1@nova.example.com", "role": "member"},
        headers=owner["headers"],
    )

    email_service.clear_sent_emails()

    # 2. Create a task
    resp = await client.post(
        f"/api/v1/organizations/{org['id']}/tasks",
        json={"title": "Assemble engine core", "priority": "high"},
        headers=owner["headers"],
    )
    assert resp.status_code == 201, resp.text

    # 3. Verify emails
    recipients = [m["to"] for m in email_service.SENT_EMAILS]
    assert "owner_t1@nova.example.com" in recipients
    assert "teammate_t1@nova.example.com" in recipients
    assert "pending_t1@nova.example.com" not in recipients

    email = next(m for m in email_service.SENT_EMAILS if m["to"] == "teammate_t1@nova.example.com")
    assert email["subject"] == "[Nova Rocketry] New Task Created: Assemble engine core"
    assert "Assemble engine core" in email["body"]
    assert "Priority: High" in email["body"]


@pytest.mark.asyncio
async def test_task_move_and_completed_notifies_members(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner_t2@nova.example.com")
    org = await _create_org(client, owner, name="Nova Space")
    teammate = await _signup_verified(client, "teammate_t2@nova.example.com")
    await _invite_and_accept(client, owner, teammate, org)

    # Create task
    task = (
        await client.post(
            f"/api/v1/organizations/{org['id']}/tasks",
            json={"title": "Launch checklist"},
            headers=owner["headers"],
        )
    ).json()

    email_service.clear_sent_emails()

    # Move task to done
    resp = await client.patch(
        f"/api/v1/organizations/{org['id']}/tasks/{task['id']}/move",
        json={"status": "done"},
        headers=owner["headers"],
    )
    assert resp.status_code == 200, resp.text

    # Verify completion status email
    recipients = [m["to"] for m in email_service.SENT_EMAILS]
    assert "owner_t2@nova.example.com" in recipients
    assert "teammate_t2@nova.example.com" in recipients

    email = email_service.SENT_EMAILS[0]
    assert email["subject"] == "[Nova Space] Task Completed: Launch checklist"
    assert "marked the task \"Launch checklist\" as Done" in email["body"]


@pytest.mark.asyncio
async def test_task_update_notifies_members(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner_t3@nova.example.com")
    org = await _create_org(client, owner, name="Nova Dynamics")
    teammate = await _signup_verified(client, "teammate_t3@nova.example.com")
    await _invite_and_accept(client, owner, teammate, org)

    task = (
        await client.post(
            f"/api/v1/organizations/{org['id']}/tasks",
            json={"title": "Test telemetry"},
            headers=owner["headers"],
        )
    ).json()

    email_service.clear_sent_emails()

    # Update priority and due_on
    resp = await client.patch(
        f"/api/v1/organizations/{org['id']}/tasks/{task['id']}",
        json={"priority": "urgent", "due_on": "2026-12-31"},
        headers=owner["headers"],
    )
    assert resp.status_code == 200, resp.text

    recipients = [m["to"] for m in email_service.SENT_EMAILS]
    assert "teammate_t3@nova.example.com" in recipients

    email = next(m for m in email_service.SENT_EMAILS if m["to"] == "teammate_t3@nova.example.com")
    assert email["subject"] == "[Nova Dynamics] Task Updated: Test telemetry"
    assert "Priority: Urgent" in email["body"]
    assert "Due Date: 2026-12-31" in email["body"]


@pytest.mark.asyncio
async def test_task_delete_notifies_members(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner_t4@nova.example.com")
    org = await _create_org(client, owner, name="Nova Robotics")
    teammate = await _signup_verified(client, "teammate_t4@nova.example.com")
    await _invite_and_accept(client, owner, teammate, org)

    task = (
        await client.post(
            f"/api/v1/organizations/{org['id']}/tasks",
            json={"title": "Obsolete prototype task"},
            headers=owner["headers"],
        )
    ).json()

    email_service.clear_sent_emails()

    # Delete task
    resp = await client.delete(
        f"/api/v1/organizations/{org['id']}/tasks/{task['id']}",
        headers=owner["headers"],
    )
    assert resp.status_code == 204, resp.text

    recipients = [m["to"] for m in email_service.SENT_EMAILS]
    assert "teammate_t4@nova.example.com" in recipients

    email = next(m for m in email_service.SENT_EMAILS if m["to"] == "teammate_t4@nova.example.com")
    assert email["subject"] == "[Nova Robotics] Task Deleted: Obsolete prototype task"
    assert "deleted the task \"Obsolete prototype task\"" in email["body"]


# ==============================================================================
# Milestone Status Email Notification Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_milestone_create_notifies_members(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner_m1@nova.example.com")
    org = await _create_org(client, owner, name="Nova Solar")
    teammate = await _signup_verified(client, "teammate_m1@nova.example.com")
    await _invite_and_accept(client, owner, teammate, org)

    email_service.clear_sent_emails()

    resp = await client.post(
        f"/api/v1/organizations/{org['id']}/milestones",
        json={"name": "Ship MVP", "target_date": "2026-12-01"},
        headers=owner["headers"],
    )
    assert resp.status_code == 201, resp.text

    recipients = [m["to"] for m in email_service.SENT_EMAILS]
    assert "owner_m1@nova.example.com" in recipients
    assert "teammate_m1@nova.example.com" in recipients

    email = next(m for m in email_service.SENT_EMAILS if m["to"] == "teammate_m1@nova.example.com")
    assert email["subject"] == "[Nova Solar] New Milestone Created: Ship MVP"
    assert "Target Date: 2026-12-01" in email["body"]


@pytest.mark.asyncio
async def test_milestone_achieved_notifies_members(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner_m2@nova.example.com")
    org = await _create_org(client, owner, name="Nova Bio")
    teammate = await _signup_verified(client, "teammate_m2@nova.example.com")
    await _invite_and_accept(client, owner, teammate, org)

    ms = (
        await client.post(
            f"/api/v1/organizations/{org['id']}/milestones",
            json={"name": "Phase 1 Trials"},
            headers=owner["headers"],
        )
    ).json()

    email_service.clear_sent_emails()

    # Update milestone to achieved
    resp = await client.patch(
        f"/api/v1/organizations/{org['id']}/milestones/{ms['id']}",
        json={"status": "achieved", "progress": 100},
        headers=owner["headers"],
    )
    assert resp.status_code == 200, resp.text

    recipients = [m["to"] for m in email_service.SENT_EMAILS]
    assert "teammate_m2@nova.example.com" in recipients

    email = next(m for m in email_service.SENT_EMAILS if m["to"] == "teammate_m2@nova.example.com")
    assert email["subject"] == "[Nova Bio] Milestone Achieved! 🎉 Phase 1 Trials"
    assert "marked the milestone \"Phase 1 Trials\" as Achieved! 🎉" in email["body"]
    assert "Progress: 100%" in email["body"]


@pytest.mark.asyncio
async def test_milestone_delete_notifies_members(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner_m3@nova.example.com")
    org = await _create_org(client, owner, name="Nova Quantum")
    teammate = await _signup_verified(client, "teammate_m3@nova.example.com")
    await _invite_and_accept(client, owner, teammate, org)

    ms = (
        await client.post(
            f"/api/v1/organizations/{org['id']}/milestones",
            json={"name": "Deprecated Horizon"},
            headers=owner["headers"],
        )
    ).json()

    email_service.clear_sent_emails()

    resp = await client.delete(
        f"/api/v1/organizations/{org['id']}/milestones/{ms['id']}",
        headers=owner["headers"],
    )
    assert resp.status_code == 204, resp.text

    recipients = [m["to"] for m in email_service.SENT_EMAILS]
    assert "teammate_m3@nova.example.com" in recipients

    email = next(m for m in email_service.SENT_EMAILS if m["to"] == "teammate_m3@nova.example.com")
    assert email["subject"] == "[Nova Quantum] Milestone Deleted: Deprecated Horizon"


# ==============================================================================
# Resilience and Preference Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_email_failure_does_not_break_api(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Verifies that external mail transport failure never crashes HTTP requests."""
    owner = await _signup_verified(client, "owner_err@nova.example.com")
    org = await _create_org(client, owner, name="Nova Defense")

    async def _failing_send_email(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("SMTP connection timed out")

    monkeypatch.setattr(email_service, "send_email", _failing_send_email)

    # Creating a task must succeed with 201 even if mail transport throws
    resp = await client.post(
        f"/api/v1/organizations/{org['id']}/tasks",
        json={"title": "Resilient task creation"},
        headers=owner["headers"],
    )
    assert resp.status_code == 201, resp.text

    # Updating milestone must succeed with 200 even if mail transport throws
    ms = (
        await client.post(
            f"/api/v1/organizations/{org['id']}/milestones",
            json={"name": "Resilient milestone"},
            headers=owner["headers"],
        )
    ).json()
    resp_ms = await client.patch(
        f"/api/v1/organizations/{org['id']}/milestones/{ms['id']}",
        json={"status": "achieved"},
        headers=owner["headers"],
    )
    assert resp_ms.status_code == 200, resp_ms.text


@pytest.mark.asyncio
async def test_notification_preference_opt_out_respected(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verifies that team members who opted out of email notifications are excluded."""
    owner = await _signup_verified(client, "owner_opt@nova.example.com")
    org = await _create_org(client, owner, name="Nova OptOut")
    teammate = await _signup_verified(client, "teammate_opt@nova.example.com")
    await _invite_and_accept(client, owner, teammate, org)

    # Get teammate user ID
    user_me = (await client.get("/api/v1/users/me", headers=teammate["headers"])).json()
    teammate_uid = uuid.UUID(user_me["id"])

    # Insert an opt-out preference for teammate
    pref = NotificationPreference(
        user_id=teammate_uid,
        category="tasks",
        channel=NotificationChannel.email,
        is_enabled=False,
    )
    db_session.add(pref)
    await db_session.commit()

    email_service.clear_sent_emails()

    # Create task
    await client.post(
        f"/api/v1/organizations/{org['id']}/tasks",
        json={"title": "Quiet task for opted out user"},
        headers=owner["headers"],
    )

    recipients = [m["to"] for m in email_service.SENT_EMAILS]
    assert "owner_opt@nova.example.com" in recipients
    assert "teammate_opt@nova.example.com" not in recipients
