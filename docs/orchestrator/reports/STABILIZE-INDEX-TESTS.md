# STABILIZE-INDEX-TESTS — Completion Report

**Date:** 2026-07-12  
**Branch:** `fix/stabilize-index-tests`  
**Status:** ✅ Complete  

---

## Deliverables

### 1. Composite Index Migration

**File:** `supabase/migrations/20260712000000_add_tasks_workspace_status_index.sql`

```sql
create index if not exists idx_tasks_workspace_status
  on public.tasks (workspace_id, status);
```

- Adds a composite B-tree index on `tasks(workspace_id, status)` — the pair most frequently queried together for dashboard status filtering and ops summary counts.
- Uses `IF NOT EXISTS` (no `CONCURRENTLY`) — consistent with all 40+ existing migrations in the project.
- Includes a `COMMENT ON INDEX` for discoverability.

**Why this index matters:** The existing `tasks_workspace_id_idx` and `tasks_status_idx` are separate single-column indexes. Queries filtering on both `workspace_id` AND `status` would require a bitmap-AND of two indexes or a sequential scan, both of which degrade at scale. The composite index covers this filter pattern directly.

---

### 2. Auth Brute-Force Test Fixes

Three bugs were identified and fixed in the rate-limit infrastructure that caused 3 auth brute-force tests to fail:

#### Bug 1: `peekRateLimit` bypassed `activeRateLimitStore`

**Root cause:** `peekRateLimit` and `clearRateLimitKey` directly accessed the module-level `inMemoryRateLimitStore` instead of the store set by `setRateLimitStore()`. When tests called `setRateLimitStore(new InMemoryRateLimitStore())` in `beforeEach`, `recordAuthAttempt`/`checkRateLimit` correctly used the new store, but `peekRateLimit` (used for checking) read from the old default store — so it never saw the buckets created by `recordAuthAttempt`.

**Fix:** Changed both functions to use `(activeRateLimitStore ?? inMemoryRateLimitStore)` — when a custom store is set by tests, peek/clear operations read from the correct store. In production, `activeRateLimitStore` is null until first access, so it falls back to the default module-level store.

**Files changed:**
- `src/lib/rate-limit.ts` — `peekRateLimit()` and `clearRateLimitKey()`

#### Bug 2: `checkRateLimitLockout` created buckets instead of peeking

**Root cause:** `checkRateLimitLockout` used `checkRateLimit()` which **creates/increments** rate-limit buckets. When `checkLockoutPair` called it during `checkAuthBruteForce`, the first call created a lockout bucket with `count=1, limit=1`. The second call (or subsequent `checkAuthBruteForce` call within the same test) found the bucket and returned `{ allowed: false }` — a false-positive lockout detection.

**Fix:** 
1. Added `peekRateLimitLockout()` — a read-only lockout check that delegates to `peekRateLimit()` (no bucket mutation).
2. Updated `checkLockoutPair` in `auth-brute-force.ts` to call `peekRateLimitLockout()` instead of `checkRateLimitLockout()`.
3. Updated JSDoc on `checkRateLimitLockout` clarifying it creates buckets (used only by `setRateLimitLockout` during `recordAuthFailure`).

**Files changed:**
- `src/lib/rate-limit.ts` — added `peekRateLimitLockout()`, updated JSDoc
- `src/lib/auth/auth-brute-force.ts` — `checkLockoutPair()` now uses `peekRateLimitLockout`

#### Bug 3: `clearRateLimitKey` also missed active store (same as Bug 1)

Same root cause as Bug 1 but for the clear path. Fixed with the same pattern.

---

### 3. Test Results

| Test Suite | Before | After |
|---|---|---|
| `auth-brute-force.test.ts` | 12/15 PASS (3 failures) | **15/15 PASS** ✅ |
| `rate-limit.test.ts` | 5/6 PASS (1 failure) | **6/6 PASS** ✅ |
| `tsc --noEmit` | ❌ | **PASS** ✅ |
| Full test suite | 2 pre-existing failures | **No regressions** ✅ |

The 2 remaining test failures (`user-preferences.test.ts` and `execute/route.test.ts`) are **pre-existing** and unrelated to this task — they were documented in `PROJECT_HEALTH_REPORT.md` as known debt from Wave 0/Wave 1.

---

## Files Changed

| File | Change |
|---|---|
| `supabase/migrations/20260712000000_add_tasks_workspace_status_index.sql` | **NEW** — composite index migration |
| `src/lib/rate-limit.ts` | Fix `peekRateLimit`/`clearRateLimitKey` to use active store; add `peekRateLimitLockout` |
| `src/lib/auth/auth-brute-force.ts` | Use `peekRateLimitLockout` instead of `checkRateLimitLockout` in `checkLockoutPair` |

---

## Success Criteria Met

| Criterion | Status |
|---|---|
| Index migration موجودة | ✅ `supabase/migrations/20260712000000_add_tasks_workspace_status_index.sql` |
| Brute-force tests كتمر | ✅ 15/15 PASS |
| التقرير مكتوب | ✅ This document |
