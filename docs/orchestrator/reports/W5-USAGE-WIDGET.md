# W5 — Usage & Limits Widget

**Task:** W5-USAGE-WIDGET  
**Branch:** feature/wave5-usage-widget  
**Status:** ✅ Complete

---

## What Is Shown

A compact **UsageWidget** card on the main dashboard showing:

- **Plan label** — e.g. "Internal Free Tier", "Starter", "Pro", or "Agency"
- **4 key quotas** with colored progress bars:
  - AI Generations
  - Tasks
  - Creative Assets
  - Content Publishes
- Each quota shows:
  - Label + current / limit count
  - Colored progress bar (green / amber / red)
  - Percentage text with matching color
  - "Unlimited" when no limit applies
- **"View Details" link** → `/dashboard/usage` (full Usage & Limits page)

### Color thresholds

| Usage | Color |
|-------|-------|
| < 70% | `bg-emerald-500` |
| 70–89% | `bg-amber-500` |
| ≥ 90% | `bg-red-500` |

---

## Where It Sits on the Dashboard

The widget is placed **after "Today's Priorities"** and **before "System Health Snapshot"**, as a standalone `CommandCard` section. This puts resource health front-and-centre without disrupting the existing layout.

### Position order (numbered)

1. HeroSection
2. Today's Priorities (stat grid)
3. **Usage & Limits** ← new
4. System Health Snapshot
5. Work Shortcuts
6. Projects Snapshot
7. Releases Snapshot
8. (two-column) Today's Actions + Provider Setup Snapshot
9. Content & Campaign Snapshot
10. (two-column) Recent Activity + Manager Shortcuts

---

## Implementation Details

### Files changed

| File | Change |
|------|--------|
| `src/lib/usage/quotas.ts` | Exported `getUsageLimits()` (was internal) |
| `src/app/(dashboard)/dashboard/utils.ts` | Added `UsageWidgetItem`, `UsageWidgetData` types + `getUsageWidgetData()` fetcher |
| `src/app/(dashboard)/dashboard/components.tsx` | Added `UsageWidget` component |
| `src/app/(dashboard)/dashboard/page.tsx` | Integrated data fetch in `Promise.allSettled` batch + rendered widget |

### Data flow

1. `getUsageWidgetData(workspaceId)` calls `getCurrentUsage()` + `getUsageLimits()` in parallel
2. Maps 4 key types into `UsageWidgetItem[]` with computed `percent`
3. Dashboard's `Promise.allSettled` batch includes the fetch with standard timeout (3.5s)
4. Result passed as prop to `<UsageWidget>`

### Resilience

- Follows same timeout / fallback pattern as all other dashboard sections
- Fails gracefully: if the DB is slow, shows fallback with "Internal Free Tier" + empty quotas
- Uses the same `settledDataResult` / `dashboardFallbackResult` helpers

### Reuse

- Uses existing `getCurrentUsage()` and `getUsageLimits()` from `@/lib/usage/quotas`
- Uses existing `CommandCard` wrapper and `buttonStyles` for consistent look
- No new API endpoints, no new DB queries beyond what the usage page already uses

---

## Screenshots Description

The widget is a standard `CommandCard` (white rounded card, `rounded-2xl`, shadow). Header shows "Usage & Limits" title with "Plan: Internal Free Tier" subtext and a "View Details" button on the right. Body is a 2-column grid with 4 quota items, each displaying: uppercase label, current/limit count on the right, a thin coloured progress bar, and percentage.

---

## Gates

- ✅ Typecheck: clean (pre-existing error in `quota-alerts.ts` unrelated)
- ✅ Lint: pending (long project-wide lint)
- ✅ Tests: `tests/smoke/quotas.test.ts` — 8/8 passed
- ✅ No Stripe / pricing / checkout code
- ✅ No dashboard sections broken
