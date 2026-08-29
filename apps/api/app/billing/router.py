from fastapi import APIRouter, Depends, Header

from app.core.audit import write_audit
from app.core.collections import INVOICE_ITEMS, INVOICES, PAYMENT_ALLOCATIONS, PAYMENTS, PROJECTS
from app.core.context import RequestContext, get_ctx
from app.core.errors import AppError
from app.core.idempotency import remember, require_key
from app.core.numbering import next_number
from app.core.permissions import Permission
from app.core.repo import list_org, now_iso, org_owned, stamp_new
from app.core.store import get_store
from app.engines.billing import assert_billing_cap
from app.engines.gst import compute_gst
from app.engines.payments import allocate
from app.engines.units import D, money
from app.accounting.service import post_entry
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
    line_total = money(sum(D(i.get("amount") or 0) for i in payload.items))
    tax = compute_gst(
        line_total,
        payload.taxRate,
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
                    "siteId": project["siteId"],
                    "kind": payload.kind,
                    "status": "draft",
                    "items": payload.items,
                    "tax": tax,
                    "total": str(grand),
                    "paid": "0",
                    "outstanding": str(grand),
                },
            ),
        )
        for item in payload.items:
            store.create(INVOICE_ITEMS, stamp_new(org_id, {"invoiceId": invoice["id"], **item}))
        project["billedToDate"] = str(money(D(project.get("billedToDate") or 0) + grand))
        store.set(PROJECTS, project["id"], project)
        post_entry(store, org_id, "invoice", str(grand), project_id=project["id"], reference="invoice", reference_id=invoice["id"])
        write_audit(store, ctx, "invoice.create", "invoice", invoice["id"], new=invoice)
        return invoice

    existing = store.get("idempotency_keys", f"{org_id}:{key}")
    if existing:
        return existing["response"]
    invoice = build()
    return remember(store, org_id, key, invoice)


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
