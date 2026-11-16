from email.message import EmailMessage
from typing import Any

import aiosmtplib
import resend

from app.core.config import Settings, get_settings
from app.core.logging import get_logger

logger = get_logger("email_service")


async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str | None = None,
    settings: Settings | None = None,
) -> bool:
    if settings is None:
        settings = get_settings()

    provider = settings.EMAIL_PROVIDER.lower()
    logger.info("sending_email", to_email=to_email, subject=subject, provider=provider)

    try:
        if provider == "resend" and settings.RESEND_API_KEY:
            resend.api_key = settings.RESEND_API_KEY
            params: resend.Emails.SendParams = {
                "from": settings.RESEND_FROM,
                "to": [to_email],
                "subject": subject,
                "html": html_content,
            }
            if text_content:
                params["text"] = text_content
            resend.Emails.send(params)
            logger.info("email_sent_resend", to_email=to_email)
            return True

        # Default to SMTP (Mailpit locally, Gmail, etc.)
        message = EmailMessage()
        message["From"] = settings.SMTP_FROM
        message["To"] = to_email
        message["Subject"] = subject

        if text_content:
            message.set_content(text_content)
            message.add_alternative(html_content, subtype="html")
        else:
            message.set_content(html_content, subtype="html")

        kwargs: dict[str, Any] = {
            "hostname": settings.SMTP_HOST,
            "port": settings.SMTP_PORT,
        }
        if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
            kwargs["username"] = settings.SMTP_USERNAME
            kwargs["password"] = settings.SMTP_PASSWORD
            kwargs["start_tls"] = True
        else:
            kwargs["start_tls"] = False

        await aiosmtplib.send(message, **kwargs)
        logger.info("email_sent_smtp", to_email=to_email)
        return True
    except Exception as exc:
        logger.error("email_send_failed", to_email=to_email, error=str(exc))
        return False
