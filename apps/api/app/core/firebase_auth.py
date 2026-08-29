from typing import Any


def verify_firebase_token(token: str) -> dict[str, Any]:
    import firebase_admin
    from firebase_admin import auth

    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    decoded = auth.verify_id_token(token)
    return {
        "uid": decoded["uid"],
        "email": decoded.get("email"),
        "phone": decoded.get("phone_number"),
        "email_verified": decoded.get("email_verified", False),
    }
