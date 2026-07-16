# Scaling & Multi-Tenant Operations Guide

This document describes how AgentFlow AI is designed to run as **multiple
stateless instances behind a load balancer**, and the controls added in **W17-T2**
to harden tenant isolation and bound per-tenant load.

---

## 1. Statelessness contract

AgentFlow AI is stateless by design:

| Concern        | Where state lives            | Shared across instances? |
| -------------- | ---------------------------- | ------------------------ |
| Sessions / auth| HttpOnly cookies (Supabase)  | Yes (cookie-based)       |
| Rate limiting  | Redis                        | Yes                      |
| Query cache    | Redis (`af:cache:*`)         | Yes                      |
| Throttle       | Redis (`af:throttle:*`)      | Yes                      |
| Concurrency    | Redis (`af:concurrency:*`)   | Yes                      |
| Persistence    | Postgres (Supabase)          | Yes                      |

No in-memory per-request state is required to serve a request. This means you
can scale the web tier horizontally with zero affinity (any instance can serve
any request).

---

## 2. Readiness & liveness probes

`src/lib/scaling/instance.ts` exposes:

- `livenessProbe()` — cheap, no I/O. Returns `{ alive, instanceId, uptimeSeconds }`.
- `readinessProbe()` — aggregates dependency health (Postgres + Redis). Returns
  `ready=false` if any critical dependency is down, with per-check detail.

Wire these into a health endpoint (e.g. `GET /api/health`) and point your
orchestrator at them:

- **Kubernetes**: `livenessProbe` → `/api/health/live`, `readinessProbe` → `/api/health/ready`.
- **Fly.io / Render**: use the same endpoints for the platform health checks.

Load balancers should only route to instances where `ready === true`.

---

## 3. Instance identity

- `INSTANCE_ID` — stable id for the current process (override with `INSTANCE_ID`
  env, e.g. for log correlation).
- `INSTANCE_LABEL` — `hostname:pid` for human-readable logs.
- `workspaceShardKey(workspaceId, shardCount)` — deterministic hash in
  `[0, shardCount)`. Use for **future** data sharding or sticky routing without
  baking the sharding scheme into call sites.

---

## 4. Multi-tenant isolation (hardening)

Tenant boundary = `workspace_id`. User-facing queries are protected by Supabase
RLS (`is_workspace_member`). The **service-role (admin) client bypasses RLS**, so
isolation of admin queries depends on app code always adding
`.eq('workspace_id', ...)`.

W17-T2 added guards:

- `src/lib/data/tenant-scope.ts`
  - `withTenantScope(supabase, workspaceId)` — wraps the admin client with a
    `TenantScopedClient` whose `assertScoped()` guarantees every query/insert/
    update/delete includes a `workspace_id` filter. Callers that forget it get a
    `TenantScopeError` at runtime.
  - `requireSameTenant(a, b)` — assert two ids belong to the same workspace.
  - `verifyTenantIsolation()` — introspects RLS via the
    `list_rls_enabled_tables()` SQL function (created in migration
    `20260717000000_scaling_isolation`) to confirm core tenant tables have RLS on.
- Migration `20260717000000_scaling_isolation.sql` enables RLS on all core
  tenant tables (idempotent) and adds covering composite indexes.

**Rule of thumb:** any new admin (service-role) query MUST go through
`withTenantScope()` or explicitly `.eq('workspace_id', ...)`.

---

## 5. Load controls

### 5.1 Rate limiting (`src/lib/api-handler.ts`)

`createApiHandler` supports four layered controls:

1. **Simple fixed-window** — `maxRequests` + `windowMs` + `keyPrefix`.
2. **Composite** — multiple `RateLimitInput` buckets enforced together
   (e.g. per-IP + per-workspace + per-key) via `checkRateLimitComposite`.
3. **Token-bucket throttle** — `throttle: { key, capacity, refillPerSecond }`
   for bursty / expensive endpoints (AI generation). See
   `src/lib/rate-limit/throttle.ts`.
4. **Concurrency cap** — `concurrencyKey` + `concurrencyMax` limits in-flight
   operations per key (e.g. per workspace) to protect shared workers.

All limits emit a `429` with `Retry-After` / `X-RateLimit-*` headers and degrade
to "allow" when Redis is unavailable.

### 5.2 Query cache (`src/lib/data/query-cache.ts`)

`cachedQuery({ namespace, key, ttlSeconds }, fetcher)` caches expensive reads in
Redis and falls back to a direct fetch when Redis is down. Invalidate by single
key (`invalidateQuery`) or by namespace (`invalidateNamespace`, SCAN-based, safe
on large datasets). `getCachedOrFetch(namespace, key, fetcher, ttl)` is the
unified helper used by analytics/billing; `clearWorkspaceCaches(workspaceId)`
invalidates every cached entry embedding a workspace id after a mutation, so
dashboards never serve stale aggregates.

### 5.3 AI cost reduction (W19-T2)

- **Shared AI response cache** (`src/lib/ai/redis-ai-cache.ts`): promotes the
  in-memory AI caches to a Redis-backed L2 so identical prompts are computed
  (and billed) once across all instances. Falls back to miss when Redis is down.
- **Cost persistence** (`src/lib/usage/cost-tracking.ts`): `recordCost()` now
  inserts a `usage_costs` row; `getWorkspaceCostBreakdown()` aggregates via the
  `sum_workspace_cost()` server function (single round-trip). Table + RPC in
  migration `20260719000000_perf_optimization`.
- **AI cost budget** (`src/lib/performance/cost-budget.ts`): `checkAiCostBudget`
  caps daily AI spend per workspace with the W17-T2 token bucket; rejects before
  the model call when exhausted.

### 5.4 CDN / cache-control (W19-T2)

- `src/lib/performance/response-cache.ts` centralizes `Cache-Control` builders
  (`immutableCacheControl`, `privateSwrCacheControl`, `publicSwrCacheControl`,
  `noStoreCacheControl`).
- `next.config.ts` adds SWR headers for `/api/billing/export`,
  `/api/analytics/insights/export`, `/api/health/live`, `/api/health/ready`.

---

## 6. Capacity & scaling guidance

- **Web tier**: scale horizontally to demand; no affinity required. Use
  readiness gates to avoid routing to unhealthy instances.
- **Redis**: required for distributed rate limiting / cache / shared AI cache;
  without it, the app still works but loses cross-instance coordination
  (in-memory fallback).
- **Postgres**: the composite indexes in `20260717000000_scaling_isolation` and
  `20260719000000_perf_optimization` target the heaviest access patterns
  (`usage_events` + `tasks` + `creative_assets` by workspace). The
  `sum_workspace_cost()` RPC replaces JS-loop cost rollups. Monitor slow queries
  and add indexes as new hot paths appear.
- **Queue/workers** (BullMQ): already separate from web tier; bound per-workspace
  concurrency with the concurrency limiter to prevent one tenant from saturating
  shared workers.

---

## 7. Pre-deploy checklist

- [ ] Migrations applied (including `20260717000000_scaling_isolation`,
  `20260718000000_billing_invoices`, `20260719000000_perf_optimization`, and
  `20260720000000_backup_dr`).
- [ ] Redis provisioned and reachable; `getRedisClient()` non-null in logs.
- [ ] Run `verifyTenantIsolation()` in a smoke test — expect `ok: true`.
- [ ] Health endpoints (`/api/health/live`, `/api/health/ready`) wired to probes.
- [ ] At least 2 web instances behind the load balancer for HA.
- [ ] Shared AI cache TTL reviewed against prompt volatility.
- [ ] AI daily cost budget (`DEFAULT_DAILY_BUDGET_USD`) tuned per plan.
- [ ] Monitoring: `/api/metrics` scrape target registered (token-protected by
  `CRON_SECRET`); JSON metric logs shipped to a log drain.
- [ ] Alerting: channels configured (email + Slack + optional webhook/PagerDuty)
  and a test alert delivered to each; `ALERT_*` thresholds tuned.
- [ ] Backup: `scripts/backup-snapshot.sh` scheduled (RPO met) and
  `/api/cron/backup` watchdog alerting on missing/stale backups.
- [ ] `CRON_SECRET` set; all `/api/cron/*` routes require `Bearer $CRON_SECRET`.
- [ ] Sentry release tagged with `VERCEL_GIT_COMMIT_SHA`; graceful shutdown
  registered (redis quit, queue stop, Sentry flush) in `instrumentation.ts`.
- [ ] Full launch checklist in `INFRASTRUCTURE.md` §6 reviewed.
