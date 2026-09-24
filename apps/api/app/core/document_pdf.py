"""Branded estimate / quote / invoice PDF matching the web DefaultDocumentPdf layout."""

from __future__ import annotations

import io
from datetime import datetime
from typing import Any
from urllib.request import urlopen

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Image,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ACCENT = colors.HexColor("#1e3a5f")
MUTED = colors.HexColor("#64748b")
TEXT = colors.HexColor("#1e293b")
LIGHT = colors.HexColor("#e2e8f0")
ROW_BORDER = colors.HexColor("#f1f5f9")


def _s(value: Any, fallback: str = "") -> str:
    if value is None:
        return fallback
    text = str(value).strip()
    return text if text else fallback


def _money(value: Any) -> str:
    try:
        amount = float(str(value).replace(",", "") or 0)
    except (TypeError, ValueError):
        return _s(value, "0")
    # Helvetica has no ₹ glyph — use ASCII "Rs." for reliable PDF output
    return f"Rs. {amount:,.2f}"


def _date(value: Any) -> str:
    raw = _s(value)
    if not raw:
        return "—"
    try:
        if "T" in raw:
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).strftime("%d %b %Y")
        return datetime.fromisoformat(raw[:10]).strftime("%d %b %Y")
    except Exception:
        return raw[:16]


def _load_image(url: str, max_w: float, max_h: float) -> Image | None:
    if not url or not str(url).startswith(("http://", "https://")):
        return None
    try:
        with urlopen(url, timeout=8) as resp:  # noqa: S310 — branding assets from Cloudinary/HTTPS
            data = resp.read()
        img = Image(io.BytesIO(data))
        img.hAlign = "LEFT"
        # Keep aspect ratio within box.
        iw, ih = float(img.imageWidth), float(img.imageHeight)
        if iw <= 0 or ih <= 0:
            return None
        scale = min(max_w / iw, max_h / ih, 1.0)
        img.drawWidth = iw * scale
        img.drawHeight = ih * scale
        return img
    except Exception:
        return None


def _line_rows(doc: dict[str, Any]) -> list[list[Any]]:
    lines = doc.get("line_items") or doc.get("items") or []
    rows: list[list[Any]] = []
    for i, line in enumerate(lines[:80]):
        if not isinstance(line, dict):
            rows.append([str(i + 1), _s(line), "", "", "", "", ""])
            continue
        desc = _s(line.get("description") or "Line")
        unit = _s(line.get("unit"))
        if unit:
            desc = f"{desc} ({unit})"
        qty = _s(line.get("quantity"), "1")
        rate = line.get("unit_price") or line.get("rate") or line.get("sellRate") or ""
        disc = line.get("discount_pct") or line.get("discountPct") or 0
        tax = line.get("tax_pct") or line.get("taxPct") or line.get("gstPct") or 0
        total = (
            line.get("total")
            or line.get("subtotal")
            or line.get("amount")
            or line.get("materialCost")
            or ""
        )
        rows.append(
            [
                str(i + 1),
                desc,
                qty,
                _money(rate) if rate != "" else "—",
                _s(disc, "0"),
                _s(tax, "0"),
                _money(total) if total != "" else "—",
            ]
        )
    if not rows:
        rows.append(["", "No line items", "", "", "", "", ""])
    return rows


def build_branded_document_pdf(doc: dict[str, Any], kind: str) -> bytes:
    """Generate a branded A4 PDF aligned with the web document template."""
    branding = doc.get("branding") if isinstance(doc.get("branding"), dict) else {}
    customer = doc.get("customer") if isinstance(doc.get("customer"), dict) else {}
    scope = doc.get("scope") if isinstance(doc.get("scope"), dict) else {}

    kind_key = (kind or "estimate").lower()
    if kind_key in {"quote", "quotation", "estimate"}:
        doc_label = "Estimate"
    elif kind_key == "invoice":
        doc_label = "Tax Invoice"
    else:
        doc_label = kind_key.title()

    serial = _s(doc.get("number") or (str(doc.get("id") or "")[:8].upper()) or "N/A")
    company = _s(branding.get("company_name") or "Company")
    address = _s(branding.get("company_address"))

    buf = io.BytesIO()
    doc_pdf = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
    )
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="CompanyName",
            parent=styles["Heading1"],
            fontSize=16,
            textColor=ACCENT,
            alignment=TA_CENTER,
            spaceAfter=4,
            leading=20,
        )
    )
    styles.add(
        ParagraphStyle(
            name="MutedCenter",
            parent=styles["Normal"],
            fontSize=9,
            textColor=MUTED,
            alignment=TA_CENTER,
            leading=12,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Section",
            parent=styles["Normal"],
            fontSize=9,
            textColor=ACCENT,
            fontName="Helvetica-Bold",
            spaceBefore=8,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(name="BodySm", parent=styles["Normal"], fontSize=9, textColor=TEXT, leading=12)
    )
    styles.add(
        ParagraphStyle(name="MutedSm", parent=styles["Normal"], fontSize=8, textColor=MUTED, leading=11)
    )
    styles.add(
        ParagraphStyle(
            name="RightLabel",
            parent=styles["Normal"],
            fontSize=9,
            textColor=ACCENT,
            fontName="Helvetica-Bold",
            alignment=TA_RIGHT,
        )
    )
    styles.add(
        ParagraphStyle(
            name="RightBody",
            parent=styles["Normal"],
            fontSize=10,
            textColor=TEXT,
            fontName="Helvetica-Bold",
            alignment=TA_RIGHT,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Footer",
            parent=styles["Normal"],
            fontSize=7,
            textColor=colors.white,
            alignment=TA_CENTER,
        )
    )

    story: list[Any] = []

    # Accent bar
    story.append(
        Table(
            [[""]],
            colWidths=[doc_pdf.width],
            rowHeights=[3],
        )
    )
    story[-1].setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), ACCENT)]))
    story.append(Spacer(1, 8))

    # Header: logo + company
    logo = _load_image(_s(branding.get("logo_url")), 110, 48)
    left = logo if logo else Paragraph("", styles["BodySm"])
    center = [
        Paragraph(company, styles["CompanyName"]),
    ]
    if address:
        center.append(Paragraph(address.replace("\n", "<br/>"), styles["MutedCenter"]))
    header = Table(
        [[left, center, ""]],
        colWidths=[doc_pdf.width * 0.25, doc_pdf.width * 0.5, doc_pdf.width * 0.25],
    )
    header.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (1, 0), (1, 0), "CENTER"),
            ]
        )
    )
    story.append(header)
    story.append(Spacer(1, 8))

    # Company details
    story.append(Paragraph("COMPANY DETAILS", styles["Section"]))
    detail_bits = []
    if branding.get("gst_number"):
        detail_bits.append(f"<b>GSTIN:</b> {_s(branding.get('gst_number'))}")
    if branding.get("pan"):
        detail_bits.append(f"<b>PAN:</b> {_s(branding.get('pan'))}")
    if branding.get("phone"):
        detail_bits.append(f"<b>Phone:</b> {_s(branding.get('phone'))}")
    if branding.get("email"):
        detail_bits.append(f"<b>Email:</b> {_s(branding.get('email'))}")
    if detail_bits:
        # 2-column grid
        pairs = detail_bits + ([""] if len(detail_bits) % 2 else [])
        grid = [[Paragraph(pairs[i], styles["BodySm"]), Paragraph(pairs[i + 1], styles["BodySm"])] for i in range(0, len(pairs), 2)]
        t = Table(grid, colWidths=[doc_pdf.width / 2, doc_pdf.width / 2])
        t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
        story.append(t)

    story.append(HRFlowable(width="100%", thickness=1, color=LIGHT, spaceBefore=8, spaceAfter=8))

    # Bill to + doc meta
    buyer_parts = []
    if customer.get("name"):
        buyer_parts.append(f"<b>{_s(customer.get('name'))}</b>")
    if customer.get("company"):
        buyer_parts.append(_s(customer.get("company")))
    if customer.get("phone"):
        buyer_parts.append(f"Phone: {_s(customer.get('phone'))}")
    if customer.get("email"):
        buyer_parts.append(_s(customer.get("email")))
    if customer.get("gstin"):
        buyer_parts.append(f"GSTIN: {_s(customer.get('gstin'))}")
    addr = _s(customer.get("billingAddress") or customer.get("address"))
    if addr:
        buyer_parts.append(addr.replace("\n", "<br/>"))
    if not buyer_parts:
        buyer_parts = ["No customer details"]

    meta_parts = [
        Paragraph(doc_label.upper(), styles["RightLabel"]),
        Paragraph(f"#{serial}", styles["RightBody"]),
        Paragraph(f"Date: {_date(doc.get('createdAt'))}", styles["MutedSm"]),
    ]
    if kind_key in {"quote", "quotation", "estimate"} and doc.get("validUntil"):
        meta_parts.append(Paragraph(f"Valid Until: {_date(doc.get('validUntil'))}", styles["MutedSm"]))
    if kind_key == "invoice" and doc.get("dueDate"):
        meta_parts.append(Paragraph(f"Due Date: {_date(doc.get('dueDate'))}", styles["MutedSm"]))

    bill = Table(
        [
            [
                [Paragraph("BILL TO", styles["Section"]), Paragraph("<br/>".join(buyer_parts), styles["BodySm"])],
                meta_parts,
            ]
        ],
        colWidths=[doc_pdf.width * 0.58, doc_pdf.width * 0.42],
    )
    bill.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    story.append(bill)
    story.append(Spacer(1, 10))

    # Line items table
    header_row = ["#", "Description", "Qty", "Rate", "Disc %", "GST %", "Amount"]
    data = [header_row] + _line_rows(doc)
    # Wrap description cells
    for r in range(1, len(data)):
        data[r][1] = Paragraph(_s(data[r][1]), styles["BodySm"])
    col_w = [
        doc_pdf.width * 0.05,
        doc_pdf.width * 0.37,
        doc_pdf.width * 0.08,
        doc_pdf.width * 0.12,
        doc_pdf.width * 0.10,
        doc_pdf.width * 0.10,
        doc_pdf.width * 0.18,
    ]
    items = Table(data, colWidths=col_w, repeatRows=1)
    items.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 8),
                ("FONTSIZE", (0, 1), (-1, -1), 8),
                ("TEXTCOLOR", (0, 1), (-1, -1), TEXT),
                ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
                ("ALIGN", (0, 0), (0, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("LINEBELOW", (0, 1), (-1, -1), 0.5, ROW_BORDER),
            ]
        )
    )
    story.append(items)
    story.append(Spacer(1, 10))

    # Totals
    has_igst = False
    try:
        has_igst = float(_s(doc.get("igst"), "0") or 0) > 0
    except ValueError:
        has_igst = False
    totals_rows = [
        ["Subtotal", _money(doc.get("subtotal") or 0)],
    ]
    try:
        if float(_s(doc.get("discount_total"), "0") or 0) > 0:
            totals_rows.append(["Discount", _money(doc.get("discount_total"))])
    except ValueError:
        pass
    if has_igst:
        totals_rows.append(["IGST", _money(doc.get("igst"))])
    else:
        totals_rows.append(["CGST", _money(doc.get("cgst") or 0)])
        totals_rows.append(["SGST", _money(doc.get("sgst") or 0)])
    totals_rows.append(
        [
            "Total",
            _money(doc.get("total_amount") or doc.get("total") or doc.get("subtotal") or 0),
        ]
    )
    totals = Table(totals_rows, colWidths=[40 * mm, 35 * mm], hAlign="RIGHT")
    totals.setStyle(
        TableStyle(
            [
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("TEXTCOLOR", (0, 0), (0, -2), MUTED),
                ("TEXTCOLOR", (1, 0), (1, -2), TEXT),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, -1), (-1, -1), 11),
                ("TEXTCOLOR", (0, -1), (-1, -1), colors.HexColor("#0f172a")),
                ("LINEABOVE", (0, -1), (-1, -1), 1.5, TEXT),
                ("TOPPADDING", (0, -1), (-1, -1), 6),
            ]
        )
    )
    story.append(totals)

    # Scope
    scope_bits = []
    if scope.get("included"):
        scope_bits.append(f"<b>Included:</b> {_s(scope.get('included'))}")
    if scope.get("excluded"):
        scope_bits.append(f"<b>Excluded:</b> {_s(scope.get('excluded'))}")
    if scope.get("warranty"):
        scope_bits.append(f"<b>Warranty:</b> {_s(scope.get('warranty'))}")
    if scope.get("paymentTerms"):
        scope_bits.append(f"<b>Payment Terms:</b> {_s(scope.get('paymentTerms'))}")
    if scope_bits:
        story.append(Spacer(1, 8))
        story.append(HRFlowable(width="100%", thickness=1, color=LIGHT, spaceBefore=2, spaceAfter=6))
        for bit in scope_bits:
            story.append(Paragraph(bit, styles["MutedSm"]))

    # Seal / signature
    story.append(Spacer(1, 12))
    seal = _load_image(_s(branding.get("seal_url")), 100, 70)
    sig = _load_image(_s(branding.get("signature_url")), 120, 48)
    seal_block = [Paragraph("COMPANY SEAL", styles["Section"])]
    seal_block.append(seal if seal else Spacer(1, 50))
    sig_block = [
        Paragraph("AUTHORIZED SIGNATURE", styles["Section"]),
        sig if sig else Spacer(1, 40),
        HRFlowable(width=120, thickness=1, color=MUTED, spaceBefore=4, spaceAfter=2),
        Paragraph("Authorised Signatory", styles["BodySm"]),
    ]
    signs = Table([[seal_block, sig_block]], colWidths=[doc_pdf.width * 0.5, doc_pdf.width * 0.5])
    signs.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ]
        )
    )
    story.append(KeepTogether(signs))

    # Bank
    bank_bits = []
    if branding.get("bank_account_holder"):
        bank_bits.append(f"<b>Account Holder:</b> {_s(branding.get('bank_account_holder'))}")
    if branding.get("bank_name"):
        bank_bits.append(f"<b>Bank:</b> {_s(branding.get('bank_name'))}")
    if branding.get("bank_branch"):
        bank_bits.append(f"<b>Branch:</b> {_s(branding.get('bank_branch'))}")
    if branding.get("bank_account_number"):
        bank_bits.append(f"<b>Account Number:</b> {_s(branding.get('bank_account_number'))}")
    if branding.get("bank_ifsc_code"):
        bank_bits.append(f"<b>IFSC:</b> {_s(branding.get('bank_ifsc_code'))}")
    if branding.get("upi_id"):
        bank_bits.append(f"<b>UPI (GPay):</b> {_s(branding.get('upi_id'))}")
    if bank_bits:
        story.append(HRFlowable(width="100%", thickness=1, color=LIGHT, spaceBefore=10, spaceAfter=6))
        story.append(Paragraph("BANK DETAILS", styles["Section"]))
        for bit in bank_bits:
            story.append(Paragraph(bit, styles["BodySm"]))

    if branding.get("terms_conditions"):
        story.append(HRFlowable(width="100%", thickness=1, color=LIGHT, spaceBefore=10, spaceAfter=6))
        story.append(Paragraph("TERMS & CONDITIONS", styles["Section"]))
        story.append(Paragraph(_s(branding.get("terms_conditions")).replace("\n", "<br/>"), styles["MutedSm"]))

    if doc.get("notes"):
        story.append(HRFlowable(width="100%", thickness=1, color=LIGHT, spaceBefore=10, spaceAfter=6))
        story.append(Paragraph("NOTES", styles["Section"]))
        story.append(Paragraph(_s(doc.get("notes")).replace("\n", "<br/>"), styles["MutedSm"]))

    # Footer bar
    story.append(Spacer(1, 12))
    footer_text = " | ".join(
        p for p in [company, address.replace("\n", " "), _s(branding.get("phone")), _s(branding.get("email"))] if p
    )
    footer = Table([[Paragraph(footer_text, styles["Footer"])]], colWidths=[doc_pdf.width])
    footer.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), ACCENT),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(footer)

    doc_pdf.build(story)
    return buf.getvalue()
