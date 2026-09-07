# Athena

Operating system for Indian contractors and handyman businesses.

**Measure → Calculate → Quote → Plan → Allocate → Procure → Execute → Track → Bill → Collect → Complete → Know Your Profit**

This is a construction operations platform, not a CRM.

## Stack

- Frontend: Next.js (PWA) on Vercel
- Backend: FastAPI on Cloud Run
- Auth: Firebase Authentication
- Data: Cloud Firestore
- Media: Cloudinary

## Local development

```bash
# API
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8080

# Web
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

Set `ATHENA_STORE=memory` and `ATHENA_AUTH=dev` to run the API without Firebase/GCP. Dev tokens look like `Authorization: Bearer dev:<userId>`.

## Tests

```bash
cd apps/api && .venv/bin/pytest -q
pnpm --filter @athena/web lint
```

## Demo flow

1. Open http://localhost:3000/onboarding — create a tenant (painting templates auto-provision)
2. Sign in at http://localhost:3000/login — demo owner
3. Use the app: Customers → Sites → Surveys → Measurements → Estimates → Quotes → Projects → Billing

### Mobile (Expo)

```bash
pnpm --filter @athena/mobile start
```

Demo login uses the same `local-owner` seed. See `apps/mobile/README.md`.

API tests cover the full operational chain including procurement, inventory, snags, change orders, sync, and portal.


## Environments

Development, staging, and production are configured via environment variables. Secrets never belong in git.
