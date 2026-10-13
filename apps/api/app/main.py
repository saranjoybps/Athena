import uuid
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse

from app.api.platform import extra
from app.attendance.router import attendance_router, reports_router as daily_reports_router
from app.auth.router import router as auth_router
from app.billing.quotes import router as quotes_router
from app.billing.router import router as billing_router
from app.operations.delivery_challans import router as delivery_challans_router
from app.core.config import get_settings
from app.core.demo_seed import ensure_demo_account
from app.core.errors import AppError, app_exception_handler, error_payload
from app.core.privacy_html import ACCOUNT_DELETION_HTML, PRIVACY_HTML
from app.platform.access import check_tenant_access, is_platform_path, is_unprotected_path
from app.platform.router import router as platform_admin_router
from app.tenants.router import router as tenants_router
from app.customers.router import router as customers_router
from app.estimating.router import router as estimates_router
from app.formulas.router import router as formulas_router
from app.measurements.router import router as measurements_router
from app.onboarding.router import router as onboarding_router
from app.operations.router import (
    crews_router,
    docs_router,
    groups_router,
    inventory_router,
    labour_router,
    materials_router,
    ops,
    suppliers_router,
    vehicles_router,
)
from app.organizations.router import router as orgs_router
from app.portal.router import router as portal_router
from app.projects.ops import co_router, expenses_router, snags_router
from app.projects.router import router as projects_router
from app.reports.router import router as analytics_router
from app.search.router import router as search_router
from app.sites.router import router as sites_router
from app.surveys.router import router as surveys_router
from app.sync.router import router as sync_router
from app.users.router import router as users_router

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    ensure_demo_account()
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.2.0",
    openapi_url=f"{settings.api_prefix}/openapi.json",
    docs_url=f"{settings.api_prefix}/docs",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next: Callable):
    request.state.request_id = request.headers.get("X-Request-Id") or uuid.uuid4().hex
    path = request.url.path.rstrip("/") or "/"
    if not is_unprotected_path(path, request.method) and not is_platform_path(path):
        authorization = request.headers.get("authorization")
        if authorization and authorization.startswith("Bearer "):
            try:
                from app.core.context import verify_token
                from app.core.membership_cache import get_memberships_for_user
                from app.core.store import get_store

                claims = verify_token(authorization[7:].strip())
                memberships = get_memberships_for_user(get_store(), claims["uid"])
                org_id = None
                xorg = request.headers.get("x-organization-id")
                if memberships:
                    if xorg:
                        chosen = next((m for m in memberships if m.get("orgId") == xorg), None)
                        org_id = (chosen or memberships[0]).get("orgId")
                    else:
                        org_id = memberships[0].get("orgId")
                elif claims.get("org_id"):
                    org_id = str(claims["org_id"])
                check_tenant_access(org_id, request)
            except AppError as exc:
                status, body = error_payload(request, exc)
                return JSONResponse(status_code=status, content=body)
    response = await call_next(request)
    response.headers["X-Request-Id"] = request.state.request_id
    return response


app.add_exception_handler(AppError, app_exception_handler)
app.add_exception_handler(Exception, app_exception_handler)


@app.get("/health")
def health():
    return {"status": "ok", "service": "athena-api", "env": settings.app_env}


@app.get("/privacy", response_class=HTMLResponse)
def privacy_policy():
    """Public Privacy Policy (no auth) — use this HTTPS URL in Play Console."""
    return HTMLResponse(content=PRIVACY_HTML, status_code=200)


@app.get("/account-deletion", response_class=HTMLResponse)
def account_deletion():
    """Public account-deletion request page for Play Console Data deletion URL."""
    return HTMLResponse(content=ACCOUNT_DELETION_HTML, status_code=200)


for r in (
    auth_router,
    onboarding_router,
    tenants_router,
    platform_admin_router,
    users_router,
    orgs_router,
    customers_router,
    sites_router,
    surveys_router,
    measurements_router,
    formulas_router,
    estimates_router,
    quotes_router,
    projects_router,
    billing_router,
    delivery_challans_router,
    expenses_router,
    co_router,
    snags_router,
    attendance_router,
    daily_reports_router,
    materials_router,
    suppliers_router,
    labour_router,
    crews_router,
    inventory_router,
    docs_router,
    groups_router,
    vehicles_router,
    ops,
    portal_router,
    analytics_router,
    search_router,
    sync_router,
    extra,
):
    app.include_router(r, prefix=settings.api_prefix)
