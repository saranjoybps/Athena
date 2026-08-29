from __future__ import annotations

from app.core.collections import DELIVERIES, MATERIAL_REQUESTS, PURCHASE_ORDERS, PURCHASES
from app.core.context import RequestContext
from app.core.numbering import next_number
from app.core.repo import now_iso, org_owned, stamp_new
from app.core.store import DocumentStore
from app.accounting.service import post_entry
from app.engines.gst import compute_gst
from app.engines.units import D, money


def create_mr(store: DocumentStore, ctx: RequestContext, data: dict) -> dict:
    org_id = ctx.require_org()
    data["status"] = "requested"
    data["number"] = next_number(store, org_id, "material_request")
    return store.create(MATERIAL_REQUESTS, stamp_new(org_id, data))


def approve_mr(store: DocumentStore, ctx: RequestContext, mr_id: str) -> dict:
    mr = org_owned(store, MATERIAL_REQUESTS, mr_id, ctx.require_org())
    mr["status"] = "approved"
    mr["approvedAt"] = now_iso()
    mr["approvedBy"] = ctx.user_id
    return store.set(MATERIAL_REQUESTS, mr_id, mr)


def create_po(store: DocumentStore, ctx: RequestContext, data: dict) -> dict:
    org_id = ctx.require_org()
    data["status"] = "draft"
    data["number"] = next_number(store, org_id, "purchase_order")
    return store.create(PURCHASE_ORDERS, stamp_new(org_id, data))


def receive_po(store: DocumentStore, ctx: RequestContext, po_id: str) -> dict:
    po = org_owned(store, PURCHASE_ORDERS, po_id, ctx.require_org())
    po["status"] = "received"
    po["receivedAt"] = now_iso()
    return store.set(PURCHASE_ORDERS, po_id, po)


def quick_purchase(store: DocumentStore, ctx: RequestContext, data: dict) -> dict:
    org_id = ctx.require_org()
    items = data.get("items") or []
    total = data.get("total")
    if not total:
        total = str(money(sum(D(i.get("amount") or (D(i.get("qty", 0)) * D(i.get("rate", 0)))) for i in items)))
    tax = data.get("tax") or compute_gst(total, "0.18", "Tamil Nadu", "Tamil Nadu")
    doc = store.create(
        PURCHASES,
        stamp_new(
            org_id,
            {
                **data,
                "total": str(money(D(tax.get("grandTotal", total)))),
                "tax": tax,
                "status": "posted",
                "number": next_number(store, org_id, "purchase"),
            },
        ),
    )
    post_entry(store, org_id, "purchase", doc["total"], project_id=data.get("projectId"), reference="purchase", reference_id=doc["id"])
    return doc


def create_delivery(store: DocumentStore, ctx: RequestContext, data: dict) -> dict:
    org_id = ctx.require_org()
    data["status"] = "delivered"
    return store.create(DELIVERIES, stamp_new(org_id, data))
