from __future__ import annotations

from app.core.collections import INVENTORY, INVENTORY_TRANSACTIONS
from app.core.context import RequestContext
from app.core.errors import AppError
from app.core.repo import list_org, now_iso, org_owned, stamp_new
from app.core.store import DocumentStore
from app.engines.units import D, qty


def apply_transaction(store: DocumentStore, ctx: RequestContext, payload: dict) -> dict:
    org_id = ctx.require_org()
    tool_id = payload.get("toolId") or payload.get("inventoryId")
    material_id = payload.get("materialId")
    warehouse = payload.get("warehouse") or "main"

    if tool_id:
        stock = org_owned(store, INVENTORY, tool_id, org_id)
    elif material_id:
        rows = store.query(
            INVENTORY,
            filters=[("orgId", "==", org_id), ("materialId", "==", material_id), ("warehouse", "==", warehouse)],
            limit=1,
        )
        if rows:
            stock = rows[0]
        else:
            stock = store.create(
                INVENTORY,
                stamp_new(org_id, {"materialId": material_id, "name": material_id, "warehouse": warehouse, "qty": "0"}),
            )
    else:
        raise AppError(400, "tool_required", "toolId or materialId is required.")

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
    from app.core.collections import MATERIALS

    rows = list_org(store, INVENTORY, org_id)
    materials = {m["id"]: m for m in list_org(store, MATERIALS, org_id)}
    out = []
    for row in rows:
        material = materials.get(row.get("materialId") or "") or {}
        qty = D(row.get("qty") or 0)
        reorder = D(material.get("reorderLevel") or material.get("minimumStock") or row.get("reorderLevel") or 0)
        name = row.get("name") or row.get("materialName") or material.get("name") or "Item"
        out.append(
            {
                **row,
                "toolName": name,
                "materialName": material.get("name"),
                "unit": material.get("unit") or row.get("unit") or "pcs",
                "onHand": str(qty),
                "lowStock": bool(reorder and qty <= reorder),
                "reorderLevel": str(reorder) if reorder else None,
            }
        )
    return out
