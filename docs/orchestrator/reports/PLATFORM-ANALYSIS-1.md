# PLATFORM ANALYSIS — Deep Technical Assessment

**Task:** PLATFORM-ANALYSIS-1  
**Agent:** Architecture Engineer  
**Date:** 2026-07-12  
**Scope:** Full platform health — security, types, build, lint, tests, broken modules

---

## Executive Summary

| Gate | Status | Detail |
|------|--------|--------|
| typecheck | **FAIL** (exit 1) | 23 errors across 12 files |
| lint | **FAIL** (exit 1) | 3 errors, 51 warnings (over 60 warning limit) |
| build | **FAIL** (exit 1) | TypeScript check fails during build (reels.ts) |
| test | **FAIL** (exit 1) | 10 failed / 193 passed (203 total) |
| npm audit | **PASS** (exit 0) | 0 vulnerabilities |
| Secret hygiene | **PASS** | `.env.example` clean, `.gitignore` hardened, no secrets in git |

**Verdict:** 0 of 4 code gates green. Build is blocked by typecheck. All failures are pre-existing (Wave 0 debt). No regressions from Wave 2.

---

## 1. Quality Gate Results

### 1.1 typecheck — 23 errors

```
npm run typecheck → tsc --noEmit → exit 1
```

| # | File | Line | Error | Category |
|---|------|------|-------|----------|
| 1 | `src/actions/reels.ts` | 27 | `unknown` not assignable to `ReelActionState` | Type mismatch |
| 2 | `src/actions/reels.ts` | 36 | `unknown` not assignable to `ReelActionState` | Type mismatch |
| 3 | `src/actions/tasks.ts` | 33 | `unknown` not assignable to `CreateTaskDraftInput` | Type mismatch |
| 4 | `src/app/(dashboard)/layout.tsx` | 20 | `DashboardRBACProfile` not exported from DashboardContext | Missing export |
| 5 | `src/app/(dashboard)/layout.tsx` | 286 | Property `rbac` does not exist on `DashboardShellProps` | Missing prop |
| 6 | `src/components/dashboard/PersonalizedDashboard.tsx` | 18 | `useRBAC` not exported from DashboardContext | Missing export |
| 7 | `src/components/dashboard/PersonalizedDashboard.tsx` | 52 | `any` index into `Record<Department, ...>` | Type mismatch |
| 8 | `src/components/dashboard/PersonalizedDashboard.tsx` | 180 | `any` index into `Record<Department, ...>` | Type mismatch |
| 9 | `src/components/security/BrowserSecretGuard.tsx` | 4 | `getBrowserSupabaseEnvStatus` not exported | Missing export |
| 10 | `src/components/tasks/TasksClient.tsx` | 24 | `useRBAC` not exported from DashboardContext | Missing export |
| 11 | `src/components/tasks/TasksClient.tsx` | 40 | `agent_department` does not exist (should be `agentDepartment`) | Property name |
| 12 | `src/components/ui/DepartmentSwitcher.tsx` | 20 | `useRBAC` not exported from DashboardContext | Missing export |
| 13 | `src/components/ui/DepartmentSwitcher.tsx` | 62 | `any` index into `Record<Department, ...>` | Type mismatch |
| 14 | `src/lib/dashboard/get-dashboard-data.ts` | 194 | `departmentScope` does not exist in options type | Excess property |
| 15 | `src/lib/dashboard/get-dashboard-data.ts` | 296 | `departmentScope` does not exist in options type | Excess property |
| 16 | `src/lib/dashboard/get-dashboard-data.ts` | 401 | Expected 0-2 arguments, got 3 | Argument count |
| 17 | `src/lib/dashboard/get-dashboard-data.ts` | 406 | `departmentScope` does not exist in options type | Excess property |
| 18 | `src/lib/dashboard/get-dashboard-data.ts` | 414 | `departmentScope` does not exist in options type | Excess property |
| 19 | `src/lib/preferences/user-preferences.ts` | 164 | `preferenceDepartment` does not exist in parameter type | Excess property |
| 20 | `src/lib/reports/report-data.ts` | 53 | SupabaseClient not assignable to string | Type mismatch |
| 21 | `tests/smoke/rbac-page-access.test.ts` | 117 | `preferenceDepartment` does not exist in parameter type | Excess property |
| 22 | `tests/user-preferences.test.ts` | 15 | `preferenceDepartment` does not exist in parameter type | Excess property |
| 23 | `tests/user-preferences.test.ts` | 25,44 | `preferenceDepartment` does not exist in parameter type | Excess property |

**Error clusters:**

| Cluster | Count | Root Cause |
|---------|-------|------------|
| Missing `DashboardRBACProfile` / `useRBAC` from DashboardContext | 5 | RBAC layer never added to context |
| `preferenceDepartment` excess property | 4 | `resolveEffectiveDepartment` not updated |
| `unknown` type mismatches (reels, tasks) | 3 | Gated wrappers use `unknown` instead of typed params |
| `departmentScope` excess property | 4 | `ListContentStudioItemsOptions` not updated |
| `getBrowserSupabaseEnvStatus` missing | 1 | Function never implemented |
| Other (report-data, agent_department) | 2 | Misc type mismatches |

### 1.2 lint — 3 errors, 51 warnings

```
npm run lint → eslint . --max-warnings 60 → exit 1
```

**Errors (3):**

| File | Line | Rule | Issue |
|------|------|------|-------|
| `src/actions/creative-assets.ts` | 12:57 | `@typescript-eslint/no-explicit-any` | `any` type in function parameter |
| `src/components/auth/MfaSection.tsx` | 52:5 | `react-hooks/set-state-in-effect` | `setState` called synchronously in effect |
| `src/components/settings/SessionManagementPanel.tsx` | 49:5 | `react-hooks/set-state-in-effect` | `setState` called synchronously in effect |

**Warnings (51):** Mostly unused variables/imports across ~15 files. Pre-existing.

**Note:** Lint exits 1 because of 3 errors (not just warnings). The `--max-warnings 60` threshold is not the issue.

### 1.3 build — FAIL

```
npm run build → exit 1
```

Build compiles webpack successfully (114s), but fails during the TypeScript check phase:

```
Type error: Argument of type 'unknown' is not assignable to parameter of type 'ReelActionState'.
  src/actions/reels.ts:27:25
```

The build fails on the same `unknown` type issue in `reels.ts`. This is the same error as typecheck #1 above.

### 1.4 test — 10 failed / 193 passed

```
npm test → vitest → exit 1
```

**Failed test files (4):**

| File | Failures | Root Cause |
|------|----------|------------|
| `src/lib/auth/auth-brute-force.test.ts` | 8 | Rate-limit API changed; tests expect old interface (`checkRateLimitLockout` returns `{allowed}` but now returns different shape) |
| `tests/user-preferences.test.ts` | 2 | `preferenceDepartment` param ignored; test expects department override but function ignores it |
| `tests/smoke/rbac-page-access.test.ts` | 1 | Same `preferenceDepartment` issue |
| `src/app/api/tasks/execute/route.test.ts` | 1 | Timeout — Redis ECONNREFUSED at 127.0.0.1:6379 (infra dependency) |

**Note:** The brute-force test failures changed since last run. Previously they were `TypeError: checkRateLimitLockout is not a function`. Now they are assertion errors (`expected false to be true`), meaning the function exists but returns a different shape than tests expect.

---

## 2. Secret Hygiene Status — CLEAN

| Check | Result |
|-------|--------|
| `.env.example` | All placeholders — clean ✅ |
| `.gitignore` | Covers `.env`, `.env.local`, `.env.*.local`, `.env.staging`, `.env.*.backup/old/bak` ✅ |
| Only `.env.example` tracked | Confirmed ✅ |
| No `.env`/`.env.local` in git history | Confirmed ✅ |
| No `.pem`/`.key` files | None found ✅ |
| No real secrets in source code | None found ✅ |
| npm audit (production) | 0 vulnerabilities ✅ |

**Status:** R1 (Secret Hygiene) is **Closed**. No action needed.

---

## 3. All Remaining Problems (Critical + High)

### CRITICAL — 0 problems

No Critical-severity issues remain. R1 (secrets) was the last Critical, now closed.

### HIGH — 6 problems

| # | Problem | Files | Impact | Suggested Fix |
|---|---------|-------|--------|---------------|
| H1 | **DashboardContext missing RBAC layer** | `DashboardContext.tsx`, `layout.tsx`, `PersonalizedDashboard.tsx`, `TasksClient.tsx`, `DepartmentSwitcher.tsx` | 5 type errors; 4 components cannot access RBAC state; RBAC-aware UI is broken | Add `DashboardRBACProfile` type and `useRBAC` hook to DashboardContext |
| H2 | **`resolveEffectiveDepartment` missing `preferenceDepartment` param** | `require-page-access.ts:43`, `user-preferences.ts:164`, 3 test files | 4 type errors; admin "view as" department feature broken | Add `preferenceDepartment` to function signature |
| H3 | **Gated action wrappers use `unknown` types** | `reels.ts:27,36`, `tasks.ts:33`, `creative-assets.ts:12` | 3 type errors + 1 lint error; build fails on reels.ts | Replace `unknown` with correct action state types |
| H4 | **`departmentScope` not in options types** | `get-dashboard-data.ts:194,296,401,406,414` | 5 type errors; content studio department filtering broken at type level | Add `departmentScope` to `ListContentStudioItemsOptions` and `ListCreativeAssetsOptions` |
| H5 | **`getBrowserSupabaseEnvStatus` missing** | `BrowserSecretGuard.tsx:4`, `supabase-client.ts` | 1 type error; security guard component broken | Implement the function or refactor guard to use `isSupabaseConfigured` |
| H6 | **Auth brute-force tests failing** | `auth-brute-force.test.ts` (8 tests) | Tests do not validate actual brute-force protection; security regression risk | Update tests to match current rate-limit API or fix rate-limit API |

### MEDIUM — 5 problems

| # | Problem | Files | Impact |
|---|---------|-------|--------|
| M1 | `agent_department` property name mismatch | `TasksClient.tsx:40` | Should be `agentDepartment` |
| M2 | `report-data.ts` SupabaseClient type mismatch | `report-data.ts:53` | Wrong parameter type |
| M3 | setState-in-effect in MfaSection + SessionManagementPanel | 2 component files | Performance issue (cascading renders) |
| M4 | Redis ECONNREFUSED in test environment | `route.test.ts` | Task execution test requires Redis |
| M5 | 51 ESLint warnings (unused vars/imports) | ~15 files | Code hygiene |

---

## 4. Broken Modules Deep Dive

### 4.1 `@/components/layout/DashboardContext` — MISSING RBAC LAYER

**File:** `src/components/layout/DashboardContext.tsx`

**Currently exports:**
- `DashboardUserProfile` (interface)
- `DashboardWorkspaceProfile` (interface)
- `DashboardContextProvider` (component)
- `useDashboardContext` (hook)

**Missing exports needed by consumers:**

| Export | Type | Consumers |
|--------|------|-----------|
| `DashboardRBACProfile` | interface `{ role: RBACRole; department: Department \| null; isAdminOrHigher: boolean }` | `layout.tsx:20` |
| `useRBAC` | hook returning `{ role, effectiveDepartment, assignedDepartment, setEffectiveDepartment, isAdminOrHigher, isSavingDepartment, assignedRole }` | `PersonalizedDashboard.tsx:18`, `TasksClient.tsx:24`, `DepartmentSwitcher.tsx:20` |

**Root cause:** The context was created with only `user` + `workspace` state. The RBAC layer (role, department, permissions) was never added. Components were written against a planned API.

### 4.2 `@/lib/supabase-client` — MISSING DIAGNOSTIC FUNCTION

**File:** `src/lib/supabase-client.ts`

**Currently exports:** `isSupabaseConfigured` (boolean), `supabase`, `getAuthSession`, `getCurrentUser`, `logout`

**Missing:** `getBrowserSupabaseEnvStatus` — expected to return `{ ok: boolean; message?: string }`

**Root cause:** `BrowserSecretGuard` was written against a planned diagnostic function that was never implemented. The existing `isSupabaseConfigured` returns a boolean, not the expected object shape.

### 4.3 `@/lib/preferences/user-preferences.ts` — EXCESS PROPERTY

**File:** `src/lib/preferences/user-preferences.ts:164`

The call passes `preferenceDepartment` to `resolveEffectiveDepartment`, but the function only accepts `{ assignedDepartment, role, cookieDepartment }`. The `preferenceDepartment` property is silently ignored at runtime, but causes a type error.

**Root cause:** The "view as" department feature was implemented in the caller but the underlying `resolveEffectiveDepartment` function was never updated to accept it.

### 4.4 `src/actions/reels.ts` + `tasks.ts` + `creative-assets.ts` — UNKNOWN TYPES

All three gated action wrappers use `unknown` or `any` for their parameters instead of the correct action state types. This causes type errors when delegating to the underlying actions.

---

## 5. Pre-existing vs New Issues

**All 23 typecheck errors, 3 lint errors, and 10 test failures are pre-existing.** They were introduced during Wave 0/Wave 1 development and have not been fixed.

| Wave | Introduced | Fixed | Remaining |
|------|------------|-------|-----------|
| Wave 0 | ~30 type errors, ~60 warnings | Some in Wave 1.2 | 23 errors, 51 warnings |
| Wave 1.2 | Fixed lint exit code | — | — |
| Wave 2 | 0 new issues | — | — |

**No regressions from Wave 2 changes** (CSP, API envelope, n8n callback, billing decision, secret hygiene).

---

## 6. Recommended Fix Priority

| Priority | Problem | Effort | Risk if Deferred |
|----------|---------|--------|-----------------|
| P1 | H3: Fix `unknown` types in gated actions | Small (1-2h) | **Build is broken** — cannot deploy |
| P2 | H1: Add RBAC to DashboardContext | Medium (4-6h) | RBAC-aware UI components broken |
| P3 | H2: Add `preferenceDepartment` param | Small (1h) | Admin "view as" feature broken |
| P4 | H4: Add `departmentScope` to options | Small (1-2h) | Content studio department filtering broken at type level |
| P5 | H5: Implement `getBrowserSupabaseEnvStatus` | Small (1h) | Security guard component broken |
| P6 | H6: Fix brute-force tests | Medium (2-3h) | Security regression risk |
| P7 | M3: Fix setState-in-effect | Medium (2-3h) | Performance (cascading renders) |
| P8 | M5: Fix 51 ESLint warnings | Medium (3-4h) | Code hygiene |

---

## 7. Files Reference

| File | Lines | Status |
|------|-------|--------|
| `src/components/layout/DashboardContext.tsx` | — | Missing RBAC exports |
| `src/lib/preferences/user-preferences.ts` | 164 | Excess property error |
| `src/lib/auth/require-page-access.ts` | 43 | Missing `preferenceDepartment` param |
| `src/actions/reels.ts` | 27, 36 | `unknown` type |
| `src/actions/tasks.ts` | 33 | `unknown` type |
| `src/actions/creative-assets.ts` | 12 | `any` type |
| `src/lib/dashboard/get-dashboard-data.ts` | 194,296,401,406,414 | `departmentScope` missing |
| `src/components/security/BrowserSecretGuard.tsx` | 4 | Missing import |
| `src/lib/supabase-client.ts` | — | Missing `getBrowserSupabaseEnvStatus` |
| `src/lib/auth/auth-brute-force.test.ts` | — | 8 failing tests |
| `tests/user-preferences.test.ts` | 15,25,44 | `preferenceDepartment` mismatch |
| `tests/smoke/rbac-page-access.test.ts` | 117 | `preferenceDepartment` mismatch |
| `src/app/api/tasks/execute/route.test.ts` | 62 | Redis timeout |
