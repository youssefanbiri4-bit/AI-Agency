# W12-T3 — Customer Success Tools + Advanced Reporting + Churn Prevention

**Role:** Senior Backend + Analytics Engineer
**Status:** ✅ Complete

## Overview

Built a **Customer Success** area covering all four workstreams: an **Advanced
Reporting Dashboard** with CSV/JSON exports, **Churn Prevention** (usage/cancellation
signals, win-back flows), **Customer Success Tools** (support tickets, feedback, NPS),
and **Retention Analytics** (active members, engagement trend, NPS trend). Everything
reuses existing repo patterns: Supabase + RLS, RBAC-guarded server actions
(`requireWorkspaceAccessWithRBAC`), the `DataResult`/`createNotification` conventions,
`StatCard`/`Card`/`EmptyState` UI primitives, and the Blob-based CSV export pattern.

---

## Changes

### New database layer
- `supabase/migrations/20260717000000_create_customer_success.sql`
  - `support_tickets` (workspace-scoped): subject, description, status, priority,
    category, assigned_to, resolved_at. RLS: members read/create; admins update/delete.
  - `customer_feedback`: rating (1–5, nullable), category, message, status. RLS as above.
  - `nps_responses`: score (0–10), comment, period (YYYY-MM). RLS as above.
  - `churn_alerts`: signal_type, severity, title, message, acknowledged flags, metadata.
    RLS: members read; admins create/manage.
  - Indexes, `set_updated_at` triggers, and RLS via `is_workspace_member` /
    `is_workspace_admin` helpers (matching existing migration style).
- `src/types/database.ts`
  - Added Row/Insert/Update types for all four tables + `SupportTicketRecord`,
    `CustomerFeedbackRecord`, `NpsResponseRecord`, `ChurnAlertRecord`.
  - Extended `NotificationType` with `churn_warning` and `win_back`.

### Data + analytics layer
- `src/lib/data/customer-success.ts` (new)
  - CRUD: `listSupportTickets`, `getSupportTicket`, `createSupportTicket`,
    `updateSupportTicket`, `deleteSupportTicket`, `listFeedback`, `createFeedback`,
    `deleteFeedback`, `listNpsResponses`, `createNpsResponse`, `getNpsSummary`
    (promoters/passives/detractors + NPS + per-period trend), `listChurnAlerts`,
    `acknowledgeChurnAlert`, `createChurnAlert`.
  - Analytics (admin client, `getSupabaseAdmin`):
    - `getRetentionAnalytics` — total/active members (30d), active rate, daily-active
      series, month-over-month event volume, NPS summary.
    - `computeChurnSignals` — detects: scheduled cancellations, limit-exceeded /
      near-limit usage (vs `usage_limits`), member inactivity (≥50% inactive 30d),
      and low NPS (≥3 detractors 30d).
    - `getChurnRiskSummary` — heuristic 0–100 risk score + level (low/medium/high/critical).

### RBAC-guarded server actions
- `src/actions/customer-success/actions.ts` (new, `'use server'`)
  - `createSupportTicketAction` (editor+), `updateTicketStatusAction` (editor+),
    `deleteTicketAction` (admin), `createFeedbackAction` (viewer+),
    `deleteFeedbackAction` (admin), `createNpsAction` (viewer+),
    `acknowledgeChurnAlertAction` (admin), `runChurnAnalysisAction` (admin; dedupes
    alerts, notifies admins), `triggerWinBackFlowAction` (admin; acknowledges alert +
    notifies admins via `win_back` notifications).

### Customer Success dashboard (UI)
- `src/app/(dashboard)/dashboard/customer-success/page.tsx` — server page, admin-gated
  (returns `<AccessDenied />` otherwise), fetches all data via admin client.
- `CustomerSuccessClient.tsx` — tab shell (Overview / Tickets / Feedback / NPS / Reports).
- `CSOverview.tsx` — risk + active-members + NPS stat cards, retention sparkline, churn
  signals, alerts with **Acknowledge** / **Win-back** actions, and **Run analysis**.
- `CSTickets.tsx` — ticket list + create form + status/priority changes + delete.
- `CSFeedback.tsx` — feedback list + rating + message + delete.
- `CSNps.tsx` — NPS scorecard (promoters/passives/detractors), trend bars, response form.
- `CSReports.tsx` — **CSV + JSON exports** (tickets, feedback, NPS, full bundle).
- `types.ts` — shared client-safe `CsPageData` type.

### Programmatic export API
- `src/app/api/customer-success/export/route.ts` — `GET` (admin session) returning
  `?type=tickets|feedback|nps&format=csv|json` with `Content-Disposition: attachment`.
  Reuses `requireSessionAdmin` from `src/lib/api/auth.ts` (W11-T3).

### Navigation & i18n
- `src/components/ui/Sidebar.tsx` — added **Customer Success** (`HeartHandshake`) to the
  Automation & Ops group.
- `src/components/ui/CommandPalette.tsx` — quick-open entry.
- `src/i18n/locales/{en,ar,fr,es}.json` — added `nav.customerSuccess` (bilingual).

---

## Verification

- `npx tsc --noEmit` — **no type errors** in any file added/changed by this task
  (confirmed via targeted grep on `customer-success`, `actions/customer-success`,
  `api/customer-success`, `Sidebar.tsx`, `CommandPalette.tsx`).
- `npx eslint` on the new route + data + action + UI files — **0 errors, 0 warnings**.
- SQL migration follows the repo's established pattern (`set_updated_at` trigger,
  `is_workspace_member` / `is_workspace_admin` RLS helpers, `on delete cascade`).
- Reuses existing conventions: `requireWorkspaceAccessWithRBAC`, `DataResult`,
  `createNotification`, `StatCard`/`Card`/`EmptyState`, and the Blob CSV export pattern
  (matches `api/usage/analytics/route.ts`).
- Charts are CSS/SVG only (no chart library added), preserving the Vercel build guard.

> Note: A pre-existing, unrelated typecheck drift exists elsewhere in the repo
> (`src/lib/data/tasks.ts`, `content-studio.ts`, `usage/analytics.ts`, and some
> `tests/…`); not touched by this task. This feature's files compile and lint cleanly.

### How to apply the migration
```bash
supabase db push            # or: supabase migration up
```
Then open `/dashboard/customer-success` (admin role). Reports export via the Reports tab
or `GET /api/customer-success/export?type=tickets&format=csv`.

---

## Status: ✅ Complete
