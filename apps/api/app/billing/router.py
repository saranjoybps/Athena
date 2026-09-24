from fastapi import APIRouter, Depends, Header
from fastapi.responses import HTMLResponse, Response

from app.core.audit import write_audit
from app.core.collections import (
    CUSTOMERS,
    INVOICE_ITEMS,
    INVOICES,
    PAYMENT_ALLOCATIONS,
    PAYMENTS,
    PROJECTS,
    QUOTE_INVOICES,
    QUOTES,
)
from app.core.context import RequestContext, get_ctx
from app.core.errors import AppError
from app.core.idempotency import remember, require_key
from app.core.media import document_pdf_bytes, document_preview_html, document_preview_pages
from app.core.numbering import next_number
from app.core.permissions import Permission
from app.core.repo import list_org, now_iso, org_owned, stamp_new, update_doc
from app.core.store import get_store
from app.engines.billing import assert_billing_cap
from app.engines.gst import compute_gst
from app.engines.payments import allocate
from app.engines.units import D, money
from app.accounting.service import post_entry
from app.billing.document_service import enrich_invoice_document, invoice_items_from_quote
from app.billing.schemas import InvoiceFromQuoteIn, InvoiceUpdateIn
from app.projects.schemas import InvoiceIn, PaymentIn

router = APIRouter(tags=["billing"])


@router.post("/invoices")
def create_invoice(
    payload: InvoiceIn,
    ctx: RequestContext = Depends(get_ctx),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    ctx.require(Permission.INVOICE_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    key = require_key(idempotency_key)
    project = org_owned(store, PROJECTS, payload.projectId, org_id)
    if project.get("status") == "completed":
        raise AppError(400, "project_closed", "Closed projects are read-only.")

    items = [dict(i) for i in (payload.items or [])]
    if not items and project.get("quoteId"):
        quote = org_owned(store, QUOTES, str(project["quoteId"]), org_id)
        items = invoice_items_from_quote(quote)
    # Append labour (schedule×crew) or contract (sqft×rate) lines when creating from project.
    from app.billing.labor import labor_lines_for_project

    labor_lines = labor_lines_for_project(store, org_id, project["id"])
    existing_desc = {str(i.get("description") or "") for i in items}
    for line in labor_lines:
        if line["description"] not in existing_desc:
            items.append(line)

    # Prefer GST from material lines (hsn + gstRate) when taxRate not provided.
    if payload.taxRate is None:
        material_rates = [
            D(i.get("gstRate"))
            for i in items
            if i.get("gstRate") is not None and D(i.get("gstRate") or 0) > 0
        ]
        if material_rates:
            # Use highest line GST rate for invoice-level tax (simple single-rate engine).
            payload_tax = max(material_rates)
            tax_rate_override = str(payload_tax)
        else:
            tax_rate_override = None
    else:
        tax_rate_override = payload.taxRate

    if not items:
        raise AppError(400, "invoice_items_required", "Invoice needs at least one line item from the estimate/quote.")

    line_total = money(sum(D(i.get("amount") or 0) for i in items))
    tax = compute_gst(
        line_total,
        tax_rate_override,
        payload.placeOfSupply,
        payload.supplierState,
        payload.registeredCustomer,
    )
    grand = D(tax["grandTotal"])
    try:
        assert_billing_cap(
            project.get("billedToDate") or 0,
            grand,
            project.get("contractValue") or 0,
            project.get("approvedChangeOrders") or 0,
            override=payload.overrideCap,
        )
    except ValueError as exc:
        raise AppError(400, "billing_cap", str(exc)) from exc

    def build():
        number = next_number(store, org_id, "invoice")
        invoice = store.create(
            INVOICES,
            stamp_new(
                org_id,
                {
                    "number": number,
                    "projectId": project["id"],
                    "customerId": project["customerId"],
                    "siteId": project.get("siteId"),
                    "quoteId": project.get("quoteId"),
                    "kind": payload.kind,
                    "status": "draft",
                    "items": items,
                    "tax": tax,
                    "total": str(grand),
                    "paid": "0",
                    "outstanding": str(grand),
                    "placeOfSupply": payload.placeOfSupply or tax.get("placeOfSupply") or "Tamil Nadu",
                    "supplierState": payload.supplierState or tax.get("supplierState") or "Tamil Nadu",
                    "registeredCustomer": payload.registeredCustomer,
                },
            ),
        )
        for item in items:
            store.create(INVOICE_ITEMS, stamp_new(org_id, {"invoiceId": invoice["id"], **item}))
        project["billedToDate"] = str(money(D(project.get("billedToDate") or 0) + grand))
        store.set(PROJECTS, project["id"], project)
        post_entry(store, org_id, "invoice", str(grand), project_id=project["id"], reference="invoice", reference_id=invoice["id"])
        from app.core.media import upload_document_pdf

        enriched = enrich_invoice_document(store, org_id, invoice)
        pdf = upload_document_pdf(enriched, kind="invoice", org_id=org_id, doc_id=invoice["id"])
        invoice.update(pdf)
        invoice = store.set(INVOICES, invoice["id"], invoice)
        write_audit(store, ctx, "invoice.create", "invoice", invoice["id"], new=invoice)
        return enrich_invoice_document(store, org_id, invoice)

    existing = store.get("idempotency_keys", f"{org_id}:{key}")
    if existing:
        return existing["response"]
    invoice = build()
    return remember(store, org_id, key, invoice)

@router.post("/invoices/from-quote/{quote_id}")
def create_invoice_from_quote(
    quote_id: str,
    payload: InvoiceFromQuoteIn,
    ctx: RequestContext = Depends(get_ctx),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    ctx.require(Permission.INVOICE_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    key = require_key(idempotency_key)
    quote = org_owned(store, QUOTES, quote_id, org_id)
    if quote.get("status") not in ("accepted", "invoiced"):
        raise AppError(400, "quote_not_accepted", "Quote must be accepted before invoicing.")

    existing_link = store.get(QUOTE_INVOICES, quote_id)
    if existing_link:
        invoice = org_owned(store, INVOICES, existing_link["invoiceId"], org_id)
        return enrich_invoice_document(store, org_id, invoice)

    computed = quote.get("computed") or {}
    tax = computed.get("tax") or {}
    grand = D(computed.get("grandTotal") or tax.get("grandTotal") or 0)
    items = invoice_items_from_quote(quote)
    if not items:
        # Last resort: single line from quote total so the PDF is never empty.
        items = [
            {
                "description": str(quote.get("number") or "Approved estimate"),
                "amount": str(grand),
                "quantity": "1",
                "unit": "",
                "rate": str(grand),
            }
        ]

    project = None
    if payload.projectId:
        project = org_owned(store, PROJECTS, payload.projectId, org_id)
    elif quote.get("projectId"):
        project = org_owned(store, PROJECTS, quote["projectId"], org_id)

    if project:
        if project.get("status") == "completed":
            raise AppError(400, "project_closed", "Closed projects are read-only.")
        try:
            assert_billing_cap(
                project.get("billedToDate") or 0,
                grand,
                project.get("contractValue") or 0,
                project.get("approvedChangeOrders") or 0,
                override=payload.overrideCap,
            )
        except ValueError as exc:
            raise AppError(400, "billing_cap", str(exc)) from exc

    def build():
        number = next_number(store, org_id, "invoice")
        invoice = store.create(
            INVOICES,
            stamp_new(
                org_id,
                {
                    "number": number,
                    "quoteId": quote_id,
                    "projectId": project["id"] if project else None,
                    "customerId": quote["customerId"],
                    "siteId": quote.get("siteId"),
                    "kind": payload.kind,
                    "status": "draft",
                    "items": items,
                    "tax": tax,
                    "total": str(grand),
                    "paid": "0",
                    "outstanding": str(grand),
                    "notes": payload.notes,
                    "dueDate": payload.dueDate,
                },
            ),
        )
        for item in items:
            store.create(INVOICE_ITEMS, stamp_new(org_id, {"invoiceId": invoice["id"], **item}))
        store.create(
            QUOTE_INVOICES,
            {"orgId": org_id, "quoteId": quote_id, "invoiceId": invoice["id"], "createdAt": now_iso()},
            doc_id=quote_id,
        )
        quote["status"] = "invoiced"
        quote["invoicedAt"] = now_iso()
        store.set(QUOTES, quote_id, quote)
        if project:
            project["billedToDate"] = str(money(D(project.get("billedToDate") or 0) + grand))
            store.set(PROJECTS, project["id"], project)
            post_entry(
                store,
                org_id,
                "invoice",
                str(grand),
                project_id=project["id"],
                reference="invoice",
                reference_id=invoice["id"],
            )
        write_audit(store, ctx, "invoice.create_from_quote", "invoice", invoice["id"], new=invoice)
        return invoice

    existing = store.get("idempotency_keys", f"{org_id}:{key}")
    if existing:
        invoice = org_owned(store, INVOICES, existing["response"]["id"], org_id)
        return enrich_invoice_document(store, org_id, invoice)
    invoice = build()
    remember(store, org_id, key, invoice)
    return enrich_invoice_document(store, org_id, invoice)


@router.post("/invoices/{invoice_id}/send")
def send_invoice(invoice_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.INVOICE_SEND)
    store = get_store()
    org_id = ctx.require_org()
    invoice = org_owned(store, INVOICES, invoice_id, org_id)
    if invoice.get("status") not in ("draft", "sent"):
        raise AppError(400, "invalid_status", "Only draft invoices can be sent.")
    invoice["status"] = "sent"
    invoice["sentAt"] = now_iso()
    if not invoice.get("pdfUrl"):
        from app.core.media import upload_document_pdf

        enriched = enrich_invoice_document(store, org_id, invoice)
        pdf = upload_document_pdf(enriched, kind="invoice", org_id=org_id, doc_id=invoice_id)
        invoice.update(pdf)
    customer = store.get(CUSTOMERS, invoice.get("customerId") or "") or {}
    from app.core.mail import send_email

    invoice["emailResult"] = send_email(
        to=customer.get("email"),
        subject=f"Invoice {invoice.get('number') or invoice_id}",
        body=f"Please find your invoice {invoice.get('number')}.\n\n{invoice.get('pdfUrl') or ''}",
    )
    saved = store.set(INVOICES, invoice_id, invoice)
    write_audit(store, ctx, "invoice.send", "invoice", invoice_id, new=saved)
    return enrich_invoice_document(store, org_id, saved)


@router.post("/invoices/{invoice_id}/pdf")
def generate_invoice_pdf(invoice_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.INVOICE_READ)
    store = get_store()
    org_id = ctx.require_org()
    invoice = org_owned(store, INVOICES, invoice_id, org_id)
    from app.core.media import upload_document_pdf

    enriched = enrich_invoice_document(store, org_id, invoice)
    pdf = upload_document_pdf(enriched, kind="invoice", org_id=org_id, doc_id=invoice_id)
    invoice.update(pdf)
    invoice["updatedAt"] = now_iso()
    saved = store.set(INVOICES, invoice_id, invoice)
    return enrich_invoice_document(store, org_id, saved)


@router.get("/invoices/{invoice_id}/pdf-file")
def download_invoice_pdf(invoice_id: str, ctx: RequestContext = Depends(get_ctx)):
    """Inline PDF bytes for download / share (does not depend on Cloudinary delivery)."""
    ctx.require(Permission.INVOICE_READ)
    store = get_store()
    org_id = ctx.require_org()
    invoice = org_owned(store, INVOICES, invoice_id, org_id)
    enriched = enrich_invoice_document(store, org_id, invoice)
    data = document_pdf_bytes(enriched, "invoice")
    filename = f"{invoice.get('number') or invoice_id}.pdf"
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/invoices/{invoice_id}/preview-html")
def preview_invoice_html(invoice_id: str, ctx: RequestContext = Depends(get_ctx)):
    """In-app HTML preview — reliable in mobile WebView without PDF.js/CDN."""
    ctx.require(Permission.INVOICE_READ)
    store = get_store()
    org_id = ctx.require_org()
    invoice = org_owned(store, INVOICES, invoice_id, org_id)
    enriched = enrich_invoice_document(store, org_id, invoice)
    return HTMLResponse(content=document_preview_html(enriched, "invoice"))


@router.get("/invoices/{invoice_id}/preview-pages")
def preview_invoice_pages(invoice_id: str, ctx: RequestContext = Depends(get_ctx)):
    """Rasterized PDF pages (PNG) for native in-app preview."""
    ctx.require(Permission.INVOICE_READ)
    store = get_store()
    org_id = ctx.require_org()
    invoice = org_owned(store, INVOICES, invoice_id, org_id)
    enriched = enrich_invoice_document(store, org_id, invoice)
    return document_preview_pages(enriched, "invoice")


@router.patch("/invoices/{invoice_id}")
def update_invoice(invoice_id: str, payload: InvoiceUpdateIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.INVOICE_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    invoice = org_owned(store, INVOICES, invoice_id, org_id)
    fields = payload.model_dump(exclude_unset=True)
    next_status = fields.get("status")
    if next_status == "void":
        if invoice.get("status") == "void":
            return enrich_invoice_document(store, org_id, invoice)
        project_id = invoice.get("projectId")
        total = D(invoice.get("total") or 0)
        invoice["status"] = "void"
        invoice["voidedAt"] = now_iso()
        invoice["outstanding"] = "0"
        saved = store.set(INVOICES, invoice_id, invoice)
        if project_id:
            project = org_owned(store, PROJECTS, project_id, org_id)
            project["billedToDate"] = str(money(max(D(0), D(project.get("billedToDate") or 0) - total)))
            # Recalculate project status from remaining non-void invoices.
            siblings = [
                i
                for i in list_org(store, INVOICES, org_id)
                if i.get("projectId") == project_id and i.get("status") != "void" and i.get("id") != invoice_id
            ]
            if project.get("status") == "completed" and not any(i.get("kind") == "final" for i in siblings):
                project["status"] = "active"
            store.set(PROJECTS, project_id, project)
        write_audit(store, ctx, "invoice.void", "invoice", invoice_id, new=saved)
        return enrich_invoice_document(store, org_id, saved)

    if invoice.get("status") in ("paid", "void"):
        raise AppError(400, "invoice_locked", "Paid or void invoices cannot be edited.")
    if invoice.get("status") not in ("draft", "sent", "partially_paid"):
        raise AppError(400, "invoice_locked", "This invoice cannot be edited.")
    if next_status and next_status not in ("draft", "sent", "paid", "void"):
        raise AppError(400, "invalid_status", "Unsupported invoice status.")

    items_payload = fields.pop("items", None)
    tax_rate = fields.pop("taxRate", None)
    place = fields.pop("placeOfSupply", None)
    supplier_state = fields.pop("supplierState", None)
    registered = fields.pop("registeredCustomer", None)

    old_total = D(invoice.get("total") or 0)
    paid_amt = D(invoice.get("paid") or 0)

    if items_payload is not None:
        items = [dict(i) for i in items_payload]
        line_total = money(sum(D(i.get("amount") or 0) for i in items))
        tax = compute_gst(
            line_total,
            tax_rate if tax_rate is not None else (invoice.get("tax") or {}).get("rate") or "0",
            place
            if place is not None
            else invoice.get("placeOfSupply")
            or (invoice.get("tax") or {}).get("placeOfSupply")
            or "Tamil Nadu",
            supplier_state
            if supplier_state is not None
            else invoice.get("supplierState")
            or (invoice.get("tax") or {}).get("supplierState")
            or "Tamil Nadu",
            registered if registered is not None else invoice.get("registeredCustomer", True),
        )
        grand = D(tax["grandTotal"])
        if paid_amt > grand:
            raise AppError(400, "invoice_paid_exceeds", "New total cannot be less than amount already paid.")
        fields["items"] = items
        fields["tax"] = tax
        fields["total"] = str(grand)
        fields["outstanding"] = str(money(grand - paid_amt))
        if paid_amt <= 0:
            if invoice.get("status") == "partially_paid":
                fields["status"] = "sent"
        elif paid_amt < grand:
            fields["status"] = "partially_paid"
        else:
            fields["status"] = "paid"

        project_id = invoice.get("projectId")
        if project_id:
            project = org_owned(store, PROJECTS, project_id, org_id)
            project["billedToDate"] = str(money(D(project.get("billedToDate") or 0) - old_total + grand))
            store.set(PROJECTS, project_id, project)

    saved = update_doc(store, INVOICES, invoice_id, org_id, fields)
    from app.core.media import upload_document_pdf

    enriched = enrich_invoice_document(store, org_id, saved)
    pdf = upload_document_pdf(enriched, kind="invoice", org_id=org_id, doc_id=invoice_id)
    saved.update(pdf)
    saved = store.set(INVOICES, invoice_id, saved)
    write_audit(store, ctx, "invoice.update", "invoice", invoice_id, new=saved)
    return enrich_invoice_document(store, org_id, saved)


@router.get("/invoices/{invoice_id}")
def get_invoice(invoice_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.INVOICE_READ)
    store = get_store()
    org_id = ctx.require_org()
    invoice = org_owned(store, INVOICES, invoice_id, org_id)
    return enrich_invoice_document(store, org_id, invoice)


@router.get("/invoices")
def list_invoices(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.INVOICE_READ)
    return {"items": list_org(get_store(), INVOICES, ctx.require_org())}


@router.post("/payments")
def create_payment(
    payload: PaymentIn,
    ctx: RequestContext = Depends(get_ctx),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    ctx.require(Permission.PAYMENT_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    key = require_key(idempotency_key)
    invoice = org_owned(store, INVOICES, payload.invoiceId, org_id)
    try:
        result = allocate(payload.amount, invoice.get("outstanding") or invoice.get("total"))
    except ValueError as exc:
        raise AppError(400, "payment_invalid", str(exc)) from exc

    def build():
        number = next_number(store, org_id, "payment")
        payment = store.create(
            PAYMENTS,
            stamp_new(
                org_id,
                {
                    "number": number,
                    "invoiceId": invoice["id"],
                    "projectId": invoice.get("projectId"),
                    "customerId": invoice.get("customerId"),
                    "amount": result["allocated"],
                    "method": payload.method,
                    "reference": payload.reference,
                    "notes": payload.notes,
                },
            ),
        )
        store.create(
            PAYMENT_ALLOCATIONS,
            stamp_new(org_id, {"paymentId": payment["id"], "invoiceId": invoice["id"], **result}),
        )
        invoice["paid"] = str(money(D(invoice.get("paid") or 0) + D(result["allocated"])))
        invoice["outstanding"] = result["outstanding"]
        invoice["status"] = "paid" if result["fullyPaid"] else "partially_paid"
        store.set(INVOICES, invoice["id"], invoice)
        if result["fullyPaid"] and invoice.get("projectId"):
            project = store.get(PROJECTS, str(invoice["projectId"]))
            if project and project.get("orgId") == org_id and project.get("status") != "completed":
                # Auto-complete only when every project invoice is fully paid (or void).
                siblings = list_org(
                    store, INVOICES, org_id, extra_filters=[("projectId", "==", invoice["projectId"])], limit=200
                )
                all_settled = all(str(i.get("status") or "") in ("paid", "void") for i in siblings)
                if all_settled:
                    project["status"] = "completed"
                    project["completedAt"] = now_iso()
                    store.set(PROJECTS, project["id"], project)
        post_entry(store, org_id, "payment", result["allocated"], project_id=invoice.get("projectId"), reference="payment", reference_id=payment["id"])
        write_audit(store, ctx, "payment.create", "payment", payment["id"], new=payment)
        return payment

    existing = store.get("idempotency_keys", f"{org_id}:{key}")
    if existing:
        return existing["response"]
    payment = build()
    return remember(store, org_id, key, payment)


@router.get("/payments")
def list_payments(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PAYMENT_VIEW)
    return {"items": list_org(get_store(), PAYMENTS, ctx.require_org())}
