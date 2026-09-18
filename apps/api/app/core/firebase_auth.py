from typing import Any

from app.core.config import get_settings


def _ensure_firebase_app() -> None:
    import firebase_admin
    from firebase_admin import credentials

    if firebase_admin._apps:
        return

    settings = get_settings()
    options = {"projectId": settings.firebase_project_id} if settings.firebase_project_id else None

    from app.core.firebase_credentials import get_service_account_info

    info = get_service_account_info()
    if info:
        cred = credentials.Certificate(info)
        firebase_admin.initialize_app(cred, options)
        return

    # Cloud Run / ADC (no explicit SA in env)
    firebase_admin.initialize_app(options=options)


def verify_firebase_token(token: str) -> dict[str, Any]:
    from firebase_admin import auth

    _ensure_firebase_app()
    # Allow small local clock drift vs Firebase (avoids "Token used too early").
    decoded = auth.verify_id_token(token, clock_skew_seconds=10)
    return {
        "uid": decoded["uid"],
        "email": decoded.get("email"),
        "phone": decoded.get("phone_number"),
        "email_verified": decoded.get("email_verified", False),
        "org_id": decoded.get("org_id"),
        "role": decoded.get("role"),
    }
