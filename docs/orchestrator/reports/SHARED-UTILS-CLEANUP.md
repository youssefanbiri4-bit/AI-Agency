# SHARED-UTILS-CLEANUP — Shared Utils Consolidation Report

**Task ID:** SHARED-UTILS-CLEANUP  
**Date:** 2026-07-12  
**Branch:** fix/shared-dashboard-utils

---

## Goal

Remove duplication between dashboard and reports utility files by consolidating shared pure helpers into a single module.

---

## Functions Consolidated

The following 8 items were duplicated between `src/app/(dashboard)/dashboard/utils.ts` and `src/app/(dashboard)/dashboard/reports/utils.ts`:

| # | Item | Type | Notes |
|---|------|------|-------|
| 1 | `contentStatuses` | Constant | `ContentStudioStatus[]` |
| 2 | `readinessBadgeStatuses` | Constant | Maps `ReadinessState` → `StatusBadge` status |
| 3 | `countBy` | Function | Generic array grouping utility |
| 4 | `readObject` | Function | Safe `unknown` → `Record<string, unknown>` cast |
| 5 | `safeString` | Function | Null-safe string normalization |
| 6 | `isVideoAsset` | Function | Checks asset type for video/reel video |
| 7 | `isManualOnlyItem` | Function | Checks if a Content Studio item is manual-only |
| 8 | `getReadinessState` | Function | Derives readiness from state/status/isConfigured |

## Final Structure

```
src/
├── lib/
│   └── dashboard-shared.ts          ← NEW: 8 consolidated items
│
├── app/(dashboard)/dashboard/
│   ├── page.tsx                     ← Unchanged (imports from ./utils)
│   ├── components.tsx               ← Unchanged (imports from ./utils)
│   ├── utils.ts                     ← Updated: imports + re-exports from shared
│   ├── DashboardSchedulerButton.tsx  ← Unchanged
│   └── layout.tsx                   ← Unchanged
│
│   └── reports/
│       ├── page.tsx                 ← Unchanged (imports from ./utils)
│       ├── components.tsx           ← Unchanged (imports from ./utils, gets readinessBadgeStatuses)
│       ├── utils.ts                 ← Updated: imports + re-exports from shared
│       ├── types.ts                 ← Unchanged (still has local ReadinessState)
│       ├── data.ts                  ← Unchanged
│       ├── OperationalReportClient.tsx  ← Unchanged
│       ├── MonthlyAgencyReportClient.tsx ← Unchanged
│       ├── AdvancedAnalyticsClient.tsx   ← Unchanged
│       └── ReportsListClient.tsx    ← Unchanged
```

## Changes Made

### 1. Created `src/lib/dashboard-shared.ts`

Contains all 8 consolidated items with their original implementations. Also defines and exports `ReadinessState` type used internally by `readinessBadgeStatuses` and `getReadinessState`.

### 2. Updated `src/app/(dashboard)/dashboard/utils.ts`

- **Removed** local definitions of all 8 items
- **Kept** local `ReadinessState` type, `ProviderRow`, `TodayAction`, and all dashboard-specific helpers
- **Added** `import` + `export` for the 8 items from `@/lib/dashboard-shared`
- **Removed** `ContentStudioStatus` from imports (was only used by removed `contentStatuses`)

### 3. Updated `src/app/(dashboard)/dashboard/reports/utils.ts`

- **Removed** local definitions of all 8 items
- **Kept** all reports-specific helpers (`rowString`, `safeText`, `hasAssetMediaUrl`, `sanitizeSummary`, etc.)
- **Added** `import` + `export` for the 8 items from `@/lib/dashboard-shared`
- **Removed** `StatusBadge`, `ContentStudioStatus`, and `formatDateTime` from imports (were only used by removed items or pre-existing dead code)

## Design Decisions

1. **Separate `import` + `export` instead of `export { ... } from`** — The `export { X } from` syntax does not create local bindings, so items used internally (like `readObject` and `safeString` in both util files) would cause `TS2304: Cannot find name` errors.
2. **Local `ReadinessState` kept in both utils files** — The dashboard/utils.ts and reports/types.ts each define their own `ReadinessState`. Since the shared module also needs it internally, there are now 3 copies of the same type. Consolidating types was deferred to avoid scope creep (would require updating all type consumers).
3. **No consumer files updated** — Both utils files still export the same symbols, so `page.tsx`, `components.tsx`, and other consumers don't need import changes.

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ PASS (2 pre-existing errors in `usage-limits.ts` unrelated to this change) |
| Logic changes | ❌ None — extraction only, same implementations |
| Consumer file changes | ❌ None — all exports preserved |

## Pre-existing Unrelated Errors

```
src/lib/usage/usage-limits.ts(327,18): error TS2339: Property 'quota_type' does not exist on type 'never'.
src/lib/usage/usage-limits.ts(327,49): error TS2339: Property 'count' does not exist on type 'never'.
```

## Next Steps

1. **Consolidate `ReadinessState` type** — Move the shared `ReadinessState` type from `dashboard/utils.ts` and `reports/types.ts` to `dashboard-shared.ts`, then update all consumers to import from there.
2. **Create `src/lib/dashboard/index.ts`** — If more dashboard utilities emerge, consider a directory-based module instead of a single file.
3. **Remove unused imports** — `ReactNode` in `dashboard/utils.ts` and `formatDateTime` in `reports/utils.ts` are unused after cleanup.
