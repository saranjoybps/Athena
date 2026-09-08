from __future__ import annotations

from typing import Any

from app.core.collections import CUSTOMERS, INVOICE_ITEMS, ORGANIZATIONS, SITES
from app.core.repo import list_org, org_owned
from app.core.store import DocumentStore
from app.engines.units import D, money


def _item_cost(item: dict[str, Any]) -> Any:
    return money(
        D(item.get("materialCost") or 0)
        + D(item.get("labourCost") or 0)
        + D(item.get("equipmentCost") or 0)
        + D(item.get("otherCost") or 0)
    )


def normalize_quote_lines(quote: dict[str, Any]) -> list[dict[str, Any]]:
    items = quote.get("items") or []
    computed = quote.get("computed") or {}
    tax = computed.get("tax") or {}
    tax_pct = float(D(tax.get("rate") or 0)) * 100
    selling_total = D(computed.get("selling") or computed.get("subtotal") or 0)
    costs = [_item_cost(i) for i in items]
    total_cost = sum(costs, D(0))

    lines: list[dict[str, Any]] = []
    allocated = D(0)
    for idx, item in enumerate(items):
        qty = D(item.get("quantity") or 1)
        if qty <= 0:
            qty = D(1)
        if item.get("rate"):
            unit_price = D(item["rate"])
            line_subtotal = money(qty * unit_price)
        elif total_cost > 0:
            share = costs[idx] / total_cost
            line_subtotal = money(selling_total * share)
            unit_price = money(line_subtotal / qty) if qty else line_subtotal
        elif items:
            line_subtotal = money(selling_total / len(items))
            unit_price = money(line_subtotal / qty) if qty else line_subtotal
        else:
            line_subtotal = money(0)
            unit_price = money(0)

        if idx == len(items) - 1 and items:
            line_subtotal = money(selling_total - allocated)
            unit_price = money(line_subtotal / qty) if qty else line_subtotal
        else:
            allocated += line_subtotal

        taxable = line_subtotal
        tax_amount = money(taxable * D(tax.get("rate") or 0))
        lines.append(
            {
                "description": item.get("description") or "Item",
                "quantity": str(qty),
                "unit": item.get("unit") or "",
                "unit_price": str(unit_price),
                "discount_pct": "0",
                "tax_pct": str(tax_pct),
                "subtotal": str(line_subtotal),
                "tax_amount": str(tax_amount),
                "total": str(money(taxable + tax_amount)),
            }
        )
    return lines


def normalize_invoice_lines(invoice: dict[str, Any]) -> list[dict[str, Any]]:
    tax = invoice.get("tax") or {}
    tax_pct = float(D(tax.get("rate") or 0)) * 100
    lines: list[dict[str, Any]] = []
    for item in invoice.get("items") or []:
        try:
            qty = D(item.get("quantity") or 1)
        except Exception:
            qty = D(1)
        if qty <= 0:
            qty = D(1)

        amount = D(item.get("amount") or 0)
        rate_raw = item.get("rate") if item.get("rate") not in (None, "") else item.get("unit_price")
        try:
            unit_price = D(rate_raw) if rate_raw not in (None, "") else None
        except Exception:
            unit_price = None

        if unit_price is not None and amount == 0:
            amount = money(qty * unit_price)
        elif unit_price is None:
            unit_price = money(amount / qty) if qty else money(amount)

        tax_amount = money(amount * D(tax.get("rate") or 0))
        lines.append(
            {
                "description": item.get("description") or "Item",
                "quantity": str(qty),
                "unit": item.get("unit") or "",
                "unit_price": str(money(unit_price)),
                "discount_pct": "0",
                "tax_pct": str(tax_pct),
                "subtotal": str(money(amount)),
                "tax_amount": str(tax_amount),
                "total": str(money(amount + tax_amount)),
            }
        )
    return lines


def invoice_items_from_quote(quote: dict[str, Any]) -> list[dict[str, Any]]:
    """Build invoice line payloads from a quote (prefer normalized display lines)."""
    lines = normalize_quote_lines(quote)
    if lines:
        return [
            {
                "description": line["description"],
                "amount": line["subtotal"],
                "quantity": line["quantity"],
                "unit": line.get("unit") or "",
                "rate": line["unit_price"],
            }
            for line in lines
        ]
    # Fallback: raw estimate/quote rows
    items: list[dict[str, Any]] = []
    for item in quote.get("items") or []:
        qty = item.get("quantity") or 1
        try:
            qty_d = D(qty)
        except Exception:
            qty_d = D(1)
        if qty_d <= 0:
            qty_d = D(1)
        if item.get("rate"):
            amount = money(qty_d * D(item["rate"]))
            rate = str(money(D(item["rate"])))
        else:
            amount = money(
                D(item.get("materialCost") or 0)
                + D(item.get("labourCost") or 0)
                + D(item.get("equipmentCost") or 0)
                + D(item.get("otherCost") or 0)
            )
            rate = str(money(amount / qty_d)) if qty_d else str(amount)
        items.append(
            {
                "description": item.get("description") or "Item",
                "amount": str(amount),
                "quantity": str(qty_d),
                "unit": item.get("unit") or "",
                "rate": rate,
            }
        )
    return items


def quote_document_totals(quote: dict[str, Any]) -> dict[str, str]:
    computed = quote.get("computed") or {}
    tax = computed.get("tax") or {}
    subtotal = computed.get("selling") or computed.get("subtotal") or "0"
    discount = computed.get("discount") or "0"
    return {
        "subtotal": str(subtotal),
        "discount_total": str(discount),
        "tax_total": tax.get("taxTotal") or "0",
        "cgst": tax.get("cgst") or "0",
        "sgst": tax.get("sgst") or "0",
        "igst": tax.get("igst") or "0",
        "total_amount": computed.get("grandTotal") or tax.get("grandTotal") or str(subtotal),
    }


def invoice_document_totals(invoice: dict[str, Any]) -> dict[str, str]:
    tax = invoice.get("tax") or {}
    taxable = tax.get("taxableAmount") or "0"
    return {
        "subtotal": str(taxable),
        "discount_total": "0",
        "tax_total": tax.get("taxTotal") or "0",
        "cgst": tax.get("cgst") or "0",
        "sgst": tax.get("sgst") or "0",
        "igst": tax.get("igst") or "0",
        "total_amount": invoice.get("total") or tax.get("grandTotal") or "0",
    }


def org_document_branding(org: dict[str, Any]) -> dict[str, Any]:
    branding = org.get("documentBranding") or {}
    address = org.get("address") or ""
    if not address:
        address = ", ".join(
            p
            for p in [org.get("city"), org.get("state"), org.get("pinCode"), org.get("country")]
            if p
        )
    return {
        "company_name": branding.get("companyName") or org.get("name") or "",
        "company_address": branding.get("companyAddress") or address,
        "gst_number": branding.get("gstNumber") or org.get("gstin") or "",
        "pan": branding.get("pan") or org.get("pan") or "",
        "phone": branding.get("phone") or org.get("phone") or "",
        "email": branding.get("email") or org.get("email") or "",
        "bank_name": branding.get("bankName") or "",
        "bank_branch": branding.get("bankBranch") or "",
        "bank_account_holder": branding.get("bankAccountHolder") or "",
        "bank_account_number": branding.get("bankAccountNumber") or "",
        "bank_ifsc_code": branding.get("bankIfscCode") or "",
        "upi_id": branding.get("upiId") or "",
        "terms_conditions": branding.get("termsConditions") or "",
        "logo_url": branding.get("logoUrl") or org.get("logo") or "",
        "seal_url": branding.get("sealUrl") or "",
        "signature_url": branding.get("signatureUrl") or "",
    }


def enrich_quote_document(store: DocumentStore, org_id: str, quote: dict[str, Any]) -> dict[str, Any]:
    customer = org_owned(store, CUSTOMERS, quote["customerId"], org_id)
    site = org_owned(store, SITES, quote["siteId"], org_id) if quote.get("siteId") else None
    org = org_owned(store, ORGANIZATIONS, org_id, org_id)
    totals = quote_document_totals(quote)
    return {
        **quote,
        "customer": customer,
        "site": site,
        "branding": org_document_branding(org),
        "line_items": normalize_quote_lines(quote),
        **totals,
        "notes": quote.get("notes"),
        "scope": quote.get("scope") or {},
    }


def enrich_invoice_document(store: DocumentStore, org_id: str, invoice: dict[str, Any]) -> dict[str, Any]:
    customer = org_owned(store, CUSTOMERS, invoice["customerId"], org_id)
    site = org_owned(store, SITES, invoice["siteId"], org_id) if invoice.get("siteId") else None
    org = org_owned(store, ORGANIZATIONS, org_id, org_id)
    items = list(invoice.get("items") or [])
    if not items:
        items = [
            {
                "description": i.get("description") or "Item",
                "amount": i.get("amount") or "0",
                "quantity": i.get("quantity") or "1",
                "unit": i.get("unit") or "",
                "rate": i.get("rate") or i.get("unit_price") or "",
            }
            for i in list_org(store, INVOICE_ITEMS, org_id)
            if i.get("invoiceId") == invoice.get("id")
        ]
        if items:
            invoice = {**invoice, "items": items}
    totals = invoice_document_totals(invoice)
    return {
        **invoice,
        "customer": customer,
        "site": site,
        "branding": org_document_branding(org),
        "line_items": normalize_invoice_lines(invoice),
        **totals,
    }
