"""Estimate / quotation PDF laid out from the organization's document branding.

Everything printed about the business (name, logo, address, GSTIN, contact, bank, UPI, terms,
signature and accent colour) comes from Organization details, so the document changes as soon
as those details are updated and the estimate PDF is regenerated.
"""

from __future__ import annotations

import io
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import HRFlowable, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core.document_pdf import _load_image

DEFAULT_ACCENT = "#EA580C"
INK = colors.HexColor("#1C1917")
MUTED = colors.HexColor("#78716C")
RULE = colors.HexColor("#E7E5E4")
ZEBRA = colors.HexColor("#FAFAF9")

KIND_TITLES = (("work", "Work"), ("material", "Materials"), ("tool", "Tool & equipment charges"))
SCOPE_LABELS = (
    ("included", "Included"),
    ("excluded", "Not included"),
    ("timeline", "Timeline"),
    ("warranty", "Warranty"),
    ("paymentTerms", "Payment terms"),
    ("assumptions", "Assumptions"),
)

_HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")
INVOICE_KINDS = {"advance": "Advance bill", "progress": "Progress bill", "final": "Final bill", "standard": "Invoice"}


def _is_invoice(label: str) -> bool:
    return "invoice" in label.lower()


def _esc(value: Any) -> str:
    text = "" if value is None else str(value).strip()
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _multiline(value: Any) -> str:
    return _esc(value).replace("\n", "<br/>")


def _dec(value: Any) -> Decimal:
    try:
        return Decimal(str(value).replace(",", "") or "0")
    except (InvalidOperation, ValueError):
        return Decimal("0")


def _money(value: Any) -> str:
    # Helvetica has no rupee glyph.
    return f"Rs. {_indian_grouping(_dec(value))}"


def _indian_grouping(amount: Decimal) -> str:
    sign = "-" if amount < 0 else ""
    whole, _, frac = f"{abs(amount):.2f}".partition(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        whole = ",".join(parts + [tail])
    return f"{sign}{whole}.{frac}"


def _qty(value: Any) -> str:
    d = _dec(value)
    return f"{d:,.2f}".rstrip("0").rstrip(".") if d != d.to_integral() else f"{int(d):,}"


def _date(value: Any) -> str:
    raw = "" if value is None else str(value).strip()
    if not raw:
        return ""
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).strftime("%d %b %Y")
    except ValueError:
        return raw[:10]


_ONES = (
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
    "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
)
_TENS = ("", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety")


def _below_hundred(n: int) -> str:
    return _ONES[n] if n < 20 else f"{_TENS[n // 10]} {_ONES[n % 10]}".strip()


def _below_thousand(n: int) -> str:
    hundreds, rest = divmod(n, 100)
    parts = [f"{_ONES[hundreds]} Hundred"] if hundreds else []
    if rest:
        parts.append(_below_hundred(rest))
    return " ".join(parts)


def amount_in_words(value: Any) -> str:
    """Indian numbering: 1,25,000.50 -> Rupees One Lakh Twenty Five Thousand and Fifty Paise Only."""
    amount = abs(_dec(value)).quantize(Decimal("0.01"))
    rupees = int(amount)
    paise = int((amount - rupees) * 100)
    if rupees == 0 and paise == 0:
        return "Rupees Zero Only"
    parts: list[str] = []
    crore, rupees = divmod(rupees, 10_000_000)
    lakh, rupees = divmod(rupees, 100_000)
    thousand, rupees = divmod(rupees, 1000)
    if crore:
        parts.append(f"{_below_thousand(crore) if crore < 1000 else f'{crore:,}'} Crore")
    if lakh:
        parts.append(f"{_below_hundred(lakh)} Lakh")
    if thousand:
        parts.append(f"{_below_hundred(thousand)} Thousand")
    if rupees:
        parts.append(_below_thousand(rupees))
    words = "Rupees " + " ".join(parts) if parts else "Rupees Zero"
    if paise:
        words += f" and {_below_hundred(paise)} Paise"
    return words + " Only"


def _accent(branding: dict[str, Any]) -> colors.Color:
    raw = str(branding.get("brand_color") or "").strip()
    return colors.HexColor(raw if _HEX.match(raw) else DEFAULT_ACCENT)


def _tint(color: colors.Color, amount: float) -> colors.Color:
    """Blend towards white; amount=0.9 gives a very light wash of the brand colour."""
    return colors.Color(
        color.red + (1 - color.red) * amount,
        color.green + (1 - color.green) * amount,
        color.blue + (1 - color.blue) * amount,
    )


def _styles(accent: colors.Color) -> dict[str, ParagraphStyle]:
    base = ParagraphStyle("base", fontName="Helvetica", fontSize=9, leading=12, textColor=INK)
    return {
        "company": ParagraphStyle("company", parent=base, fontName="Helvetica-Bold", fontSize=15, leading=19),
        "small": ParagraphStyle("small", parent=base, fontSize=8, leading=11, textColor=MUTED),
        "body": base,
        "bold": ParagraphStyle("bold", parent=base, fontName="Helvetica-Bold"),
        "docTitle": ParagraphStyle("docTitle", parent=base, fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=accent, alignment=TA_RIGHT),
        "metaRight": ParagraphStyle("metaRight", parent=base, alignment=TA_RIGHT, fontSize=8.5, leading=12),
        "label": ParagraphStyle("label", parent=base, fontName="Helvetica-Bold", fontSize=7.5, leading=10, textColor=accent),
        "cell": ParagraphStyle("cell", parent=base, fontSize=8.5, leading=11),
        "cellMuted": ParagraphStyle("cellMuted", parent=base, fontSize=7.5, leading=10, textColor=MUTED),
        "num": ParagraphStyle("num", parent=base, fontSize=8.5, leading=11, alignment=TA_RIGHT),
        "head": ParagraphStyle("head", parent=base, fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=colors.white),
        "headNum": ParagraphStyle("headNum", parent=base, fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=colors.white, alignment=TA_RIGHT),
        "section": ParagraphStyle("section", parent=base, fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=accent),
        "sectionNum": ParagraphStyle("sectionNum", parent=base, fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=accent, alignment=TA_RIGHT),
        "words": ParagraphStyle("words", parent=base, fontName="Helvetica-Oblique", fontSize=8.5, leading=12),
        "left": ParagraphStyle("left", parent=base, alignment=TA_LEFT),
    }


def _header(doc: dict[str, Any], branding: dict[str, Any], st: dict[str, ParagraphStyle], width: float, label: str) -> Table:
    company = _esc(branding.get("company_name")) or "Your business"
    contact = [
        _multiline(branding.get("company_address")),
        " | ".join(_esc(v) for v in (branding.get("phone"), branding.get("email")) if v),
        _esc(branding.get("website")),
        f"GSTIN: {_esc(branding.get('gst_number'))}" if branding.get("gst_number") else "",
        f"PAN: {_esc(branding.get('pan'))}" if branding.get("pan") else "",
    ]
    left: list[Any] = []
    logo = _load_image(str(branding.get("logo_url") or ""), 120, 46)
    if logo:
        left += [logo, Spacer(1, 4)]
    left.append(Paragraph(company, st["company"]))
    left.append(Paragraph("<br/>".join(c for c in contact if c), st["small"]))

    meta = [f"<b>No.</b> {_esc(doc.get('number')) or '-'}"]
    if doc.get("version") and int(_dec(doc.get("version"))) > 1:
        meta.append(f"<b>Revision</b> v{int(_dec(doc.get('version')))}")
    if _date(doc.get("createdAt")):
        meta.append(f"<b>Date</b> {_date(doc.get('createdAt'))}")
    if _date(doc.get("validUntil")):
        meta.append(f"<b>Valid until</b> {_date(doc.get('validUntil'))}")
    if _date(doc.get("dueDate")):
        meta.append(f"<b>Due date</b> {_date(doc.get('dueDate'))}")
    if INVOICE_KINDS.get(str(doc.get("kind") or "")):
        meta.append(f"<b>Type</b> {INVOICE_KINDS[str(doc.get('kind'))]}")
    if doc.get("placeOfSupply") and _is_invoice(label):
        meta.append(f"<b>Place of supply</b> {_esc(doc.get('placeOfSupply'))}")
    right = [Paragraph(label.upper(), st["docTitle"]), Spacer(1, 4), Paragraph("<br/>".join(meta), st["metaRight"])]

    t = Table([[left, right]], colWidths=[width * 0.62, width * 0.38])
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    return t


def _parties(doc: dict[str, Any], st: dict[str, ParagraphStyle], width: float, accent: colors.Color, bill_label: str = "PREPARED FOR") -> Table:
    customer = doc.get("customer") if isinstance(doc.get("customer"), dict) else {}
    site = doc.get("site") if isinstance(doc.get("site"), dict) else {}
    name = _esc(customer.get("company") or customer.get("name")) or "-"
    contact_name = _esc(customer.get("name")) if customer.get("company") else ""
    bill = [f"<b>{name}</b>"]
    bill += [v for v in (
        contact_name,
        _esc(customer.get("phone")),
        _esc(customer.get("email")),
        _multiline(customer.get("billingAddress") or customer.get("address")),
        f"GSTIN: {_esc(customer.get('gstin'))}" if customer.get("gstin") else "",
    ) if v]
    site_lines = [f"<b>{_esc(site.get('name')) or '-'}</b>"] if site else ["<b>-</b>"]
    if site:
        address = ", ".join(_esc(v) for v in (site.get("address"), site.get("area"), site.get("city"), site.get("pinCode")) if v)
        site_lines += [v for v in (address, _esc(site.get("siteType")).replace("_", " ").title() if site.get("siteType") else "") if v]

    cells = [
        [Paragraph(bill_label, st["label"]), Paragraph("<br/>".join(bill), st["body"])],
        [Paragraph("WORK SITE", st["label"]), Paragraph("<br/>".join(site_lines), st["body"])],
    ]
    gap = 6
    t = Table([cells], colWidths=[(width - gap) / 2, (width - gap) / 2])
    t.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (-1, -1), _tint(accent, 0.93)),
                ("LINEBEFORE", (0, 0), (0, 0), 2, accent),
                ("LINEBEFORE", (1, 0), (1, 0), 2, accent),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return t


def _lines_table(doc: dict[str, Any], st: dict[str, ParagraphStyle], width: float, accent: colors.Color) -> tuple[Table, dict[str, Decimal]]:
    lines = doc.get("estimate_lines")
    if not lines:
        lines = [
            {"kind": "work", "description": l.get("description"), "quantity": l.get("quantity"), "unit": l.get("unit"), "rate": l.get("unit_price"), "amount": l.get("subtotal")}
            for l in (doc.get("line_items") or [])
            if isinstance(l, dict)
        ]
    widths = [width * w for w in (0.06, 0.44, 0.11, 0.1, 0.13, 0.16)]
    data: list[list[Any]] = [[
        Paragraph("#", st["head"]),
        Paragraph("Description", st["head"]),
        Paragraph("Qty", st["headNum"]),
        Paragraph("Unit", st["head"]),
        Paragraph("Rate", st["headNum"]),
        Paragraph("Amount", st["headNum"]),
    ]]
    style: list[tuple] = [
        ("BACKGROUND", (0, 0), (-1, 0), accent),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]
    totals: dict[str, Decimal] = {}
    present = [(k, title) for k, title in KIND_TITLES if any(l.get("kind") == k for l in lines)]
    grouped = len(present) > 1 or (bool(present) and present[0][0] != "work")
    counter = 0
    for kind, title in present:
        rows = [l for l in lines if l.get("kind") == kind]
        subtotal = sum((_dec(l.get("amount")) for l in rows), Decimal("0"))
        totals[kind] = subtotal
        if grouped:
            r = len(data)
            data.append([Paragraph(title.upper(), st["section"]), "", "", "", "", ""])
            style += [("SPAN", (0, r), (-1, r)), ("BACKGROUND", (0, r), (-1, r), _tint(accent, 0.9))]
        for line in rows:
            counter += 1
            desc = [Paragraph(_esc(line.get("description")) or "Item", st["cell"])]
            if line.get("detail"):
                desc.append(Paragraph(_esc(line.get("detail")), st["cellMuted"]))
            r = len(data)
            data.append([
                Paragraph(str(counter), st["cellMuted"]),
                desc,
                Paragraph(_qty(line.get("quantity")), st["num"]),
                Paragraph(_esc(line.get("unit")), st["cell"]),
                Paragraph(_money(line.get("rate")), st["num"]),
                Paragraph(_money(line.get("amount")), st["num"]),
            ])
            style.append(("LINEBELOW", (0, r), (-1, r), 0.4, RULE))
            if counter % 2 == 0:
                style.append(("BACKGROUND", (0, r), (-1, r), ZEBRA))
        if grouped:
            r = len(data)
            data.append(["", Paragraph(f"{title} subtotal", st["sectionNum"]), "", "", "", Paragraph(_money(subtotal), st["sectionNum"])])
            style += [("SPAN", (1, r), (4, r)), ("LINEABOVE", (0, r), (-1, r), 0.8, accent)]
    if counter == 0:
        data.append(["", Paragraph("No line items", st["cellMuted"]), "", "", "", ""])
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle(style))
    return t, totals


def _totals(
    doc: dict[str, Any],
    kind_totals: dict[str, Decimal],
    st: dict[str, ParagraphStyle],
    width: float,
    accent: colors.Color,
    with_balance: bool = False,
) -> Table:
    rows: list[list[Any]] = []
    if len(kind_totals) > 1:
        for kind, title in KIND_TITLES:
            if kind in kind_totals:
                rows.append([title, _money(kind_totals[kind])])
    subtotal = _dec(doc.get("subtotal"))
    discount = _dec(doc.get("discount_total"))
    rows.append(["Subtotal", _money(subtotal)])
    if discount > 0:
        rows.append(["Discount", f"- {_money(discount)}"])
        rows.append(["Taxable amount", _money(doc.get("taxable_amount") or subtotal - discount)])
    pct = _dec(doc.get("tax_pct"))
    pct_text = f"{pct.normalize():f}".rstrip(".")
    if _dec(doc.get("igst")) > 0:
        rows.append([f"IGST @ {pct_text}%", _money(doc.get("igst"))])
    elif _dec(doc.get("tax_total")) > 0:
        half = f"{(pct / 2).normalize():f}"
        rows.append([f"CGST @ {half}%", _money(doc.get("cgst"))])
        rows.append([f"SGST @ {half}%", _money(doc.get("sgst"))])
    grand_row = len(rows)
    rows.append(["Grand total", _money(doc.get("total_amount") or doc.get("subtotal"))])
    balance_row = None
    if with_balance:
        rows.append(["Paid", _money(doc.get("paid"))])
        balance_row = len(rows)
        rows.append(["Balance due", _money(doc.get("outstanding"))])

    def cell(i: int, text: str, num: bool) -> Paragraph:
        if i == grand_row:
            return Paragraph(_esc(text), st["headNum"] if num else st["head"])
        if i == balance_row:
            return Paragraph(f"<b>{_esc(text)}</b>", st["num"] if num else st["body"])
        return Paragraph(_esc(text), st["num"] if num else st["body"])

    data = [[cell(i, a, False), cell(i, b, True)] for i, (a, b) in enumerate(rows)]
    t = Table(data, colWidths=[width * 0.55, width * 0.45])
    style = [
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 0), (-1, grand_row - 1), 0.4, RULE),
        ("BACKGROUND", (0, grand_row), (-1, grand_row), accent),
        ("TOPPADDING", (0, grand_row), (-1, grand_row), 7),
        ("BOTTOMPADDING", (0, grand_row), (-1, grand_row), 7),
    ]
    if balance_row is not None:
        style += [("BACKGROUND", (0, balance_row), (-1, balance_row), _tint(accent, 0.88)), ("LINEBELOW", (0, balance_row - 1), (-1, balance_row - 1), 0.4, RULE)]
    t.setStyle(TableStyle(style))
    return t


def _payment_block(doc: dict[str, Any], branding: dict[str, Any], st: dict[str, ParagraphStyle]) -> list[Any]:
    block: list[Any] = [
        Paragraph("AMOUNT IN WORDS", st["label"]),
        Paragraph(_esc(amount_in_words(doc.get("total_amount") or doc.get("subtotal"))), st["words"]),
    ]
    bank = [
        ("Account name", branding.get("bank_account_holder")),
        ("Account no.", branding.get("bank_account_number")),
        ("IFSC", branding.get("bank_ifsc_code")),
        ("Bank", " - ".join(str(v) for v in (branding.get("bank_name"), branding.get("bank_branch")) if v)),
        ("UPI", branding.get("upi_id")),
    ]
    bank = [(k, v) for k, v in bank if v]
    if bank:
        block += [Spacer(1, 8), Paragraph("PAYMENT DETAILS", st["label"])]
        block.append(Paragraph("<br/>".join(f"<font color='#78716C'>{k}:</font> {_esc(v)}" for k, v in bank), st["body"]))
    return block


def _scope_and_terms(
    doc: dict[str, Any], branding: dict[str, Any], st: dict[str, ParagraphStyle], width: float, accent: colors.Color, invoice: bool = False
) -> list[Any]:
    scope = doc.get("scope") if isinstance(doc.get("scope"), dict) else {}
    rows = [[Paragraph(label, st["bold"]), Paragraph(_multiline(scope.get(key)), st["body"])] for key, label in SCOPE_LABELS if str(scope.get(key) or "").strip()]
    out: list[Any] = []
    if rows:
        out += [Spacer(1, 12), Paragraph("SCOPE & TERMS OF THIS ESTIMATE", st["label"]), Spacer(1, 3)]
        t = Table(rows, colWidths=[width * 0.2, width * 0.8])
        t.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ("LINEBELOW", (0, 0), (-1, -2), 0.4, RULE),
                ]
            )
        )
        out.append(t)
    if str(doc.get("notes") or "").strip():
        out += [Spacer(1, 10), Paragraph("NOTES", st["label"]), Paragraph(_multiline(doc.get("notes")), st["body"])]
    terms = branding.get("terms_conditions") if invoice else branding.get("estimate_terms") or branding.get("terms_conditions")
    if str(terms or "").strip():
        out += [Spacer(1, 10), Paragraph("TERMS & CONDITIONS", st["label"]), Paragraph(_multiline(terms), st["small"])]
    return out


def _signatures(branding: dict[str, Any], st: dict[str, ParagraphStyle], width: float, customer_label: str = "Customer acceptance") -> Table:
    company = _esc(branding.get("company_name")) or "the company"
    sig = _load_image(str(branding.get("signature_url") or ""), 120, 42)
    seal = _load_image(str(branding.get("seal_url") or ""), 70, 50)
    right: list[Any] = [Paragraph(f"For <b>{company}</b>", st["metaRight"])]
    marks = [m for m in (seal, sig) if m]
    if marks:
        for m in marks:
            m.hAlign = "RIGHT"
        right += marks
    else:
        right.append(Spacer(1, 38))
    right.append(HRFlowable(width=150, thickness=0.8, color=MUTED, hAlign="RIGHT", spaceBefore=2, spaceAfter=3))
    signatory = _esc(branding.get("signatory_name"))
    designation = _esc(branding.get("signatory_designation"))
    if signatory:
        right.append(Paragraph(f"<b>{signatory}</b>", st["metaRight"]))
    right.append(Paragraph(designation or "Authorised signatory", st["metaRight"]))
    left = [
        Paragraph(customer_label, st["body"]),
        Spacer(1, 38),
        HRFlowable(width=150, thickness=0.8, color=MUTED, hAlign="LEFT", spaceBefore=2, spaceAfter=3),
        Paragraph("Signature &amp; date", st["small"]),
    ]
    t = Table([[left, right]], colWidths=[width * 0.5, width * 0.5])
    t.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return t


def build_invoice_pdf(doc: dict[str, Any]) -> bytes:
    branding = doc.get("branding") if isinstance(doc.get("branding"), dict) else {}
    tax = doc.get("tax") if isinstance(doc.get("tax"), dict) else {}
    rate = _dec(tax.get("rate"))
    prepared = {
        **doc,
        "estimate_lines": doc.get("estimate_lines") or None,
        "tax_pct": doc.get("tax_pct") or str(rate * 100 if rate <= 1 else rate),
        "title": doc.get("title") or "",
    }
    return build_estimate_pdf(prepared, label="Tax invoice" if branding.get("gst_number") else "Invoice")


def build_estimate_pdf(doc: dict[str, Any], label: str = "Estimate") -> bytes:
    invoice = _is_invoice(label)
    branding = doc.get("branding") if isinstance(doc.get("branding"), dict) else {}
    accent = _accent(branding)
    st = _styles(accent)
    buf = io.BytesIO()
    pdf = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=14 * mm, bottomMargin=18 * mm)
    width = pdf.width
    footer_text = " | ".join(str(v) for v in (branding.get("company_name"), branding.get("phone"), branding.get("email"), branding.get("website")) if v)

    def decorate(canvas, document) -> None:
        canvas.saveState()
        w, h = A4
        canvas.setFillColor(accent)
        canvas.rect(0, h - 5, w, 5, stroke=0, fill=1)
        canvas.setStrokeColor(RULE)
        canvas.setLineWidth(0.6)
        canvas.line(document.leftMargin, 12 * mm, w - document.rightMargin, 12 * mm)
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(document.leftMargin, 8 * mm, footer_text[:120])
        canvas.drawRightString(w - document.rightMargin, 8 * mm, f"{label} {doc.get('number') or ''}  |  Page {document.page}".strip())
        stamp = {"paid": ("PAID", colors.HexColor("#16A34A")), "void": ("VOID", colors.HexColor("#DC2626"))}.get(str(doc.get("status") or "")) if invoice else None
        if stamp and document.page == 1:
            canvas.translate(w / 2, h / 2)
            canvas.rotate(30)
            canvas.setFillColor(stamp[1])
            canvas.setFillAlpha(0.12)
            canvas.setFont("Helvetica-Bold", 110)
            canvas.drawCentredString(0, 0, stamp[0])
        canvas.restoreState()

    story: list[Any] = [
        _header(doc, branding, st, width, label),
        Spacer(1, 10),
        _parties(doc, st, width, accent, "BILL TO" if invoice else "PREPARED FOR"),
    ]

    title = str(doc.get("title") or "").strip()
    if title:
        story += [Spacer(1, 10), Paragraph(f"<font color='#78716C'>Subject:</font> <b>{_esc(title)}</b>", st["body"])]
    story.append(Spacer(1, 8))

    lines, kind_totals = _lines_table(doc, st, width, accent)
    story.append(lines)
    story.append(Spacer(1, 10))

    summary = Table(
        [[_payment_block(doc, branding, st), _totals(doc, kind_totals, st, width * 0.44, accent, with_balance=invoice)]],
        colWidths=[width * 0.56, width * 0.44],
    )
    summary.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (0, 0), 12), ("RIGHTPADDING", (1, 0), (1, 0), 0)]))
    story.append(KeepTogether(summary))

    story += _scope_and_terms(doc, branding, st, width, accent, invoice=invoice)
    story += [Spacer(1, 22), KeepTogether(_signatures(branding, st, width, "Received by" if invoice else "Customer acceptance"))]

    pdf.build(story, onFirstPage=decorate, onLaterPages=decorate)
    return buf.getvalue()
