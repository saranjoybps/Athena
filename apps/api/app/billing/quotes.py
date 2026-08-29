from fastapi import APIRouter, Depends

from app.core.audit import write_audit
from app.core.collections import ESTIMATES, QUOTE_APPROVALS, QUOTES
from app.core.context import RequestContext, get_ctx
from app.core.numbering import next_number
from app.core.permissions import Permission
from app.core.repo import list_org, now_iso, org_owned, stamp_new
from app.core.store import get_store
from app.billing.document_service import enrich_quote_document
from app.billing.quote_schemas import QuoteCreateIn, QuoteDecisionIn

router = APIRouter(prefix="/quotes", tags=["quotes"])


@router.get("/{quote_id}")
def get_quote(quote_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.QUOTE_READ)
    store = get_store()
    org_id = ctx.require_org()
    quote = org_owned(store, QUOTES, quote_id, org_id)
    doc = enrich_quote_document(store, org_id, quote)
    if ctx.is_customer:
        doc.pop("computedCost", None)
        if doc.get("computed"):
            doc["computed"] = {
                k: v for k, v in doc["computed"].items() if k in ("selling", "grandTotal", "tax", "subtotal")
            }
    return doc


@router.get("")
def list_quotes(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.QUOTE_READ)
    items = list_org(get_store(), QUOTES, ctx.require_org())
    if ctx.is_customer:
        for q in items:
            q.pop("computedCost", None)
            if q.get("computed"):
                q["computed"] = {k: v for k, v in q["computed"].items() if k in ("selling", "grandTotal", "tax", "subtotal")}
    return {"items": items}


@router.post("")
def create_quote(payload: QuoteCreateIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.QUOTE_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    estimate = org_owned(store, ESTIMATES, payload.estimateId, org_id)
    number = next_number(store, org_id, "quote")
    doc = store.create(
        QUOTES,
        stamp_new(
            org_id,
            {
                "number": number,
                "estimateId": estimate["id"],
                "customerId": estimate["customerId"],
                "siteId": estimate["siteId"],
                "status": "draft",
                "validityDays": payload.validityDays,
                "notes": payload.notes,
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
    write_audit(store, ctx, "quote.create", "quote", doc["id"], new=doc)
    return doc


@router.post("/{quote_id}/send")
def send_quote(quote_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.QUOTE_SEND)
    store = get_store()
    quote = org_owned(store, QUOTES, quote_id, ctx.require_org())
    quote["status"] = "sent"
    quote["sentAt"] = now_iso()
    saved = store.set(QUOTES, quote_id, quote)
    write_audit(store, ctx, "quote.send", "quote", quote_id, new=saved)
    return saved


@router.post("/{quote_id}/accept")
def accept_quote(quote_id: str, payload: QuoteDecisionIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.QUOTE_APPROVE)
    return _decide(quote_id, "accepted", payload, ctx)


@router.post("/{quote_id}/reject")
def reject_quote(quote_id: str, payload: QuoteDecisionIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.QUOTE_APPROVE)
    return _decide(quote_id, "rejected", payload, ctx)


@router.post("/{quote_id}/request-modification")
def request_mod(quote_id: str, payload: QuoteDecisionIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.QUOTE_APPROVE)
    return _decide(quote_id, "modification_requested", payload, ctx)


def _decide(quote_id: str, status: str, payload: QuoteDecisionIn, ctx: RequestContext):
    store = get_store()
    quote = org_owned(store, QUOTES, quote_id, ctx.require_org())
    quote["status"] = status
    quote["decidedAt"] = now_iso()
    saved = store.set(QUOTES, quote_id, quote)
    store.create(
        QUOTE_APPROVALS,
        {
            "orgId": ctx.org_id,
            "quoteId": quote_id,
            "status": status,
            "comment": payload.comment,
            "signature": payload.signature,
            "userId": ctx.user_id,
            "createdAt": now_iso(),
        },
    )
    write_audit(store, ctx, f"quote.{status}", "quote", quote_id, new=saved)
    return saved
