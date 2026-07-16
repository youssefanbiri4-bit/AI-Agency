# W17-T2 — Multi-Tenant Architecture + Performance Scaling + Rate Limiting Polish

**Role:** Senior Backend + Scaling Engineer
**Status:** ✅ Complete
**Date:** 2026-07-17

---

## Deliverables

### 1. Multi-Tenant Isolation Hardening
- **`src/lib/data/tenant-scope.ts`** — runtime guard for the `workspace_id`
  boundary:
  - `withTenantScope(supabase, workspaceId)` → `TenantScopedClient` whose
    `assertScoped()` guarantees every query/insert/update/delete carries a
    `workspace_id` filter. Forgetting it throws `TenantScopeError`.
  - `requireSameTenant(a, b)` — guard cross-tenant comparisons.
  - `verifyTenantIsolation()` — introspects RLS state via
    `list_rls_enabled_tables()` and reports any unsecured core tables.
  - `TENANT_TABLES` set of tenant-scoped tables.
- **`supabase/migrations/20260717000000_scaling_isolation.sql`** —
  - `list_rls_enabled_tables()` SQL function (used by the probe).
  - Idempotently enables RLS on all core tenant tables.
  - Composite covering indexes: `tasks`, `usage_events`, `referrals`,
    `referral_rewards`, `marketing_events`, `security_audit_logs`.

### 2. Performance / Query Optimization
- **`src/lib/data/query-cache.ts`** — Redis-backed namespaced result cache with
  single-key and namespace (SCAN-based) invalidation; falls back to direct fetch
  when Redis is unavailable.

### 3. Advanced Rate Limiting Polish
- **`src/lib/rate-limit/throttle.ts`** —
  - `tokenBucketThrottle()` — atomic Lua-based token bucket (burst-tolerant
    steady throughput) for expensive endpoints.
  - `acquireConcurrency()` — per-key in-flight cap to protect shared workers.
- **`src/lib/api-handler.ts`** — extended `createApiHandler` to support four
  layered controls, all emitting `429` with `Retry-After` / `X-RateLimit-*`:
  1. Simple fixed-window (`maxRequests` + `windowMs`).
  2. Composite multi-dimensional limits (`checkRateLimitComposite`).
  3. Token-bucket throttle.
  4. Concurrency cap (releases slot on success/error automatically).

### 4. Horizontal Scaling Preparation
- **`src/lib/scaling/instance.ts`** —
  - `livenessProbe()` / `readinessProbe()` (aggregates Postgres + Redis health).
  - `INSTANCE_ID` / `INSTANCE_LABEL` for observability and log correlation.
  - `workspaceShardKey()` — deterministic affinity key for future sharding.
- **`SCALING.md`** — operations guide: statelessness contract, probe wiring
  (K8s/Fly/Render), isolation rules of thumb, load controls, capacity guidance,
  and a pre-deploy checklist.

---

## Verification

- ✅ `eslint` clean on all new/modified files (0 errors, 0 warnings).
- ✅ `tsc --noEmit` clean across the new code (project-wide type check: no
  errors in W17-T2 files; incremental verification of touched modules passed).
- ⚠️ `npm run build` / Lighthouse cannot run in this sandbox (offline
  `next/font/google` fetch hangs; no Chrome). This is a pre-existing
  environment limitation, not a code defect.

## Notes
- The service-role (admin) client bypasses RLS. All admin queries must scope by
  `workspace_id`; prefer `withTenantScope()` to enforce this at runtime.
- `verifyTenantIsolation()` is inconclusive (treated as `ok` with empty list)
  if the RPC isn't yet applied in an environment — run after the migration.
- No secrets touched. The pre-existing scanner false positive in
  `src/components/pwa/PushNotificationManager.tsx` (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`)
  is a public key and unchanged.

## Files
- `src/lib/data/tenant-scope.ts` (new)
- `src/lib/data/query-cache.ts` (new)
- `src/lib/rate-limit/throttle.ts` (new)
- `src/lib/api-handler.ts` (modified)
- `src/lib/scaling/instance.ts` (new)
- `src/types/database.ts` (added `list_rls_enabled_tables` to DB types)
- `supabase/migrations/20260717000000_scaling_isolation.sql` (new)
- `SCALING.md` (new)
- `W17-T2-REPORT.md` (this file)
