from __future__ import annotations

from app.core.collections import INVENTORY, INVENTORY_TRANSACTIONS, MATERIALS
from app.core.context import RequestContext
from app.core.errors import AppError
from app.core.repo import list_org, now_iso, org_owned, stamp_new
from app.core.store import DocumentStore
from app.engines.units import D, qty


def _stock_key(material_id: str, warehouse: str) -> str:
    return f"{material_id}:{warehouse}"


def get_or_create_stock(store: DocumentStore, org_id: str, material_id: str, warehouse: str) -> dict:
    key = _stock_key(material_id, warehouse)
    rows = store.query(
        INVENTORY,
        filters=[("orgId", "==", org_id), ("materialId", "==", material_id), ("warehouse", "==", warehouse)],
        limit=1,
    )
    if rows:
        return rows[0]
    return store.create(INVENTORY, stamp_new(org_id, {"materialId": material_id, "warehouse": warehouse, "qty": "0"}))


def apply_transaction(store: DocumentStore, ctx: RequestContext, payload: dict) -> dict:
    org_id = ctx.require_org()
    org_owned(store, MATERIALS, payload["materialId"], org_id)
    stock = get_or_create_stock(store, org_id, payload["materialId"], payload.get("warehouse") or "main")
    current = D(stock.get("qty") or 0)
    delta = D(payload["qty"])
    txn_type = payload["type"]
    if txn_type in ("out", "issue", "damage", "wastage") and delta > current:
        raise AppError(400, "insufficient_stock", "Insufficient stock.", {"available": str(current)})
    if txn_type in ("in", "return"):
        new_qty = current + delta
    elif txn_type in ("out", "issue", "damage", "wastage"):
        new_qty = current - delta
    elif txn_type == "adjustment":
        new_qty = delta
    else:
        new_qty = current + delta
    stock["qty"] = str(qty(new_qty))
    stock["updatedAt"] = now_iso()
    store.set(INVENTORY, stock["id"], stock)
    txn = store.create(
        INVENTORY_TRANSACTIONS,
        stamp_new(org_id, {**payload, "userId": ctx.user_id, "balanceAfter": stock["qty"]}),
    )
    return txn


def stock_summary(store: DocumentStore, org_id: str) -> list[dict]:
    rows = list_org(store, INVENTORY, org_id)
    out = []
    for row in rows:
        mat = store.get(MATERIALS, row["materialId"]) or {}
        out.append({**row, "materialName": mat.get("name"), "reorderLevel": mat.get("reorderLevel")})
    return out
