from tests.helpers import fresh_client, headers, onboard


def test_operations_procurement_inventory_and_search():
    client, _ = fresh_client()
    org = onboard(client)
    h = headers("demo-owner", org)

    supplier = client.post(
        "/api/v1/suppliers",
        json={"name": "ABC Traders", "phone": "9111111111", "gstin": "33BBBBB0000B1Z5"},
        headers=h,
    )
    assert supplier.status_code == 200
    sid = supplier.json()["id"]

    material = client.post(
        "/api/v1/materials",
        json={"name": "Cement", "unit": "bags", "sku": "CEM-53", "gstRate": 0.28, "supplierId": sid},
        headers=h,
    )
    assert material.status_code == 200
    mid = material.json()["id"]

    customer = client.post("/api/v1/customers", json={"name": "Client A", "phone": "9222222222"}, headers=h)
    site = client.post(
        "/api/v1/sites",
        json={"customerId": customer.json()["id"], "name": "Site A", "address": "Adyar"},
        headers=h,
    )
    project = client.post(
        "/api/v1/projects/from-quote",
        json={"quoteId": _accepted_quote(client, h, customer.json()["id"], site.json()["id"])},
        headers=h,
    )
    pid = project.json()["id"]

    mr = client.post(
        "/api/v1/material-requests",
        json={"projectId": pid, "materialId": mid, "qty": "30"},
        headers=h,
    )
    assert mr.status_code == 200
    mr_id = mr.json()["id"]
    approved = client.post(f"/api/v1/material-requests/{mr_id}/approve", headers=h)
    assert approved.json()["status"] == "approved"

    po = client.post(
        "/api/v1/purchase-orders",
        json={"supplierId": sid, "projectId": pid, "items": [{"materialId": mid, "qty": "30", "rate": "410"}]},
        headers=h,
    )
    assert po.status_code == 200
    po_id = po.json()["id"]
    received = client.post(f"/api/v1/purchase-orders/{po_id}/receive", headers=h)
    assert received.json()["status"] == "received"

    purchase = client.post(
        "/api/v1/purchases",
        json={
            "supplierId": sid,
            "projectId": pid,
            "items": [{"name": "Cement", "qty": "30", "rate": "410", "amount": "12300"}],
            "payment": "cash",
        },
        headers=h,
    )
    assert purchase.status_code == 200

    stock_in = client.post(
        "/api/v1/inventory-transactions",
        json={"materialId": mid, "qty": "30", "type": "in", "warehouse": "main"},
        headers=h,
    )
    assert stock_in.status_code == 200
    issue = client.post(
        "/api/v1/inventory-transactions",
        json={"materialId": mid, "qty": "10", "type": "issue", "projectId": pid},
        headers=h,
    )
    assert issue.status_code == 200

    summary = client.get("/api/v1/stock/summary", headers=h)
    assert summary.status_code == 200
    assert len(summary.json()["items"]) >= 1

    search = client.get("/api/v1/search?q=Client", headers=h)
    assert search.status_code == 200
    assert len(search.json()["items"]) >= 1

    dashboard = client.get("/api/v1/reports/dashboard", headers=h)
    assert dashboard.status_code == 200
    assert "activeProjects" in dashboard.json()

    gst = client.get("/api/v1/reports/gst", headers=h)
    assert gst.status_code == 200

    accounting = client.get("/api/v1/accounting-entries", headers=h)
    assert accounting.status_code == 200
    assert len(accounting.json()["items"]) >= 1


def test_snags_change_orders_attendance_sync_portal():
    client, _ = fresh_client()
    org = onboard(client)
    h = headers("demo-owner", org)

    customer = client.post("/api/v1/customers", json={"name": "Portal Client", "phone": "9333333333"}, headers=h)
    site = client.post(
        "/api/v1/sites",
        json={"customerId": customer.json()["id"], "name": "Portal Site", "address": "Velachery"},
        headers=h,
    )
    qid = _accepted_quote(client, h, customer.json()["id"], site.json()["id"])
    project = client.post("/api/v1/projects/from-quote", json={"quoteId": qid}, headers=h)
    pid = project.json()["id"]

    worker = client.post(
        "/api/v1/labour",
        json={"name": "Mason 1", "trade": "masonry", "dailyRate": "1100"},
        headers=h,
    )
    wid = worker.json()["id"]

    attendance = client.post(
        "/api/v1/attendance",
        json={"projectId": pid, "workerId": wid, "status": "present"},
        headers=h,
    )
    assert attendance.status_code == 200

    report = client.post(
        "/api/v1/daily-reports",
        json={"projectId": pid, "workCompleted": "Plastering 120 sq.ft.", "progressPercent": "15"},
        headers=h,
    )
    assert report.status_code == 200

    co = client.post(
        "/api/v1/change-orders",
        json={
            "projectId": pid,
            "reason": "Extra balcony",
            "additionalCost": "5000",
            "sellingPrice": "8000",
        },
        headers=h,
    )
    co_id = co.json()["id"]
    sent = client.post(f"/api/v1/change-orders/{co_id}/send", headers=h)
    assert sent.json()["status"] == "sent"
    approved = client.post(f"/api/v1/change-orders/{co_id}/approve", headers=h)
    assert approved.json()["status"] == "approved"

    snag = client.post(
        "/api/v1/snags",
        json={"projectId": pid, "description": "Paint peel near window", "location": "Bedroom 1"},
        headers=h,
    )
    snag_id = snag.json()["id"]
    assigned = client.post(f"/api/v1/snags/{snag_id}/assign?user_id=supervisor-1", headers=h)
    assert assigned.json()["status"] == "assigned"
    resolved = client.post(f"/api/v1/snags/{snag_id}/resolve", headers=h)
    assert resolved.json()["status"] == "resolved"

    sync = client.post(
        "/api/v1/sync",
        json=[{"kind": "attendance", "clientIdempotencyKey": "att-1", "payload": {"status": "present"}}],
        headers=h,
    )
    assert sync.json()["accepted"] == 1
    dup = client.post(
        "/api/v1/sync",
        json=[{"kind": "attendance", "clientIdempotencyKey": "att-1", "payload": {"status": "present"}}],
        headers=h,
    )
    assert dup.json()["conflicts"]

    portal_projects = client.get("/api/v1/portal/projects", headers=h)
    assert portal_projects.status_code == 200

    notif = client.post(
        "/api/v1/notifications",
        json={"title": "Quote accepted", "body": "Client approved quote", "userId": "demo-owner"},
        headers=h,
    )
    assert notif.status_code == 200


def _accepted_quote(client, h, customer_id: str, site_id: str) -> str:
    measurement = client.post(
        "/api/v1/measurements",
        json={
            "siteId": site_id,
            "customerId": customer_id,
            "formulaKind": "painting",
            "inputs": {"length": 10, "width": 10, "height": 10, "doors": 20, "windows": 10, "coats": 2},
        },
        headers=h,
    )
    estimate = client.post(
        "/api/v1/estimates",
        json={
            "customerId": customer_id,
            "siteId": site_id,
            "measurementId": measurement.json()["id"],
            "title": "Painting",
            "marginRate": "0.2",
            "items": [{"description": "Paint", "quantity": "100", "unit": "sqft", "materialCost": "8000", "labourCost": "6000"}],
        },
        headers=h,
    )
    quote = client.post("/api/v1/quotes", json={"estimateId": estimate.json()["id"]}, headers=h)
    qid = quote.json()["id"]
    client.post(f"/api/v1/quotes/{qid}/send", headers=h)
    client.post(f"/api/v1/quotes/{qid}/accept", json={"comment": "ok"}, headers=h)
    return qid
