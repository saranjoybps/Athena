from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends

from app.core.audit import write_audit
from app.core.collections import ACCOUNTING_ENTRIES, CHANGE_ORDERS, EXPENSES, PROJECT_SCHEDULES, PROJECTS, SNAGS
from app.core.context import RequestContext, get_ctx
from app.core.errors import AppError
from app.core.numbering import next_number
from app.core.permissions import Permission
from app.core.repo import list_org, now_iso, org_owned, soft_delete, stamp_new, update_doc
from app.core.store import get_store
from app.engines.units import D, money
from app.projects.schemas import ChangeOrderIn, ExpenseIn, SnagIn
from app.projects.update_schemas import ChangeOrderUpdateIn, ExpenseUpdateIn

expenses_router = APIRouter(prefix="/expenses", tags=["expenses"])
co_router = APIRouter(prefix="/change-orders", tags=["change_orders"])
snags_router = APIRouter(prefix="/snags", tags=["snags"])


def is_manual_labour(category: object) -> bool:
    return str(category or "").strip().lower().startswith(("labour", "labor", "wage"))


def project_has_crew(store, org_id: str, project_id: str) -> bool:
    rows = store.query(PROJECT_SCHEDULES, filters=[("orgId", "==", org_id), ("projectId", "==", project_id)], limit=50)
    return any(not r.get("deletedAt") for r in rows)


def _amount(value: object) -> Decimal:
    try:
        return D(str(value or "0").strip() or "0")
    except InvalidOperation:
        return D(0)


def _clean_category(category: object) -> str:
    value = " ".join(str(category or "").split())[:60]
    if not value:
        raise AppError(400, "category_required", "Choose what the money was spent on.")
    return value


def _guard_labour(store, org_id: str, project_id: str, category: object) -> None:
    if is_manual_labour(category) and project_has_crew(store, org_id, project_id):
        raise AppError(
            400,
            "labour_from_attendance",
            "A crew is scheduled on this project, so labour cost is calculated from attendance. "
            "Mark attendance instead of entering labour manually.",
        )


def _expense_ledger(store, org_id: str, expense_id: str) -> list[dict]:
    rows = store.query(ACCOUNTING_ENTRIES, filters=[("orgId", "==", org_id), ("referenceId", "==", expense_id)], limit=20)
    return [r for r in rows if not r.get("deletedAt") and r.get("reference") == "expense"]


@expenses_router.post("")
def create_expense(payload: ExpenseIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.EXPENSE_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    org_owned(store, PROJECTS, payload.projectId, org_id)
    payload.category = _clean_category(payload.category)
    if _amount(payload.amount) <= 0:
        raise AppError(400, "amount_invalid", "Enter the amount spent.")
    _guard_labour(store, org_id, payload.projectId, payload.category)
    doc = store.create(EXPENSES, stamp_new(org_id, payload.model_dump()))
    from app.accounting.service import post_entry

    post_entry(store, org_id, "expense", payload.amount, project_id=payload.projectId, reference="expense", reference_id=doc["id"])
    write_audit(store, ctx, "expense.create", "expense", doc["id"], new=doc)
    return doc


@expenses_router.get("")
def list_expenses(project_id: str | None = None, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.EXPENSE_READ)
    extra = [("projectId", "==", project_id)] if project_id else None
    return {"items": list_org(get_store(), EXPENSES, ctx.require_org(), extra, limit=500 if project_id else 200)}


@expenses_router.get("/{expense_id}")
def get_expense(expense_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.EXPENSE_READ)
    return org_owned(get_store(), EXPENSES, expense_id, ctx.require_org())


@expenses_router.patch("/{expense_id}")
def update_expense(expense_id: str, payload: ExpenseUpdateIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.EXPENSE_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    existing = org_owned(store, EXPENSES, expense_id, org_id)
    fields = payload.model_dump(exclude_unset=True)
    if "category" in fields:
        fields["category"] = _clean_category(fields["category"])
        if is_manual_labour(fields["category"]) and not is_manual_labour(existing.get("category")):
            _guard_labour(store, org_id, str(existing.get("projectId") or ""), fields["category"])
    if "amount" in fields and _amount(fields["amount"]) <= 0:
        raise AppError(400, "amount_invalid", "Enter the amount spent.")
    saved = update_doc(store, EXPENSES, expense_id, org_id, fields)
    if "amount" in fields:
        for entry in _expense_ledger(store, org_id, expense_id):
            entry.update({"amount": str(fields["amount"]), "updatedAt": now_iso()})
            store.set(ACCOUNTING_ENTRIES, str(entry["id"]), entry)
    write_audit(store, ctx, "expense.update", "expense", expense_id, new=saved)
    return saved


@expenses_router.delete("/{expense_id}")
def delete_expense(expense_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.EXPENSE_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    org_owned(store, EXPENSES, expense_id, org_id)
    soft_delete(store, EXPENSES, expense_id, org_id)
    stamp = now_iso()
    for entry in _expense_ledger(store, org_id, expense_id):
        entry.update({"deletedAt": stamp, "updatedAt": stamp})
        store.set(ACCOUNTING_ENTRIES, str(entry["id"]), entry)
    write_audit(store, ctx, "expense.delete", "expense", expense_id)
    return {"ok": True}


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
    if co.get("status") == "approved":
        return co
    co["status"] = "approved"
    co["approvedAt"] = now_iso()
    store.set(CHANGE_ORDERS, co_id, co)
    project = org_owned(store, PROJECTS, co["projectId"], org_id)
    project["approvedChangeOrders"] = str(
        money(D(project.get("approvedChangeOrders") or 0) + D(co["sellingPrice"]))
    )
    project["contractValue"] = str(money(D(project.get("contractValue") or 0) + D(co["sellingPrice"])))
    project["estimatedCost"] = str(money(D(project.get("estimatedCost") or 0) + D(co.get("additionalCost") or 0)))
    store.set(PROJECTS, project["id"], project)
    write_audit(store, ctx, "change_order.approve", "change_order", co_id, new=co)
    return co


@co_router.get("")
def list_cos(project_id: str | None = None, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.CHANGE_ORDER_MANAGE)
    extra = [("projectId", "==", project_id)] if project_id else None
    return {"items": list_org(get_store(), CHANGE_ORDERS, ctx.require_org(), extra, limit=300)}


def _editable_co(store, org_id: str, co_id: str) -> dict:
    co = org_owned(store, CHANGE_ORDERS, co_id, org_id)
    if co.get("status") == "approved":
        raise AppError(400, "change_order_approved", "This change order is approved and already part of the contract value.")
    return co


@co_router.get("/{co_id}")
def get_co(co_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.CHANGE_ORDER_MANAGE)
    return org_owned(get_store(), CHANGE_ORDERS, co_id, ctx.require_org())


@co_router.patch("/{co_id}")
def update_co(co_id: str, payload: ChangeOrderUpdateIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.CHANGE_ORDER_MANAGE)
    store = get_store()
    org_id = ctx.require_org()
    _editable_co(store, org_id, co_id)
    fields = payload.model_dump(exclude_unset=True)
    for key in ("sellingPrice", "additionalCost"):
        if key in fields and _amount(fields[key]) < 0:
            raise AppError(400, "amount_invalid", "Amounts can't be negative.")
    saved = update_doc(store, CHANGE_ORDERS, co_id, org_id, fields)
    write_audit(store, ctx, "change_order.update", "change_order", co_id, new=saved)
    return saved


@co_router.delete("/{co_id}")
def delete_co(co_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.CHANGE_ORDER_MANAGE)
    store = get_store()
    org_id = ctx.require_org()
    _editable_co(store, org_id, co_id)
    soft_delete(store, CHANGE_ORDERS, co_id, org_id)
    write_audit(store, ctx, "change_order.delete", "change_order", co_id)
    return {"ok": True}


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
    co = _editable_co(store, ctx.require_org(), co_id)
    co["status"] = "sent"
    co["sentAt"] = now_iso()
    return store.set(CHANGE_ORDERS, co_id, co)


@co_router.post("/{co_id}/reject")
def reject_co(co_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.CHANGE_ORDER_MANAGE)
    store = get_store()
    co = _editable_co(store, ctx.require_org(), co_id)
    co["status"] = "rejected"
    co["rejectedAt"] = now_iso()
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
