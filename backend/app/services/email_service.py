"""Email service: single send_email() behind EMAIL_PROVIDER.

Providers: smtp, resend, console, memory.
- smtp: Gmail SMTP / Mailpit locally (Step 1).
- resend: production via Resend HTTP API (httpx, no extra SDK).
- console: log the email (dev default, no external service).
- memory: record in-memory for tests (never used in prod).
"""

import logging
import smtplib
from email.message import EmailMessage

import httpx

from app.core.config import get_settings

logger = logging.getLogger("forma.email")

# Test hook: when EMAIL_PROVIDER=memory, sent emails are recorded here.
SENT_EMAILS: list[dict[str, str]] = []


def _send_smtp(to: str, subject: str, body: str) -> None:
    settings = get_settings()
    msg = EmailMessage()
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
        if settings.SMTP_TLS:
            smtp.starttls()
        if settings.SMTP_USER:
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        smtp.send_message(msg)


def _send_resend(to: str, subject: str, body: str) -> None:
    settings = get_settings()
    if not settings.RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY is not configured.")
    resp = httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
        json={"from": settings.EMAIL_FROM, "to": [to], "subject": subject, "text": body},
        timeout=10.0,
    )
    resp.raise_for_status()


async def send_email(to: str, subject: str, body: str) -> None:
    """Send an email. Raises on failure; callers decide whether to surface it."""
    settings = get_settings()
    provider = settings.EMAIL_PROVIDER
    if provider == "memory":
        SENT_EMAILS.append({"to": to, "subject": subject, "body": body})
        logger.info("email (memory) to=%s subject=%s", to, subject)
    elif provider == "console":
        logger.info("email (console) to=%s subject=%s body=%s", to, subject, body)
    elif provider == "smtp":
        _send_smtp(to, subject, body)
    elif provider == "resend":
        _send_resend(to, subject, body)
    else:  # pragma: no cover - guarded by Literal type
        raise RuntimeError(f"Unknown EMAIL_PROVIDER: {provider}")


def clear_sent_emails() -> None:
    SENT_EMAILS.clear()
