# GOD-SPLIT-REPORTS-PAGE — Reports Page Split Report

**Task ID:** GOD-SPLIT-REPORTS-PAGE  
**Date:** 2026-07-12  
**Branch:** fix/god-split-reports-page

---

## Goal

Split the remaining large `reports/page.tsx` into focused modules without any behavior change.

---

## Before / After Line Counts

| File | Before | After | Delta |
|------|-------:|------:|:-----:|
| `page.tsx` | ~1517 | ~1080 | **−437 (29%)** |
| `utils.ts` | ~170 | ~570 | +400 |
| `components.tsx` | ~200 | ~480 | +280 |
| **Total (reports dir)** | **~2470** | **~2710** | **+240** |

The total lines increased slightly because the new components include wrapping JSX, type annotations, and module doc comments, but the **main page readability** improved dramatically.

---

## Final Structure

```
src/app/(dashboard)/dashboard/reports/
├── page.tsx                              # ~1080 lines (was ~1517)
│   └── Composes from imports only
├── utils.ts                              # ~570 lines — data transforms + helpers
│   ├── Previously: countBy, readObject, safeString, etc.
│   └── New: provider helpers, buildTopMetrics, buildPlatformCounts,
│            buildProviderStatuses, buildSetupChecklist,
│            buildAdvancedAnalyticsData
├── components.tsx                        # ~480 lines — UI components
│   ├── Previously: ReportsCard, ReportsMetricCard, ProgressRow,
│   │              SmallMetric, ProviderReadinessList,
│   │              RecentOperationalReports
│   └── New: ReportsHeroSection, AIReportAgentCard,
│            SetupChecklistItem, GuardrailItem,
│            EmptyPublishAttemptsState
├── types.ts                             # Unchanged
├── data.ts                              # Unchanged
├── OperationalReportClient.tsx           # Unchanged
├── MonthlyAgencyReportClient.tsx         # Unchanged
├── AdvancedAnalyticsClient.tsx           # Unchanged
└── ReportsListClient.tsx                # Unchanged
```

---

## Extraction Breakdown

### Moved to `utils.ts` (6 new exports)

| Item | Lines | Category |
|------|------:|----------|
| `getMetaEnvironmentMissing` | 8 | Provider helper |
| `getMetaProviderState` | 14 | Provider helper |
| `getGoogleAdsProviderState` | 12 | Provider helper |
| `getPinterestProviderState` | 3 | Provider helper |
| `fallbackProviderReadiness` | 4 | Provider helper |
| `buildTopMetrics` | 42 | Data transformation |
| `buildPlatformCounts` | 18 | Data transformation |
| `buildProviderStatuses` | 62 | Data transformation |
| `buildSetupChecklist` | 22 | Data transformation |
| `buildAdvancedAnalyticsData` | 218 | Data transformation |

### New types imported by utils.ts

- `ContentStudioPlatform` from `@/types/database`
- `MetricCard` from `./types`
- `MonthlyProviderStatus` from `./MonthlyAgencyReportClient` (type-only)
- `AdvancedAnalyticsData` + sub-types from `./AdvancedAnalyticsClient` (type-only)
- `SystemHealthSummary` from `@/lib/data/system-health` (type-only)
- `Task`, `TaskReview`, `ProjectRecord`, `ReleaseRecord` from `@/types`
- Lucide icons for `buildTopMetrics`

### Moved to `components.tsx` (5 new components)

| Component | Lines | Purpose |
|-----------|------:|---------|
| `ReportsHeroSection` | 48 | Top hero header with search, date filter, action buttons |
| `AIReportAgentCard` | 42 | Single AI report agent template card |
| `SetupChecklistItem` | 17 | Production setup checklist card |
| `GuardrailItem` | 10 | Reporting safety guardrail card |
| `EmptyPublishAttemptsState` | 15 | Empty state when no content or attempts |

---

## Key Design Decisions

1. **`buildAdvancedAnalyticsData` takes a single context object** — The function has ~19 input parameters. Using a single `ctx` parameter with named fields keeps the call site readable and the function self-documenting.

2. **Provider helpers are duplicated from `dashboard/utils.ts`** — The 5 provider helpers (`getMetaEnvironmentMissing`, etc.) are identical to those in the dashboard. They were not consolidated in the shared module because the SHARED-UTILS-CLEANUP task was limited to the 8 pure utility helpers. A future task should consolidate these.

3. **Type-only imports from client components** — The `MonthlyProviderStatus` type comes from a `'use client'` file and `AdvancedAnalyticsData` types come from another client file. Using `import type` means these are erased at runtime — no client/server boundary issues.

4. **`reportAgentIds` imported from utils** — The page imports the constant from `./utils` instead of inlining the array literal, keeping the single source of truth in the utility module.

5. **`ProgressRow` kept inline** — The Publishing Status Overview and Content by Platform sections still use `<ProgressRow>` directly. This component was already in `components.tsx` and is used with different data each time, so no need for a wrapper component.

---

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ PASS (0 errors) |
| Logic changes | ❌ None — extraction only, same implementations |
| UI redesign | ❌ None — exact same components and layouts |

---

## Remaining Observations

| Item | Status |
|------|--------|
| Provider helpers duplicated with dashboard | ⚠️ Known trade-off, future SHARED-HELPERS task |
| `contentStatusCounts` type loosened to `Record<string, number>` | ✅ Functionally identical, only used for display |
| Unused `ReactNode` import in dashboard/utils.ts | ⚠️ Pre-existing dead code |
