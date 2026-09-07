#!/usr/bin/env python3
"""Seed a rich demo dataset so every module has browsable sample data."""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
import uuid

API = "http://127.0.0.1:8080"
USER_ID = "local-owner"


def call(
    method: str,
    path: str,
    body: dict | None = None,
    org_id: str | None = None,
    extra_headers: dict | None = None,
) -> dict | list:
    headers = {
        "Authorization": f"Bearer dev:{USER_ID}",
        "Content-Type": "application/json",
    }
    if org_id:
        headers["X-Organization-Id"] = org_id
    if extra_headers:
        headers.update(extra_headers)
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(f"{API}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as res:
            raw = res.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode()
        raise RuntimeError(f"{method} {path} -> {exc.code}: {detail}") from exc


def idem() -> str:
    return f"seed-{uuid.uuid4().hex[:12]}"


def ensure_org() -> str:
    me = call("GET", "/api/v1/me")
    if me.get("orgId"):
        return str(me["orgId"])
    if me.get("memberships"):
        return str(me["memberships"][0]["organization"]["id"])

    result = call(
        "POST",
        "/api/v1/onboarding",
        {
            "account": {"name": "Demo Owner", "email": "demo@athena.local", "phone": "9876543210"},
            "business": {
                "businessName": "Athena Demo Contractors",
                "ownerName": "Demo Owner",
                "phone": "9876543210",
                "email": "demo@athena.local",
                "description": "Sample contractor business for product demos",
            },
            "location": {
                "country": "India",
                "state": "Tamil Nadu",
                "city": "Chennai",
                "pinCode": "600001",
                "address": "12 Demo Street, T Nagar",
            },
            "config": {
                "currency": "INR",
                "timeZone": "Asia/Kolkata",
                "gstRegistered": True,
                "gstin": "33AAAAA0000A1Z5",
                "pan": "AAAAA0000A",
            },
            "trades": ["painting", "plumbing", "electrical"],
            "team": [],
        },
    )
    return str(result["organization"]["id"])


def seed_branding(org_id: str) -> None:
    call(
        "PATCH",
        "/api/v1/organizations/current/document-branding",
        {
            "companyName": "Athena Demo Contractors",
            "companyAddress": "12 Demo Street, T Nagar\nChennai, Tamil Nadu 600001",
            "gstNumber": "33AAAAA0000A1Z5",
            "pan": "AAAAA0000A",
            "phone": "9876543210",
            "email": "demo@athena.local",
            "bankName": "HDFC Bank",
            "bankBranch": "T Nagar",
            "bankAccountHolder": "Athena Demo Contractors",
            "bankAccountNumber": "50200012345678",
            "bankIfscCode": "HDFC0001234",
            "upiId": "athenademo@hdfcbank",
            "termsConditions": "1. Quote valid for 15 days.\n2. 40% advance to start work.\n3. Balance on completion.\n4. Extra work billed via change order.",
        },
        org_id,
    )


def create_job(
    org_id: str,
    *,
    customer: dict,
    site: dict,
    survey: dict,
    measurement_inputs: dict,
    estimate_title: str,
    estimate_items: list[dict],
    scope: dict,
    quote_notes: str,
    quote_stage: str,
    project_name: str | None = None,
    invoice_amount: str | None = None,
    pay: bool = False,
) -> dict:
    cust = call("POST", "/api/v1/customers", customer, org_id)
    site_doc = call("POST", "/api/v1/sites", {**site, "customerId": cust["id"]}, org_id)
    survey_doc = call(
        "POST",
        "/api/v1/surveys",
        {**survey, "customerId": cust["id"], "siteId": site_doc["id"]},
        org_id,
    )
    measurement = call(
        "POST",
        "/api/v1/measurements",
        {
            "surveyId": survey_doc["id"],
            "siteId": site_doc["id"],
            "customerId": cust["id"],
            "formulaKind": survey.get("projectType", "painting"),
            "originalUnit": "sqft",
            "inputs": measurement_inputs,
        },
        org_id,
    )
    area = str(measurement.get("outputs", {}).get("paintableArea") or measurement_inputs.get("length", "100"))
    items = []
    for item in estimate_items:
        row = dict(item)
        if row.get("quantity") == "AUTO_AREA":
            row["quantity"] = area
        items.append(row)

    estimate = call(
        "POST",
        "/api/v1/estimates",
        {
            "customerId": cust["id"],
            "siteId": site_doc["id"],
            "surveyId": survey_doc["id"],
            "measurementId": measurement["id"],
            "title": estimate_title,
            "marginRate": "0.20",
            "items": items,
            **scope,
        },
        org_id,
    )
    quote = call(
        "POST",
        "/api/v1/quotes",
        {"estimateId": estimate["id"], "validityDays": 15, "notes": quote_notes},
        org_id,
    )

    out = {
        "customer": cust,
        "site": site_doc,
        "survey": survey_doc,
        "measurement": measurement,
        "estimate": estimate,
        "quote": quote,
        "project": None,
        "invoice": None,
        "payment": None,
    }

    if quote_stage == "draft":
        return out

    quote = call("POST", f"/api/v1/quotes/{quote['id']}/send", {}, org_id)
    out["quote"] = quote
    if quote_stage == "sent":
        return out

    quote = call("POST", f"/api/v1/quotes/{quote['id']}/accept", {"comment": "Looks good"}, org_id)
    out["quote"] = quote
    if quote_stage == "accepted":
        return out

    project = call(
        "POST",
        "/api/v1/projects/from-quote",
        {"quoteId": quote["id"], "name": project_name or estimate_title},
        org_id,
    )
    out["project"] = project

    if invoice_amount:
        invoice = call(
            "POST",
            "/api/v1/invoices",
            {
                "projectId": project["id"],
                "kind": "progress",
                "items": [{"description": "Progress / advance billing", "amount": invoice_amount}],
                "taxRate": "0.18",
                "placeOfSupply": "Tamil Nadu",
                "supplierState": "Tamil Nadu",
            },
            org_id,
            {"Idempotency-Key": idem()},
        )
        out["invoice"] = invoice
        call("POST", f"/api/v1/invoices/{invoice['id']}/send", {}, org_id)
        if pay:
            out["payment"] = call(
                "POST",
                "/api/v1/payments",
                {
                    "invoiceId": invoice["id"],
                    "amount": invoice_amount,
                    "method": "upi",
                    "reference": "DEMO-UPI-001",
                    "notes": "Customer UPI payment",
                },
                org_id,
                {"Idempotency-Key": idem()},
            )
    return out


def seed_catalog(org_id: str) -> dict:
    suppliers = [
        call(
            "POST",
            "/api/v1/suppliers",
            {
                "name": "Chennai Paints Hub",
                "company": "Chennai Paints Hub Pvt Ltd",
                "phone": "9000011111",
                "email": "sales@chennaipaints.demo",
                "address": "Guindy Industrial Estate, Chennai",
                "gstin": "33BBBBB0000B1Z5",
                "paymentTerms": "Net 15",
            },
            org_id,
        ),
        call(
            "POST",
            "/api/v1/suppliers",
            {
                "name": "Pipe & Wire Traders",
                "phone": "9000022222",
                "address": "Poonamallee High Road",
                "gstin": "33CCCCC0000C1Z5",
                "paymentTerms": "Cash on delivery",
            },
            org_id,
        ),
    ]

    materials = [
        call(
            "POST",
            "/api/v1/materials",
            {
                "name": "Premium Interior Emulsion",
                "brand": "Asian Paints",
                "category": "paint",
                "unit": "litre",
                "hsn": "320910",
                "gstRate": 0.18,
                "defaultPurchasePrice": "420",
                "defaultSellingPrice": "520",
                "minimumStock": "20",
                "reorderLevel": "40",
                "supplierId": suppliers[0]["id"],
            },
            org_id,
        ),
        call(
            "POST",
            "/api/v1/materials",
            {
                "name": "Wall Putty",
                "brand": "Birla",
                "category": "prep",
                "unit": "kg",
                "defaultPurchasePrice": "28",
                "defaultSellingPrice": "40",
                "minimumStock": "50",
                "supplierId": suppliers[0]["id"],
            },
            org_id,
        ),
        call(
            "POST",
            "/api/v1/materials",
            {
                "name": "PVC Pipe 1 inch",
                "brand": "Ashirvad",
                "category": "plumbing",
                "unit": "m",
                "defaultPurchasePrice": "65",
                "defaultSellingPrice": "90",
                "supplierId": suppliers[1]["id"],
            },
            org_id,
        ),
    ]

    workers = [
        call(
            "POST",
            "/api/v1/labour",
            {
                "name": "Ravi Kumar",
                "phone": "9887711111",
                "trade": "painting",
                "skill": "senior",
                "dailyRate": "1200",
                "overtimeRate": "200",
                "workerType": "employee",
            },
            org_id,
        ),
        call(
            "POST",
            "/api/v1/labour",
            {
                "name": "Suresh",
                "phone": "9887722222",
                "trade": "plumbing",
                "skill": "mid",
                "dailyRate": "1100",
                "workerType": "contractor",
            },
            org_id,
        ),
        call(
            "POST",
            "/api/v1/labour",
            {
                "name": "Anand",
                "phone": "9887733333",
                "trade": "electrical",
                "dailyRate": "1300",
                "workerType": "employee",
            },
            org_id,
        ),
    ]

    crew = call(
        "POST",
        "/api/v1/crews",
        {
            "name": "Painting Crew Alpha",
            "trade": "painting",
            "members": [{"labourId": workers[0]["id"], "name": workers[0]["name"]}],
            "dailyCost": "3500",
            "expectedProductivity": "400 sqft/day",
        },
        org_id,
    )

    for mat, qty in ((materials[0], "80"), (materials[1], "120"), (materials[2], "60")):
        call(
            "POST",
            "/api/v1/inventory",
            {"materialId": mat["id"], "qty": "0", "warehouse": "main"},
            org_id,
        )
        call(
            "POST",
            "/api/v1/inventory-transactions",
            {
                "materialId": mat["id"],
                "qty": qty,
                "type": "in",
                "warehouse": "main",
                "notes": "Opening stock for demo",
            },
            org_id,
        )

    vehicle = call(
        "POST",
        "/api/v1/vehicles",
        {"type": "mini_truck", "name": "Tempo 407", "registration": "TN-09-AB-1234", "driver": "Murugan"},
        org_id,
    )

    return {
        "suppliers": suppliers,
        "materials": materials,
        "workers": workers,
        "crew": crew,
        "vehicle": vehicle,
    }


def seed_project_ops(org_id: str, project_id: str, catalog: dict) -> None:
    call(
        "POST",
        "/api/v1/expenses",
        {
            "projectId": project_id,
            "category": "transport",
            "amount": "850",
            "paidBy": "cash",
            "description": "Material transport to site",
        },
        org_id,
    )
    call(
        "POST",
        "/api/v1/expenses",
        {
            "projectId": project_id,
            "category": "tea_snacks",
            "amount": "320",
            "paidBy": "cash",
            "description": "Crew tea / snacks",
        },
        org_id,
    )
    call(
        "POST",
        "/api/v1/attendance",
        {
            "projectId": project_id,
            "workerId": catalog["workers"][0]["id"],
            "status": "present",
            "overtimeHours": "2",
        },
        org_id,
    )
    call(
        "POST",
        "/api/v1/daily-reports",
        {
            "projectId": project_id,
            "workCompleted": "Completed putty and primer on living room walls",
            "progressPercent": "35",
            "weather": "Clear",
            "problems": "None",
        },
        org_id,
    )

    co = call(
        "POST",
        "/api/v1/change-orders",
        {
            "projectId": project_id,
            "reason": "Customer asked for feature wall in living room",
            "additionalScope": "Accent wall with designer paint",
            "additionalCost": "4500",
            "sellingPrice": "7500",
        },
        org_id,
    )
    call("POST", f"/api/v1/change-orders/{co['id']}/send", {}, org_id)
    call("POST", f"/api/v1/change-orders/{co['id']}/approve", {}, org_id)

    snag = call(
        "POST",
        "/api/v1/snags",
        {
            "projectId": project_id,
            "location": "Living room window",
            "description": "Touch-up required near window frame",
        },
        org_id,
    )
    call("POST", f"/api/v1/snags/{snag['id']}/assign?user_id={USER_ID}", {}, org_id)

    mr = call(
        "POST",
        "/api/v1/material-requests",
        {
            "projectId": project_id,
            "materialId": catalog["materials"][0]["id"],
            "qty": "20",
            "notes": "Need more emulsion for second coat",
        },
        org_id,
    )
    call("POST", f"/api/v1/material-requests/{mr['id']}/approve", {}, org_id)

    po = call(
        "POST",
        "/api/v1/purchase-orders",
        {
            "supplierId": catalog["suppliers"][0]["id"],
            "projectId": project_id,
            "items": [
                {
                    "materialId": catalog["materials"][0]["id"],
                    "description": catalog["materials"][0]["name"],
                    "qty": "20",
                    "rate": "420",
                    "amount": "8400",
                }
            ],
            "notes": "Urgent site delivery",
        },
        org_id,
    )
    call("POST", f"/api/v1/purchase-orders/{po['id']}/receive", {}, org_id)

    call(
        "POST",
        "/api/v1/purchases",
        {
            "supplierId": catalog["suppliers"][0]["id"],
            "projectId": project_id,
            "invoiceNumber": "SUP-7781",
            "items": [
                {
                    "materialId": catalog["materials"][1]["id"],
                    "description": "Wall Putty",
                    "qty": "40",
                    "rate": "28",
                    "amount": "1120",
                }
            ],
            "payment": "upi",
        },
        org_id,
    )

    call(
        "POST",
        "/api/v1/deliveries",
        {
            "purchaseOrderId": po["id"],
            "projectId": project_id,
            "items": [{"description": "Emulsion 20L", "qty": "20"}],
            "receivedBy": "Demo Owner",
        },
        org_id,
    )

    call(
        "POST",
        "/api/v1/inventory-transactions",
        {
            "materialId": catalog["materials"][0]["id"],
            "qty": "10",
            "type": "issue",
            "projectId": project_id,
            "notes": "Issued to site for second coat",
        },
        org_id,
    )

    call(
        "POST",
        "/api/v1/photos",
        {
            "projectId": project_id,
            "category": "progress",
            "url": "https://res.cloudinary.com/demo/image/upload/sample.jpg",
            "description": "After primer – living room",
        },
        org_id,
    )
    call(
        "POST",
        "/api/v1/documents",
        {
            "projectId": project_id,
            "category": "contract",
            "url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
            "name": "Work order – Kumar Residence.pdf",
        },
        org_id,
    )
    call(
        "POST",
        "/api/v1/project-schedules",
        {
            "projectId": project_id,
            "startDate": "2026-09-01",
            "endDate": "2026-09-20",
            "crewId": catalog["crew"]["id"],
            "progress": 35,
        },
        org_id,
    )
    call(
        "POST",
        "/api/v1/project-assignments",
        {"projectId": project_id, "userId": USER_ID, "role": "supervisor"},
        org_id,
    )
    call(
        "POST",
        "/api/v1/transport-trips",
        {
            "vehicleId": catalog["vehicle"]["id"],
            "projectId": project_id,
            "supplierId": catalog["suppliers"][0]["id"],
            "material": "Premium Interior Emulsion",
            "quantity": "20",
            "cost": "600",
            "date": "2026-09-03",
        },
        org_id,
    )
    call(
        "POST",
        "/api/v1/groups",
        {"name": "Chennai Field Team", "type": "crew", "memberIds": [USER_ID]},
        org_id,
    )


def summarize(org_id: str) -> dict:
    counts = {}
    for path in (
        "customers",
        "sites",
        "surveys",
        "measurements",
        "estimates",
        "quotes",
        "projects",
        "invoices",
        "payments",
        "materials",
        "suppliers",
        "labour",
        "crews",
        "expenses",
        "change-orders",
        "snags",
        "vehicles",
        "documents",
    ):
        try:
            items = call("GET", f"/api/v1/{path}", org_id=org_id)
            counts[path] = len(items.get("items", [])) if isinstance(items, dict) else 0
        except Exception:
            counts[path] = "?"
    return counts


def main() -> int:
    force = "--force" in sys.argv
    org_id = ensure_org()

    existing = call("GET", "/api/v1/customers", org_id=org_id)
    if existing.get("items") and not force:
        print(
            json.dumps(
                {
                    "status": "demo_data_already_present",
                    "hint": "Re-run with --force to add another full demo dataset",
                    "orgId": org_id,
                    "counts": summarize(org_id),
                    "login": "http://localhost:3003/login → Continue as demo owner",
                },
                indent=2,
            )
        )
        return 0

    seed_branding(org_id)
    catalog = seed_catalog(org_id)

    # 1) Active paid painting job (full chain)
    active = create_job(
        org_id,
        customer={
            "name": "Kumar",
            "phone": "9123456789",
            "email": "kumar@example.com",
            "address": "45 Race Course Road, Chennai",
            "gstin": "33DDDDD0000D1Z5",
            "billingAddress": "45 Race Course Road\nChennai 600018",
        },
        site={
            "name": "Kumar Residence",
            "address": "45 Race Course Road, Chennai",
            "pinCode": "600018",
            "siteType": "residential",
            "contactName": "Kumar",
            "phone": "9123456789",
        },
        survey={
            "projectType": "painting",
            "scope": "Interior emulsion two coats for living + bedrooms",
            "clientRequirements": "Washable finish, light ivory colour",
            "existingConditions": "Old distemper peeling in corners",
            "photos": ["https://res.cloudinary.com/demo/image/upload/sample.jpg"],
        },
        measurement_inputs={
            "length": 20,
            "width": 15,
            "height": 10,
            "doors": 40,
            "windows": 30,
            "coats": 2,
            "ceiling": True,
            "wastage": 0.05,
        },
        estimate_title="Interior painting – Kumar Residence",
        estimate_items=[
            {
                "description": "Interior emulsion (walls + ceiling)",
                "quantity": "AUTO_AREA",
                "unit": "sqft",
                "materialCost": "18000",
                "labourCost": "12000",
            },
            {
                "description": "Putty & primer preparation",
                "quantity": "1",
                "unit": "ls",
                "materialCost": "3500",
                "labourCost": "2500",
            },
        ],
        scope={
            "included": "Putty, primer, two coats emulsion",
            "excluded": "Wood polish, exterior walls",
            "warranty": "1 year workmanship",
            "paymentTerms": "40% advance, 60% on completion",
        },
        quote_notes="Includes scaffolding for living room.",
        quote_stage="project",
        project_name="Kumar Residence Painting",
        invoice_amount="15000",
        pay=True,
    )

    seed_project_ops(org_id, active["project"]["id"], catalog)

    # 2) Quote sent – waiting customer approval
    create_job(
        org_id,
        customer={
            "name": "Priya Sharma",
            "company": "Sharma Interiors",
            "phone": "9988776655",
            "email": "priya@sharma.demo",
            "address": "Adyar, Chennai",
        },
        site={
            "name": "Sharma Office",
            "address": "2nd Floor, Adyar Plaza",
            "pinCode": "600020",
            "siteType": "commercial",
        },
        survey={
            "projectType": "painting",
            "scope": "Office repaint – open hall and cabins",
            "clientRequirements": "Low-odour paint, weekend work only",
        },
        measurement_inputs={
            "length": 30,
            "width": 20,
            "height": 10,
            "doors": 60,
            "windows": 80,
            "coats": 2,
            "ceiling": False,
            "wastage": 0.08,
        },
        estimate_title="Office repaint – Sharma Interiors",
        estimate_items=[
            {
                "description": "Low-odour emulsion",
                "quantity": "AUTO_AREA",
                "unit": "sqft",
                "materialCost": "22000",
                "labourCost": "15000",
            }
        ],
        scope={
            "included": "Masking, primer, two coats",
            "excluded": "Furniture shifting",
            "warranty": "6 months",
            "paymentTerms": "50% advance",
        },
        quote_notes="Weekend schedule as requested.",
        quote_stage="sent",
    )

    # 3) Draft estimate/quote – still preparing
    create_job(
        org_id,
        customer={
            "name": "Arun Electricals",
            "phone": "9090909090",
            "address": "Velachery, Chennai",
        },
        site={
            "name": "Arun Showroom",
            "address": "Velachery Main Road",
            "pinCode": "600042",
            "siteType": "commercial",
        },
        survey={
            "projectType": "painting",
            "scope": "Showroom ceiling and wall refresh",
        },
        measurement_inputs={
            "length": 25,
            "width": 12,
            "height": 12,
            "doors": 20,
            "windows": 40,
            "coats": 2,
            "ceiling": True,
            "wastage": 0.05,
        },
        estimate_title="Showroom refresh – Arun Electricals",
        estimate_items=[
            {
                "description": "Ceiling + wall emulsion",
                "quantity": "AUTO_AREA",
                "unit": "sqft",
                "materialCost": "14000",
                "labourCost": "9000",
            }
        ],
        scope={
            "included": "Two coats",
            "excluded": "Signage painting",
            "warranty": "1 year",
            "paymentTerms": "30% advance",
        },
        quote_notes="Draft – awaiting final colour selection.",
        quote_stage="draft",
    )

    # Final invoice from accepted quote path (full tax invoice PDF story)
    if active["quote"]:
        try:
            call(
                "POST",
                f"/api/v1/invoices/from-quote/{active['quote']['id']}",
                {"kind": "final", "projectId": active["project"]["id"], "overrideCap": True},
                org_id,
                {"Idempotency-Key": idem()},
            )
        except RuntimeError:
            # Quote already invoiced or cap issues — ignore for demo richness
            pass

    counts = summarize(org_id)
    print(
        json.dumps(
            {
                "status": "demo_data_seeded",
                "orgId": org_id,
                "businessName": "Athena Demo Contractors",
                "login": "http://localhost:3003/login → Continue as demo owner",
                "stories": {
                    "activePaidJob": "Kumar Residence Painting (quote→project→invoice→payment + site ops)",
                    "awaitingApproval": "Priya Sharma / Sharma Office (quote sent)",
                    "draftQuote": "Arun Electricals showroom (draft)",
                },
                "counts": counts,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
