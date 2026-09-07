# Athena Mobile

Field-first Expo app for contractors. Most users will live in this APK, not the web app.

## Stack

- Expo 52 + Expo Router 4 + React Native 0.76
- TanStack Query + Zustand + Axios + NetInfo
- Dev auth: `Bearer dev:local-owner` (same as web demo)

## Run (dev)

1. API on `:8080` with demo data:

```bash
cd apps/api && .venv/bin/python scripts/seed_demo.py --force
```

2. From repo root:

```bash
pnpm install
pnpm --filter @athena/mobile start
```

> **Physical phone / APK:** `localhost` will not work. On login (or More → Settings), set API to your LAN IP, e.g. `http://192.168.2.160:8080/api/v1`.

## Build Android APK (EAS — recommended)

One-time:

```bash
cd apps/mobile
pnpm install
pnpm eas:login          # Expo account
pnpm eas:init           # creates EAS project; copies projectId into app config if prompted
```

Build installable APK:

```bash
cd apps/mobile
pnpm build:apk
```

EAS prints a download URL when the build finishes. Install on any Android device (allow unknown sources).

Production Play Store bundle:

```bash
pnpm build:aab
```

### Local APK (optional, needs Android SDK)

```bash
cd apps/mobile
pnpm prebuild:android
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

## Tabs

| Tab | Purpose |
|-----|---------|
| Home | Dashboard + on-site / office shortcuts |
| Projects | Job hub — field actions, money, details |
| Quotes | Send / accept / invoice |
| Field | Expense, attendance, snags, COs, sites, customers |
| More | Full modules + Accounts + Settings |

## Field flows

- Project → Field tab → expense / snag / change order (project prefilled)
- Site hub → surveys & measurements
- Customer CRM → pipeline + money + follow-ups
- Offline banner when network drops

## Env

See `.env.example`. Build-time `EXPO_PUBLIC_API_URL` is the default; devices can override at runtime in Settings.
