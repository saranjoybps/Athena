# Athena Mobile — Core Flow Checklist

Statuses: `PASS` | `FAIL` | `FIXING` | `FIXED`  
Last updated: 2026-09-24

| # | Flow | Status | Notes |
|---|------|--------|-------|
| 1 | Tenant scoped (X-Organization-Id) | PASS | api.ts + org onboarding gate |
| 2 | Customer create / edit / hub nav | PASS | Keep; smoke on loads |
| 3 | Site create (GPS, address, photos) | FIXED | Open-in-Maps + workflow shortcuts |
| 4 | Many surveys / measurements per site | FIXED | Removed API one-per-site for survey/measurement |
| 5 | One estimate per site | PASS | API assert_site_has_no on estimates |
| 6 | One project per site | PASS | API assert on from-quote |
| 7 | Standalone Estimates/Invoices/DC/Expenses hubs removed | FIXED | More + Home + Field cleaned |
| 8 | Stock / Photos / Documents hubs removed | FIXED | More menu |
| 9 | Estimate from measurement OR manual | FIXED | Measurement chips on new estimate |
| 10 | Estimate materials + labour cost | FIXED | catalogMaterialId persisted |
| 11 | Estimate Send top; Approve/Reject separate | FIXED | DocumentSendActions + Approve/Reject |
| 12 | Estimate PDF Cloudinary on create/edit | FIXED | ensurePdf after create/revise |
| 13 | Project Money: Received / Outstanding / Loss | FIXED | Relabeled stats |
| 14 | Expense only via project (bill-to-customer) | FIXED | Hub removed; project Money keeps Add expense |
| 15 | Invoice from estimate + expenses; edit until paid | PASS | Verify PDF template later |
| 16 | Full payment → project completed | FIXED | API auto-complete when all invoices paid |
| 17 | Crew: name + labours only (no wages) | FIXED | dailyCost removed from UI |
| 18 | Schedule: project+crew+dates; show on project | FIXED | Trimmed fields; shown on project Details |
| 19 | Attendance: project→crew→Present/Half/Leave | FIXED | Step UI + labour formula rewrite |
| 20 | Tools / Materials (no stock module) | FIXED | Stock hub removed |
| 21 | Navigation / back / loading consistency | FIXED | Loading indicators + back targets on touched screens |

## Still soft / follow-up
- Branded invoice/estimate PDF visual polish (template already branded in API)
- Delete unused route files (quotes list, stock, photos, documents, delivery-challans) when no deep links remain
- Smoke test with login on Android emulator
