from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.audit import write_audit
from app.core.collections import CUSTOMERS
from app.core.context import RequestContext, get_ctx
from app.core.permissions import Permission
from app.core.repo import list_org, org_owned, stamp_new
from app.core.store import get_store
from app.customers.crm import complete_follow_up, create_follow_up, customer_summary, list_follow_ups
from app.customers.schemas import CustomerIn

router = APIRouter(prefix="/customers", tags=["customers"])


class FollowUpIn(BaseModel):
    note: str = Field(min_length=1)
    dueAt: str | None = None


@router.get("")
def list_customers(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.CUSTOMER_READ)
    org_id = ctx.require_org()
    return {"items": list_org(get_store(), CUSTOMERS, org_id)}


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
def update_customer(customer_id: str, payload: CustomerIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.CUSTOMER_UPDATE)
    store = get_store()
    existing = org_owned(store, CUSTOMERS, customer_id, ctx.require_org())
    existing.update(payload.model_dump())
    existing["updatedAt"] = existing.get("updatedAt")
    saved = store.set(CUSTOMERS, customer_id, existing)
    write_audit(store, ctx, "customer.update", "customer", customer_id, previous=existing, new=saved)
    return saved
