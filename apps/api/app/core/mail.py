from __future__ import annotations

import smtplib
from email.message import EmailMessage
from typing import Any

from app.core.config import get_settings


def send_email(*, to: str | None, subject: str, body: str, html: str | None = None) -> dict[str, Any]:
    """Send via SMTP. If no recipient email, skip quietly (no error)."""
    address = (to or "").strip()
    if not address:
        return {"sent": False, "skipped": True, "reason": "no_email"}

    settings = get_settings()
    if not settings.smtp_host or not settings.smtp_user:
        return {
            "sent": False,
            "skipped": True,
            "reason": "smtp_not_configured",
            "to": address,
            "subject": subject,
        }

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = address
    msg.set_content(body)
    if html:
        msg.add_alternative(html, subtype="html")

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_password:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
    except Exception as exc:
        return {"sent": False, "skipped": False, "error": str(exc), "to": address, "subject": subject}

    return {"sent": True, "skipped": False, "to": address, "subject": subject}
