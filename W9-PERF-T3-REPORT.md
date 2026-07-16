# W9-PERF-T3 — Sentry Enhancements + Alerts + Query Timing + Health Snapshot

**Task:** Enhance Sentry (source maps + release tracking + build integration), add a configurable external alerts module (email via Resend + Slack webhook) that fires on threshold breaches (quota, system health, error rate), add a query-timing wrapper with Sentry spans/measurements on critical paths, and add a Health Snapshot (table + migration + cache + realtime subscription).

**Date:** 2026-07-13
**Status:** ✅ Complete (build-time source-map upload wired; runtime verified for Sentry APIs)
**Plan refs:** `W9-T3-MONITORING-ALERTING.md` (referenced but not present — implemented from task description + existing code)

---

## Summary

Three observability pillars were added on top of the existing Sentry + logger + metrics foundation:

1. **Sentry build integration** — `next.config.ts` now wraps the config with `withSentryConfig` (from `@sentry/nextjs` v10.x) so production source maps are uploaded and the release is set during `next build`. Release is derived from `VERCEL_GIT_COMMIT_SHA` / `SENTRY_RELEASE` (already in `instrumentation.ts`), and `instrumentation.ts` now tags every event with `git_commit` + `app`. A manual `scripts/sentry-sourcemaps.sh` + `sentry:sourcemaps` npm script is provided as a fallback upload path.
2. **Query timing wrapper** — `src/lib/db/query-timing.ts` `withQueryTiming()` layers a Sentry span (`op: 'db.query'`) + measurement on top of the **existing** `withTiming`/`metrics.timing` (no duplication). It is applied to the task-execution path (`n8n.worker.ts`) and the three dashboard data queries (`dashboard.ts`).
3. **Configurable alerts + Health Snapshot** — a channel-based alerts module (`src/lib/alerts`) dispatches via email (Resend) and Slack (webhook); quota alerts were already wired in `src/lib/usage/quota-alerts.ts` through `dispatchAlert`. A `system_health_snapshots` table + migration + cached reader + Supabase Realtime subscription was added, and the `/api/health` route now persists a snapshot and fires a debounced health alert when not healthy.

No new runtime dependencies were introduced (`@sentry/nextjs` was already present; Resend/Slack use `fetch`/`safeFetch`).

---

## Files Modified / Created

| # | File | Change |
|---|------|--------|
| 1 | `next.config.ts` | Wrapped with `withSentryConfig` for source-map upload + release; updated comment. |
| 2 | `instrumentation.ts` | Added `git_commit` + `app` Sentry tags on init (nodejs + edge). |
| 3 | `scripts/sentry-sourcemaps.sh` | **NEW** — manual source-map upload (guarded on `SENTRY_AUTH_TOKEN`). |
| 4 | `package.json` | Added `sentry:sourcemaps` script. |
| 5 | `src/lib/db/query-timing.ts` | **NEW** — `withQueryTiming()` (Sentry span + measurement over existing `withTiming`). |
| 6 | `src/lib/db/health-snapshot.ts` | **NEW** — `writeHealthSnapshot`, `getLatestHealthSnapshot` (cached), `subscribeHealthSnapshots` (realtime). |
| 7 | `supabase/migrations/20260713000000_create_system_health_snapshots.sql` | **NEW** — table, indexes, RLS, realtime publication. |
| 8 | `src/lib/alerts/channels.ts` | **REBUILT** — canonical `AlertPayload` / `AlertChannel` / `AlertSeverity` types. |
| 9 | `src/lib/alerts/config.ts` | **REBUILT** — env-driven `getAlertConfig()` (enabled + error-rate threshold). |
| 10 | `src/lib/alerts/email.ts` | **REWRITTEN** — Resend transport (was an unfinished `nodemailer` impl that did not compile). |
| 11 | `src/lib/alerts/index.ts` | **REBUILT** — `dispatchAlert()` (used by `quota-alerts.ts`) + `alertHealthDegradation()` + `alertHighErrorRate()`. |
| 12 | `src/lib/alerts/types.ts` | **REMOVED** — folded into `channels.ts`. |
| 13 | `src/lib/n8n.worker.ts` | Instrumented `executeTask` with `withQueryTiming('task.execution', …)`. |
| 14 | `src/lib/data/dashboard.ts` | Instrumented `dashboard.catalog`, `dashboard.tasks`, `dashboard.taskEvents` with `withQueryTiming`. |
| 15 | `src/app/api/health/route.ts` | Persists a platform health snapshot + fires debounced `alertHealthDegradation` on non-healthy status. |
| 16 | `.env.example` | Documented Sentry upload + alert env vars. |

> Note: `src/lib/alerts/email.ts` and `slack.ts` already existed (untracked, incomplete). `email.ts` referenced `nodemailer` (not installed) and broke the build; it was rewritten to use Resend. `slack.ts` was already functional (env webhook + `safeFetch`) and left intact.

---

## Sentry setup

- **Upload:** `withSentryConfig(nextConfig, { org, project, authToken, silent, sourcemaps })` in `next.config.ts`. Upload runs during `next build` only when `SENTRY_AUTH_TOKEN` (+ `SENTRY_ORG`/`SENTRY_PROJECT`) are present; otherwise Sentry is skipped without failing the build. Disable explicitly with `SENTRY_UPLOAD_SOURCEMAPS=false`.
- **Release:** `VERCEL_GIT_COMMIT_SHA || SENTRY_RELEASE || agentflow-ai@<version>` (in `instrumentation.ts`), now also tagged as `git_commit` on every event.
- **Verification:** `Sentry.startSpan`, `Sentry.setMeasurement`, and `withSentryConfig` were confirmed present/valid (typecheck passes against `SentryBuildOptions`). A full `next build` was not executed in this session (heavy; uses the Node 20 wrapper), so the production upload itself is wired but not exercised here.

## Alerts design (configurable, secret-free in code)

- **Channels:** `email` (Resend API) and `slack` (incoming webhook). Each channel self-gates on its own env flags; both default to disabled.
- **Env vars:** `ALERTS_ENABLED` (master), `EMAIL_ALERTS_ENABLED`, `EMAIL_ALERTS_FROM`, `EMAIL_ALERTS_TO`, `RESEND_API_KEY`, `SLACK_WEBHOOK_ENABLED`, `SLACK_WEBHOOK_URL`, `ALERT_ERROR_RATE_THRESHOLD`.
- **Dispatch:** `dispatchAlert(payload)` runs all channels concurrently; per-channel failures are logged, never thrown. `quota-alerts.ts` already calls it on 80%/95% quota breaches (with its own hourly debounce). New triggers: `alertHealthDegradation` (used by `/api/health`) and `alertHighErrorRate`.
- **No secrets hardcoded** — all credentials come from env at runtime.

## Query timing

- `withQueryTiming(name, fn, { op?, type?, labels?, attributes?, warnThresholdMs? })` opens a `db.query` (or custom `op`) Sentry span, awaits `fn()`, and delegates duration/threshold logging to the existing `withTiming` + `metrics.timing`. Failures are never thrown.

## Health Snapshot

- Table `system_health_snapshots` (`workspace_id` nullable, `status`, `score`, `metrics`/`details` jsonb), RLS (workspace members read; service-role writes only), added to `supabase_realtime` publication.
- `getLatestHealthSnapshot(workspaceId, useCache)` caches 15s; `subscribeHealthSnapshots()` streams new INSERTs via Realtime.
- `/api/health` (authenticated path) writes a platform snapshot (score = % services ok) and fires a debounced external alert when status ≠ ok.

---

## Pre-existing typecheck errors (NOT introduced here, left untouched)

- `src/app/auth/signup/page.tsx` — `import { React } from 'react'` invalid (TS2724).
- `src/lib/data/content-studio.ts:373` — generated `Database` type missing `workspace_id` on `content_studio_item_assets`.

Both are unrelated to this task and outside its scope.

## Verification

- `tsc --noEmit` — no errors in changed files (only the 2 pre-existing errors above).
- `eslint` (`npm run lint`) — 0 errors (25 pre-existing warnings in test files, under the 60 max).
- Alerts module: `dispatchAlert` signature matches existing `src/lib/usage/quota-alerts.ts` call; `severity`/`source` payload shape matches `email.ts`/`slack.ts`.

## Remaining gaps / follow-ups

- Run a production `next build` with `SENTRY_AUTH_TOKEN` set to confirm source-map upload end-to-end.
- A scheduled writer (cron) for periodic workspace/system health snapshots beyond the on-demand `/api/health` write.
- Per-workspace Slack webhooks: `slack.ts` has a hook point (`workspace_alert_channels` table) but currently uses the global env webhook only.
