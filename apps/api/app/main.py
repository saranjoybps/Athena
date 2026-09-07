import uuid
from collections.abc import Callable

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.platform import extra
from app.attendance.router import attendance_router, reports_router as daily_reports_router
from app.auth.router import router as auth_router
from app.billing.quotes import router as quotes_router
from app.billing.router import router as billing_router
from app.core.config import get_settings
from app.core.errors import AppError, app_exception_handler
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

app = FastAPI(
    title=settings.app_name,
    version="0.2.0",
    openapi_url=f"{settings.api_prefix}/openapi.json",
    docs_url=f"{settings.api_prefix}/docs",
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
    response = await call_next(request)
    response.headers["X-Request-Id"] = request.state.request_id
    return response


app.add_exception_handler(AppError, app_exception_handler)
app.add_exception_handler(Exception, app_exception_handler)


@app.get("/health")
def health():
    return {"status": "ok", "service": "athena-api", "env": settings.app_env}


for r in (
    auth_router,
    onboarding_router,
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
