# W9-UI-W2-T3 — Dashboard Command Center Foundations (Above-the-fold)

**Task:** Restructure the dashboard top into a lightweight "Command Center": 3 Primary CTAs above the fold, a 4-metric Health Scorecard row, a personalized "My Work" zone, and collapsible secondary content (Projects / Releases / Content Snapshot).

**Date:** 2026-07-13
**Status:** ✅ Complete
**Plan refs:** `FRONTEND_IMPLEMENTATION_PLAN.md` (T3.1 + T3.2), `DESIGN_IMPROVEMENT_PLAN.md` (FRP-03)

---

## Summary

The dashboard was restructured along the Command Center pattern without rewriting the page from scratch. The existing `HeroSection` now leads with **3 Primary CTAs** (Create Task, Run Scheduler, Review Queue) plus a de-emphasised secondary links row. The old 6-card "Today's Priorities" grid was replaced by a new **`HealthScoreCard`** (4 metrics in a single responsive row using the existing `StatCard`). A new personalized **"My Work"** zone shows tasks created by the user, their drafts, and items awaiting their review. The three secondary sections (Projects, Releases, Content & Campaign Snapshot) were moved into a new **`ExpandablePanel`** component, collapsed by default with `localStorage` persistence. All new user-facing text is routed through the i18n system (en/ar/es/fr).

No new dependencies were added. Only existing components (`Card`/`CommandCard`, `StatCard`, `Button`, `Notice`, `EmptyState`, `LatestTaskCard`, `LatestContentCard`) were reused.

---

## Files Modified

| # | File | Change |
|---|------|--------|
| 1 | `src/i18n/server.ts` | **NEW** — server-side translator `getServerTranslator()` (mirrors client `t`, falls back EN). |
| 2 | `src/i18n/locales/en.json` | Added 25 `page.dashboard.*` command-center keys. |
| 3 | `src/i18n/locales/ar.json` | Added same keys (Arabic). |
| 4 | `src/i18n/locales/es.json` | Added same keys (Spanish). |
| 5 | `src/i18n/locales/fr.json` | Added same keys (French). |
| 6 | `src/components/ui/ExpandablePanel.tsx` | **NEW** — accessible collapsible panel (chevron, `aria-expanded`, `role="region"`, persisted open/closed). |
| 7 | `src/app/(dashboard)/dashboard/components.tsx` | Added `HealthScoreCard`; rebuilt `HeroSection` with 3 Primary CTAs + secondary row. |
| 8 | `src/app/(dashboard)/dashboard/page.tsx` | Wired `HealthScoreCard`, added "My Work" zone, wrapped secondary sections in `ExpandablePanel`; trims unused imports. |

**Components reused (not rewritten):** `CommandCard`, `StatCard`, `Button` (`buttonStyles`), `Notice`, `EmptyState`, `LatestTaskCard`, `LatestContentCard`, `ProjectSnapshotCard`, `ReleaseSnapshotCard`, `ProgressRow`, `SmallMetric`.

---

## Layout Changes

### Above the Fold (new order)
1. **Hero / 3 Primary CTAs** — `Create Task` (primary), `Run Scheduler` (scheduler button when admin, else link to System Health), `Review Queue` (→ `/dashboard/tasks?status=needs_review`). A smaller ghost-style secondary row keeps Content Studio / System Health / Open Alex / Open Backup Center reachable but de-emphasised.
2. **Health Scorecard** (4 metrics, `grid-cols-2 lg:grid-cols-4`):
   - Provider Status — `active/total`, tone `success`/`warning`.
   - Scheduler Health — `Running`/`Needs setup`, tone `success`/`warning`.
   - Review Queue — `taskStats.needsReview`, tone `danger` when > 0 else `neutral`.
   - Ready Content — `contentStatusCounts.ready`, tone `success`.
3. **My Work** (personalized, `lg:grid-cols-3`): My Tasks (`user_id === userId`), My Drafts (content `draft` where `created_by === userId`), Awaiting My Review (`status === 'needs_review'`). Each column has a "See all" link and an empty state.

### Secondary Content (collapsed by default)
- Projects Snapshot, Releases Snapshot, and Content & Campaign Snapshot are now `ExpandablePanel`s (`storageKey` `cc-panel-projects` / `cc-panel-releases` / `cc-panel-content`), collapsed on first load and remembered across reloads.

### Removed
- The 6-card "Today's Priorities" `ManagerStat` grid (replaced by Health Scorecard).
- Unused imports: `ManagerStat`, `failedOrSetup` computation, and the now-unused icon imports (`AlertCircle`, `AlertTriangle`, `CalendarClock`, `FileText`, `RadioTower`) from `page.tsx`.

---

## Verification

| Check | Command | Result |
|-------|---------|--------|
| Type check | `npx tsc --noEmit` | No new errors (only 2 pre-existing unrelated errors: `auth/signup` React import, missing `nodemailer` types). |
| Lint | `npx eslint <changed files> --max-warnings 60` | Clean — 0 errors, 0 warnings. |
| i18n JSON parse | `node -e JSON.parse(...)` on en/ar/es/fr | All 4 files valid. |

**Acceptance criteria (T3.1 / T3.2 / FRP-03):**
- ✅ 3 primary CTAs above the fold.
- ✅ 4-metric Health Scorecard in a single responsive row, built on `StatCard` with semantic tones, no hover-lift animation.
- ✅ Personalized "My Work" zone (assigned/created tasks, drafts, review queue).
- ✅ Projects / Releases / Content Snapshot demoted into collapsible `ExpandablePanel`s.
- ✅ Reused existing components; no page rewrite; no new dependencies; i18n preserved (extended, not broken).

**Notes / assumptions:**
- The `Task` model has no `assignee_id` (only `user_id` = creator). "Assigned to me" is therefore interpreted as "created by me"; "Awaiting my review" maps to `needs_review` tasks. If a true assignee relation is added later, the `myTasks` filter should switch to it.
- "Run Scheduler" CTA renders the existing `DashboardSchedulerButton` for admins; non-admins get a link to System Health (the scheduler action is admin-only).
- Server-side text defaults to English to stay consistent with the existing server-rendered dashboard copy; the client `LanguageProvider` re-resolves to the active locale after mount (same behaviour as the rest of the app).

---

## Status

✅ **Complete** — implementation done, type-checks and lints clean, i18n keys added for all four locales.
