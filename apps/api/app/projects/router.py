from fastapi import APIRouter, Depends

from app.core.audit import write_audit
from app.core.collections import CUSTOMERS, PROJECTS, QUOTES, SITES, TRADE_TEMPLATES, WORK_ITEMS, WORK_PACKAGES
from app.core.context import RequestContext, get_ctx
from app.core.entitlements import check_limit
from app.core.errors import AppError
from app.core.numbering import next_number
from app.core.permissions import Permission
from app.core.repo import list_org, now_iso, org_owned, stamp_new, update_doc
from app.core.store import get_store
from app.projects.schemas import ProjectFromQuoteIn
from app.projects.update_schemas import ProjectUpdateIn

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("")
def list_projects(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PROJECT_READ)
    items = list_org(get_store(), PROJECTS, ctx.require_org())
    if ctx.is_customer:
        for p in items:
            for k in ("estimatedCost", "actualCost", "profit", "margin", "internalNotes"):
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
    if not payload.startDate or not payload.expectedCompletion:
        raise AppError(400, "project_dates_required", "Start date and estimated end date are required.")
    computed = quote.get("computed") or {}
    number = next_number(store, org_id, "project")
    customer = store.get(CUSTOMERS, quote.get("customerId") or "") or {}
    site = store.get(SITES, quote.get("siteId") or "") or {}
    auto_name = (
        payload.name
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
            },
        ),
    )
    templates = store.query(TRADE_TEMPLATES, filters=[("orgId", "==", org_id)], limit=20)
    for tpl in templates:
        pkg = store.create(
            WORK_PACKAGES,
            stamp_new(org_id, {"projectId": project["id"], "name": tpl.get("trade"), "trade": tpl.get("trade")}),
        )
        for item in tpl.get("workItems") or []:
            store.create(
                WORK_ITEMS,
                stamp_new(org_id, {"projectId": project["id"], "workPackageId": pkg["id"], **item, "progress": 0}),
            )
    write_audit(store, ctx, "project.create", "project", project["id"], new=project)
    return project


@router.get("/{project_id}")
def get_project(project_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PROJECT_READ)
    project = org_owned(get_store(), PROJECTS, project_id, ctx.require_org())
    if ctx.is_customer:
        for k in ("estimatedCost", "actualCost", "profit", "margin", "internalNotes", "costing"):
            project.pop(k, None)
    return project


@router.patch("/{project_id}")
def update_project(project_id: str, payload: ProjectUpdateIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PROJECT_UPDATE)
    store = get_store()
    org_id = ctx.require_org()
    fields = payload.model_dump(exclude_unset=True)
    saved = update_doc(store, PROJECTS, project_id, org_id, fields)
    write_audit(store, ctx, "project.update", "project", project_id, new=saved)
    return saved


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
