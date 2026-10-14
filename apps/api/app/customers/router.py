from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.audit import write_audit
from app.core.collections import CUSTOMERS, INVOICES, SITES
from app.core.concurrency import run_parallel
from app.core.context import RequestContext, get_ctx
from app.core.permissions import Permission
from app.core.repo import list_org, now_iso, org_owned, stamp_new
from app.core.store import get_store
from app.customers.crm import complete_follow_up, create_follow_up, customer_summary, list_follow_ups
from app.customers.hierarchy import delete_customer_cascade
from app.customers.schemas import CustomerIn, CustomerUpdateIn
from app.engines.units import D, money

router = APIRouter(prefix="/customers", tags=["customers"])

_LIST_LIMIT = 500


class FollowUpIn(BaseModel):
    note: str = Field(min_length=1)
    dueAt: str | None = None


@router.get("")
def list_customers(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.CUSTOMER_READ)
    store = get_store()
    org_id = ctx.require_org()
    org_filter = [("orgId", "==", org_id)]
    customers, sites, invoices = run_parallel(
        lambda: list_org(store, CUSTOMERS, org_id, limit=_LIST_LIMIT),
        lambda: store.query(SITES, filters=org_filter, limit=_LIST_LIMIT, fields=["customerId", "deletedAt"]),
        lambda: store.query(
            INVOICES, filters=org_filter, limit=_LIST_LIMIT, fields=["customerId", "outstanding", "status", "deletedAt"]
        ),
    )
    site_counts: dict[str, int] = {}
    for s in sites:
        if not s.get("deletedAt"):
            key = str(s.get("customerId") or "")
            site_counts[key] = site_counts.get(key, 0) + 1
    dues: dict[str, object] = {}
    for inv in invoices:
        if inv.get("deletedAt") or inv.get("status") == "void":
            continue
        key = str(inv.get("customerId") or "")
        dues[key] = D(dues.get(key) or 0) + D(inv.get("outstanding") or 0)
    for c in customers:
        c["siteCount"] = site_counts.get(c["id"], 0)
        c["outstanding"] = str(money(dues.get(c["id"]) or 0))
    return {"items": customers}


@router.post("")
def create_customer(payload: CustomerIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.CUSTOMER_CREATE)
    org_id = ctx.require_org()
    from app.platform.quota import assert_quota

    assert_quota(org_id, "customers")
    doc = get_store().create(CUSTOMERS, stamp_new(org_id, payload.model_dump()))
    write_audit(get_store(), ctx, "customer.create", "customer", doc["id"], new=doc)
    return doc


@router.get("/{customer_id}/summary")
def get_customer_summary(customer_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.CUSTOMER_READ)
    return customer_summary(get_store(), ctx.require_org(), customer_id)


@router.get("/{customer_id}/follow-ups")
def get_follow_ups(customer_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.CUSTOMER_READ)
    return {"items": list_follow_ups(get_store(), ctx.require_org(), customer_id)}


@router.post("/{customer_id}/follow-ups")
def add_follow_up(customer_id: str, payload: FollowUpIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.CUSTOMER_UPDATE)
    doc = create_follow_up(
        get_store(),
        ctx.require_org(),
        customer_id,
        note=payload.note,
        due_at=payload.dueAt,
        user_id=ctx.user_id,
    )
    write_audit(get_store(), ctx, "customer.follow_up.create", "customer_follow_up", doc["id"], new=doc)
    return doc


@router.post("/follow-ups/{follow_up_id}/complete")
def mark_follow_up_done(follow_up_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.CUSTOMER_UPDATE)
    doc = complete_follow_up(get_store(), ctx.require_org(), follow_up_id)
    write_audit(get_store(), ctx, "customer.follow_up.complete", "customer_follow_up", follow_up_id, new=doc)
    return doc


@router.get("/{customer_id}")
def get_customer(customer_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.CUSTOMER_READ)
    return org_owned(get_store(), CUSTOMERS, customer_id, ctx.require_org())


@router.patch("/{customer_id}")
def update_customer(customer_id: str, payload: CustomerUpdateIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.CUSTOMER_UPDATE)
    store = get_store()
    existing = org_owned(store, CUSTOMERS, customer_id, ctx.require_org())
    previous = dict(existing)
    fields = payload.model_dump(exclude_unset=True)
    for required in ("name", "phone", "type"):
        if fields.get(required) is None:
            fields.pop(required, None)
    if fields.get("type") == "individual":
        fields.update({"company": None, "gstin": None})
    existing.update(fields)
    existing["updatedAt"] = now_iso()
    saved = store.set(CUSTOMERS, customer_id, existing)
    write_audit(store, ctx, "customer.update", "customer", customer_id, previous=previous, new=saved)
    return saved


@router.delete("/{customer_id}")
def delete_customer(customer_id: str, ctx: RequestContext = Depends(get_ctx)):
    """Soft-deletes the customer with its sites, surveys, measurements, estimates, quotes, files and follow-ups.
    Refused while projects, invoices or payments exist for the customer."""
    ctx.require(Permission.CUSTOMER_UPDATE)
    store = get_store()
    org_id = ctx.require_org()
    customer = org_owned(store, CUSTOMERS, customer_id, org_id)
    removed = delete_customer_cascade(store, org_id, customer)
    write_audit(store, ctx, "customer.delete", "customer", customer_id, previous=customer, new={"removed": removed})
    return {"ok": True, "id": customer_id, "removed": removed}
