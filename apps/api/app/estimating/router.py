from decimal import Decimal

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse, Response

from app.core.audit import write_audit
from app.core.collections import ESTIMATE_VERSIONS, ESTIMATES, MEASUREMENTS, PROJECTS
from app.core.context import RequestContext, get_ctx
from app.core.errors import AppError
from app.core.numbering import next_number
from app.core.permissions import Permission
from app.core.repo import list_org, now_iso, org_owned, stamp_new
from app.core.site_uniqueness import assert_site_has_no
from app.core.store import get_store
from app.engines.costing import estimate_totals
from app.engines.gst import compute_gst
from app.engines.units import D, money
from app.estimating.schemas import EstimateIn
from app.core.media import document_pdf_bytes, document_preview_html, document_preview_pages, upload_document_pdf
from app.billing.document_service import enrich_estimate_document

router = APIRouter(prefix="/estimates", tags=["estimates"])


def _compute(payload: EstimateIn) -> dict:
    material = sum(D(i.materialCost) for i in payload.items)
    labour = sum(D(i.labourCost) for i in payload.items)
    equipment_items = sum(D(i.equipmentCost) for i in payload.items)
    other_items = sum(D(i.otherCost) for i in payload.items)
    totals = estimate_totals(
        material=material,
        labour=labour,
        equipment=D(payload.equipmentCost) + equipment_items,
        transport=payload.transportCost,
        subcontractor=payload.subcontractorCost,
        other=D(payload.otherCost) + other_items,
        markup_rate=payload.markupRate,
        margin_rate=payload.marginRate,
        discount=payload.discount,
    )

    # When lines carry an explicit unit rate, customer-facing totals follow qty × rate.
    rate_sell = D(0)
    has_rates = False
    for item in payload.items:
        if item.rate in (None, ""):
            continue
        has_rates = True
        try:
            qty = D(item.quantity or 1)
        except Exception:
            qty = D(1)
        if qty <= 0:
            qty = D(1)
        rate_sell += qty * D(item.rate)

    if has_rates:
        selling = money(rate_sell - D(payload.discount or 0))
        if selling < 0:
            selling = money(0)
        tax = compute_gst(
            selling,
            payload.taxRate or "0",
            payload.placeOfSupply,
            payload.supplierState,
            payload.registeredCustomer,
        )
        cost = D(totals["totalCost"])
        return {
            **totals,
            "subtotal": str(selling),
            "selling": str(selling),
            "sellingBeforeDiscount": str(money(rate_sell)),
            "discount": str(money(payload.discount or 0)),
            "profit": str(money(selling - cost)),
            "tax": tax,
            "grandTotal": tax["grandTotal"],
        }

    tax = compute_gst(
        totals["subtotal"],
        payload.taxRate or "0",
        payload.placeOfSupply,
        payload.supplierState,
        payload.registeredCustomer,
    )
    return {**totals, "tax": tax, "grandTotal": tax["grandTotal"]}


@router.get("")
def list_estimates(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.ESTIMATE_READ)
    return {"items": list_org(get_store(), ESTIMATES, ctx.require_org())}


def _assert_estimate_editable(store, org_id: str, estimate: dict) -> None:
    site_id = estimate.get("siteId")
    if not site_id:
        return
    projects = list_org(store, PROJECTS, org_id, extra_filters=[("siteId", "==", site_id)], limit=1)
    if projects:
        raise AppError(
            400,
            "estimate_locked",
            "This estimate is locked because a project already exists for the site.",
            {"projectId": projects[0].get("id")},
        )


@router.post("")
def create_estimate(payload: EstimateIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.ESTIMATE_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    assert_site_has_no(store, ESTIMATES, org_id, payload.siteId or "", label="estimate")
    computed = _compute(payload)
    number = next_number(store, org_id, "estimate")
    body = stamp_new(
        org_id,
        {
            **payload.model_dump(),
            "number": number,
            "version": 1,
            "status": "draft",
            "computed": computed,
        },
    )
    if payload.measurementId:
        m = org_owned(store, MEASUREMENTS, payload.measurementId, org_id)
        body["measurementOutputs"] = m.get("outputs")
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
    computed = _compute(payload)
    version = int(existing.get("version") or 1) + 1
    existing.update(payload.model_dump())
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
