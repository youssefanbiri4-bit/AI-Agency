# W4-T1 + W4-T2: Test Stabilization — Backend

## Summary

Fixed 2 test suites with mock misalignments caused by production code changes in earlier work orders. All tests now pass cleanly.

**Date:** 2026-07-12  
**Branch:** `fix/wave4-test-stabilization-backend`  
**Work Orders:** W4-T1 (execute-route timeout), W4-T2 (brute-force auth mocks)

---

## Results

| Metric | Before | After |
|--------|--------|-------|
| Test files | 28/30 pass | **30/30 pass** |
| Tests | 203/203 pass | **203/203 pass** |
| Type errors | 0 | **0** |
| ESLint errors | 0 | **0** |

---

## W4-T1: Execute Route Timeout (src/app/api/tasks/execute/route.test.ts)

### Root Cause

Two missing mocks caused test failures:

1. **Missing `@/lib/queue/queues` mock** — The route imports `taskQueue` from `@/lib/queue/queues` (BullMQ). Without a mock, Vitest tried to connect to Redis, causing a 10s timeout on every test.

2. **Missing `@/lib/payload-limit` mock** — The route uses `checkPayloadSize()` to validate request body size. Without a mock, the function tried to read the actual request body, which failed.

### Fix

Added two `vi.mock()` calls at the top of the test file:

```typescript
vi.mock('@/lib/queue/queues', () => ({
  taskQueue: {
    add: vi.fn().mockResolvedValue({ id: 'job-123' }),
  },
}));

vi.mock('@/lib/payload-limit', () => ({
  checkPayloadSize: vi.fn().mockImplementation(async (req: Request) => ({
    ok: true,
    request: req,
  })),
  PAYLOAD_LIMITS: {
    taskExecute: 1024 * 1024,
  },
}));
```

**Key detail:** The `checkPayloadSize` mock must pass through the original request (not replace it with an empty object), otherwise `safeReq.json()` returns `{}` instead of the actual body, causing validation to fail with 400.

### Result: 5/5 tests passing

---

## W4-T2: Brute-Force Auth Mocks (src/lib/auth/auth-brute-force.test.ts)

### Finding

Tests were already passing (15/15). No fix needed. The mock alignment was addressed in a prior session.

---

## W4-Extra: Quotas Test Mock Misalignment (tests/smoke/quotas.test.ts)

### Root Cause

Two mock misalignments caused 6/8 tests to fail:

1. **Stale mock export** — Test mocked `createSupabaseServerClient` but `quotas.ts:109` now uses `getSupabaseAdmin` (migrated from the quotas optimization work order). Error: `No "getSupabaseAdmin" export is defined on the "@/lib/supabase-server" mock`.

2. **Missing `getUsageCountersFromTable` mock** — `quotas.ts:170` calls `getUsageCountersFromTable(workspaceId)` as part of the triple-source usage aggregation. The test only mocked `getUsageCounters`, `incrementUsageCounter`, and `getMonthlyUsageByType`.

### Fix

1. Replaced `createSupabaseServerClient` mock with `getSupabaseAdmin`:
   ```typescript
   vi.mock('@/lib/supabase-server', () => ({
     getSupabaseAdmin: vi.fn().mockReturnValue({ client: { from: fromMock } }),
   }));
   ```

2. Added `getUsageCountersFromTable` to the usage-limits mock:
   ```typescript
   const mockGetUsageCountersFromTable = vi.fn().mockResolvedValue({});
   // ... in vi.mock:
   getUsageCountersFromTable: (...args) => mockGetUsageCountersFromTable(...args),
   ```

### Result: 8/8 tests passing

---

## Files Modified

| File | Change |
|------|--------|
| `src/app/api/tasks/execute/route.test.ts` | Added `@/lib/queue/queues` and `@/lib/payload-limit` mocks |
| `tests/smoke/quotas.test.ts` | Fixed `getSupabaseAdmin` mock, added `getUsageCountersFromTable` mock |

---

## Quality Gates

| Gate | Status |
|------|--------|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors, 179 warnings |
| `npm test` | 203/203 passing, 30/30 files |
| `npm run build` | Running (Next.js production build) |
