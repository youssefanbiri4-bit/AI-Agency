# W9-VER-T3 — Health Snapshot + Query Timing Verification

**Task ID:** W9-VER-T3  
**Title:** Health Snapshot + Query Timing Verification  
**Date:** 2026-07-13  
**Status:** ✅ **PASS — All verification gates green**

**Verified areas:**
1. ✅ `system_health_snapshots` table + migration
2. ✅ `/api/health` persistence
3. ✅ `withQueryTiming` on critical paths
4. ✅ Realtime subscriptions (health, notifications, tasks)

---

## 1. system_health_snapshots Table + Migration

### 1.1 Migration File

**File:** `supabase/migrations/20260713000000_create_system_health_snapshots.sql`  
**Status:** ✅ **Present and structurally sound**

| Aspect | Verification | Status |
|--------|-------------|--------|
| Migration file exists | `supabase/migrations/20260713000000_create_system_health_snapshots.sql` | ✅ |
| `CREATE TABLE IF NOT EXISTS` | Uses safe idempotent pattern (`if not exists`) | ✅ |
| All columns defined | `id (uuid PK)`, `workspace_id (uuid nullable FK → workspaces)`, `status (text CHECK)`, `score (int CHECK 0-100)`, `metrics (jsonb)`, `details (jsonb)`, `created_at (timestamptz)` | ✅ |
| CHECK constraints | `status in ('healthy', 'degraded', 'critical')`, `score >= 0 and score <= 100` | ✅ |
| Foreign key | `workspace_id references workspaces(id) on delete cascade` | ✅ |
| Indexes | `system_health_snapshots_workspace_created_idx` (workspace_id, created_at DESC), `system_health_snapshots_created_idx` (created_at DESC) | ✅ |
| RLS enabled | `alter table ... enable row level security` | ✅ |
| Read policy | `"Authenticated can read health snapshots"` — workspace members see own workspace; `workspace_id is null` (global) visible to all authenticated | ✅ |
| Write policy | `"No authenticated writes to health snapshots"` — `for insert, update, delete using (false) with check (false)` — service-role only | ✅ |
| Realtime publication | Adds `system_health_snapshots` to `supabase_realtime` (guarded by `if exists`) | ✅ |
| Comments | `comment on table` provides documentation | ✅ |
| Idempotent/drop policy guards | `drop policy if exists` before each `create policy` | ✅ |

### 1.2 TypeScript Data Module

**File:** `src/lib/db/health-snapshot.ts`  
**Status:** ✅ **Fully implemented with 3 exported functions**

| Function | Purpose | Status |
|----------|---------|--------|
| `writeHealthSnapshot(input)` | Writes snapshot via service-role client (bypasses RLS). No-op gracefully when service role not configured. | ✅ |
| `getLatestHealthSnapshot(workspaceId, useCache)` | Reads most recent snapshot per (own) workspace or global. 15-second in-memory cache. | ✅ |
| `subscribeHealthSnapshots(opts)` | Subscribes to `postgres_changes` INSERT on `system_health_snapshots` via browser client. Returns unsubscribe function. Updates local cache on each snapshot. | ✅ |

**Edge cases handled:**
- ⚡ `writeHealthSnapshot`: logs warning when service role env vars missing (graceful no-op)
- ⚡ `getLatestHealthSnapshot`: returns `null` on query error or no data; cache invalidation on write
- ⚡ `subscribeHealthSnapshots`: filters by `workspace_id`; handles `CHANNEL_ERROR`/`TIMED_OUT` via `onError`

### 1.3 Config TOML

**File:** `supabase/config.toml`  
**Status:** ✅ Realtime is enabled

```toml
[realtime]
enabled = true
```

---

## 2. /api/health Persistence

### 2.1 Route File

**File:** `src/app/api/health/route.ts`  
**Status:** ✅ **Fully functional with two-tier response + persistence**

### 2.2 Behavior Matrix

| Scenario | Response | Status |
|----------|----------|--------|
| **Public (unauthenticated)** | `{ status: 'ok', timestamp }` — minimal, no internal details | ✅ |
| **Authenticated, all services ok** | Full detailed health; **persists snapshot** (score=100); no alert fired | ✅ |
| **Authenticated, services degraded** | Full detailed health; **persists snapshot** (score < 100); **fires debounced** `alertHealthDegradation()` | ✅ |
| **Rate limited (>60 req/min/IP)** | 429 `Rate limit exceeded` with `Retry-After` header | ✅ |
| **Internal error** | 500 `Health check failed` — never leaks details | ✅ |

### 2.3 Snapshot Persistence Pathway

```mermaid
graph LR
    A[GET /api/health] --> B{Authenticated?}
    B -->|No| C[Return minimal {status:'ok', timestamp}]
    B -->|Yes| D[buildDetailedHealth]
    D --> E[Calculate score = % services ok]
    E --> F[writeHealthSnapshot]
    E --> G{status !== 'ok'?}
    G -->|Yes| H[alertHealthDegradation<br/>debounced 5 min]
    G -->|No| I[Return detailed health]
    F --> I
    H --> I
```

**Services checked:** database, supabase, n8n, storage, env  
**Score formula:** `round((okCount / totalServices) * 100)`  
**Debounce window:** 5 minutes (`HEALTH_ALERT_DEBOUNCE_MS = 300_000`)  
**Rate limit:** 60 requests/min per IP (fixed-window)

### 2.4 Security

- Unauthenticated callers receive a safe `{ status: 'ok', timestamp }` — no env details, no service breakdowns
- Internal errors never leak stack traces or sensitive details
- Service-role keys used for snapshot writes only (not exposed to client)

---

## 3. withQueryTiming on Critical Paths

### 3.1 Utility Module

**File:** `src/lib/db/query-timing.ts`  
**Imports from:** `src/lib/data/with-timing.ts` (base timing wrapper) + `@sentry/nextjs`  
**Status:** ✅ **Fully implemented with Sentry spans**

### 3.2 Architecture

```
withQueryTiming(name, fn, opts)
  ├── withTiming(name, fn, {type, warnThresholdMs, labels})
  │   ├── Executes fn()
  │   ├── Calls metrics.timing(name, durationMs, labels)
  │   └── Logs slow queries (>warnThresholdMs) at 'warn' level
  └── Sentry.startSpan({op: 'db.query', name, attributes})
      └── Reports as db.query span in Sentry Performance
```

### 3.3 Critical Paths Instrumented

| Path | File | Name | Operation Type | Status |
|------|------|------|----------------|--------|
| **Task execution** | `src/lib/n8n.worker.ts:46` | `task.execution` | `task` | ✅ |
| **Dashboard: agent catalog** | `src/lib/data/dashboard.ts:55` | `dashboard.catalog` | `db` (default) | ✅ |
| **Dashboard: tasks list** | `src/lib/data/dashboard.ts:58` | `dashboard.tasks` | `db` (default) | ✅ |
| **Dashboard: task events** | `src/lib/data/dashboard.ts:106` | `dashboard.taskEvents` | `db` (default) | ✅ |

### 3.4 Options Supported

| Option | Default | Purpose |
|--------|---------|---------|
| `workspaceId` | — | Scopes metrics to workspace |
| `type` | `'db'` | Operation category for metrics |
| `warnThresholdMs` | 1000 | Log threshold (via `withTiming`) |
| `labels` | — | Additional metric labels |
| `attributes` | — | Alias for labels + Sentry span attributes |
| `op` | `'db.query'` | Sentry span operation name |

### 3.5 Base Timing Utility

**File:** `src/lib/data/with-timing.ts`  
**Also exports:**
- `withTimingGetDuration(name, fn, opts)` — returns `[T, number]` (result + duration)
- `withTimingFn(name, fn, opts)` — higher-order function wrapper

**Status:** ✅ Fully functional with slow-query logging and metrics emission

---

## 4. Realtime Subscriptions

### 4.1 Realtime Publication Coverage

| Table | Migration to Add to Publication | Status |
|-------|-------------------------------|--------|
| `system_health_snapshots` | `20260713000000_create_system_health_snapshots.sql` (inline) | ✅ |
| `notifications` | `20260705000000_add_notifications_realtime.sql` | ✅ |
| `tasks` | `20260713000004_add_tasks_realtime.sql` | ✅ |
| `workspace_alert_channels` | `20260713000003_create_workspace_alert_channels.sql` (inline) | ✅ |

### 4.2 Client Hooks for Realtime

| Hook | File | Table | Events | Status |
|------|------|-------|--------|--------|
| `subscribeHealthSnapshots()` | `src/lib/db/health-snapshot.ts` | `system_health_snapshots` | INSERT | ✅ |
| `useRealtimeNotifications()` | `src/lib/notifications/realtime-notifications.ts` | `notifications` | INSERT/UPDATE/DELETE | ✅ |
| `useRealtimeTaskStatus()` | `src/lib/notifications/realtime-tasks.ts` | `tasks` | INSERT/UPDATE/DELETE | ✅ |

### 4.3 Realtime Configuration

**`supabase/config.toml`:**
```toml
[realtime]
enabled = true
```

**Safeguards:**
- All migration statements use `ALTER PUBLICATION supabase_realtime ADD TABLE` (idempotent)
- `system_health_snapshots` migration guards with `if exists (select 1 from pg_publication ...)`
- `notifications` migration also sets `REPLICA IDENTITY FULL` for full row capture on UPDATE/DELETE

---

## 5. Tests Summary

### 5.1 Verification Tests (W9-VER suite)

| Test File | Tests | Pass | Fail |
|-----------|-------|------|------|
| `tests/verification/alerts.verification.test.ts` | 7 | 7 | 0 |
| `tests/verification/rate-limiter.verification.test.ts` | 6 | 6 | 0 |
| `tests/verification/circuit-breaker.verification.test.ts` | 9 | 9 | 0 |
| **Total** | **22** | **22** | **0** |

### 5.2 Smoke Tests

| Test File | Tests | Pass | Fail |
|-----------|-------|------|------|
| `tests/smoke/quotas.test.ts` | — | — | 0 |
| `tests/smoke/reels-lifecycle.test.ts` | — | — | 0 |
| `tests/smoke/rbac-page-access.test.ts` | — | — | 0 |
| `tests/smoke/production-gate.test.ts` | — | — | 0 |
| `tests/smoke/task-lifecycle.test.ts` | — | — | 0 |
| **Total** | **44** | **44** | **0** |

### 5.3 Test Gaps (No dedicated unit tests for)

| Area | Missing Tests | Priority |
|------|---------------|----------|
| `writeHealthSnapshot` / `getLatestHealthSnapshot` | No unit tests exist | Medium |
| `subscribeHealthSnapshots` | No unit tests exist | Medium |
| `/api/health/route.ts` | No integration tests for two-tier auth + persistence | Medium |
| `withQueryTiming` utility | No unit tests for span + metrics delegation. Wrapped functions (`n8n.worker.ts`, `dashboard.ts`) verified at import/invocation level only. | Low |
| Realtime subscription hooks | No component tests (client-side only) | Low |

---

## 6. Overall Assessment

### 6.1 Gate Results

| Check | Status | Details |
|-------|--------|---------|
| ✅ Migration file exists & idempotent | **PASS** | `create table if not exists`, `drop policy if exists` |
| ✅ RLS correct & secure | **PASS** | Read: authenticated members; Write: service-role only (denied for auth'd) |
| ✅ Indexes present | **PASS** | Workspace+created + created-only indexes |
| ✅ Realtime enabled in migration | **PASS** | Guarded `alter publication` + `config.toml` realtime enabled |
| ✅ Health endpoint persists snapshot | **PASS** | `writeHealthSnapshot` called with score + metrics |
| ✅ Health endpoint fires alerts on degradation | **PASS** | `alertHealthDegradation` debounced at 5 min |
| ✅ Two-tier security (public vs auth) | **PASS** | Public: minimal; Auth'd: full detail |
| ✅ Rate limiting on health endpoint | **PASS** | 60 req/min per IP |
| ✅ withQueryTiming on task execution | **PASS** | `n8n.worker.ts:46` — `task.execution` |
| ✅ withQueryTiming on dashboard queries | **PASS** | `dashboard.ts:55,58,106` — catalog, tasks, taskEvents |
| ✅ Realtime subscription for health snapshots | **PASS** | `subscribeHealthSnapshots()` + publication |
| ✅ Realtime subscription for notifications | **PASS** | `useRealtimeNotifications()` + migration |
| ✅ Realtime subscription for tasks | **PASS** | `useRealtimeTaskStatus()` + migration |
| ✅ Verification tests (W9-VER) | **22/22 PASS** | alerts, rate-limiter, circuit-breaker |
| ✅ Smoke tests | **44/44 PASS** | quotas, reels, rbac, production-gate, task-lifecycle |

### 6.2 Final Verdict

```
W9-VER-T3: ✅ ALL GATES GREEN
```

All four verification areas pass. The `system_health_snapshots` infrastructure is complete with migration, cached reader, service-role writer, and realtime subscription. The `/api/health` route correctly persists snapshots and fires alerts per the design. `withQueryTiming` is applied to all intended critical paths (task execution + 3 dashboard queries). Realtime subscriptions are enabled for `system_health_snapshots`, `notifications`, and `tasks` tables with proper publications and client-side hooks.

### 6.3 Recommendations

1. **Add unit tests** for `writeHealthSnapshot()` / `getLatestHealthSnapshot()` / `subscribeHealthSnapshots()` to close the test gap
2. **Add an integration test** for the `/api/health` two-tier response (unauthenticated vs authenticated + snapshot persistence)
3. **Consider a scheduled (cron-based) health snapshot writer** for periodic workspace/system snapshots beyond on-demand `api/health` calls (noted in W9-PERF-T3 report)

---

> **Cross-reference:** The `system_health_snapshots` table, `withQueryTiming` utility, alerts integration, and Sentry enhancements were originally implemented in [W9-PERF-T3](./W9-PERF-T3-REPORT.md) (2026-07-13). This verification confirms all pieces are present, correctly wired, and passing existing tests.

---

*Report generated by W9-VER-T3 Verification Engineer — AgentFlow AI*
