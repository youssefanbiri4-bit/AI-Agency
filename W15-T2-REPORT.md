# W15-T2 — Senior Analytics Engineer: Advanced Analytics & Insights

**Status:** ✅ Complete
**Project:** AgentFlow AI (Next.js 16 App Router, React 19, Supabase, Redis, Sentry)
**Scope:** Add advanced analytics on top of the existing usage engine — usage trends +
forecasts, churn prediction + risk scores, a team performance dashboard, and exportable
PDF/CSV reports.

---

## 1. Changes

### 1.1 Usage Trends + Forecasts (Redis + Charts)
- **`src/lib/analytics/insights.ts`** → `getUsageTrendsForecast(workspaceId, days=90, forecastDays=14)`
  - Builds a daily usage series from `usage_events` (Redis-cached 5 min, in-memory fallback).
  - Computes a **least-squares linear forecast** for the next 14 days with a ±1σ confidence
    band and an **R² fit-quality** score (0–1) surfaced in the UI/PDF.
  - Derives 30-day vs prior-30-day change % and a 7-day moving-average trend direction
    (`up` / `down` / `flat`).
- **Chart:** `InsightsDashboard.tsx` `UsageChart` renders actual (violet) + forecast (red)
  bars with hover tooltips; legend distinguishes the two.

### 1.2 Churn Prediction + Risk Scores
- **`getChurnRiskScores(workspaceId)`** — per-member heuristic model:
  - **Recency** (days since last `usage_events` / `tasks` activity) — up to 45 pts.
  - **Usage decay** (this-month vs last-month `usage_events` delta) — up to 35 pts.
  - **Volume** (low/absent monthly usage) — up to 20 pts.
  - Produces a 0–100 `riskScore` and a segment: `healthy` / `watch` / `at_risk` / `churn_risk`,
    plus human-readable `signals` (e.g. "Usage dropped 62% vs last month").
- **UI:** `ChurnPanel` with member search + segment filter, color-coded badges, and signals.

### 1.3 Team Performance Dashboard
- **`getTeamPerformance(workspaceId)`** — per-member from `tasks`:
  - total / completed / failed, **completion rate %**, **avg cycle time** (completed_at −
    created_at, in hours), and tasks in the last 30 days.
  - **Department breakdown** (`agent_department`) with volume + completion rate.
  - Workspace totals (active members, completion rate).
- **UI:** `TeamPanel` (searchable member table) + `DepartmentPanel` (horizontal bars).

### 1.4 Exportable Reports (PDF / CSV)
- **CSV:** `exportInsightsCsv(summary)` serializer (usage+forecast, churn, team, department).
  - Route: `GET /api/analytics/insights/export` → `text/csv` attachment.
- **PDF:** `src/lib/analytics/pdf-export.ts` `generateInsightsReportPdf` — branded HTML →
  PDF via `puppeteer-core`, **falling back to HTML when Chromium is unavailable** (mirrors
  `src/lib/usage/pdf-export.ts`).
  - Route: `GET /api/analytics/insights/export-pdf` → `application/pdf` (or `.html` fallback).
- **UI:** Export buttons (CSV / PDF) wired in `InsightsDashboard`.

### 1.5 Page + Navigation
- **`src/app/(dashboard)/dashboard/insights/page.tsx`** (server component) — loads
  `getInsightsSummary`, renders `InsightsDashboard`. `dynamic = 'force-dynamic'`.
- **Nav:** added "Analytics & Insights" to `Sidebar.tsx`, `CommandPalette.tsx`, and i18n
  (`nav.insights` in en/es/ar/fr).
- **Cross-link:** usage page now links to the new insights page.

---

## 2. Dashboard Screenshots Description

The `/dashboard/insights` view is composed of the following on-screen sections (rendered in
the `InsightsDashboard` client component):

1. **Header row** — title "Analytics & Insights", last-updated timestamp, and Refresh / CSV /
   PDF buttons (top-right).
2. **KPI cards (4-up)** — Usage (30d) with MoM change + trend arrow; Forecast R²; At/Churn
   Risk member count; Team Completion %.
3. **Usage Trends & 14-Day Forecast** — bar chart, violet = actual daily totals, red =
   forecasted; legend; hover tooltips show date + value.
4. **Churn Risk Scores** — search box + segment `<select>`; summary chips per segment
   (Healthy/Watch/At Risk/Churn Risk with counts); table of members with risk score,
   color-coded segment badge, idle-days, and textual signals.
5. **Team Performance** — searchable table: member, total/done/failed tasks, completion %,
   avg cycle hours.
6. **Department Breakdown** — horizontal bars per department (volume-proportional), with
   completed/total and completion %.

*(Screenshots could not be captured in this sandbox — no Chromium/Lighthouse and offline
`next/font/google` blocks `npm run build`; this is a pre-existing environment limitation, not
a code defect. The component tree above maps 1:1 to the implemented JSX.)*

---

## 3. Verification

- ✅ `npx tsc --noEmit` — **zero errors** across the whole project (includes all W15-T2 files).
- ✅ `npx eslint` — **0 errors** on all new/changed files (only pre-existing unused-`request`
  style warnings elsewhere; none in W15-T2 scope after cleanup).
- ✅ `node --check` / JSON parse — i18n locale files valid; security-audit scanner run.
- ✅ Chart rendering, filters, and export endpoints follow existing conventions from
  `src/lib/usage/analytics.ts` and `src/lib/usage/pdf-export.ts`.
- ⚠️ `npm run build` and Lighthouse still cannot run in this sandbox (offline font fetch /
  no Chromium) — same limitation noted in prior tasks.

**Out of scope / pre-existing:** the security scanner continues to flag
`src/components/pwa/PushNotificationManager.tsx` (a `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — a
*public* VAPID key, false positive). This file is unrelated to W15-T2 and was not modified.

---

## 4. Status

✅ **Complete** — all four deliverables implemented, type-checked, lint-clean, and wired into
navigation with PDF/CSV export.
