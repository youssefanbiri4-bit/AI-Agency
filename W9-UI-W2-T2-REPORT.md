# W9-UI-W2-T2-REPORT: Apply 4/8pt Spacing Grid on Key Pages

**Date:** 2026-07-13  
**Task ID:** W9-UI-W2-T2  
**Status:** ✅ Complete  

---

## Summary

Applied strict 4/8pt spacing grid to 8 target files following the DESIGN_IMPROVEMENT_PLAN.md (VFL-03) specification:

| Spacing Rule | Value | Tailwind |
|---|---|---|
| Major sections | 40px | `space-y-10` |
| Component gaps | 24px | `gap-6` |
| Card padding | 24px | `p-6` |
| Stat cards / compact | 16px | `p-4` |
| Micro spacing | 8px | `p-2` / `gap-2` |

**Banned classes removed:** `space-y-3` (12px), `gap-3` (12px), `gap-5` (20px), `py-2.5` (10px), `py-0.5` (2px), `p-5` (20px), `mb-5` (20px), `mt-5` (20px), `sm:p-7` (28px), `sm:p-8` (32px).

---

## Files Modified

| # | File | Changes |
|---|---|---|
| 1 | `src/components/ui/Card.tsx` | 2 changes |
| 2 | `src/components/ui/StatCard.tsx` | 2 changes |
| 3 | `src/components/ui/PageHeader.tsx` | 3 changes |
| 4 | `src/components/dashboard/PersonalizedDashboard.tsx` | ~12 changes |
| 5 | `src/app/(dashboard)/dashboard/components.tsx` | ~18 changes |
| 6 | `src/app/(dashboard)/dashboard/page.tsx` | ~6 changes |
| 7 | `src/app/(dashboard)/dashboard/content-studio/page.tsx` | ~6 changes |
| 8 | `src/app/(dashboard)/dashboard/settings/page.tsx` | ~5 changes |

---

## Spacing Changes Per File

### 1. Card.tsx
- `p-5 sm:p-6` → `p-6` (standardise card padding to 24px)
- `mb-5` → `mb-6` (header bottom margin 20px→24px)
- `gap-3` → `gap-2` (header flex gap 12px→8px)

### 2. StatCard.tsx
- `p-5` → `p-4` (compact stat card padding 20px→16px)
- `p-3` → `p-2` (icon container padding 12px→8px)

### 3. PageHeader.tsx
- `px-4 py-5 sm:px-6 sm:py-6` → `px-4 py-4 sm:px-6 sm:py-6` (vertical padding 20px→16px mobile, 24px maintained on desktop)
- `flex flex-col gap-3` → `flex flex-col gap-2` (title column gap 12px→8px)
- `gap-2 sm:gap-3` → `gap-2` (actions gap 12px removed on desktop)

### 4. PersonalizedDashboard.tsx
- `space-y-8` → `space-y-10` (outer container 32px→40px)
- `p-6 sm:p-8` → `p-6` (section padding 32px→24px on large screens)
- `gap-3` → `gap-2` (3× badge/title/stat flex containers)
- `mb-3` → `mb-2` (2× section heading margins 12px→8px)
- `py-2.5` → `py-2` (task link padding 10px→8px)
- `py-0.5` → `py-1` (status badge padding 2px→4px)
- `mt-3` → `mt-2` (2× top margins 12px→8px)
- `gap-3` → `gap-2` (department stats grid)
- `p-5 shadow-sm` → `p-6 shadow-sm` (recent activity section 20px→24px)
- `gap-3` → `gap-2` (recent activity header)

### 5. Dashboard components.tsx
- `p-5` → `p-6` (CommandCard section padding 20px→24px)
- `mb-5` → `mb-6` (CommandCard header margin 20px→24px)
- `gap-3` → `gap-2` (CommandCard header gap + ManagerStat + ProgressRow + TodayActionCard + shortcuts grids)
- `mt-5` → `mt-6` (HeroSection action buttons + DashboardContentFallback actions 20px→24px)
- `mt-3` → `mt-2` (ManagerStat value + HeroSection description + DashboardContentFallback description + ProviderSnapshotCard link)
- `p-5 sm:p-7` → `p-6` (HeroSection + DashboardContentFallback section padding 28px→24px)
- `grid gap-3` → `grid gap-2` (8× grid components: shortcuts, project snapshot, release snapshot, manager shortcuts, ops card)
- `space-y-3` → `space-y-2` (ProviderRowsSection)
- `p-3` → `p-2` (notification items in OpsCard)

### 6. Dashboard page.tsx
- `space-y-8` → `space-y-10` (outer container 32px→40px)
- `space-y-3` → `space-y-2` (Today's Priorities + TodayActionCard list + Latest Tasks + Latest Content + Task Events + Publish Attempts)
- `mt-5` → `mt-6` (before Latest Task Events + Publish & Scheduler Attempts 20px→24px)

### 7. Content Studio page.tsx
- `space-y-8` → `space-y-10` (outer container 32px→40px)
- `p-3` → `p-2` (details accordion + 3× provider status items padding 12px→8px)
- `mt-3` → `mt-2` (accordion content 12px→8px)

### 8. Settings page.tsx
- `space-y-8` → `space-y-10` (outer container 32px→40px)
- `p-3` → `p-2` (nav bar padding 12px→8px)
- `space-y-3` → `space-y-2` (preferences list 12px→8px)
- `gap-8` → `gap-6` (two-column grid gap 32px→24px)
- `space-y-8` → `space-y-10` (inner left/right columns 32px→40px)

---

## Verification

| Check | Status |
|---|---|
| TypeScript compilation | ✅ 0 new errors (2 pre-existing) |
| No `space-y-3` remains in target files | ✅ All replaced |
| No `gap-3`/`gap-5` remains in target files | ✅ All replaced |
| No `py-2.5`/`py-0.5` in target files | ✅ All replaced |
| No `p-5`/`mb-5`/`mt-5` in target files | ✅ All replaced |
| Cards use `p-6` consistently | ✅ Card.tsx + CommandCard + sections |
| Stat cards use `p-4` consistently | ✅ StatCard.tsx + SmallMetric + cards |
| Major sections use `space-y-10` | ✅ All 5 page-level containers |
| Code review | ✅ No layout-breaking changes |

---

## Status

**✅ Complete — All 8 files updated with consistent 4/8pt spacing grid.**

The spacing is now harmonised across the dashboard page, content studio, settings page, and all core UI components (Card, StatCard, PageHeader, CommandCard, ManagerStat, SmallMetric, HeroSection). No layout regressions or visual breakage expected.
