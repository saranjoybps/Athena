from fastapi import APIRouter, Depends

from app.core.collections import (
    ACCOUNTING_ENTRIES,
    ATTENDANCE,
    CREWS,
    DELIVERIES,
    DOCUMENTS,
    ESTIMATES,
    EXPENSES,
    GROUPS,
    INVENTORY,
    INVENTORY_TRANSACTIONS,
    INVOICES,
    LABOUR,
    MATERIAL_REQUESTS,
    MATERIALS,
    NOTIFICATIONS,
    PROJECT_ASSIGNMENTS,
    PROJECT_SCHEDULES,
    PROJECTS,
    PURCHASE_ORDERS,
    PURCHASES,
    QUOTES,
    SITES,
    SITE_PHOTOS,
    SUPPLIERS,
    TRANSPORT_TRIPS,
    VEHICLES,
)
from app.attendance.service import crew_member_ids, crew_spans, parse_day, pretty_day, uncovered_attendance
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
    ScheduleUpdateIn,
    SupplierIn,
    TransportTripIn,
    VehicleIn,
)


def _normalize_crew_members(store, org_id: str, data: dict) -> dict:
    """Resolve member labourIds, drop invalid refs, stamp names from labour docs."""
    raw = data.get("members") or []
    seen: set[str] = set()
    normalized: list[dict] = []
    for m in raw:
        if not isinstance(m, dict):
            continue
        lid = str(m.get("labourId") or m.get("workerId") or "").strip()
        if not lid or lid in seen:
            continue
        lab = store.get(LABOUR, lid)
        if not lab or lab.get("orgId") != org_id:
            raise AppError(400, "invalid_crew_member", f"Labour worker not found: {lid}")
        if lab.get("deletedAt"):
            continue
        seen.add(lid)
        normalized.append(
            {
                "labourId": lid,
                "name": str(lab.get("name") or m.get("name") or ""),
                **({"role": m["role"]} if m.get("role") else {}),
            }
        )
    data["members"] = normalized
    return data


def _crew_on_create(store, ctx: RequestContext, data: dict) -> dict:
    org_id = ctx.require_org()
    _normalize_crew_members(store, org_id, data)
    return store.create(CREWS, data)


def _crew_on_update(store, ctx: RequestContext, doc_id: str, fields: dict) -> dict:
    org_id = ctx.require_org()
    if "members" in fields:
        _normalize_crew_members(store, org_id, fields)
    return update_doc(store, CREWS, doc_id, org_id, fields)


def _live_refs(store, collection: str, org_id: str, field: str, value: str) -> list[dict]:
    # Equality-only filters: no composite index needed. Soft-deleted rows are dropped after the read.
    rows = store.query(collection, filters=[("orgId", "==", org_id), (field, "==", value)], limit=25)
    return [r for r in rows if not r.get("deletedAt")]


def _crews_with_member(store, org_id: str, labour_id: str) -> list[dict]:
    crews = list_org(store, CREWS, org_id, limit=500)
    return [
        c
        for c in crews
        if any(isinstance(m, dict) and str(m.get("labourId") or "") == labour_id for m in c.get("members") or [])
    ]


def _labour_on_update(store, ctx: RequestContext, doc_id: str, fields: dict) -> dict:
    org_id = ctx.require_org()
    doc = update_doc(store, LABOUR, doc_id, org_id, fields)
    new_name = str(doc.get("name") or "")
    if "name" in fields:
        # Crews keep a snapshot of member names; keep them in step with the worker record.
        for crew in _crews_with_member(store, org_id, doc_id):
            members = crew.get("members") or []
            if not any(m.get("labourId") == doc_id and m.get("name") != new_name for m in members if isinstance(m, dict)):
                continue
            synced = [
                {**m, "name": new_name} if isinstance(m, dict) and m.get("labourId") == doc_id else m for m in members
            ]
            update_doc(store, CREWS, str(crew["id"]), org_id, {"members": synced})
    return doc


def _labour_before_delete(store, ctx: RequestContext, doc: dict) -> None:
    org_id = ctx.require_org()
    name = str(doc.get("name") or "This worker")
    crews = _crews_with_member(store, org_id, str(doc["id"]))
    if crews:
        crew_names = ", ".join(str(c.get("name") or "a crew") for c in crews[:3])
        raise AppError(
            409,
            "labour_in_use",
            f"{name} is a member of {crew_names}. Remove them from the crew before deleting.",
        )
    if _live_refs(store, ATTENDANCE, org_id, "workerId", str(doc["id"])):
        raise AppError(409, "labour_in_use", f"{name} has attendance records and can't be deleted.")


def _crew_before_delete(store, ctx: RequestContext, doc: dict) -> None:
    org_id = ctx.require_org()
    name = str(doc.get("name") or "This crew")
    if _live_refs(store, PROJECT_SCHEDULES, org_id, "crewId", str(doc["id"])):
        raise AppError(
            409,
            "crew_in_use",
            f"{name} is scheduled on a project. Remove it from the project schedule before deleting.",
        )
    if _live_refs(store, ATTENDANCE, org_id, "crewId", str(doc["id"])):
        raise AppError(409, "crew_in_use", f"{name} has attendance records and can't be deleted.")


def _validate_tool_site(store, org_id: str, site_id: str | None) -> None:
    if not site_id:
        return
    site = store.get(SITES, site_id)
    if not site or site.get("orgId") != org_id or site.get("deletedAt"):
        raise AppError(400, "invalid_tool_site", "Site not found in this organization.")


def _tool_on_create(store, ctx: RequestContext, data: dict) -> dict:
    org_id = ctx.require_org()
    _validate_tool_site(store, org_id, data.get("siteId"))
    return store.create(INVENTORY, data)


def _tool_on_update(store, ctx: RequestContext, doc_id: str, fields: dict) -> dict:
    org_id = ctx.require_org()
    if "siteId" in fields:
        _validate_tool_site(store, org_id, fields["siteId"])
    return update_doc(store, INVENTORY, doc_id, org_id, fields)


def _tool_before_delete(store, ctx: RequestContext, doc: dict) -> None:
    org_id = ctx.require_org()
    name = str(doc.get("name") or "This tool")
    site_id = doc.get("siteId")
    if site_id:
        site = store.get(SITES, str(site_id))
        if site and site.get("orgId") == org_id and not site.get("deletedAt"):
            raise AppError(
                409,
                "tool_in_use",
                f"{name} is assigned to {site.get('name') or 'a site'}. Unassign it from the site before deleting.",
            )
    if _live_refs(store, INVENTORY_TRANSACTIONS, org_id, "toolId", str(doc["id"])):
        raise AppError(409, "tool_in_use", f"{name} has stock movements recorded and can't be deleted.")


def _items_reference(store, collection: str, org_id: str, key: str, value: str) -> bool:
    for row in list_org(store, collection, org_id, limit=300):
        if any(isinstance(i, dict) and str(i.get(key) or "") == value for i in row.get("items") or []):
            return True
    return False


def _material_before_delete(store, ctx: RequestContext, doc: dict) -> None:
    org_id = ctx.require_org()
    material_id = str(doc["id"])
    name = str(doc.get("name") or "This material")
    linked = [
        ("estimates", _items_reference(store, ESTIMATES, org_id, "catalogMaterialId", material_id)),
        ("quotes", _items_reference(store, QUOTES, org_id, "catalogMaterialId", material_id)),
        ("invoices", _items_reference(store, INVOICES, org_id, "catalogMaterialId", material_id)),
        ("stock records", bool(_live_refs(store, INVENTORY, org_id, "materialId", material_id))),
        ("material requests", bool(_live_refs(store, MATERIAL_REQUESTS, org_id, "materialId", material_id))),
    ]
    used_in = [label for label, hit in linked if hit]
    if used_in:
        raise AppError(
            409,
            "material_in_use",
            f"{name} is used in {', '.join(used_in)} and can't be deleted.",
        )


materials_router = make_crud_router(
    "/materials",
    MATERIALS,
    "materials",
    MaterialIn,
    Permission.MATERIAL_READ,
    Permission.MATERIAL_MANAGE,
    before_delete=_material_before_delete,
    list_limit=500,
)
suppliers_router = make_crud_router(
    "/suppliers", SUPPLIERS, "suppliers", SupplierIn, Permission.MATERIAL_READ, Permission.MATERIAL_MANAGE
)
labour_router = make_crud_router(
    "/labour",
    LABOUR,
    "labour",
    LabourIn,
    Permission.LABOUR_READ,
    Permission.LABOUR_MANAGE,
    on_update=_labour_on_update,
    before_delete=_labour_before_delete,
    list_limit=500,
)
crews_router = make_crud_router(
    "/crews",
    CREWS,
    "crews",
    CrewIn,
    Permission.LABOUR_READ,
    Permission.CREW_MANAGE,
    on_create=_crew_on_create,
    on_update=_crew_on_update,
    before_delete=_crew_before_delete,
    list_limit=500,
)
inventory_router = make_crud_router(
    "/inventory",
    INVENTORY,
    "inventory",
    InventoryIn,
    Permission.MATERIAL_READ,
    Permission.INVENTORY_MANAGE,
    on_create=_tool_on_create,
    on_update=_tool_on_update,
    include=lambda row: not row.get("materialId"),
    before_delete=_tool_before_delete,
    list_limit=500,
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


def _schedule_conflict(existing: dict, candidate: dict) -> bool:
    from app.attendance.service import schedule_working_days

    return bool(schedule_working_days(existing) & schedule_working_days(candidate))


def _ranges_overlap(a_start, a_end, b_start, b_end) -> bool:
    if not a_start or not a_end or not b_start or not b_end:
        return False
    return str(a_start) <= str(b_end) and str(b_start) <= str(a_end)


def _validate_schedule(store, org_id: str, data: dict, exclude_id: str | None = None) -> dict:
    start = parse_day(data.get("startDate"))
    end = parse_day(data.get("endDate"))
    if not start or not end:
        raise AppError(400, "schedule_dates_required", "Pick a start date and an expected end date.")
    if end < start:
        raise AppError(400, "schedule_dates_invalid", "The expected end date must be on or after the start date.")
    data["startDate"], data["endDate"] = start, end
    raw_days = data.get("workingDates")
    if isinstance(raw_days, list) and any(str(d or "").strip() for d in raw_days):
        days = sorted({d for d in (parse_day(item) for item in raw_days) if d})
        if not days:
            raise AppError(400, "schedule_dates_invalid", "Pick at least one working day.")
        outside = [d for d in days if d < start or d > end]
        if outside:
            raise AppError(400, "schedule_dates_invalid", "Working days must fall between the start date and the expected end date.")
        data["workingDates"] = days
    else:
        data["workingDates"] = None
    crew_id = data.get("crewId")
    if not crew_id:
        raise AppError(400, "crew_required", "Pick the crew to schedule.")
    crew = org_owned(store, CREWS, crew_id, org_id)
    for row in _live_refs_all(store, PROJECT_SCHEDULES, org_id, "crewId", crew_id):
        if exclude_id and str(row.get("id")) == exclude_id:
            continue
        if not _schedule_conflict(row, data):
            continue
        project = store.get(PROJECTS, str(row.get("projectId") or "")) or {}
        raise AppError(
            400,
            "crew_double_booked",
            f"{crew.get('name') or 'This crew'} is already scheduled on "
            f"{project.get('name') or project.get('number') or 'another project'} from "
            f"{pretty_day(str(row.get('startDate'))[:10])} to {pretty_day(str(row.get('endDate') or row.get('startDate'))[:10])}.",
            {"existingId": row.get("id"), "projectId": row.get("projectId")},
        )
    members = crew_member_ids(crew)
    if members:
        for other in list_org(store, CREWS, org_id, limit=500):
            if str(other.get("id")) == str(crew_id) or not (members & crew_member_ids(other)):
                continue
            for row in _live_refs_all(store, PROJECT_SCHEDULES, org_id, "crewId", str(other["id"])):
                if exclude_id and str(row.get("id")) == exclude_id:
                    continue
                if str(row.get("projectId") or "") == str(data.get("projectId") or ""):
                    continue
                if not _schedule_conflict(row, data):
                    continue
                project = store.get(PROJECTS, str(row.get("projectId") or "")) or {}
                raise AppError(
                    400,
                    "crew_workers_busy",
                    f"Some workers in {crew.get('name') or 'this crew'} are also in {other.get('name') or 'another crew'}, "
                    f"which is scheduled on {project.get('name') or project.get('number') or 'another project'} from "
                    f"{pretty_day(str(row.get('startDate'))[:10])} to {pretty_day(str(row.get('endDate') or row.get('startDate'))[:10])}. "
                    "Pick other dates or another crew.",
                    {"existingId": row.get("id"), "projectId": row.get("projectId")},
                )
    from app.attendance.service import schedule_working_days
    from app.engines.units import D, money

    wage = D(0)
    for member in crew.get("members") or []:
        if not isinstance(member, dict):
            continue
        worker_id = member.get("labourId") or member.get("workerId")
        worker = store.get(LABOUR, str(worker_id)) if worker_id else {}
        wage += D((worker or {}).get("dailyRate") or member.get("dailyRate") or 0)
    working = schedule_working_days(data)
    data["plannedWorkingDays"] = len(working)
    data["plannedLabourPerDay"] = str(money(wage))
    data["plannedLabourCost"] = str(money(wage * D(len(working))))
    data["status"] = data.get("status") or "planned"
    return data


def _live_refs_all(store, collection: str, org_id: str, field: str, value: str) -> list[dict]:
    rows = store.query(collection, filters=[("orgId", "==", org_id), (field, "==", value)], limit=1000)
    return [r for r in rows if not r.get("deletedAt")]


def _guard_attendance(store, org_id: str, project_id: str, crew_id: str, spans: list[tuple[str, str]], action: str, working: set[str] | None = None) -> None:
    orphaned = uncovered_attendance(store, org_id, project_id, crew_id, spans, working)
    if not orphaned:
        return
    days = sorted({str(r.get("date"))[:10] for r in orphaned})
    sample = ", ".join(pretty_day(d) for d in days[:3])
    more = f" and {len(days) - 3} more" if len(days) > 3 else ""
    raise AppError(
        409,
        "schedule_has_attendance",
        f"Attendance is already marked for {sample}{more}. Clear those days in Attendance before you {action}.",
    )


@ops.post("/project-schedules")
def schedule(payload: ScheduleIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PROJECT_UPDATE)
    store = get_store()
    org_id = ctx.require_org()
    org_owned(store, PROJECTS, payload.projectId, org_id)
    from app.projects.ops import is_manual_labour

    manual = [
        e
        for e in list_org(store, EXPENSES, org_id, extra_filters=[("projectId", "==", payload.projectId)], limit=500)
        if is_manual_labour(e.get("category"))
    ]
    if manual:
        raise AppError(
            400,
            "manual_labour_exists",
            f"This project already has {len(manual)} manual labour entr{'y' if len(manual) == 1 else 'ies'}. "
            "Labour is either entered manually or calculated from crew attendance, not both. "
            "Delete those labour expenses first if you want to use a crew.",
        )
    data = _validate_schedule(store, org_id, payload.model_dump())
    return store.create(PROJECT_SCHEDULES, stamp_new(org_id, data))


@ops.patch("/project-schedules/{schedule_id}")
def update_schedule(schedule_id: str, payload: ScheduleUpdateIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PROJECT_UPDATE)
    store = get_store()
    org_id = ctx.require_org()
    existing = org_owned(store, PROJECT_SCHEDULES, schedule_id, org_id)
    merged = {**existing, **payload.model_dump(exclude_unset=True)}
    merged = _validate_schedule(store, org_id, merged, exclude_id=schedule_id)
    project_id = str(existing.get("projectId") or "")
    old_crew = str(existing.get("crewId") or "")
    if old_crew:
        from app.attendance.service import covered_days, crew_schedule_rows

        remaining_rows = crew_schedule_rows(store, org_id, project_id, old_crew, exclude_id=schedule_id)
        if merged["crewId"] == old_crew:
            remaining_rows.append(merged)
        _guard_attendance(store, org_id, project_id, old_crew, [], "change these dates", covered_days(remaining_rows))
    fields = {
        k: merged[k]
        for k in ("startDate", "endDate", "crewId", "workingDates", "plannedWorkingDays", "plannedLabourPerDay", "plannedLabourCost", "status")
        if k in merged
    }
    return update_doc(store, PROJECT_SCHEDULES, schedule_id, org_id, fields)


@ops.delete("/project-schedules/{schedule_id}")
def delete_schedule(schedule_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PROJECT_UPDATE)
    store = get_store()
    org_id = ctx.require_org()
    existing = org_owned(store, PROJECT_SCHEDULES, schedule_id, org_id)
    crew_id = str(existing.get("crewId") or "")
    if crew_id:
        project_id = str(existing.get("projectId") or "")
        from app.attendance.service import covered_days, crew_schedule_rows

        remaining_rows = crew_schedule_rows(store, org_id, project_id, crew_id, exclude_id=schedule_id)
        _guard_attendance(store, org_id, project_id, crew_id, [], "remove this schedule", covered_days(remaining_rows))
    soft_delete(store, PROJECT_SCHEDULES, schedule_id, org_id)
    return {"ok": True}


@ops.get("/project-schedules")
def list_schedules(project_id: str | None = None, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PROJECT_READ)
    extra = [("projectId", "==", project_id)] if project_id else None
    return {"items": list_org(get_store(), PROJECT_SCHEDULES, ctx.require_org(), extra, limit=500)}


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
