from fastapi import APIRouter, Depends

from app.core.audit import write_audit
from app.core.collections import CUSTOMERS
from app.core.context import RequestContext, get_ctx
from app.core.permissions import Permission
from app.core.repo import list_org, org_owned, stamp_new
from app.core.store import get_store
from app.customers.schemas import CustomerIn

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("")
def list_customers(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.CUSTOMER_READ)
    org_id = ctx.require_org()
    return {"items": list_org(get_store(), CUSTOMERS, org_id)}


@router.post("")
def create_customer(payload: CustomerIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.CUSTOMER_CREATE)
    org_id = ctx.require_org()
    doc = get_store().create(CUSTOMERS, stamp_new(org_id, payload.model_dump()))
    write_audit(get_store(), ctx, "customer.create", "customer", doc["id"], new=doc)
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
