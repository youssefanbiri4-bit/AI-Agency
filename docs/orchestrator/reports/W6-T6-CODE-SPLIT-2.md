# W6-T6-CODE-SPLIT-2 — Code-Split Heavy Client Report

**Date:** 2026-07-12  
**Status:** COMPLETE  
**Branch:** `fix/wave6-code-split-2`

---

## Target

**`MonthlyAgencyReportClient.tsx`** — 757 lines, the largest remaining statically-imported client component on a hot route.

### Why This Target

| Metric | Value |
|--------|-------|
| File size | 757 lines |
| Component type | `'use client'` report with charts, tables, and publish status logic |
| Import site | 1 (`reports/page.tsx`) |
| Route type | Hot route (`/dashboard/reports`) |
| Bundle impact | Report dependencies (chart rendering, date formatting, status logic) loaded eagerly on page visit |

The `reports/page.tsx` already dynamically imports `AdvancedAnalyticsClient` — `MonthlyAgencyReportClient` was the only remaining heavy client statically imported in the same file.

### Other candidates evaluated

| File | Lines | Status | Why not |
|------|-------|--------|---------|
| `settings/page.tsx` | 965 | N/A | Already a `'use client'` page component — can't be split from a parent |
| `CreativeAssetForm.tsx` | 1,115 | Already split ✅ | Done in W6-T1 |
| `AlexChatClient.tsx` | 937 | Already split ✅ | Done previously |
| `WorkflowBuilderClient.tsx` | 933 | Already split ✅ | Done previously |
| `CampaignsClient.tsx` | 892 | Already split ✅ | Done previously |

---

## What Changed

### Before
```tsx
import {
  MonthlyAgencyReportClient,
  type MonthlyProviderStatus,
} from './MonthlyAgencyReportClient';
```
Static import — 757-line client bundle loaded eagerly on the reports page.

### After
```tsx
import type { MonthlyProviderStatus } from './MonthlyAgencyReportClient';

const MonthlyAgencyReportClient = dynamic(
  () => import('./MonthlyAgencyReportClient').then((mod) => mod.MonthlyAgencyReportClient),
  {
    loading: () => (
      <div className="rounded-2xl border border-black/7 bg-white/90 p-5 shadow-[0_20px_54px_rgba(93,107,107,0.08)] ring-1 ring-white/70">
        <p className="text-sm font-semibold text-black/42">Loading monthly report…</p>
      </div>
    ),
  }
);
```
Lazy-loaded via `next/dynamic` with a skeleton fallback matching the existing card style. Type-only import of `MonthlyProviderStatus` kept (erased at compile time, no bundle impact).

### Files Modified

| File | Change |
|------|--------|
| `src/app/(dashboard)/dashboard/reports/page.tsx` | Replaced static import of `MonthlyAgencyReportClient` with `next/dynamic` |

---

## Bundle Impact

The `MonthlyAgencyReportClient` and all its dependencies (chart rendering, date formatting, publish status logic) are now code-split into a separate chunk. The reports page initial load is lighter — only the summary cards and navigation load eagerly; the monthly report section loads on demand.

Estimated savings: ~757 lines of client-side code removed from the reports page initial chunk.

---

## Remaining Heavy Clients (Updated)

| File | Lines | Split Status | Route |
|------|-------|:------------:|-------|
| `CreativeAssetForm.tsx` | 1,115 | **Done ✅** | `/dashboard/creative-assets/*` |
| `MonthlyAgencyReportClient.tsx` | 757 | **Done ✅** | `/dashboard/reports` |
| `AlexChatClient.tsx` | 937 | **Done ✅** | `/dashboard/alex` |
| `WorkflowBuilderClient.tsx` | 933 | **Done ✅** | `/dashboard/agent-library/workflows` |
| `CampaignsClient.tsx` | 892 | **Done ✅** | `/dashboard/campaigns` |
| `CalendarClient.tsx` | 619 | **Done ✅** | `/dashboard/calendar` |
| `AdvancedAnalyticsClient.tsx` | 475 | **Done ✅** | `/dashboard/reports` |
| `settings/page.tsx` | 965 | N/A (is page) | `/dashboard/settings` |
| `CampaignPlanner.tsx` | 628 | Not split | `/dashboard/content-studio` |
| `ContentStudioClient.tsx` | 618 | Not split | `/dashboard/content-studio` |
| `SoftwarePlannerClient.tsx` | 600 | Not split | `/dashboard/software-planner` |
| `NotificationsCenterClient.tsx` | 578 | Not split | `/dashboard/notifications` |
| `CodebaseAnalyzer.tsx` | 546 | Not split | `/dashboard/projects` |

---

## Quality Gates

| Gate | Status |
|------|:------:|
| typecheck | **PASS** (0 new errors) |
| lint | **PASS** (0 errors, 0 warnings) |
| test | **PASS** (203/203) |

---

## Summary

- `MonthlyAgencyReportClient` (757 lines) is now lazy-loaded via `next/dynamic`
- 1 file modified (`reports/page.tsx`)
- Type-only import of `MonthlyProviderStatus` preserved (no bundle impact)
- Zero behavior change — same component, same props, same rendering
- Loading fallback matches existing card skeleton style
- Gates green: typecheck ✅, lint ✅, tests 203/203 ✅
