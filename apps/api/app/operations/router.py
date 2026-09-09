from fastapi import APIRouter, Depends

from app.core.collections import (
    ACCOUNTING_ENTRIES,
    CREWS,
    DELIVERIES,
    DOCUMENTS,
    GROUPS,
    INVENTORY,
    INVENTORY_TRANSACTIONS,
    LABOUR,
    MATERIAL_REQUESTS,
    MATERIALS,
    NOTIFICATIONS,
    PROJECT_ASSIGNMENTS,
    PROJECT_SCHEDULES,
    PURCHASE_ORDERS,
    PURCHASES,
    SITE_PHOTOS,
    SUPPLIERS,
    TRANSPORT_TRIPS,
    VEHICLES,
)
from app.core.context import RequestContext, get_ctx
from app.core.errors import AppError
from app.core.permissions import Permission
from app.core.repo import list_org, now_iso, org_owned, soft_delete, stamp_new, update_doc
from app.core.resource import make_crud_router
from app.core.store import get_store
from app.inventory.service import apply_transaction, stock_summary
from app.procurement.service import approve_mr, create_delivery, create_mr, create_po, quick_purchase, receive_po
from app.schemas.operations import (
    AssignmentIn,
    CrewIn,
    DeliveryIn,
    DocumentIn,
    GroupIn,
    InventoryIn,
    InventoryTxnIn,
    LabourIn,
    MaterialIn,
    MaterialRequestIn,
    NotificationIn,
    PhotoIn,
    PurchaseIn,
    PurchaseOrderIn,
    ScheduleIn,
    SupplierIn,
    TransportTripIn,
    VehicleIn,
)

materials_router = make_crud_router(
    "/materials", MATERIALS, "materials", MaterialIn, Permission.MATERIAL_READ, Permission.MATERIAL_MANAGE
)
suppliers_router = make_crud_router(
    "/suppliers", SUPPLIERS, "suppliers", SupplierIn, Permission.MATERIAL_READ, Permission.MATERIAL_MANAGE
)
labour_router = make_crud_router("/labour", LABOUR, "labour", LabourIn, Permission.LABOUR_READ, Permission.LABOUR_MANAGE)
crews_router = make_crud_router("/crews", CREWS, "crews", CrewIn, Permission.LABOUR_READ, Permission.CREW_MANAGE)
inventory_router = make_crud_router(
    "/inventory", INVENTORY, "inventory", InventoryIn, Permission.MATERIAL_READ, Permission.INVENTORY_MANAGE
)
docs_router = make_crud_router("/documents", DOCUMENTS, "documents", DocumentIn, Permission.DOCUMENT_READ, Permission.DOCUMENT_READ)
groups_router = make_crud_router("/groups", GROUPS, "groups", GroupIn, Permission.USER_MANAGE, Permission.USER_MANAGE)
vehicles_router = make_crud_router("/vehicles", VEHICLES, "vehicles", VehicleIn, Permission.VEHICLE_MANAGE, Permission.VEHICLE_MANAGE)

ops = APIRouter(tags=["operations"])


@ops.get("/stock/summary")
def inventory_summary(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.MATERIAL_READ)
    return {"items": stock_summary(get_store(), ctx.require_org())}


@ops.post("/inventory-transactions")
def inventory_txn(payload: InventoryTxnIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.INVENTORY_MANAGE)
    return apply_transaction(get_store(), ctx, payload.model_dump())


@ops.get("/inventory-transactions")
def list_inventory_txn(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.MATERIAL_READ)
    return {"items": list_org(get_store(), INVENTORY_TRANSACTIONS, ctx.require_org())}


@ops.post("/material-requests")
def material_request(payload: MaterialRequestIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.MATERIAL_MANAGE)
    return create_mr(get_store(), ctx, payload.model_dump())


@ops.get("/material-requests")
def list_material_requests(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.MATERIAL_READ)
    return {"items": list_org(get_store(), MATERIAL_REQUESTS, ctx.require_org())}


@ops.post("/material-requests/{mr_id}/approve")
def approve_material_request(mr_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PURCHASE_APPROVE)
    return approve_mr(get_store(), ctx, mr_id)


@ops.post("/purchase-orders")
def purchase_order(payload: PurchaseOrderIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PURCHASE_CREATE)
    return create_po(get_store(), ctx, payload.model_dump())


@ops.get("/purchase-orders")
def list_purchase_orders(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PURCHASE_READ)
    return {"items": list_org(get_store(), PURCHASE_ORDERS, ctx.require_org())}


@ops.post("/purchase-orders/{po_id}/receive")
def receive_purchase_order(po_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PURCHASE_APPROVE)
    return receive_po(get_store(), ctx, po_id)


@ops.post("/purchases")
def purchase(payload: PurchaseIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PURCHASE_CREATE)
    return quick_purchase(get_store(), ctx, payload.model_dump())


@ops.get("/purchases")
def list_purchases(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PURCHASE_READ)
    return {"items": list_org(get_store(), PURCHASES, ctx.require_org())}


@ops.post("/deliveries")
def delivery(payload: DeliveryIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PURCHASE_CREATE)
    return create_delivery(get_store(), ctx, payload.model_dump())


@ops.get("/deliveries")
def list_deliveries(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PURCHASE_READ)
    return {"items": list_org(get_store(), DELIVERIES, ctx.require_org())}


@ops.post("/photos")
def photo(payload: PhotoIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PROJECT_UPDATE)
    data = payload.model_dump()
    data["userId"] = ctx.user_id
    return get_store().create(SITE_PHOTOS, stamp_new(ctx.require_org(), data))


@ops.get("/photos")
def list_photos(project_id: str | None = None, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PROJECT_READ)
    extra = [("projectId", "==", project_id)] if project_id else None
    return {"items": list_org(get_store(), SITE_PHOTOS, ctx.require_org(), extra)}


@ops.post("/notifications")
def notify(payload: NotificationIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.SETTINGS_MANAGE)
    data = payload.model_dump()
    data["read"] = False
    return get_store().create(NOTIFICATIONS, stamp_new(ctx.require_org(), data))


@ops.get("/notifications")
def list_notifications(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.NOTIFICATION_READ)
    items = list_org(get_store(), NOTIFICATIONS, ctx.require_org())
    if not (Permission.WILDCARD in ctx.permissions or Permission.SETTINGS_MANAGE in ctx.permissions):
        items = [n for n in items if n.get("userId") in (None, ctx.user_id)]
    return {"items": items}


@ops.post("/notifications/{notif_id}/read")
def read_notification(notif_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.NOTIFICATION_READ)
    store = get_store()
    doc = org_owned(store, NOTIFICATIONS, notif_id, ctx.require_org())
    doc["read"] = True
    doc["readAt"] = now_iso()
    return store.set(NOTIFICATIONS, notif_id, doc)


@ops.post("/transport-trips")
def trip(payload: TransportTripIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.VEHICLE_MANAGE)
    return get_store().create(TRANSPORT_TRIPS, stamp_new(ctx.require_org(), payload.model_dump()))


@ops.get("/transport-trips")
def list_trips(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.VEHICLE_MANAGE)
    return {"items": list_org(get_store(), TRANSPORT_TRIPS, ctx.require_org())}


@ops.post("/project-schedules")
def schedule(payload: ScheduleIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PROJECT_UPDATE)
    store = get_store()
    org_id = ctx.require_org()
    data = payload.model_dump()
    if data.get("crewId") and data.get("startDate") and data.get("endDate"):
        existing = list_org(store, PROJECT_SCHEDULES, org_id)
        for row in existing:
            if row.get("crewId") != data["crewId"]:
                continue
            if _ranges_overlap(row.get("startDate"), row.get("endDate"), data["startDate"], data["endDate"]):
                raise AppError(
                    400,
                    "crew_double_booked",
                    "This crew is already scheduled for overlapping dates.",
                    {"existingId": row.get("id"), "projectId": row.get("projectId")},
                )
    return store.create(PROJECT_SCHEDULES, stamp_new(org_id, data))


def _ranges_overlap(a_start, a_end, b_start, b_end) -> bool:
    if not a_start or not a_end or not b_start or not b_end:
        return False
    return str(a_start) <= str(b_end) and str(b_start) <= str(a_end)

@ops.get("/project-schedules")
def list_schedules(project_id: str | None = None, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PROJECT_READ)
    extra = [("projectId", "==", project_id)] if project_id else None
    return {"items": list_org(get_store(), PROJECT_SCHEDULES, ctx.require_org(), extra)}


@ops.post("/project-assignments")
def assign(payload: AssignmentIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PROJECT_UPDATE)
    return get_store().create(PROJECT_ASSIGNMENTS, stamp_new(ctx.require_org(), payload.model_dump()))


@ops.get("/project-assignments")
def list_assignments(project_id: str | None = None, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PROJECT_READ)
    extra = [("projectId", "==", project_id)] if project_id else None
    return {"items": list_org(get_store(), PROJECT_ASSIGNMENTS, ctx.require_org(), extra)}


@ops.get("/accounting-entries")
def accounting_entries(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.ACCOUNTING_READ)
    return {"items": list_org(get_store(), ACCOUNTING_ENTRIES, ctx.require_org())}
