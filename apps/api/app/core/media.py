from typing import Any

from app.core.config import get_settings
from app.core.errors import AppError


def sign_upload(folder: str, public_id: str | None = None) -> dict[str, Any]:
    settings = get_settings()
    if not settings.cloudinary_api_secret:
        return {
            "provider": "cloudinary",
            "folder": folder,
            "unsigned": True,
            "note": "Configure Cloudinary credentials to enable signed uploads.",
        }
    import cloudinary
    import cloudinary.utils

    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
    )
    params = {"folder": folder, "timestamp": cloudinary.utils.now()}
    if public_id:
        params["public_id"] = public_id
    signature = cloudinary.utils.api_sign_request(params, settings.cloudinary_api_secret)
    return {
        "provider": "cloudinary",
        "cloudName": settings.cloudinary_cloud_name,
        "apiKey": settings.cloudinary_api_key,
        "folder": folder,
        "signature": signature,
        **params,
    }


def assert_not_binary_in_firestore(payload: dict[str, Any]) -> None:
    for key, value in payload.items():
        if isinstance(value, (bytes, bytearray)):
            raise AppError(400, "binary_forbidden", "Do not store binary files in Firestore.", {"field": key})
