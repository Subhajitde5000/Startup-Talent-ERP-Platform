"""Email service: single send_email() behind EMAIL_PROVIDER.

Providers: smtp, resend, console, memory.
- smtp: Gmail SMTP (STARTTLS on 587 or SSL on 465) / Mailpit locally (port 1025, no TLS).
- resend: production via Resend HTTP API (httpx, no extra SDK).
- console: log the email to stdout (dev, no external service needed).
- memory: record in-memory for tests (never used in prod).
"""

import logging
import smtplib
from email.message import EmailMessage

import anyio.to_thread
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

    try:
        # Port 465 uses implicit SSL; port 587 / 25 / 1025 uses plain/STARTTLS.
        smtp_factory = smtplib.SMTP_SSL if settings.SMTP_PORT == 465 else smtplib.SMTP
        with smtp_factory(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
            smtp.ehlo()
            if settings.SMTP_PORT != 465 and settings.SMTP_TLS:
                smtp.starttls()
                smtp.ehlo()
            if settings.SMTP_USER:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
            logger.info("smtp: sent email to=%s subject=%s", to, subject)
    except (smtplib.SMTPException, OSError, TimeoutError) as exc:
        logger.error("smtp: failed to send email to=%s: %s", to, exc)
        raise


def _send_resend(to: str, subject: str, body: str) -> None:
    settings = get_settings()
    if not settings.RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY is not configured.")
    try:
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            json={"from": settings.EMAIL_FROM, "to": [to], "subject": subject, "text": body},
            timeout=10.0,
        )
        resp.raise_for_status()
        logger.info("resend: sent email to=%s subject=%s", to, subject)
    except httpx.HTTPError as exc:
        logger.error("resend: failed to send email to=%s: %s", to, exc)
        raise


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
        # Run blocking socket I/O in thread pool to avoid blocking asyncio loop
        await anyio.to_thread.run_sync(_send_smtp, to, subject, body)
    elif provider == "resend":
        await anyio.to_thread.run_sync(_send_resend, to, subject, body)
    else:  # pragma: no cover - guarded by Literal type
        raise RuntimeError(f"Unknown EMAIL_PROVIDER: {provider}")


async def safe_send_email(to: str, subject: str, body: str) -> bool:
    """Send an email safely without propagating exceptions to callers.

    Used by background tasks and auth flows so external mail latency/outages
    do not crash user registrations or request transactions.
    """
    try:
        await send_email(to, subject, body)
        return True
    except Exception as exc:
        logger.error("safe_send_email: failed to send email to=%s subject=%s: %s", to, subject, exc)
        return False


def clear_sent_emails() -> None:
    SENT_EMAILS.clear()
