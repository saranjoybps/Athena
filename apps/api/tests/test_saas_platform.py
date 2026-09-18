from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.membership_cache import invalidate_membership_cache
from app.core.store import MemoryStore, set_store
from app.main import app
from app.platform.ratelimit import reset_limits
from tests.helpers import ONBOARD_PAYLOAD, headers


@pytest.fixture()
def store():
    mem = MemoryStore()
    set_store(mem)
    invalidate_membership_cache()
    reset_limits()
    return mem


@pytest.fixture()
def client(store):
    return TestClient(app)


@pytest.fixture()
def admin(monkeypatch):
    monkeypatch.setenv("PLATFORM_ADMIN_UIDS", "plat-admin")
    get_settings.cache_clear()
    from app.core.firebase_credentials import get_service_account_info

    get_service_account_info.cache_clear()
    yield
    get_settings.cache_clear()
    get_service_account_info.cache_clear()


def trial_signup(client: TestClient, email: str = "owner@trial.test", company: str = "Trial Co") -> dict:
    res = client.post(
        "/api/v1/auth/trial-signup",
        json={
            "company_name": company,
            "owner_name": "Owner",
            "email": email,
            "password": "Password1",
        },
    )
    assert res.status_code == 200, res.text
    return res.json()


def owner_headers(uid: str, org: str) -> dict[str, str]:
    return headers(uid, org)


def test_trial_signup_preset_and_claims(client):
    body = trial_signup(client)
    uid, org_id = body["uid"], body["orgId"]
    tenant = body["tenant"]
    assert tenant["status"] == "trial"
    assert tenant["plan"] == "free"
    assert tenant["quota_enforced"] is True
    assert tenant["rate_limits"]["max_users"] == 5
    assert tenant["rate_limits"]["max_customers"] == 50
    assert tenant["rate_limits"]["max_sites"] == 25
    starts = datetime.fromisoformat(tenant["trial_starts_at"])
    ends = datetime.fromisoformat(tenant["trial_ends_at"])
    assert (ends - starts).days == 15

    me = client.get("/api/v1/me", headers=owner_headers(uid, org_id))
    assert me.status_code == 200, me.text
    ents = me.json()["entitlements"]
    assert ents["status"] == "trial"
    assert ents["limits"]["users"] == 5
    assert ents["limits"]["customers"] == 50
    assert ents["limits"]["sites"] == 25
    assert ents["usage"]["users"] == 1
    assert ents["upgrade_request_pending"] is False
    assert ents["read_only"] is False
    assert me.json()["orgId"] == org_id


def test_trial_signup_existing_email_409(client):
    trial_signup(client, email="dup@trial.test")
    res = client.post(
        "/api/v1/auth/trial-signup",
        json={
            "company_name": "Other",
            "owner_name": "Owner",
            "email": "dup@trial.test",
            "password": "Password1",
        },
    )
    assert res.status_code == 409


def test_sixth_user_blocked(client):
    body = trial_signup(client, email="users@trial.test")
    uid, org = body["uid"], body["orgId"]
    h = owner_headers(uid, org)
    for i in range(4):
        res = client.post(
            "/api/v1/users/invite",
            json={"email": f"u{i}@trial.test", "name": f"User {i}", "roles": ["field"]},
            headers=h,
        )
        assert res.status_code == 200, res.text
    blocked = client.post(
        "/api/v1/users/invite",
        json={"email": "u5@trial.test", "name": "User 5", "roles": ["field"]},
        headers=h,
    )
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "quota_exceeded"
    assert "Account limit reached" in blocked.json()["error"]["message"]
    assert "Trial" not in blocked.json()["error"]["message"]


def test_51st_customer_and_26th_site_blocked(client, store):
    body = trial_signup(client, email="caps@trial.test")
    uid, org = body["uid"], body["orgId"]
    h = owner_headers(uid, org)
    # Raise RPM so bulk creates in this test are not blocked by the trial rate limit.
    tenant = store.get("platform_tenants", org)
    tenant["rate_limits"] = {**(tenant.get("rate_limits") or {}), "requests_per_minute": 500}
    store.set("platform_tenants", org, tenant)
    for i in range(50):
        res = client.post("/api/v1/customers", json={"name": f"C{i}", "phone": "9000000000"}, headers=h)
        assert res.status_code == 200, res.text
    blocked_c = client.post("/api/v1/customers", json={"name": "C50", "phone": "9000000000"}, headers=h)
    assert blocked_c.status_code == 403
    assert blocked_c.json()["error"]["code"] == "quota_exceeded"

    # still blocked for customers; create sites against an existing one
    cid = client.get("/api/v1/customers", headers=h).json()["items"][0]["id"]
    for i in range(25):
        res = client.post(
            "/api/v1/sites",
            json={"customerId": cid, "name": f"S{i}", "address": "Addr"},
            headers=h,
        )
        assert res.status_code == 200, res.text
    blocked_s = client.post(
        "/api/v1/sites",
        json={"customerId": cid, "name": "S25", "address": "Addr"},
        headers=h,
    )
    assert blocked_s.status_code == 403
    assert blocked_s.json()["error"]["code"] == "quota_exceeded"


def test_paid_unlimited_and_custom_user_cap(client, admin):
    body = trial_signup(client, email="paid@trial.test")
    uid, org = body["uid"], body["orgId"]
    h = owner_headers(uid, org)
    admin_h = headers("plat-admin")
    converted = client.post(f"/api/v1/platform/tenants/{org}/convert", json={"to": "paid", "plan": "starter"}, headers=admin_h)
    assert converted.status_code == 200, converted.text
    assert converted.json()["status"] == "active"
    assert converted.json()["plan"] == "starter"
    assert converted.json()["quota_enforced"] is False
    assert converted.json()["rate_limits"]["max_users"] == 0

    for i in range(6):
        res = client.post(
            "/api/v1/users/invite",
            json={"email": f"p{i}@trial.test", "name": f"P{i}", "roles": ["field"]},
            headers=h,
        )
        assert res.status_code == 200, res.text

    patched = client.patch(
        f"/api/v1/platform/tenants/{org}",
        json={"rate_limits": {"requests_per_minute": 120, "max_users": 2, "max_customers": 0, "max_sites": 0}},
        headers=admin_h,
    )
    assert patched.status_code == 200, patched.text
    # already over cap from the 6 invites + owner; next invite blocked
    blocked = client.post(
        "/api/v1/users/invite",
        json={"email": "extra@trial.test", "name": "Extra", "roles": ["field"]},
        headers=h,
    )
    assert blocked.status_code == 403

    # dedicated org with cap 2 from the start
    body2 = trial_signup(client, email="cap2@trial.test", company="Cap Two")
    uid2, org2 = body2["uid"], body2["orgId"]
    h2 = owner_headers(uid2, org2)
    client.post(f"/api/v1/platform/tenants/{org2}/convert", json={"to": "paid", "plan": "starter"}, headers=admin_h)
    client.patch(
        f"/api/v1/platform/tenants/{org2}",
        json={"rate_limits": {"requests_per_minute": 120, "max_users": 2, "max_customers": 0, "max_sites": 0}},
        headers=admin_h,
    )
    ok = client.post("/api/v1/users/invite", json={"email": "second@trial.test", "name": "Second", "roles": ["field"]}, headers=h2)
    assert ok.status_code == 200, ok.text
    third = client.post("/api/v1/users/invite", json={"email": "third@trial.test", "name": "Third", "roles": ["field"]}, headers=h2)
    assert third.status_code == 403


def test_missing_platform_row_skips_quota(client, store):
    res = client.post("/api/v1/onboarding", json=ONBOARD_PAYLOAD, headers=headers("legacy-owner"))
    assert res.status_code == 200, res.text
    org = res.json()["organization"]["id"]
    store.delete("platform_tenants", org)
    h = headers("legacy-owner", org)
    for i in range(6):
        invited = client.post(
            "/api/v1/users/invite",
            json={"email": f"legacy{i}@trial.test", "name": f"L{i}", "roles": ["field"]},
            headers=h,
        )
        assert invited.status_code == 200, invited.text


def test_expired_trial_hard_lock(client, store):
    body = trial_signup(client, email="exp@trial.test")
    uid, org = body["uid"], body["orgId"]
    tenant = store.get("platform_tenants", org)
    tenant["trial_ends_at"] = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    store.set("platform_tenants", org, tenant)
    h = owner_headers(uid, org)

    me = client.get("/api/v1/me", headers=h)
    assert me.status_code == 200, me.text
    assert me.json()["entitlements"]["trial_expired"] is True

    listed = client.get("/api/v1/customers", headers=h)
    assert listed.status_code == 403
    assert listed.json()["error"]["code"] == "trial_expired"

    # Expired tenants may still request an upgrade.
    upgrade = client.post("/api/v1/tenants/me/upgrade-request", json={"message": "please"}, headers=h)
    assert upgrade.status_code == 200, upgrade.text
    assert upgrade.json()["status"] == "pending"


def test_onboarding_creates_trial_preset(client):
    h = headers("onboard-owner")
    res = client.post("/api/v1/onboarding", json=ONBOARD_PAYLOAD, headers=h)
    assert res.status_code == 200, res.text
    org_id = res.json()["organization"]["id"]
    me = client.get("/api/v1/me", headers=headers("onboard-owner", org_id))
    assert me.status_code == 200, me.text
    ents = me.json()["entitlements"]
    assert ents["status"] == "trial"
    assert ents["plan"] == "free"
    assert ents["quota_enforced"] is True
    assert ents["limits"]["users"] == 5
    assert ents["limits"]["customers"] == 50
    assert ents["limits"]["sites"] == 25
    from app.platform.store import get_platform_tenant

    tenant = get_platform_tenant(org_id)
    assert tenant is not None
    assert tenant["provisioned_by"] == "self-onboarding"
    assert tenant["rate_limits"]["requests_per_minute"] == 60


def test_upgrade_request_idempotent_and_non_trial_forbidden(client, admin):
    body = trial_signup(client, email="upg@trial.test")
    uid, org = body["uid"], body["orgId"]
    h = owner_headers(uid, org)
    first = client.post("/api/v1/tenants/me/upgrade-request", json={"message": "need paid"}, headers=h)
    assert first.status_code == 200, first.text
    req_id = first.json()["id"]
    second = client.post("/api/v1/tenants/me/upgrade-request", json={"message": "again"}, headers=h)
    assert second.status_code == 200
    assert second.json()["id"] == req_id

    me = client.get("/api/v1/me", headers=h)
    assert me.json()["entitlements"]["upgrade_request_pending"] is True

    got = client.get("/api/v1/tenants/me/upgrade-request", headers=h)
    assert got.json()["item"]["id"] == req_id

    admin_h = headers("plat-admin")
    inbox = client.get("/api/v1/platform/upgrade-requests", headers=admin_h)
    assert inbox.status_code == 200, inbox.text
    assert any(i["id"] == req_id for i in inbox.json()["items"])

    accepted = client.post(f"/api/v1/platform/upgrade-requests/{req_id}/accept", headers=admin_h)
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["tenant"]["status"] == "active"
    assert accepted.json()["tenant"]["plan"] == "starter"

    forbidden = client.post("/api/v1/tenants/me/upgrade-request", json={"message": "again"}, headers=h)
    assert forbidden.status_code == 403


def test_convert_paid_and_trial(client, admin):
    body = trial_signup(client, email="cvt@trial.test")
    org = body["orgId"]
    admin_h = headers("plat-admin")
    paid = client.post(f"/api/v1/platform/tenants/{org}/convert", json={"to": "paid", "plan": "starter"}, headers=admin_h)
    assert paid.json()["status"] == "active"
    assert paid.json()["plan"] == "starter"
    trial = client.post(f"/api/v1/platform/tenants/{org}/convert", json={"to": "trial"}, headers=admin_h)
    assert trial.json()["status"] == "trial"
    assert trial.json()["plan"] == "free"
    assert trial.json()["quota_enforced"] is True
    assert trial.json()["rate_limits"]["max_users"] == 5

    extended = client.post(f"/api/v1/platform/tenants/{org}/extend-trial", json={"days": 15}, headers=admin_h)
    assert extended.status_code == 200
    ends = datetime.fromisoformat(extended.json()["trial_ends_at"])
    assert ends > datetime.now(timezone.utc) + timedelta(days=14)

    suspended = client.post(f"/api/v1/platform/tenants/{org}/suspend", headers=admin_h)
    assert suspended.json()["status"] == "suspended"
    listed = client.get("/api/v1/customers", headers=owner_headers(body["uid"], org))
    assert listed.status_code == 403
    assert listed.json()["error"]["code"] == "tenant_suspended"


def test_platform_admin_required(client):
    res = client.get("/api/v1/platform/tenants", headers=headers("not-admin"))
    assert res.status_code == 403


def test_upgrade_reject_allows_retry(client, admin):
    body = trial_signup(client, email="rej@trial.test")
    uid, org = body["uid"], body["orgId"]
    h = owner_headers(uid, org)
    admin_h = headers("plat-admin")
    first = client.post("/api/v1/tenants/me/upgrade-request", json={"message": "please"}, headers=h)
    req_id = first.json()["id"]
    rejected = client.post(f"/api/v1/platform/upgrade-requests/{req_id}/reject", headers=admin_h)
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"
    again = client.post("/api/v1/tenants/me/upgrade-request", json={"message": "again"}, headers=h)
    assert again.status_code == 200
    assert again.json()["id"] != req_id
    assert again.json()["status"] == "pending"
