# PROVIDER-HELPERS-CONSOLIDATE — Provider Helpers Consolidation Report

**Task ID:** PROVIDER-HELPERS-CONSOLIDATE  
**Date:** 2026-07-12  
**Branch:** fix/provider-helpers-shared

---

## Goal

Eliminate remaining duplication of 5 provider helper functions between dashboard and reports.

---

## Functions Consolidated

The following 5 functions were moved from both `dashboard/utils.ts` and `reports/utils.ts` into `src/lib/dashboard-shared.ts`:

| # | Function | Lines | Returns |
|---|----------|------:|---------|
| 1 | `getMetaEnvironmentMissing` | 5 | `string[]` — missing env vars |
| 2 | `getMetaProviderState` | 12 | `ReadinessState` from connection + selection |
| 3 | `getGoogleAdsProviderState` | 9 | `ReadinessState` from config + connection |
| 4 | `getPinterestProviderState` | 3 | Always `'setup_required'` |
| 5 | `fallbackProviderReadiness` | 4 | `{ state: 'setup_required' }` |

---

## Final Structure

```
src/
├── lib/
│   └── dashboard-shared.ts          ← Now has 13 exports (was 8)
│       ├── Types: ReadinessState
│       ├── Constants: contentStatuses, readinessBadgeStatuses
│       ├── Helpers: countBy, readObject, safeString,
│       │            isVideoAsset, isManualOnlyItem, getReadinessState
│       └── Provider helpers: getMetaEnvironmentMissing,
│                             getMetaProviderState,
│                             getGoogleAdsProviderState,
│                             getPinterestProviderState,
│                             fallbackProviderReadiness
│
├── app/(dashboard)/dashboard/
│   ├── utils.ts                     ← Removed local provider helpers section
│   └── reports/utils.ts             ← Removed local provider helpers section
```

---

## Changes Made

### 1. `src/lib/dashboard-shared.ts` (+5 exports)

Added the 5 provider helper functions with identical implementations. They use the shared module's `ReadinessState` type (already defined), so no new type imports were needed.

### 2. `src/app/(dashboard)/dashboard/utils.ts`

- **Added** 5 functions to `import` + `export` blocks from `@/lib/dashboard-shared`
- **Removed** entire `Provider / Meta helpers` section (~50 lines)
- All other exports preserved unchanged

### 3. `src/app/(dashboard)/dashboard/reports/utils.ts`

- **Added** 5 functions to `import` + `export` blocks from `@/lib/dashboard-shared`
- **Removed** entire `Provider helpers (shared helpers duplicated from dashboard)` section (~50 lines)
- All other exports preserved unchanged

---

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ PASS (0 errors) |
| Logic changes | ❌ None — identical implementations |
| Consumer file changes | ❌ None — all exports preserved via re-export |

## Remaining Duplications

The `src/lib/data/system-health.ts` file has its own local copies of several utility functions (`countBy`, `readObject`, `safeString`, `getReadinessState`, `isManualOnlyItem`, `hasAssetMediaUrl`). These are outside the scope of this work order but could be consolidated in a future task.
