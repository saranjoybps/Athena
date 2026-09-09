from __future__ import annotations

import io
import json
from typing import Any

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.repo import now_iso


def _configure_cloudinary() -> bool:
    settings = get_settings()
    if not settings.cloudinary_cloud_name or not settings.cloudinary_api_key or not settings.cloudinary_api_secret:
        return False
    import cloudinary

    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True,
    )
    return True


def sign_upload(folder: str, public_id: str | None = None) -> dict[str, Any]:
    settings = get_settings()
    # Prefer unsigned preset when configured (client-side uploads).
    if settings.cloudinary_upload_preset and settings.cloudinary_cloud_name:
        return {
            "provider": "cloudinary",
            "cloudName": settings.cloudinary_cloud_name,
            "folder": folder or settings.cloudinary_folder,
            "uploadPreset": settings.cloudinary_upload_preset,
            "unsigned": True,
            "publicId": public_id,
        }
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


def _document_to_pdf_bytes(doc: dict[str, Any], kind: str) -> bytes:
    """Minimal text PDF so upload works without WeasyPrint. Replace with branded PDF later."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
    except ImportError:
        # Fallback: upload JSON as .txt-like bytes labeled pdf when reportlab missing
        payload = json.dumps({"kind": kind, "document": doc}, default=str, indent=2).encode("utf-8")
        return payload

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    y = height - 48
    title = f"Athena {kind.title()}"
    number = str(doc.get("number") or doc.get("id") or "")
    c.setFont("Helvetica-Bold", 16)
    c.drawString(48, y, title)
    y -= 24
    c.setFont("Helvetica", 11)
    c.drawString(48, y, f"Number: {number}")
    y -= 18
    customer = doc.get("customer") or {}
    if isinstance(customer, dict):
        c.drawString(48, y, f"Customer: {customer.get('name') or '—'}")
        y -= 18
    total = doc.get("total_amount") or doc.get("total") or (doc.get("computed") or {}).get("grandTotal") or "0"
    c.drawString(48, y, f"Total: {total}")
    y -= 28
    c.setFont("Helvetica-Bold", 11)
    c.drawString(48, y, "Line items")
    y -= 16
    c.setFont("Helvetica", 10)
    lines = doc.get("line_items") or doc.get("items") or []
    for line in lines[:40]:
        if y < 64:
            c.showPage()
            y = height - 48
            c.setFont("Helvetica", 10)
        if isinstance(line, dict):
            desc = str(line.get("description") or "Line")[:60]
            amt = str(line.get("subtotal") or line.get("total") or line.get("amount") or line.get("materialCost") or "")
            c.drawString(48, y, f"- {desc}  {amt}")
        else:
            c.drawString(48, y, f"- {line}")
        y -= 14
    c.showPage()
    c.save()
    return buf.getvalue()


def upload_document_pdf(doc: dict[str, Any], *, kind: str, org_id: str, doc_id: str) -> dict[str, Any]:
    """Generate PDF for estimate/invoice and upload to Cloudinary. Returns pdf metadata."""
    public_id = f"athena/{org_id}/{kind}s/{doc_id}"
    pdf_bytes = _document_to_pdf_bytes(doc, kind)

    if not _configure_cloudinary():
        return {
            "pdfUrl": None,
            "pdfPublicId": public_id,
            "pdfUpdatedAt": now_iso(),
            "pdfPending": True,
            "note": "Cloudinary not configured; PDF stored metadata only.",
        }

    import cloudinary.uploader

    settings = get_settings()
    kwargs: dict[str, Any] = {
        "resource_type": "raw",
        "public_id": public_id,
        "overwrite": True,
        "format": "pdf",
    }
    if settings.cloudinary_upload_preset:
        kwargs["upload_preset"] = settings.cloudinary_upload_preset
    result = cloudinary.uploader.upload(io.BytesIO(pdf_bytes), **kwargs)
    return {
        "pdfUrl": result.get("secure_url") or result.get("url"),
        "pdfPublicId": result.get("public_id") or public_id,
        "pdfUpdatedAt": now_iso(),
        "pdfPending": False,
    }


def upload_bytes(
    data: bytes,
    *,
    folder: str,
    public_id: str | None = None,
    resource_type: str = "auto",
    filename: str | None = None,
) -> dict[str, Any]:
    if not _configure_cloudinary():
        return {
            "url": None,
            "publicId": public_id,
            "pending": True,
            "note": "Cloudinary not configured",
        }
    import cloudinary.uploader

    kwargs: dict[str, Any] = {"folder": folder, "resource_type": resource_type, "overwrite": True}
    if public_id:
        kwargs["public_id"] = public_id
    if filename:
        kwargs["filename_override"] = filename
    result = cloudinary.uploader.upload(io.BytesIO(data), **kwargs)
    return {
        "url": result.get("secure_url") or result.get("url"),
        "publicId": result.get("public_id"),
        "pending": False,
        "bytes": result.get("bytes"),
        "format": result.get("format"),
        "resourceType": result.get("resource_type"),
    }
