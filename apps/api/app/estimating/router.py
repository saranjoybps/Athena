from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse, Response

from app.core.audit import write_audit
from app.core.collections import ESTIMATE_VERSIONS, ESTIMATES, MEASUREMENTS, QUOTES
from app.core.context import RequestContext, get_ctx
from app.core.errors import AppError
from app.core.numbering import next_number
from app.core.permissions import Permission
from app.core.repo import list_org, now_iso, org_owned, stamp_new
from app.core.store import get_store
from app.customers.hierarchy import delete_estimate_cascade, estimate_project, resolve_site_scope
from app.estimating.pricing import compute_estimate
from app.estimating.schemas import EstimateIn
from app.core.media import document_pdf_bytes, document_preview_html, document_preview_pages, upload_document_pdf
from app.billing.document_service import enrich_estimate_document, org_defaults

router = APIRouter(prefix="/estimates", tags=["estimates"])


def _apply_org_state(store, org_id: str, payload: EstimateIn, existing: dict | None = None) -> None:
    previous = existing or {}
    payload.supplierState = payload.supplierState or org_defaults(store, org_id)["state"] or previous.get("supplierState")
    payload.placeOfSupply = payload.placeOfSupply or payload.supplierState


@router.get("")
def list_estimates(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.ESTIMATE_READ)
    return {"items": list_org(get_store(), ESTIMATES, ctx.require_org())}


def _assert_estimate_editable(store, org_id: str, estimate: dict) -> None:
    project = estimate_project(store, org_id, estimate)
    if project:
        raise AppError(
            400,
            "estimate_locked",
            "This estimate is locked because a project was started from it.",
            {"projectId": project.get("id")},
        )
    quotes = list_org(store, QUOTES, org_id, extra_filters=[("estimateId", "==", estimate["id"])], limit=20)
    if any(q.get("status") in ("accepted", "invoiced") for q in quotes):
        raise AppError(
            400,
            "estimate_locked",
            "This estimate is approved. Ask for changes or create a new estimate instead.",
        )


def _ensure_linked_quote(store, ctx: RequestContext, org_id: str, estimate: dict) -> None:
    """Every estimate has one quote that carries the customer's approval decision."""
    existing = list_org(store, QUOTES, org_id, extra_filters=[("estimateId", "==", estimate["id"])], limit=1)
    if existing:
        return
    quote = store.create(
        QUOTES,
        stamp_new(
            org_id,
            {
                "number": next_number(store, org_id, "quote"),
                "estimateId": estimate["id"],
                "customerId": estimate["customerId"],
                "siteId": estimate["siteId"],
                "status": "draft",
                "validityDays": org_defaults(store, org_id)["estimateValidityDays"],
                "notes": estimate.get("assumptions"),
                "items": estimate.get("items"),
                "scope": {
                    "included": estimate.get("included"),
                    "excluded": estimate.get("excluded"),
                    "assumptions": estimate.get("assumptions"),
                    "warranty": estimate.get("warranty"),
                    "paymentTerms": estimate.get("paymentTerms"),
                },
                "computed": estimate.get("computed"),
                "version": estimate.get("version"),
            },
        ),
    )
    write_audit(store, ctx, "quote.create", "quote", quote["id"], new=quote)


@router.post("")
def create_estimate(payload: EstimateIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.ESTIMATE_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    _, customer = resolve_site_scope(store, org_id, payload.siteId, payload.customerId)
    if not payload.title.strip():
        raise AppError(422, "title_required", "Add an estimate title.")
    measurement = None
    if payload.measurementId:
        measurement = org_owned(store, MEASUREMENTS, payload.measurementId, org_id)
        if str(measurement.get("siteId") or "") != payload.siteId:
            raise AppError(400, "measurement_site_mismatch", "The selected measurement belongs to a different site.")
    _apply_org_state(store, org_id, payload)
    computed, lines = compute_estimate(payload)
    number = next_number(store, org_id, "estimate")
    body = stamp_new(
        org_id,
        {
            **payload.model_dump(),
            "customerId": customer["id"],
            "title": payload.title.strip(),
            "items": lines,
            "number": number,
            "version": 1,
            "status": "draft",
            "computed": computed,
        },
    )
    if measurement:
        body["measurementOutputs"] = measurement.get("outputs")
    doc = store.create(ESTIMATES, body)
    enriched = enrich_estimate_document(store, org_id, doc)
    pdf = upload_document_pdf(enriched, kind="estimate", org_id=org_id, doc_id=doc["id"])
    doc.update(pdf)
    doc = store.set(ESTIMATES, doc["id"], doc)
    store.create(
        ESTIMATE_VERSIONS,
        {
            "orgId": org_id,
            "estimateId": doc["id"],
            "version": 1,
            "snapshot": doc,
            "userId": ctx.user_id,
            "reason": payload.reason or "created",
            "createdAt": now_iso(),
        },
    )
    write_audit(store, ctx, "estimate.create", "estimate", doc["id"], new=doc)
    try:
        _ensure_linked_quote(store, ctx, org_id, doc)
    except Exception:
        # The estimate detail screen re-creates the quote if this fails.
        pass
    return doc


def _sync_linked_quotes(store, org_id: str, estimate: dict) -> None:
    """Keep draft quotes in sync with estimate line items + regenerate PDF."""
    from app.core.collections import QUOTES

    quotes = list_org(store, QUOTES, org_id, extra_filters=[("estimateId", "==", estimate["id"])], limit=20)
    for quote in quotes:
        if quote.get("status") not in ("draft", "modification_requested", "sent"):
            continue
        quote["items"] = estimate.get("items")
        quote["computed"] = estimate.get("computed")
        quote["version"] = estimate.get("version")
        quote["updatedAt"] = now_iso()
        from app.billing.document_service import enrich_quote_document

        enriched = enrich_quote_document(store, org_id, quote)
        pdf = upload_document_pdf(enriched, kind="quote", org_id=org_id, doc_id=quote["id"])
        quote.update(pdf)
        store.set(QUOTES, quote["id"], quote)


@router.post("/{estimate_id}/versions")
def new_version(estimate_id: str, payload: EstimateIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.ESTIMATE_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    existing = org_owned(store, ESTIMATES, estimate_id, org_id)
    _assert_estimate_editable(store, org_id, existing)
    if payload.siteId != existing.get("siteId"):
        raise AppError(400, "estimate_site_locked", "An estimate can't be moved to a different site.")
    if not payload.title.strip():
        raise AppError(422, "title_required", "Add an estimate title.")
    _apply_org_state(store, org_id, payload, existing)
    computed, lines = compute_estimate(payload)
    version = int(existing.get("version") or 1) + 1
    revision = payload.model_dump(exclude_unset=True)
    revision.pop("customerId", None)
    existing.update(revision)
    existing["title"] = payload.title.strip()
    existing["items"] = lines
    existing["computed"] = computed
    existing["version"] = version
    existing["updatedAt"] = now_iso()
    enriched = enrich_estimate_document(store, org_id, existing)
    pdf = upload_document_pdf(enriched, kind="estimate", org_id=org_id, doc_id=estimate_id)
    existing.update(pdf)
    saved = store.set(ESTIMATES, estimate_id, existing)
    store.create(
        ESTIMATE_VERSIONS,
        {
            "orgId": org_id,
            "estimateId": estimate_id,
            "version": version,
            "snapshot": saved,
            "userId": ctx.user_id,
            "reason": payload.reason or "revised",
            "createdAt": now_iso(),
        },
    )
    try:
        _sync_linked_quotes(store, org_id, saved)
    except Exception:
        pass
    write_audit(store, ctx, "estimate.version", "estimate", estimate_id, new=saved)
    return saved


@router.get("/{estimate_id}")
def get_estimate(estimate_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.ESTIMATE_READ)
    return org_owned(get_store(), ESTIMATES, estimate_id, ctx.require_org())


@router.get("/{estimate_id}/workflow")
def estimate_workflow(estimate_id: str, ctx: RequestContext = Depends(get_ctx)):
    """Linked quote (carries the approval decision) and the project started from this estimate."""
    ctx.require(Permission.ESTIMATE_READ)
    store = get_store()
    org_id = ctx.require_org()
    estimate = org_owned(store, ESTIMATES, estimate_id, org_id)
    quotes = list_org(store, QUOTES, org_id, extra_filters=[("estimateId", "==", estimate_id)], limit=20)
    can_create = Permission.WILDCARD in ctx.permissions or Permission.ESTIMATE_CREATE in ctx.permissions
    if not quotes and can_create:
        _ensure_linked_quote(store, ctx, org_id, estimate)
        quotes = list_org(store, QUOTES, org_id, extra_filters=[("estimateId", "==", estimate_id)], limit=20)
    quotes.sort(key=lambda q: str(q.get("createdAt") or ""))
    quote = quotes[-1] if quotes else None
    project = estimate_project(store, org_id, estimate)
    return {
        "quote": (
            {k: quote.get(k) for k in ("id", "number", "status", "sentAt", "decidedAt", "pdfUrl", "version")}
            if quote
            else None
        ),
        "project": (
            {k: project.get(k) for k in ("id", "name", "number", "status", "contractValue")} if project else None
        ),
    }


@router.delete("/{estimate_id}")
def delete_estimate(estimate_id: str, ctx: RequestContext = Depends(get_ctx)):
    """Soft-deletes the estimate and its quote. Refused once a project was started or it was invoiced."""
    ctx.require(Permission.ESTIMATE_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    estimate = org_owned(store, ESTIMATES, estimate_id, org_id)
    removed = delete_estimate_cascade(store, org_id, estimate)
    write_audit(store, ctx, "estimate.delete", "estimate", estimate_id, previous=estimate, new={"removed": removed})
    return {
        "ok": True,
        "id": estimate_id,
        "siteId": estimate.get("siteId"),
        "customerId": estimate.get("customerId"),
        "removed": removed,
    }


@router.post("/{estimate_id}/pdf")
def generate_estimate_pdf(estimate_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.ESTIMATE_READ)
    store = get_store()
    org_id = ctx.require_org()
    estimate = org_owned(store, ESTIMATES, estimate_id, org_id)
    enriched = enrich_estimate_document(store, org_id, estimate)
    pdf = upload_document_pdf(enriched, kind="estimate", org_id=org_id, doc_id=estimate_id)
    estimate.update(pdf)
    estimate["updatedAt"] = now_iso()
    return store.set(ESTIMATES, estimate_id, estimate)


@router.get("/{estimate_id}/pdf-file")
def download_estimate_pdf(estimate_id: str, ctx: RequestContext = Depends(get_ctx)):
    """Inline PDF bytes for download / share (does not depend on Cloudinary delivery)."""
    ctx.require(Permission.ESTIMATE_READ)
    store = get_store()
    org_id = ctx.require_org()
    estimate = org_owned(store, ESTIMATES, estimate_id, org_id)
    enriched = enrich_estimate_document(store, org_id, estimate)
    data = document_pdf_bytes(enriched, "estimate")
    filename = f"{estimate.get('number') or estimate_id}.pdf"
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/{estimate_id}/preview-html")
def preview_estimate_html(estimate_id: str, ctx: RequestContext = Depends(get_ctx)):
    """In-app HTML preview — reliable in mobile WebView without PDF.js/CDN."""
    ctx.require(Permission.ESTIMATE_READ)
    store = get_store()
    org_id = ctx.require_org()
    estimate = org_owned(store, ESTIMATES, estimate_id, org_id)
    enriched = enrich_estimate_document(store, org_id, estimate)
    return HTMLResponse(content=document_preview_html(enriched, "estimate"))


@router.get("/{estimate_id}/preview-pages")
def preview_estimate_pages(estimate_id: str, ctx: RequestContext = Depends(get_ctx)):
    """Rasterized PDF pages (PNG) for native in-app preview."""
    ctx.require(Permission.ESTIMATE_READ)
    store = get_store()
    org_id = ctx.require_org()
    estimate = org_owned(store, ESTIMATES, estimate_id, org_id)
    enriched = enrich_estimate_document(store, org_id, estimate)
    return document_preview_pages(enriched, "estimate")
