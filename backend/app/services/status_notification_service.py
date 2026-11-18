"""Status notification service.

Dispatches automated status emails to all active team members of a startup
organization whenever a Task or Milestone is created, updated, moved, or deleted.

Production considerations:
- Non-blocking: background dispatch via FastAPI BackgroundTasks so external mail
  latency (SMTP/Resend) never stalls HTTP response cycles.
- Resilient: uses safe_send_email; provider errors are logged without raising.
- Decoupled: recipient lists and email payloads are resolved and built during the
  request transaction, passing pure data into background tasks (no greenlet or
  closed DB session leakage).
- Privacy & Permissions: queries only active, non-deleted organization members
  with active user accounts, honoring any notification preferences.
"""

from __future__ import annotations

import logging
import uuid

from fastapi import BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import MemberStatus, OrganizationMember
from app.models.profile import NotificationChannel, NotificationPreference
from app.models.user import AccountStatus, User
from app.services import email_service

logger = logging.getLogger("forma.notifications")


async def get_active_team_recipients(
    db: AsyncSession,
    org_id: uuid.UUID,
    category: str = "tasks",
) -> list[dict[str, str]]:
    """Fetch email recipients for all active, non-deleted team members in the organization."""
    stmt = (
        select(User.id, User.primary_email, User.display_name)
        .join(OrganizationMember, OrganizationMember.user_id == User.id)
        .where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.status == MemberStatus.active,
            OrganizationMember.deleted_at.is_(None),
            User.status == AccountStatus.active,
            User.deleted_at.is_(None),
        )
    )
    result = await db.execute(stmt)
    active_users = result.all()
    if not active_users:
        return []

    # Check notification preferences for opt-outs
    user_ids = [u.id for u in active_users]
    pref_stmt = select(NotificationPreference.user_id).where(
        NotificationPreference.user_id.in_(user_ids),
        NotificationPreference.channel == NotificationChannel.email,
        NotificationPreference.category.in_([category, "workspace", "all"]),
        NotificationPreference.is_enabled.is_(False),
    )
    opted_out = set((await db.execute(pref_stmt)).scalars().all())

    recipients = [
        {"email": u.primary_email, "name": u.display_name or u.primary_email}
        for u in active_users
        if u.id not in opted_out and u.primary_email
    ]
    return recipients


async def dispatch_status_emails(
    recipients: list[dict[str, str]],
    subject: str,
    body: str,
) -> None:
    """Asynchronously deliver status emails to each recipient safely."""
    for r in recipients:
        to_email = r.get("email")
        if to_email:
            await email_service.safe_send_email(to_email, subject, body)


def format_task_email(
    org_name: str,
    actor_name: str,
    action: str,  # "created" | "updated" | "moved" | "deleted"
    task_title: str,
    *,
    status: str | None = None,
    old_status: str | None = None,
    priority: str | None = None,
    due_on: str | None = None,
    assignee_name: str | None = None,
    milestone_name: str | None = None,
) -> tuple[str, str]:
    """Build subject and plain text body for a task event."""
    action_lower = action.lower()
    status_label = (status or "").replace("_", " ").title() if status else ""

    if action_lower == "moved" and status:
        if status == "done":
            subject = f"[{org_name}] Task Completed: {task_title}"
            action_desc = f"{actor_name} marked the task \"{task_title}\" as Done."
        else:
            subject = f"[{org_name}] Task Moved to {status_label}: {task_title}"
            action_desc = f"{actor_name} moved the task \"{task_title}\" to {status_label}."
    elif action_lower == "created":
        subject = f"[{org_name}] New Task Created: {task_title}"
        action_desc = f"{actor_name} created the task \"{task_title}\"."
    elif action_lower == "deleted":
        subject = f"[{org_name}] Task Deleted: {task_title}"
        action_desc = f"{actor_name} deleted the task \"{task_title}\"."
    else:
        subject = f"[{org_name}] Task Updated: {task_title}"
        action_desc = f"{actor_name} updated the task \"{task_title}\"."

    details_lines = []
    if status_label:
        details_lines.append(f"• Status: {status_label}")
    if priority:
        details_lines.append(f"• Priority: {priority.title()}")
    if due_on:
        details_lines.append(f"• Due Date: {due_on}")
    if assignee_name:
        details_lines.append(f"• Assignee: {assignee_name}")
    if milestone_name:
        details_lines.append(f"• Milestone: {milestone_name}")

    details_block = "\n".join(details_lines) if details_lines else "• No additional details."

    body = f"""Hello,

This is an automated status update for your workspace at {org_name}.

{action_desc}

Details:
{details_block}

Track and manage tasks on your workspace board:
https://forma.app/startup/tasks

Best regards,
The Forma Team
"""
    return subject, body


def format_milestone_email(
    org_name: str,
    actor_name: str,
    action: str,  # "created" | "updated" | "deleted"
    milestone_name: str,
    *,
    status: str | None = None,
    progress: int | None = None,
    target_date: str | None = None,
    owner_name: str | None = None,
    description: str | None = None,
) -> tuple[str, str]:
    """Build subject and plain text body for a milestone event."""
    action_lower = action.lower()
    status_label = (status or "").replace("_", " ").title() if status else ""

    if action_lower == "created":
        subject = f"[{org_name}] New Milestone Created: {milestone_name}"
        action_desc = f"{actor_name} created the milestone \"{milestone_name}\"."
    elif action_lower == "deleted":
        subject = f"[{org_name}] Milestone Deleted: {milestone_name}"
        action_desc = f"{actor_name} deleted the milestone \"{milestone_name}\"."
    elif status == "achieved":
        subject = f"[{org_name}] Milestone Achieved! 🎉 {milestone_name}"
        action_desc = f"{actor_name} marked the milestone \"{milestone_name}\" as Achieved! 🎉"
    else:
        subject = f"[{org_name}] Milestone Updated: {milestone_name}"
        action_desc = f"{actor_name} updated the milestone \"{milestone_name}\"."

    details_lines = []
    if status_label:
        details_lines.append(f"• Status: {status_label}")
    if progress is not None:
        details_lines.append(f"• Progress: {progress}%")
    if target_date:
        details_lines.append(f"• Target Date: {target_date}")
    if owner_name:
        details_lines.append(f"• Owner: {owner_name}")
    if description:
        details_lines.append(f"• Description: {description}")

    details_block = "\n".join(details_lines) if details_lines else "• No additional details."

    body = f"""Hello,

This is an automated status update for your workspace at {org_name}.

{action_desc}

Details:
{details_block}

Track and manage milestones on your workspace board:
https://forma.app/startup/tasks

Best regards,
The Forma Team
"""
    return subject, body


def queue_task_notification(
    background_tasks: BackgroundTasks | None,
    recipients: list[dict[str, str]],
    org_name: str,
    actor_name: str,
    action: str,
    task_title: str,
    *,
    status: str | None = None,
    old_status: str | None = None,
    priority: str | None = None,
    due_on: str | None = None,
    assignee_name: str | None = None,
    milestone_name: str | None = None,
) -> None:
    """Helper to format and schedule task notification emails."""
    if not background_tasks or not recipients:
        return
    subject, body = format_task_email(
        org_name=org_name,
        actor_name=actor_name,
        action=action,
        task_title=task_title,
        status=status,
        old_status=old_status,
        priority=priority,
        due_on=due_on,
        assignee_name=assignee_name,
        milestone_name=milestone_name,
    )
    background_tasks.add_task(dispatch_status_emails, recipients, subject, body)


def queue_milestone_notification(
    background_tasks: BackgroundTasks | None,
    recipients: list[dict[str, str]],
    org_name: str,
    actor_name: str,
    action: str,
    milestone_name: str,
    *,
    status: str | None = None,
    progress: int | None = None,
    target_date: str | None = None,
    owner_name: str | None = None,
    description: str | None = None,
) -> None:
    """Helper to format and schedule milestone notification emails."""
    if not background_tasks or not recipients:
        return
    subject, body = format_milestone_email(
        org_name=org_name,
        actor_name=actor_name,
        action=action,
        milestone_name=milestone_name,
        status=status,
        progress=progress,
        target_date=target_date,
        owner_name=owner_name,
        description=description,
    )
    background_tasks.add_task(dispatch_status_emails, recipients, subject, body)
