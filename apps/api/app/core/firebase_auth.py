from typing import Any

import os

from app.core.config import get_settings


def _ensure_firebase_app() -> None:
    import firebase_admin
    from firebase_admin import credentials

    if firebase_admin._apps:
        return

    settings = get_settings()
    options = {"projectId": settings.firebase_project_id} if settings.firebase_project_id else None
    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    if cred_path and os.path.isfile(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred, options)
        return
    # Cloud Run / ADC
    firebase_admin.initialize_app(options=options)


def verify_firebase_token(token: str) -> dict[str, Any]:
    from firebase_admin import auth

    _ensure_firebase_app()
    decoded = auth.verify_id_token(token)
    return {
        "uid": decoded["uid"],
        "email": decoded.get("email"),
        "phone": decoded.get("phone_number"),
        "email_verified": decoded.get("email_verified", False),
        "org_id": decoded.get("org_id"),
        "role": decoded.get("role"),
    }
