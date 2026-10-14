from fastapi import APIRouter, Depends

from app.core.audit import write_audit
from app.core.collections import (
    ATTENDANCE,
    CHANGE_ORDERS,
    CUSTOMERS,
    ESTIMATES,
    EXPENSES,
    INVOICES,
    PAYMENTS,
    PROJECT_SCHEDULES,
    PROJECTS,
    QUOTES,
    SITES,
    WORK_ITEMS,
    WORK_PACKAGES,
)
from app.core.context import RequestContext, get_ctx
from app.core.entitlements import check_limit
from app.core.errors import AppError
from app.core.numbering import next_number
from app.core.permissions import Permission
from app.core.repo import list_org, now_iso, org_owned, soft_delete, stamp_new, update_doc
from app.core.store import get_store
from app.projects.budget import budget_lines_from_items, budget_totals
from app.projects.schemas import ProjectFromQuoteIn
from app.projects.update_schemas import ProjectUpdateIn

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("")
def list_projects(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PROJECT_READ)
    items = list_org(get_store(), PROJECTS, ctx.require_org(), limit=300)
    if ctx.is_customer:
        for p in items:
            for k in ("estimatedCost", "actualCost", "profit", "margin", "internalNotes", "budgetLines", "budget"):
                p.pop(k, None)
            p.pop("costing", None)
    return {"items": items}


@router.post("/from-quote")
def from_quote(payload: ProjectFromQuoteIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PROJECT_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    active = [p for p in list_org(store, PROJECTS, org_id) if p.get("status") in ("draft", "scheduled", "active")]
    check_limit(store, org_id, "activeProjects", len(active))
    quote = org_owned(store, QUOTES, payload.quoteId, org_id)
    if quote.get("status") != "accepted":
        raise AppError(400, "quote_not_accepted", "Estimate must be approved before creating a project.")
    # A site can host several jobs over time; each approved estimate becomes at most one project.
    started = list_org(store, PROJECTS, org_id, extra_filters=[("quoteId", "==", quote["id"])], limit=1)
    if not started and quote.get("estimateId"):
        started = list_org(store, PROJECTS, org_id, extra_filters=[("estimateId", "==", quote["estimateId"])], limit=1)
    if started:
        raise AppError(
            400,
            "project_exists",
            "A project was already started from this estimate.",
            {"projectId": started[0].get("id")},
        )
    estimate = store.get(ESTIMATES, quote.get("estimateId") or "") if quote.get("estimateId") else None
    if estimate and (estimate.get("orgId") != org_id or estimate.get("deletedAt")):
        estimate = None
    computed = (estimate or {}).get("computed") or quote.get("computed") or {}
    budget_lines = budget_lines_from_items((estimate or {}).get("items") or quote.get("items") or [])
    number = next_number(store, org_id, "project")
    customer = store.get(CUSTOMERS, quote.get("customerId") or "") or {}
    site = store.get(SITES, quote.get("siteId") or "") or {}
    auto_name = (
        payload.name
        or str((estimate or {}).get("title") or "").strip()
        or " — ".join(
            part
            for part in [
                str(customer.get("name") or "").strip(),
                str(site.get("name") or "").strip() or str(quote.get("number") or "").strip(),
            ]
            if part
        )
        or f"Project {number}"
    )
    project = store.create(
        PROJECTS,
        stamp_new(
            org_id,
            {
                "number": number,
                "name": auto_name,
                "customerId": quote["customerId"],
                "siteId": quote["siteId"],
                "quoteId": quote["id"],
                "estimateId": quote.get("estimateId"),
                "status": "scheduled",
                "contractValue": computed.get("grandTotal") or computed.get("selling"),
                "estimatedCost": computed.get("totalCost"),
                "startDate": payload.startDate,
                "expectedCompletion": payload.expectedCompletion,
                "projectManagerId": payload.projectManagerId,
                "supervisorId": payload.supervisorId,
                "completionPercent": 0,
                "billedToDate": "0",
                "approvedChangeOrders": "0",
                "budgetLines": budget_lines,
                "budget": budget_totals(computed),
            },
        ),
    )
    # Work packages mirror the estimate: one package per line kind, one work item per estimate line.
    for kind, label in (("work", "Work"), ("material", "Materials"), ("tool", "Tool & equipment")):
        rows = [line for line in budget_lines if line["kind"] == kind]
        if not rows:
            continue
        pkg = store.create(WORK_PACKAGES, stamp_new(org_id, {"projectId": project["id"], "name": label, "trade": kind}))
        for line in rows:
            store.create(
                WORK_ITEMS,
                stamp_new(
                    org_id,
                    {
                        "projectId": project["id"],
                        "workPackageId": pkg["id"],
                        "budgetLineId": line["id"],
                        "name": line["description"],
                        "quantity": line["quantity"],
                        "unit": line["unit"],
                        "progress": 0,
                    },
                ),
            )
    quote["projectId"] = project["id"]
    store.set(QUOTES, quote["id"], quote)
    write_audit(store, ctx, "project.create", "project", project["id"], new=project)
    return project


@router.get("/{project_id}")
def get_project(project_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PROJECT_READ)
    project = org_owned(get_store(), PROJECTS, project_id, ctx.require_org())
    if ctx.is_customer:
        for k in ("estimatedCost", "actualCost", "profit", "margin", "internalNotes", "costing", "budgetLines", "budget"):
            project.pop(k, None)
    return project


@router.patch("/{project_id}")
def update_project(project_id: str, payload: ProjectUpdateIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PROJECT_UPDATE)
    store = get_store()
    org_id = ctx.require_org()
    fields = payload.model_dump(exclude_unset=True)
    current = org_owned(store, PROJECTS, project_id, org_id)
    if fields.get("status") and fields["status"] != current.get("status"):
        if fields["status"] == "completed":
            fields["previousStatus"] = current.get("status") or "active"
        else:
            # A manual status change replaces any automatic completion.
            for marker in ("completedAt", "completedBy", "completedByPaymentId", "previousStatus"):
                current.pop(marker, None)
            store.set(PROJECTS, project_id, current)
    saved = update_doc(store, PROJECTS, project_id, org_id, fields)
    write_audit(store, ctx, "project.update", "project", project_id, new=saved)
    return saved


@router.delete("/{project_id}")
def delete_project(project_id: str, ctx: RequestContext = Depends(get_ctx)):
    """Only a project nothing has happened on yet can be deleted; the estimate can then start a new one."""
    ctx.require(Permission.PROJECT_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    project = org_owned(store, PROJECTS, project_id, org_id)
    by_project = [("projectId", "==", project_id)]
    blockers = [
        (label, len(rows))
        for label, rows in (
            ("invoice", [i for i in list_org(store, INVOICES, org_id, by_project, limit=50) if i.get("status") != "void"]),
            ("payment", list_org(store, PAYMENTS, org_id, by_project, limit=50)),
            ("attendance mark", list_org(store, ATTENDANCE, org_id, by_project, limit=50)),
            ("expense", list_org(store, EXPENSES, org_id, by_project, limit=50)),
            ("approved change order", [c for c in list_org(store, CHANGE_ORDERS, org_id, by_project, limit=50) if c.get("status") == "approved"]),
        )
        if rows
    ]
    if blockers:
        found = ", ".join(f"{n} {label}{'' if n == 1 else 's'}" for label, n in blockers)
        raise AppError(
            400,
            "project_has_activity",
            f"This project already has {found}. Remove those first, or mark the project completed instead.",
        )
    for collection in (PROJECT_SCHEDULES, WORK_ITEMS, WORK_PACKAGES, CHANGE_ORDERS):
        for row in list_org(store, collection, org_id, by_project, limit=500):
            soft_delete(store, collection, str(row["id"]), org_id)
    for collection in (QUOTES, ESTIMATES):
        source_id = project.get("quoteId" if collection == QUOTES else "estimateId")
        source = store.get(collection, str(source_id)) if source_id else None
        if source and source.get("orgId") == org_id and source.get("projectId") == project_id:
            source.pop("projectId", None)
            source["updatedAt"] = now_iso()
            store.set(collection, str(source["id"]), source)
    soft_delete(store, PROJECTS, project_id, org_id)
    write_audit(store, ctx, "project.delete", "project", project_id, previous=project)
    return {"ok": True, "id": project_id}


@router.post("/{project_id}/close")
def close_project(project_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PROJECT_CLOSE)
    store = get_store()
    project = org_owned(store, PROJECTS, project_id, ctx.require_org())
    project["status"] = "completed"
    project["closedAt"] = now_iso()
    saved = store.set(PROJECTS, project_id, project)
    write_audit(store, ctx, "project.close", "project", project_id, new=saved)
    return saved
