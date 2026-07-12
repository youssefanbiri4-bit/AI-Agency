# God-File Split Report: `reports/page.tsx`

**Task ID:** GOD-SPLIT-REPORTS-OR-DASHBOARD  
**Date:** 2026-07-12  
**Analyzed by:** Agent 2  

---

## Target Selection

### Candidates considered

| File | Lines | Complexity |
|------|------:|-----------:|
| `src/app/(dashboard)/dashboard/page.tsx` | ~1218 | Medium — already has some extracted modules (`DashboardSchedulerButton`) |
| `src/app/(dashboard)/dashboard/reports/page.tsx` | ~1517 | High — 19 parallel data fetches, many interleaved concerns |

### Winner: `reports/page.tsx` (1517 → 1028 lines)

**Reasons:**
1. **~300 lines larger** — more impact per split
2. **Clearer separation boundaries** — types, pure utilities, data-fetching, and UI components were tightly interleaved but naturally separable
3. **Already has sibling-client pattern** — `OperationalReportClient`, `MonthlyAgencyReportClient`, `AdvancedAnalyticsClient` were already extracted, establishing the module pattern
4. **Many utility functions duplicated across dashboard + reports** — extracting them from reports sets up future sharing

---

## Chosen Structure

```
src/app/(dashboard)/dashboard/reports/
├── page.tsx                   ← Main async server component (1028 lines)
├── types.ts                   ← Type definitions (~28 lines)
├── utils.ts                   ← Pure utility functions (~313 lines)
├── data.ts                    ← Data-fetching functions (~97 lines)
├── components.tsx             ← UI components (~180 lines)
├── OperationalReportClient.tsx (unchanged)
├── MonthlyAgencyReportClient.tsx (unchanged)
├── AdvancedAnalyticsClient.tsx (unchanged)
├── ReportsListClient.tsx (unchanged)
└── loading.tsx (unchanged)
```

## Before / After Line Counts

| File | Before | After | Delta |
|------|-------:|------:|------:|
| `page.tsx` | ~1517 | 1028 | **−489 (−32%)** |
| `types.ts` | — | 28 | +28 (new) |
| `utils.ts` | — | 313 | +313 (new) |
| `data.ts` | — | 97 | +97 (new) |
| `components.tsx` | — | 180 | +180 (new) |
| **Total (all reports dir files)** | ~1760 (incl. clients) | ~1646 | — |

### What was extracted

| Module | Contents |
|--------|----------|
| **`types.ts`** | `ReadinessState`, `ProviderStatusRow`, `MetricCard`, `OptionalWorkspaceRow` |
| **`utils.ts`** | 24 pure functions: `countBy`, `readObject`, `safeString`, `safeText`, `isVideoAsset`, `hasAssetMediaUrl`, `isManualOnlyItem`, `sanitizeSummary`, `summarizeJson`, `getReadinessState`, `setupItem`, `getPercent`, `safeDashboardHref`, `formatReportAgentPrompt`, `mapAttemptTimeline`, `buildReportText`, `rowString`, `rowNullableString`, `rowNumber`, `rowBoolean`, `rowStringArray`. Constants: `readinessBadgeStatuses`, `contentStatuses`, `attemptStatuses`, `reportAgentIds` |
| **`data.ts`** | `listPublishAttempts`, `listWorkspaceTaskReviews`, `listOptionalWorkspaceRows` + `OptionalWorkspaceRowsResult` type |
| **`components.tsx`** | `ReportsCard`, `ReportsMetricCard`, `ProgressRow`, `SmallMetric`, `ProviderReadinessList`, `RecentOperationalReports` |

### What stayed in `page.tsx`

- The main `ReportsPage` async server component
- 5 local helper functions specific to the page: `getMetaEnvironmentMissing`, `getMetaProviderState`, `getGoogleAdsProviderState`, `getPinterestProviderState`, `fallbackProviderReadiness`
- 19 parallel data fetches (inlined, unchanged)
- All data processing/derivation logic
- All JSX rendering (unchanged)

---

## Design Decisions

1. **Functions specific to provider-state computation stayed local** — These 5 functions are unique to the Reports page's provider setup block and not reusable elsewhere, so they remain in `page.tsx` to avoid unnecessary abstraction.

2. **`components.tsx` imports from `utils.ts`** — The `ProgressRow` component uses `getPercent` and the `readinessBadgeStatuses` constant from `utils.ts`, avoiding duplication.

3. **No shared-utils extraction** — Although `countBy`, `readObject`, `safeString`, `isVideoAsset` etc. are duplicated in `dashboard/page.tsx`, extracting a shared `lib/reports-utils.ts` was deferred. This split stays within the reports domain.

---

## Verification

| Check | Result |
|-------|--------|
| `npm run typecheck` | ✅ PASS (exit 0) |
| `npm run build` | ✅ PASS (exit 0) |
| Business logic changes | ❌ None — extraction only, no behavior change |
| UI redesign | ❌ None — exact same components and layouts |
