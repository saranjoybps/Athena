# Athena — Step-by-step module test plan

Use this checklist to verify every module end-to-end.

| Item | Value |
|------|--------|
| Frontend | http://localhost:3003 |
| Backend | http://localhost:8080 |
| Swagger | http://localhost:8080/api/v1/docs |
| Demo login | http://localhost:3003/login → **Continue as demo owner** |
| Demo user | `local-owner` / `demo@athena.local` |
| Demo business | Athena Demo Contractors |

**Legend**

- ✅ UI — do it in the browser
- 🔌 API — use Swagger or curl (UI create form not built yet)
- ⬜ Shell — page exists but is a stub; open it and confirm it loads

Mark each step **Pass / Fail** as you go.

---

## 0. Prerequisites

1. API running on `:8080`, web on `:3003`.
2. If API was restarted (memory store), re-seed:

```bash
cd apps/api && .venv/bin/python scripts/seed_demo.py
```

3. Get your org id:

```bash
curl -s http://127.0.0.1:8080/api/v1/me \
  -H 'Authorization: Bearer dev:local-owner' | python3 -m json.tool
```

4. Export helpers (replace `ORG_ID`):

```bash
export API=http://127.0.0.1:8080
export AUTH='Authorization: Bearer dev:local-owner'
export ORG='X-Organization-Id: ORG_ID'
```

---

## 1. Auth & home

| # | Step | How | Expected | Result |
|---|------|-----|----------|--------|
| 1.1 | Open login | ✅ http://localhost:3003/login | Demo account card visible | ☐ |
| 1.2 | Sign in | ✅ Continue as demo owner | Redirect to `/app` | ☐ |
| 1.3 | Home dashboard | ✅ `/app` | Metrics / collections load (no error) | ☐ |
| 1.4 | Me endpoint | 🔌 `GET /api/v1/me` | `orgId`, roles `owner`, permissions `*` | ☐ |
| 1.5 | Sign out | ✅ header Sign out | Back to login | ☐ |

---

## 2. Settings (document branding)

| # | Step | How | Expected | Result |
|---|------|-----|----------|--------|
| 2.1 | Open settings | ✅ `/app/settings` | Branding form loads (GSTIN may be prefilled) | ☐ |
| 2.2 | Save branding | Set company name, bank, UPI, terms → Save | “Saved” confirmation | ☐ |
| 2.3 | Reload settings | Refresh page | Values persist (until API restart on memory) | ☐ |

---

## 3. Core job chain (happy path)

This is the main contractor flow. Create via API where UI forms are missing, then verify lists / PDFs in the UI.

### 3.1 Customer ✅

| # | Step | How | Expected | Result |
|---|------|-----|----------|--------|
| 3.1.1 | New customer | ✅ `/app/customers/new` — Name `Kumar`, Phone `9123456789` | Creates successfully | ☐ |
| 3.1.2 | List | ✅ `/app/customers` | Kumar appears | ☐ |

Save `CUSTOMER_ID` from Swagger create response if using API instead.

### 3.2 Site 🔌 then ✅ list

```bash
curl -s -X POST $API/api/v1/sites -H "$AUTH" -H "$ORG" -H 'Content-Type: application/json' \
  -d '{"customerId":"CUSTOMER_ID","name":"Kumar Residence","address":"Race Course, Chennai","pinCode":"600018"}'
```

| # | Step | Expected | Result |
|---|------|----------|--------|
| 3.2.1 | Create site (API) | Returns `id`, name Kumar Residence | ☐ |
| 3.2.2 | List UI `/app/sites` | Site appears | ☐ |

Save `SITE_ID`.

### 3.3 Survey 🔌

```bash
curl -s -X POST $API/api/v1/surveys -H "$AUTH" -H "$ORG" -H 'Content-Type: application/json' \
  -d '{"customerId":"CUSTOMER_ID","siteId":"SITE_ID","projectType":"painting","scope":"Interior emulsion two coats","photos":[]}'
```

| # | Step | Expected | Result |
|---|------|----------|--------|
| 3.3.1 | Create survey | Returns `id` | ☐ |
| 3.3.2 | List UI `/app/surveys` | Survey appears | ☐ |

Save `SURVEY_ID`.

### 3.4 Measurement 🔌

```bash
curl -s -X POST $API/api/v1/measurements -H "$AUTH" -H "$ORG" -H 'Content-Type: application/json' \
  -d '{
    "surveyId":"SURVEY_ID","siteId":"SITE_ID","customerId":"CUSTOMER_ID",
    "formulaKind":"painting","originalUnit":"sqft",
    "inputs":{"length":20,"width":15,"height":10,"doors":40,"windows":30,"coats":2,"ceiling":true,"wastage":0.05}
  }'
```

| # | Step | Expected | Result |
|---|------|----------|--------|
| 3.4.1 | Create measurement | `outputs.paintableArea` > 0 | ☐ |
| 3.4.2 | List UI `/app/measurements` | Measurement appears | ☐ |

Save `MEASUREMENT_ID` and `PAINTABLE_AREA`.

### 3.5 Estimate 🔌

```bash
curl -s -X POST $API/api/v1/estimates -H "$AUTH" -H "$ORG" -H 'Content-Type: application/json' \
  -d '{
    "customerId":"CUSTOMER_ID","siteId":"SITE_ID","surveyId":"SURVEY_ID","measurementId":"MEASUREMENT_ID",
    "title":"Interior painting","marginRate":"0.20",
    "items":[{"description":"Interior emulsion","quantity":"PAINTABLE_AREA","unit":"sqft","materialCost":"18000","labourCost":"12000"}],
    "included":"Putty, primer, two coats","excluded":"Wood polish",
    "warranty":"1 year workmanship","paymentTerms":"40% advance"
  }'
```

| # | Step | Expected | Result |
|---|------|----------|--------|
| 3.5.1 | Create estimate | `number` starts with `EST-`, `computed.grandTotal` present | ☐ |
| 3.5.2 | List UI `/app/estimates` | Estimate appears | ☐ |

Save `ESTIMATE_ID`.

### 3.6 Quote ✅ / 🔌 + PDF

```bash
curl -s -X POST $API/api/v1/quotes -H "$AUTH" -H "$ORG" -H 'Content-Type: application/json' \
  -d '{"estimateId":"ESTIMATE_ID","validityDays":15,"notes":"Demo quote"}'
```

| # | Step | How | Expected | Result |
|---|------|-----|----------|--------|
| 3.6.1 | Create quote | 🔌 | Status `draft`, number `QUO-…` | ☐ |
| 3.6.2 | Open detail | ✅ `/app/quotes` → click quote | Preview + amounts load | ☐ |
| 3.6.3 | Download PDF | ✅ Download PDF | Print dialog / Save as PDF works | ☐ |
| 3.6.4 | Send | ✅ Send | Status `sent` | ☐ |
| 3.6.5 | Accept | ✅ Accept | Status `accepted` | ☐ |

Save `QUOTE_ID`.

### 3.7 Project 🔌

```bash
curl -s -X POST $API/api/v1/projects/from-quote -H "$AUTH" -H "$ORG" -H 'Content-Type: application/json' \
  -d '{"quoteId":"QUOTE_ID","name":"Kumar Residence Painting"}'
```

| # | Step | Expected | Result |
|---|------|----------|--------|
| 3.7.1 | Create from quote | `number` starts with `PROJ-`, `contractValue` set | ☐ |
| 3.7.2 | List UI `/app/projects` | Project appears | ☐ |

Save `PROJECT_ID`.

### 3.8 Invoice ✅ / 🔌 + PDF

**Option A — from quote (UI)**  
On quote detail (status accepted) → **Create Invoice**.

**Option B — progress invoice (API)**

```bash
curl -s -X POST $API/api/v1/invoices -H "$AUTH" -H "$ORG" \
  -H 'Content-Type: application/json' -H 'Idempotency-Key: inv-demo-1' \
  -d '{"projectId":"PROJECT_ID","kind":"progress","items":[{"description":"Advance / progress","amount":"10000"}]}'
```

| # | Step | How | Expected | Result |
|---|------|-----|----------|--------|
| 3.8.1 | Create invoice | ✅ or 🔌 | `INV-…`, status `draft` | ☐ |
| 3.8.2 | Detail + PDF | ✅ `/app/invoices/[id]` | Bill To, GST split, branding show | ☐ |
| 3.8.3 | Mark sent | ✅ Mark Sent | Status `sent` | ☐ |

Save `INVOICE_ID`.

### 3.9 Payment 🔌 then ✅ list

```bash
curl -s -X POST $API/api/v1/payments -H "$AUTH" -H "$ORG" \
  -H 'Content-Type: application/json' -H 'Idempotency-Key: pay-demo-1' \
  -d '{"invoiceId":"INVOICE_ID","amount":"10000","method":"upi","reference":"UPI-DEMO-001"}'
```

| # | Step | Expected | Result |
|---|------|----------|--------|
| 3.9.1 | Create payment | Returns payment number `PAY-…` | ☐ |
| 3.9.2 | List UI `/app/payments` | Payment appears | ☐ |
| 3.9.3 | Invoice detail | Outstanding reduced / status paid or partially_paid | ☐ |

### 3.10 Profitability 🔌

```bash
curl -s $API/api/v1/reports/project-profitability/$PROJECT_ID -H "$AUTH" -H "$ORG"
```

| # | Step | Expected | Result |
|---|------|----------|--------|
| 3.10.1 | Profitability report | JSON includes `actualProfit` (or similar) | ☐ |
| 3.10.2 | Dashboard | ✅ `/app` reflects invoices / outstanding | ☐ |

---

## 4. Operations modules

### 4.1 Materials 🔌 → ✅ list

```bash
curl -s -X POST $API/api/v1/materials -H "$AUTH" -H "$ORG" -H 'Content-Type: application/json' \
  -d '{"name":"Asian Paints Emulsion","unit":"litre"}'
```

| # | Step | Expected | Result |
|---|------|----------|--------|
| 4.1.1 | Create material | Returns id | ☐ |
| 4.1.2 | `/app/materials` | Item listed (seed templates may also appear) | ☐ |

### 4.2 Suppliers 🔌 → ✅ list

```bash
curl -s -X POST $API/api/v1/suppliers -H "$AUTH" -H "$ORG" -H 'Content-Type: application/json' \
  -d '{"name":"Chennai Paints Traders","phone":"9000011111"}'
```

| # | Step | Expected | Result |
|---|------|----------|--------|
| 4.2.1 | Create supplier | Returns id | ☐ |
| 4.2.2 | `/app/suppliers` | Listed | ☐ |

Save `SUPPLIER_ID`, `MATERIAL_ID`.

### 4.3 Procurement ⬜ UI / 🔌 API

UI `/app/procurement` is a shell. Test API:

| # | Step | API | Expected | Result |
|---|------|-----|----------|--------|
| 4.3.1 | Material request | `POST /material-requests` `{projectId, materialId, qty}` | Created | ☐ |
| 4.3.2 | Approve MR | `POST /material-requests/{id}/approve` | Approved | ☐ |
| 4.3.3 | Purchase order | `POST /purchase-orders` `{supplierId, …}` | Created | ☐ |
| 4.3.4 | Receive PO | `POST /purchase-orders/{id}/receive` | Received | ☐ |
| 4.3.5 | Open shell page | ✅ `/app/procurement` | Page loads (stub OK) | ☐ |

### 4.4 Inventory ⬜ / 🔌

| # | Step | API / UI | Expected | Result |
|---|------|----------|----------|--------|
| 4.4.1 | Stock in | `POST /inventory-transactions` type `in` | Qty increases | ☐ |
| 4.4.2 | Stock summary | `GET /stock/summary` | Shows material qty | ☐ |
| 4.4.3 | Shell page | ✅ `/app/inventory` | Loads | ☐ |

### 4.5 Labour & crews

```bash
curl -s -X POST $API/api/v1/labour -H "$AUTH" -H "$ORG" -H 'Content-Type: application/json' \
  -d '{"name":"Ravi Painter","type":"employee"}'
curl -s -X POST $API/api/v1/crews -H "$AUTH" -H "$ORG" -H 'Content-Type: application/json' \
  -d '{"name":"Painting Crew A","trade":"painting"}'
```

| # | Step | Expected | Result |
|---|------|----------|--------|
| 4.5.1 | Create labour | Id returned | ☐ |
| 4.5.2 | `/app/labour` list | Appears (plus seed templates) | ☐ |
| 4.5.3 | Create crew | Id returned | ☐ |
| 4.5.4 | `/app/crews` shell | Loads | ☐ |

### 4.6 Attendance & daily reports 🔌

```bash
curl -s -X POST $API/api/v1/attendance -H "$AUTH" -H "$ORG" -H 'Content-Type: application/json' \
  -d '{"projectId":"PROJECT_ID","status":"present","overtimeHours":"0"}'
```

| # | Step | Expected | Result |
|---|------|----------|--------|
| 4.6.1 | Mark attendance | Created | ☐ |
| 4.6.2 | Daily report | `POST /daily-reports` with `projectId` | ☐ |
| 4.6.3 | `/app/attendance` shell | Loads | ☐ |

### 4.7 Expenses ✅ field + ✅ list

| # | Step | How | Expected | Result |
|---|------|-----|----------|--------|
| 4.7.1 | Field expense | ✅ `/field/expenses` — project, category, amount | Created | ☐ |
| 4.7.2 | Office list | ✅ `/app/expenses` | Expense appears | ☐ |

### 4.8 Change orders 🔌

```bash
curl -s -X POST $API/api/v1/change-orders -H "$AUTH" -H "$ORG" -H 'Content-Type: application/json' \
  -d '{"projectId":"PROJECT_ID","reason":"Extra bedroom wall","additionalCost":"5000","sellingPrice":"8000"}'
```

Then `POST /change-orders/{id}/send` → `/approve`.

| # | Step | Expected | Result |
|---|------|----------|--------|
| 4.8.1 | Create + approve CO | Selling price adds to contract / billing cap | ☐ |
| 4.8.2 | `/app/change-orders` shell | Loads | ☐ |

### 4.9 Snags 🔌

```bash
curl -s -X POST $API/api/v1/snags -H "$AUTH" -H "$ORG" -H 'Content-Type: application/json' \
  -d '{"projectId":"PROJECT_ID","description":"Touch-up near window","location":"Living room"}'
```

Then resolve → verify.

| # | Step | Expected | Result |
|---|------|----------|--------|
| 4.9.1 | Create / resolve / verify | Status transitions succeed | ☐ |
| 4.9.2 | `/app/snags` shell | Loads | ☐ |

---

## 5. Field app

| # | Step | Path | Expected | Result |
|---|------|------|----------|--------|
| 5.1 | Field home | ✅ `/field` | Shell/home loads | ☐ |
| 5.2 | Projects | ✅ `/field/projects` | Loads | ☐ |
| 5.3 | Tasks | ✅ `/field/tasks` | Loads | ☐ |
| 5.4 | Camera | ✅ `/field/camera` | Loads | ☐ |
| 5.5 | Attendance | ✅ `/field/attendance` | Loads | ☐ |
| 5.6 | Materials | ✅ `/field/materials` | Loads | ☐ |
| 5.7 | Expenses | ✅ `/field/expenses` | **Create works** (see 4.7) | ☐ |
| 5.8 | More | ✅ `/field/more` | Loads | ☐ |

Photo API (optional): `POST /api/v1/photos` with `{projectId, url}`.

---

## 6. Customer portal

| # | Step | Path | Expected | Result |
|---|------|------|----------|--------|
| 6.1 | Portal home | ✅ `/portal` | Shell loads | ☐ |
| 6.2 | Projects | ✅ `/portal/projects` | List (may be empty or show job) | ☐ |
| 6.3 | Quotes | ✅ `/portal/quotes` | List; costs redacted for customer role | ☐ |
| 6.4 | Invoices | ✅ `/portal/invoices` | List / outstanding | ☐ |

---

## 7. Supporting modules (smoke)

| # | Module | UI | API check | Result |
|---|--------|----|-----------|--------|
| 7.1 | Documents | ⬜ `/app/documents` | `POST /documents` `{url,name}` | ☐ |
| 7.2 | Photos | ⬜ `/app/photos` | `POST /photos` | ☐ |
| 7.3 | Vehicles | ⬜ `/app/vehicles` | `POST /vehicles` `{type}` | ☐ |
| 7.4 | Transport trips | — | `POST /transport-trips` `{vehicleId}` | ☐ |
| 7.5 | Users | ⬜ `/app/users` | `GET /users`, `POST /users/invite` `{email,role}` | ☐ |
| 7.6 | Groups | — | CRUD `/groups` | ☐ |
| 7.7 | Accounting | ⬜ `/app/accounting` | `GET /accounting-entries` after invoice/payment | ☐ |
| 7.8 | Schedule | ⬜ `/app/schedule` | `POST /project-schedules` `{projectId}` | ☐ |
| 7.9 | Assignments | — | `POST /project-assignments` `{projectId,userId}` | ☐ |
| 7.10 | Reports page | ⬜ `/app/reports` | Also `GET /reports/dashboard`, `/reports/gst` | ☐ |
| 7.11 | AI | ⬜ `/app/ai` | `POST /ai/draft?kind=quote&text=paint%20hall` → `requiresConfirmation: true` | ☐ |
| 7.12 | Search | — | `GET /search?q=Kumar` | ☐ |
| 7.13 | Sync | — | `POST /sync` (offline queue) | ☐ |

---

## 8. Quote / invoice PDF regression

After branding (section 2) and at least one quote + invoice:

| # | Check | Expected | Result |
|---|-------|----------|--------|
| 8.1 | Quote PDF company block | Name, GSTIN, address from settings | ☐ |
| 8.2 | Quote PDF buyer | Customer name / phone | ☐ |
| 8.3 | Quote PDF lines | Description, qty, GST %, amount | ☐ |
| 8.4 | Quote PDF bank / UPI | Shows if configured | ☐ |
| 8.5 | Invoice PDF | Label “Tax Invoice”, CGST/SGST or IGST | ☐ |
| 8.6 | Invoice from quote | Line items match quote | ☐ |
| 8.7 | Duplicate from-quote | Second call returns same invoice id | ☐ |

---

## 9. Negative / edge cases

| # | Case | How | Expected | Result |
|---|------|-----|----------|--------|
| 9.1 | Quote before accept → invoice | Create invoice from draft quote | 400 `quote_not_accepted` | ☐ |
| 9.2 | Billing cap | Invoice total > contract without override | 400 `billing_cap` | ☐ |
| 9.3 | Missing Idempotency-Key | `POST /invoices` without header | Error requiring key | ☐ |
| 9.4 | Replay Idempotency-Key | Same key twice | Same invoice returned | ☐ |
| 9.5 | Overpay invoice | Payment > outstanding | 400 payment invalid | ☐ |
| 9.6 | No auth | Call API without Bearer | 401 | ☐ |

---

## 10. Automated regression

```bash
cd apps/api
.venv/bin/pytest -q
.venv/bin/pytest tests/test_job_chain.py tests/test_billing_documents.py -q
```

| # | Suite | Expected | Result |
|---|-------|----------|--------|
| 10.1 | Full pytest | All pass | ☐ |
| 10.2 | Job chain + documents | Pass | ☐ |

---

## Quick reference — module UI status

| Module | List | Create UI | Detail / actions |
|--------|------|-----------|------------------|
| Customers | ✅ | ✅ | — |
| Sites / Surveys / Measurements / Estimates | ✅ | 🔌 | — |
| Quotes | ✅ | 🔌 | ✅ Send/Accept/Reject/PDF/Invoice |
| Projects | ✅ | 🔌 from-quote | — |
| Materials / Suppliers / Labour / Payments / Expenses | ✅ | 🔌 (expenses: field ✅) | — |
| Invoices | ✅ | ✅ from quote / 🔌 | ✅ PDF / Send |
| Settings | — | — | ✅ Branding |
| Procurement / Inventory / Attendance / CO / Snags / Reports / Docs / Photos / Vehicles / Users / Accounting / Schedule / AI / Crews | ⬜ shell | 🔌 | — |
| Field expenses | — | ✅ | — |
| Portal projects/quotes/invoices | ✅ | — | — |

---

## Suggested daily smoke (15 min)

1. Login as demo owner  
2. Create customer (UI)  
3. Run API chain: site → survey → measurement → estimate → quote  
4. Quote PDF → Send → Accept → Create Invoice → PDF  
5. Payment API → check payments list  
6. Field expense create  
7. Settings branding save  
8. `pytest tests/test_job_chain.py -q`

---

## Notes

- **Memory store:** data is lost when the API process restarts. Re-run `scripts/seed_demo.py`.
- **Firestore:** needs `firebase-service-account.json` + `ATHENA_STORE=firestore` before cloud persistence testing.
- **Idempotency:** always send unique `Idempotency-Key` on invoice and payment creates.
- Prefer Swagger at `/api/v1/docs` if you want a UI for API-only steps.
