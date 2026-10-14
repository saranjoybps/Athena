# Mobile app loading performance

How the Athena mobile app (Expo SDK 52, React Native 0.76, TanStack Query 5) was made to load faster, what changed, and what it gained.

## Result

On a cold start, Home data now appears in **about 24 s instead of 33–36 s**, roughly 10 s faster. The result was the same across three runs.

| Stage (seconds after tapping the app) | Before | After |
|---|---|---|
| JavaScript start to first screen | 5.6–5.9 | 2.6–3.0 |
| Home requests sent | 31.9–35.2 (after `/me`) | 23.0–23.4 (alongside `/me`) |
| **Home data on screen** | **32.6–36.1** | **23.8** |
| Development bundle | 3,204 modules, 15.2 MB | 1,687 modules, 12.3 MB |

These were measured on an Android emulator in Expo Go with a development bundle, real backend and real data. A release APK skips the bundle download and runs precompiled Hermes bytecode, so real phones load faster in absolute terms.

## Steps taken

1. **Audited the whole path:** app startup, Firebase session restore, the API client, the React Query setup, every screen's requests, and the backend's work per request.
2. **Measured before changing anything.** Each launch was timed from device logs and matched against server timings. This showed the backend answered in under 0.7 s, so most of the delay was on the phone.
3. **Fixed startup first.** It was the largest cost and affects every screen.
4. **Optimized two modules end to end,** Home and Customers, then measured again.
5. **Applied the same patterns to every other module,** including projects, sites, quotes, invoices, estimates, expenses, materials, labour, crews, delivery challans, surveys, measurements, attendance, snags, users and documents.

## Changes

### 1. Faster startup

| Change | Why it helps | File |
|---|---|---|
| Firebase starts restoring the session as soon as the app code loads, instead of after the screen tree mounts | Session restore was the main blocker, and it now overlaps with startup instead of following it | `app/_layout.tsx` |
| Cached-session boot: if the session saved on the device matches the stored Firebase user, Home opens straight away while `/me` refreshes in the background | Home's requests go out alongside `/me` instead of waiting for it | `app/_layout.tsx`, `src/lib/firebase.ts` |
| Only the icons actually used are bundled: a Babel plugin rewrites `lucide-react-native` imports to per-icon files | The bundle carried all 1,539 icons, and now carries about 20 | `babel-plugin-lucide-imports.js`, `babel.config.js` |
| `inlineRequires` is enabled, so modules load on first use instead of all at launch | Less JavaScript runs before the first screen | `metro.config.js` |
| `<Redirect>` replaces a 150 ms routing timer | Removes an artificial wait | `app/index.tsx` |
| R8 minification and resource shrinking for release builds | Smaller APK and faster class loading | `app.config.ts` |

Security is unchanged. Every API request still waits for a real Firebase token. If Firebase finds the stored user revoked, disabled or deleted, the app clears the session and cached data and returns to login.

### 2. Faster data loading on screens

| Change | Why it helps | Where |
|---|---|---|
| **Prefetch on tap:** tapping a list row starts loading that record's details before the screen opens | The detail request is already in flight during the navigation animation | All list screens, via `usePrefetchDetail()` |
| **Show cached data immediately:** detail screens display the row already loaded in the list while full details load | The header and key fields appear instantly instead of a spinner | Customers, projects, sites |
| **No duplicate requests after saving:** removed `refetch()` calls that followed mutations which already invalidate their queries | Each extra `refetch()` cancelled the first request and sent a second one | About 25 places across 15 screens |
| **No retries on deterministic errors:** 403, 404 and 422 fail once instead of retrying | Avoids a wasted round trip on every such error | `src/lib/queryClient.ts` |
| **Per-project schedules:** the project screen asks the server for that project's schedules only, instead of the 50 latest across the organization | Smaller response, and older schedules no longer go missing | `useProjectSchedules()` |
| **Shared query hooks:** both crews screens now use the shared `useCrews()` hook, and all detail queries are built from one factory | Screens share one cache entry instead of fetching the same data separately | `src/hooks/useApi.ts` |
| **Permission-gated Home requests,** with loading states shown inside the cards | No requests the user can't use, and no misleading "No data" while loading | `app/(tabs)/index.tsx`, `src/lib/permissions.ts` |
| **Cache cleared on sign-out and organization switch** | Data never leaks between accounts or tenants, and stale data isn't shown | `src/lib/auth.ts` |

### 3. Backend support (FastAPI)

- The Firebase token is verified once per request instead of twice, and the tenant record is read once instead of up to three times.
- Blocking auth and Firestore work runs off the event loop. A shared thread pool runs independent reads in parallel.
- `/me` runs its organization, entitlement and count lookups in parallel, and fetches only the fields it needs.
- `/reports/dashboard` runs its 7 reads in parallel, and `/customers/{id}/summary` runs its 10.
- Invalid or expired tokens return 401 instead of 500, so the app signs out cleanly instead of showing an error.

API response shapes are unchanged.

## Limits and next steps

- **Firebase restore** is now the largest remaining startup cost, at about 3.5 s. Moving to the native Firebase SDK would be the next big gain, but it's a larger change.
- **Lists are capped at 50 rows** by the backend, which has no paging. Adding paging, and a `project_id` filter on `/invoices`, needs an API change.
- **Release-build timing** and frame-rate checks still need a real phone. The emulator renders in software, so frame drops measured there aren't meaningful.
- After changing `babel.config.js` or `metro.config.js`, restart Metro with `npx expo start -c`.
