import threading
from typing import Any

from app.core.config import get_settings
from app.core.errors import AppError

# Token checks run in worker threads; concurrent first requests must not both call initialize_app().
_init_lock = threading.Lock()


def _ensure_firebase_app() -> None:
    import firebase_admin

    if firebase_admin._apps:
        return
    with _init_lock:
        if firebase_admin._apps:
            return
        _initialize_firebase_app()


def _initialize_firebase_app() -> None:
    import firebase_admin
    from firebase_admin import credentials

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

    if not token:
        raise AppError(401, "unauthenticated", "Missing bearer token.")
    _ensure_firebase_app()
    # Only rejections of the token itself are 401s. CertificateFetchError and the
    # ValueError raised for a missing project ID are server faults and stay 5xx.
    try:
        # Allow small local clock drift vs Firebase (avoids "Token used too early").
        decoded = auth.verify_id_token(token, clock_skew_seconds=10)
    except auth.ExpiredIdTokenError as exc:
        raise AppError(401, "token_expired", "Session expired. Sign in again.") from exc
    except auth.RevokedIdTokenError as exc:
        raise AppError(401, "token_revoked", "Session revoked. Sign in again.") from exc
    except auth.UserDisabledError as exc:
        raise AppError(401, "user_disabled", "This account is disabled.") from exc
    except auth.InvalidIdTokenError as exc:
        raise AppError(401, "invalid_token", "Invalid session token.") from exc
    return {
        "uid": decoded["uid"],
        "email": decoded.get("email"),
        "phone": decoded.get("phone_number"),
        "email_verified": decoded.get("email_verified", False),
        "org_id": decoded.get("org_id"),
        "role": decoded.get("role"),
    }
