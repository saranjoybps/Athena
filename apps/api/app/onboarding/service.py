from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field

from app.core.audit import write_audit
from app.core.collections import (
    CREWS,
    FORMULA_TEMPLATES,
    LABOUR,
    MATERIALS,
    MEMBERSHIPS,
    ORGANIZATIONS,
    TRADE_TEMPLATES,
    USERS,
)
from app.core.context import RequestContext
from app.core.entitlements import entitlements_for
from app.core.errors import AppError
from app.core.membership_cache import invalidate_membership_cache
from app.core.repo import now_iso, stamp_new
from app.core.store import DocumentStore
from app.templates.library import templates_for_trades


class AccountStep(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None


class BusinessStep(BaseModel):
    businessName: str
    ownerName: str
    phone: str
    email: str
    logo: str | None = None
    website: str | None = None
    description: str | None = None


class LocationStep(BaseModel):
    country: str = "India"
    state: str
    city: str
    pinCode: str
    address: str


class ConfigStep(BaseModel):
    currency: str = "INR"
    timeZone: str = "Asia/Kolkata"
    gstRegistered: bool = False
    gstin: str | None = None
    pan: str | None = None
    invoicePrefix: str = "INV"
    quotePrefix: str = "QUO"
    projectPrefix: str = "PROJ"


class TeamInvite(BaseModel):
    email: str
    role: str
    name: str | None = None


class OnboardingPayload(BaseModel):
    account: AccountStep
    business: BusinessStep
    location: LocationStep
    config: ConfigStep = Field(default_factory=ConfigStep)
    trades: list[str]
    team: list[TeamInvite] = Field(default_factory=list)


def onboard(store: DocumentStore, ctx: RequestContext, payload: OnboardingPayload) -> dict[str, Any]:
    existing = store.query(MEMBERSHIPS, filters=[("userId", "==", ctx.user_id)], limit=1)
    if existing:
        raise AppError(400, "already_onboarded", "This account already belongs to an organization.")
    org = stamp_new(
        "",
        {
            "name": payload.business.businessName,
            "ownerName": payload.business.ownerName,
            "phone": payload.business.phone,
            "email": payload.business.email,
            "logo": payload.business.logo,
            "website": payload.business.website,
            "description": payload.business.description,
            "country": payload.location.country,
            "state": payload.location.state,
            "city": payload.location.city,
            "pinCode": payload.location.pinCode,
            "address": payload.location.address,
            "currency": payload.config.currency,
            "timeZone": payload.config.timeZone,
            "gstRegistered": payload.config.gstRegistered,
            "gstin": payload.config.gstin,
            "pan": payload.config.pan,
            "plan": "starter",
            "trades": payload.trades,
            "numberPrefixes": {
                "invoice": payload.config.invoicePrefix,
                "quote": payload.config.quotePrefix,
                "project": payload.config.projectPrefix,
                "estimate": "EST",
                "payment": "PAY",
                "purchase_order": "PO",
            },
        },
    )
    org.pop("orgId", None)
    created = store.create(ORGANIZATIONS, org)
    org_id = created["id"]
    created["orgId"] = org_id
    store.set(ORGANIZATIONS, org_id, created)

    store.set(
        USERS,
        ctx.user_id,
        {
            "id": ctx.user_id,
            "name": payload.account.name,
            "email": payload.account.email or ctx.email,
            "phone": payload.account.phone or ctx.phone,
            "createdAt": now_iso(),
        },
    )
    membership = store.create(
        MEMBERSHIPS,
        {
            "orgId": org_id,
            "userId": ctx.user_id,
            "roles": ["owner"],
            "status": "active",
            "createdAt": now_iso(),
        },
        doc_id=f"{ctx.user_id}_{org_id}",
    )
    invalidate_membership_cache(ctx.user_id)
    provision_trade_templates(store, org_id, payload.trades)
    ctx.org_id = org_id
    ctx.roles = ["owner"]
    ctx.permissions = {"*"}
    write_audit(store, ctx, "organization.create", "organization", org_id, new=created)
    from app.platform.service import apply_onboarding_platform_row

    result = {
        "organization": created,
        "membership": membership,
        "entitlements": entitlements_for(created),
        "invitesQueued": [i.model_dump() for i in payload.team],
    }
    apply_onboarding_platform_row(store, ctx.user_id, result)
    return result


def provision_trade_templates(store: DocumentStore, org_id: str, trades: list[str]) -> None:
    for tpl in templates_for_trades(trades):
        store.create(
            TRADE_TEMPLATES,
            {**tpl, "orgId": org_id, "createdAt": now_iso()},
        )
        store.create(
            FORMULA_TEMPLATES,
            {
                "orgId": org_id,
                "trade": tpl["trade"],
                "source": "template",
                **tpl.get("formula", {}),
                "createdAt": now_iso(),
            },
        )
        for mat in tpl.get("materials", []):
            store.create(
                MATERIALS,
                {
                    **mat,
                    "orgId": org_id,
                    "source": "template",
                    "active": True,
                    "createdAt": now_iso(),
                    "updatedAt": now_iso(),
                },
            )
        for lab in tpl.get("labourCategories", []):
            store.create(
                LABOUR,
                {
                    **lab,
                    "orgId": org_id,
                    "trade": tpl["trade"],
                    "source": "template",
                    "active": True,
                    "type": "employee",
                    "createdAt": now_iso(),
                },
            )
        if tpl.get("labourCategories"):
            store.create(
                CREWS,
                {
                    "orgId": org_id,
                    "name": f"{tpl['trade'].title()} Crew A",
                    "trade": tpl["trade"],
                    "source": "template",
                    "members": tpl["labourCategories"],
                    "createdAt": now_iso(),
                },
            )
