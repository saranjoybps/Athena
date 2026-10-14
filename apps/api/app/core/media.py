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
    """Branded PDF matching the web document template (logo, GST, lines, bank, signature)."""
    try:
        if (kind or "").lower() in {"estimate", "quote", "quotation", "invoice"}:
            try:
                from app.core.estimate_pdf import build_estimate_pdf, build_invoice_pdf

                if (kind or "").lower() == "invoice":
                    return build_invoice_pdf(doc)
                return build_estimate_pdf(doc, "Estimate")
            except Exception as exc:
                import logging

                logging.getLogger(__name__).exception("estimate_pdf_failed kind=%s: %s", kind, exc)

        from app.core.document_pdf import build_branded_document_pdf

        return build_branded_document_pdf(doc, kind)
    except Exception as exc:
        # Last-resort minimal canvas if branded builder fails (e.g. missing reportlab extras).
        import logging

        logging.getLogger(__name__).exception("branded_pdf_failed kind=%s: %s", kind, exc)
        try:
            from reportlab.lib.pagesizes import A4
            from reportlab.pdfgen import canvas
        except ImportError:
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
        c.showPage()
        c.save()
        return buf.getvalue()


def document_pdf_bytes(doc: dict[str, Any], kind: str) -> bytes:
    """Public helper for inline PDF download/preview endpoints."""
    return _document_to_pdf_bytes(doc, kind)


def document_preview_pages(
    doc: dict[str, Any],
    kind: str,
    *,
    max_pages: int = 12,
    dpi: int = 144,
) -> dict[str, Any]:
    """
    Rasterize PDF pages to PNG for in-app preview (no Cloudinary / PDF.js).
    Returns { pageCount, pages: [{ page, width, height, mimeType, imageBase64 }] }.
    """
    import base64

    pdf_bytes = document_pdf_bytes(doc, kind)
    try:
        import fitz  # PyMuPDF
    except ImportError as exc:  # pragma: no cover
        raise AppError(
            500,
            "preview_unavailable",
            "PDF preview engine is not installed on the API (pymupdf).",
        ) from exc

    pdf = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        zoom = max(dpi, 72) / 72.0
        matrix = fitz.Matrix(zoom, zoom)
        pages: list[dict[str, Any]] = []
        limit = min(len(pdf), max(1, max_pages))
        for index in range(limit):
            page = pdf[index]
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            png = pix.tobytes("png")
            pages.append(
                {
                    "page": index + 1,
                    "width": pix.width,
                    "height": pix.height,
                    "mimeType": "image/png",
                    "imageBase64": base64.b64encode(png).decode("ascii"),
                }
            )
        return {"pageCount": len(pdf), "pages": pages}
    finally:
        pdf.close()


def _html_escape(value: Any) -> str:
    text = str(value if value is not None else "")
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def document_preview_html(doc: dict[str, Any], kind: str) -> str:
    """Self-contained HTML document preview for in-app WebView (no CDN / PDF.js)."""
    number = _html_escape(doc.get("number") or doc.get("id") or "")
    title = _html_escape(f"Athena {kind.title()}")
    customer = doc.get("customer") or {}
    customer_name = _html_escape(customer.get("name") if isinstance(customer, dict) else "") or "—"
    total = _html_escape(
        doc.get("total_amount")
        or doc.get("total")
        or (doc.get("computed") or {}).get("grandTotal")
        or "0"
    )
    status = _html_escape(doc.get("status") or "")
    lines = doc.get("line_items") or doc.get("items") or []
    rows: list[str] = []
    for line in lines[:60]:
        if isinstance(line, dict):
            desc = _html_escape(str(line.get("description") or "Line")[:120])
            qty = _html_escape(line.get("quantity") or "")
            unit = _html_escape(line.get("unit") or "")
            amt = _html_escape(
                line.get("subtotal")
                or line.get("total")
                or line.get("amount")
                or line.get("materialCost")
                or ""
            )
            rows.append(
                f"<tr><td>{desc}</td><td class='num'>{qty} {unit}</td><td class='num'>{amt}</td></tr>"
            )
        else:
            rows.append(f"<tr><td colspan='3'>{_html_escape(line)}</td></tr>")
    rows_html = "\n".join(rows) or "<tr><td colspan='3'>No line items</td></tr>"
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; padding: 16px; font-family: system-ui, -apple-system, Segoe UI, sans-serif;
      background: #f5f5f4; color: #1c1917; }}
    .sheet {{ background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }}
    h1 {{ margin: 0 0 4px; font-size: 22px; }}
    .meta {{ color: #78716c; font-size: 13px; margin-bottom: 16px; }}
    .row {{ display: flex; justify-content: space-between; gap: 12px; margin: 6px 0; font-size: 14px; }}
    .label {{ color: #78716c; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }}
    th, td {{ text-align: left; padding: 8px 6px; border-bottom: 1px solid #e7e5e4; vertical-align: top; }}
    th {{ color: #78716c; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }}
    td.num, th.num {{ text-align: right; white-space: nowrap; }}
    .total {{ margin-top: 16px; font-size: 18px; font-weight: 700; text-align: right; }}
  </style>
</head>
<body>
  <div class="sheet">
    <h1>{title}</h1>
    <div class="meta">{number}{(' · ' + status) if status else ''}</div>
    <div class="row"><span class="label">Customer</span><span>{customer_name}</span></div>
    <table>
      <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Amount</th></tr></thead>
      <tbody>
        {rows_html}
      </tbody>
    </table>
    <div class="total">Total: {total}</div>
  </div>
</body>
</html>"""


def _normalize_cloudinary_pdf_url(url: str | None, public_id: str | None = None) -> str | None:
    """Normalize Cloudinary PDF delivery URLs (keep resource type — raw assets 404 if rewritten to image/)."""
    if not url:
        return None
    cleaned = str(url).strip()
    if not cleaned:
        return None
    if cleaned.startswith("http://"):
        cleaned = "https://" + cleaned[len("http://") :]
    if not cleaned.lower().endswith(".pdf") and "/upload/" in cleaned and "?" not in cleaned:
        cleaned = f"{cleaned}.pdf"
    return cleaned


def upload_document_pdf(doc: dict[str, Any], *, kind: str, org_id: str, doc_id: str) -> dict[str, Any]:
    """Generate PDF for estimate/invoice and upload to Cloudinary. Returns pdf metadata."""
    # Upload as image (Cloudinary default for PDFs) so /image/upload/...pdf opens in browsers.
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

    # Signed server upload only — do not pass unsigned upload_preset (often image-only / conflicts).
    kwargs: dict[str, Any] = {
        "resource_type": "image",
        "public_id": public_id,
        "overwrite": True,
        "invalidate": True,
        "format": "pdf",
        "type": "upload",
    }
    result = cloudinary.uploader.upload(io.BytesIO(pdf_bytes), **kwargs)
    secure = result.get("secure_url") or result.get("url")
    resolved_public_id = str(result.get("public_id") or public_id)
    return {
        "pdfUrl": _normalize_cloudinary_pdf_url(secure, resolved_public_id),
        "pdfPublicId": resolved_public_id,
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
