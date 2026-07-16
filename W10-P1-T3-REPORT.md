# W10-P1-T3 — Advanced Health Dashboard + Cron System

**Task ID:** W10-P1-T3
**Title:** Advanced Health Dashboard + Cron System
**Role:** Senior Backend Engineer — Operations Engineer

---

## Summary

Delivered a periodic health-snapshot cron, a dedicated admin **Operations Dashboard**
(`/dashboard/ops`), and centralized **hard usage-limit enforcement**. Reused existing
platform infrastructure (health snapshots table, usage quotas, alerts) and filled the
concrete gaps rather than duplicating what already existed.

---

## Changes

### 1. Shared system-health check module (new)
`src/lib/health/system-health-check.ts`
- Extracted `buildDetailedHealth()` (database, Supabase, n8n, storage, env checks) out of
  the inline `/api/health` route so it can be reused by the cron.
- Added `computeHealthScore()`, `toSnapshotStatus()`, and `snapshotSystemHealth()` which
  runs the full check, persists a **global** (`workspace_id = null`) snapshot via the
  service role, and fires a debounced degradation alert when unhealthy (best-effort; never throws).

### 2. `/api/health` refactor
`src/app/api/health/route.ts`
- Now delegates to `snapshotSystemHealth()` from the shared module (removed duplicated logic).
- Behavior preserved: public callers get a minimal `{ status, timestamp }`; authenticated
  callers get detailed service statuses + a persisted snapshot; 503 when degraded.

### 3. Cron: periodic health snapshots (new)
`src/app/api/cron/health-snapshot/route.ts`
- `CRON_SECRET` Bearer-auth (timing-safe compare), `GET`/`POST`, `runtime = nodejs`,
  `dynamic = force-dynamic` — same hardened pattern as the existing content-studio cron.
- Calls `snapshotSystemHealth()` and returns `{ status, score, responseMs, services }`.

`vercel.json`
- Registered a new hourly cron: `/api/cron/health-snapshot` at `0 * * * *`.

### 4. Usage Limits Enforcement — Hard Limits (centralized)
`src/lib/usage/quotas.ts`
- Added `QuotaExceededError` (carries `quotaType`, `current`, `limit`, `percentUsed`).
- Added `enforceQuota(workspaceId, type, amount?)` — checks the quota and **throws**
  `QuotaExceededError` when the operation would exceed the hard limit; logs a warning.
- Refactored existing ad-hoc call sites to the shared helper:
  - `src/actions/tasks.ts` — `gatedCreateTask` (`tasks`), `gatedExecuteTask` (`ai_generations`)
  - `src/actions/creative-assets.ts` — `gatedGenerateImage` (`ai_generations`)

### 5. Operations Dashboard (new)
`src/app/(dashboard)/dashboard/ops/page.tsx` — admin-only server component:
- **Status tiles:** platform status, health score, hard-limit blocks, near-limit count.
- **Service Status:** per-service OK/error from the latest snapshot.
- **Usage Limits Enforcement:** all quotas with progress bars + Blocked / Near-limit badges.
- **Recent Health Snapshots:** last 24 platform snapshots (time, status, score, response).
- Admin gate via `getRBACContext` + `hasPermission('admin')`; denials logged to the security audit log.

### 6. Navigation + i18n
- `src/components/ui/Sidebar.tsx` — added "Operations Dashboard" under Monitoring (`Activity` icon).
- `src/components/ui/CommandPalette.tsx` — added `/dashboard/ops` entry.
- `src/i18n/locales/{en,fr,ar,es}.json` — added `nav.opsDashboard`.

### 7. Tests
`tests/smoke/task-lifecycle.test.ts`
- Updated quota mocks/assertions to the new `enforceQuota` enforcement path.

---

## Verification

- **Typecheck:** `npx tsc --noEmit` — no errors in any touched file. (Pre-existing,
  unrelated errors remain in the untracked `src/lib/circuit-breaker.ts`.)
- **Lint:** `eslint` on all touched files — 0 errors (only pre-existing CommandPalette warnings).
- **Unit tests:** `vitest run tests/smoke/quotas.test.ts tests/smoke/task-lifecycle.test.ts`
  → **15 passed**.
- **JSON:** all four locale files parse successfully.

### Manual verification steps
1. Deploy → Vercel Cron triggers `/api/cron/health-snapshot` hourly (Bearer `CRON_SECRET`).
2. `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/health-snapshot`
   → `{ success: true, data: { status, score, responseMs, services } }`.
3. Visit `/dashboard/ops` as an admin → snapshots, service status, and quota enforcement render.
4. Exceed a quota (e.g. tasks) → operation throws `QuotaExceededError` and the ops tile shows a Blocked badge.

---

## Notes
- Snapshots persist to the existing `system_health_snapshots` table (RLS: authenticated
  read of global snapshots; writes via service role only).
- Cron requires `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` to be configured; snapshot
  writes are best-effort and never break the health response.

---

## Status: ✅ Complete
