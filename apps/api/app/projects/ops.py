from fastapi import APIRouter, Depends

from app.core.audit import write_audit
from app.core.collections import CHANGE_ORDERS, EXPENSES, PROJECTS, SNAGS
from app.core.context import RequestContext, get_ctx
from app.core.errors import AppError
from app.core.numbering import next_number
from app.core.permissions import Permission
from app.core.repo import list_org, now_iso, org_owned, stamp_new, update_doc
from app.core.store import get_store
from app.engines.units import D, money
from app.projects.schemas import ChangeOrderIn, ExpenseIn, SnagIn
from app.projects.update_schemas import ExpenseUpdateIn

expenses_router = APIRouter(prefix="/expenses", tags=["expenses"])
co_router = APIRouter(prefix="/change-orders", tags=["change_orders"])
snags_router = APIRouter(prefix="/snags", tags=["snags"])


@expenses_router.post("")
def create_expense(payload: ExpenseIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.EXPENSE_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    org_owned(store, PROJECTS, payload.projectId, org_id)
    doc = store.create(EXPENSES, stamp_new(org_id, payload.model_dump()))
    from app.accounting.service import post_entry

    post_entry(store, org_id, "expense", payload.amount, project_id=payload.projectId, reference="expense", reference_id=doc["id"])
    write_audit(store, ctx, "expense.create", "expense", doc["id"], new=doc)
    return doc


@expenses_router.get("")
def list_expenses(project_id: str | None = None, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.EXPENSE_READ)
    extra = [("projectId", "==", project_id)] if project_id else None
    return {"items": list_org(get_store(), EXPENSES, ctx.require_org(), extra)}


@expenses_router.get("/{expense_id}")
def get_expense(expense_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.EXPENSE_READ)
    return org_owned(get_store(), EXPENSES, expense_id, ctx.require_org())


@expenses_router.patch("/{expense_id}")
def update_expense(expense_id: str, payload: ExpenseUpdateIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.EXPENSE_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    fields = payload.model_dump(exclude_unset=True)
    saved = update_doc(store, EXPENSES, expense_id, org_id, fields)
    write_audit(store, ctx, "expense.update", "expense", expense_id, new=saved)
    return saved


@co_router.post("")
def create_co(payload: ChangeOrderIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.CHANGE_ORDER_MANAGE)
    store = get_store()
    org_id = ctx.require_org()
    org_owned(store, PROJECTS, payload.projectId, org_id)
    number = next_number(store, org_id, "change_order")
    return store.create(
        CHANGE_ORDERS,
        stamp_new(org_id, {**payload.model_dump(), "number": number, "status": "draft"}),
    )


@co_router.post("/{co_id}/approve")
def approve_co(co_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.CHANGE_ORDER_MANAGE)
    store = get_store()
    org_id = ctx.require_org()
    co = org_owned(store, CHANGE_ORDERS, co_id, org_id)
    co["status"] = "approved"
    co["approvedAt"] = now_iso()
    store.set(CHANGE_ORDERS, co_id, co)
    project = org_owned(store, PROJECTS, co["projectId"], org_id)
    project["approvedChangeOrders"] = str(
        money(D(project.get("approvedChangeOrders") or 0) + D(co["sellingPrice"]))
    )
    project["contractValue"] = str(money(D(project.get("contractValue") or 0) + D(co["sellingPrice"])))
    store.set(PROJECTS, project["id"], project)
    write_audit(store, ctx, "change_order.approve", "change_order", co_id, new=co)
    return co


@co_router.get("")
def list_cos(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.CHANGE_ORDER_MANAGE)
    return {"items": list_org(get_store(), CHANGE_ORDERS, ctx.require_org())}


@snags_router.post("")
def create_snag(payload: SnagIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.SNAG_MANAGE)
    return get_store().create(SNAGS, stamp_new(ctx.require_org(), {**payload.model_dump(), "status": "open"}))


@snags_router.post("/{snag_id}/resolve")
def resolve_snag(snag_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.SNAG_MANAGE)
    store = get_store()
    snag = org_owned(store, SNAGS, snag_id, ctx.require_org())
    snag["status"] = "resolved"
    snag["resolvedAt"] = now_iso()
    return store.set(SNAGS, snag_id, snag)


@co_router.post("/{co_id}/send")
def send_co(co_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.CHANGE_ORDER_MANAGE)
    store = get_store()
    co = org_owned(store, CHANGE_ORDERS, co_id, ctx.require_org())
    co["status"] = "sent"
    co["sentAt"] = now_iso()
    return store.set(CHANGE_ORDERS, co_id, co)


@co_router.post("/{co_id}/reject")
def reject_co(co_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.CHANGE_ORDER_MANAGE)
    store = get_store()
    co = org_owned(store, CHANGE_ORDERS, co_id, ctx.require_org())
    co["status"] = "rejected"
    return store.set(CHANGE_ORDERS, co_id, co)


@snags_router.post("/{snag_id}/assign")
def assign_snag(snag_id: str, user_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.SNAG_MANAGE)
    store = get_store()
    snag = org_owned(store, SNAGS, snag_id, ctx.require_org())
    snag["status"] = "assigned"
    snag["assignedUserId"] = user_id
    return store.set(SNAGS, snag_id, snag)


@snags_router.post("/{snag_id}/verify")
def verify_snag(snag_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.SNAG_MANAGE)
    store = get_store()
    snag = org_owned(store, SNAGS, snag_id, ctx.require_org())
    snag["status"] = "verified"
    snag["verifiedAt"] = now_iso()
    return store.set(SNAGS, snag_id, snag)


@snags_router.get("")
def list_snags(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.SNAG_MANAGE)
    return {"items": list_org(get_store(), SNAGS, ctx.require_org())}
