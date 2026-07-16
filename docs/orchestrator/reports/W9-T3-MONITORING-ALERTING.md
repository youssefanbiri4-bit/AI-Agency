# W9-T3: Monitoring & Alerting Infrastructure

**Status:** ⏳ Analysis — Awaiting Project Owner Approval  
**Date:** 2026-07-13  
**Author:** Agent 3 (Monitoring & Alerting)

---

## Overview

This report audits five pillars of the AgentFlow AI monitoring and alerting system. No changes have been made — all findings are presented for approval before implementation.

| Pillar | Current State | Maturity |
|--------|--------------|----------|
| 1. Sentry (error tracking) | Installed v10.54.0, init'd client+server, error handler, ErrorBoundary | **~50%** — many gaps |
| 2. Usage Alerts (email/Slack) | In-app quota alerts at 80%/95%, debounced 1h | **~40%** — no external delivery |
| 3. System Health Dashboard | Full health engine (888 lines), dashboard page, scoring, action ranking | **~80%** — strong core, missing automation |
| 4. Centralized Logging & Metrics | Custom structured logger (216 lines), metrics module, 37 child loggers | **~60%** — no aggregation, no query timing |
| 5. Alerting Infrastructure | In-app notifications (34 types, 5 severities, 12 callers), operational alerts | **~55%** — no external channels, no routing |

---

## 1. Sentry Enhancements

### 1.1 Current State

| Component | File(s) | Status |
|-----------|---------|--------|
| Package | `package.json:26` | `@sentry/nextjs ^10.54.0` |
| Client config | `sentry.client.config.js` | Dynamic import + init with DSN env var |
| Server config | `sentry.server.config.js` | Same as client |
| Instrumentation | `instrumentation.ts` | `Sentry.init()` for nodejs + edge runtimes |
| Error handler | `src/lib/error-handler.ts:33-83` | `Sentry.captureException()` with tags + context |
| User context | `src/lib/sentry-client.tsx:10-38` | Sets user from `/api/auth/me` |
| Error Boundary | `src/lib/sentry-client.tsx:43-53` | `<Sentry.ErrorBoundary>` in root layout |
| CSP | `src/lib/security/content-security-policy.ts:23` | `*.ingest.sentry.io` allowed in `connect-src` |
| .env.example | `SENTRY_DSN` commented out | Not set in `.env.local` — Sentry is **disabled in dev** |

### 1.2 Critical Gaps

| # | Gap | Impact | Effort | Priority |
|---|-----|--------|--------|----------|
| S1 | **No source map uploads** | Stack traces are minified/unreadable in production | Medium (add `sentry-cli` to build pipeline) | **High** |
| S2 | **No release tracking** | `release` option not set in any `Sentry.init()`; errors can't be correlated to deployments | Low (add `release` from git SHA or env) | **High** |
| S3 | **`SENTRY_DSN` not configured in production** | All error capturing is silently no-op | Low (add to production env) | **High** |
| S4 | **No custom performance spans** | `tracesSampleRate: 0.1` is set but no `Sentry.startSpan()` / `startTransaction()` calls | Medium | Medium |
| S5 | **No profiling** | `profilesSampleRate` not configured, no `profilingIntegration` | Low | Low |
| S6 | **No Session Replay** | `replaysSessionSampleRate` not configured, no `Replay` integration | Low | Low |
| S7 | **No Sentry CLI/auth token** | `sentry.properties` exists but unused; no CI/CD Sentry integration | Low | Medium |
| S8 | **No `captureMessage()` calls** | Only `captureException()` is used — no informational/warning messages sent to Sentry | Low | Low |
| S9 | **No edge config file** | No `sentry.edge.config.js`; Edge runtime uses same config as Node.js | Low | Low |
| S10 | **No `Sentry.flush()`** | Not called during graceful shutdown — events may be lost on process exit | Low | Low |

### 1.3 Recommendations

**Phase 1 (Deploy-next — High priority, ~1-2 hours):**
1. Set `SENTRY_DSN` in the production environment (Vercel project env)
2. Add `release` to `instrumentation.ts` from `process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA`
3. Add `sentry-cli` source map upload to the build script in `package.json`

**Phase 2 (Medium priority, ~2-3 hours):**
4. Add custom performance spans around key operations (task execution, n8n callback processing, usage counter increments)
5. Enable profiling with `profilesSampleRate: 0.05` in production
6. Enable Session Replay with `replaysOnErrorSampleRate: 1.0` (capture replays only on errors)

**Phase 3 (Low priority):**
7. Create `sentry.edge.config.js` for optimal edge runtime configuration
8. Add `Sentry.flush()` to the graceful shutdown sequence
9. Add `captureMessage()` calls for notable application events (plan changes, admin actions)

---

## 2. Usage Alerts — Email/Slack Integration

### 2.1 Current State

**Quota alert system (`src/lib/usage/quota-alerts.ts`: 237 lines):**

| Feature | Detail |
|---------|--------|
| Warning threshold | 80% of quota (`WARNING_THRESHOLD = 80`) |
| Critical threshold | 95% of quota (`CRITICAL_THRESHOLD = 95`) |
| Debounce | 1 hour per workspace+type+threshold (in-memory `Map`) |
| Delivery channel | In-app notification only (inserts into `notifications` table) |
| Recipient | First workspace owner/admin from `workspace_members` |
| Quota types monitored | ai_generations, tasks, creative_assets, content_items, content_publishes, reels_publishes |
| Integration point | Called from `incrementUsage()` in `quotas.ts:341` (async, non-blocking) |

### 2.2 Critical Gaps

| # | Gap | Impact | Effort | Priority |
|---|-----|--------|--------|----------|
| A1 | **No email delivery** | Quota alerts are invisible if user is not logged into the dashboard | High (new module) | **High** |
| A2 | **No Slack delivery** | Team cannot get alerts in their日常 communication channel | Medium (new module) | **High** |
| A3 | **Debounce cache is in-memory only** | Lost on server restart — alerts may re-fire after deployment | Low (use Redis or DB) | Medium |
| A4 | **No user notification preferences** | All alerts go to first owner/admin — no opt-in/out per type or channel | Medium (new preferences system) | Low |
| A5 | **No alert history/audit** | No tracking of when alerts were sent, acknowledged, or resolved | Low | Low |

### 2.3 Recommendations

**Architecture for external delivery:**

Create `src/lib/notifications/channels/` with a channel interface:

```typescript
export interface NotificationChannel {
  name: string;
  send(notification: OutboundNotification): Promise<boolean>;
}

export interface OutboundNotification {
  workspaceId: string;
  userId: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}
```

**Channel implementations:**

| Channel | File | Implementation |
|---------|------|----------------|
| In-app | `src/lib/notifications/channels/in-app.ts` | Already exists (current behavior) |
| Email | `src/lib/notifications/channels/email.ts` | New — use Resend or SendGrid |
| Slack | `src/lib/notifications/channels/slack.ts` | New — use Incoming Webhook URL |

**Channel registry (`src/lib/notifications/channels/index.ts`):**

```typescript
export const notificationChannels: NotificationChannel[] = [
  new InAppChannel(),
  ...(process.env.EMAIL_ENABLED === 'true' ? [new EmailChannel()] : []),
  ...(process.env.SLACK_WEBHOOK_URL ? [new SlackChannel()] : []),
];
```

**Integrate with quota alerts:**
- Refactor `sendQuotaNotification()` in `quota-alerts.ts` to iterate over registered channels
- Wrap each channel call in try/catch (best-effort per channel)

**Env vars to add:**

| Variable | Purpose |
|----------|---------|
| `EMAIL_ENABLED` | Enable/disable email delivery |
| `EMAIL_FROM` | Sender address |
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL |

**Debounce persistence (Phase 2):**
- Replace in-memory `Map` with a Redis-based debounce using the existing BullMQ Redis connection
- Key: `alert:debounce:{workspaceId}:{type}:{threshold}` with 1h TTL

---

## 3. Advanced System Health Dashboard

### 3.1 Current State

The health system is the most mature monitoring component:

| Component | File | Lines | Description |
|-----------|------|-------|-------------|
| Health API | `src/app/api/health/route.ts` | 179 | Public `{ status: 'ok' }` + authenticated full check |
| Health engine | `src/lib/data/system-health.ts` | 888 | Checks auth, DB (8 tables), storage, env vars (17), providers (7), content, tasks, projects, releases, assets |
| Dashboard page | `src/app/(dashboard)/dashboard/system-health/page.tsx` | 426 | Score gauge, blockers, provider cards, env audit, action list |
| Scoring | `system-health.ts:321-339` | 19 | 0-100% score, labels: Excellent/Good/Needs Attention/Critical |
| Action ranking | `system-health.ts:304-319` | 16 | Priority-sorted, capped at 12 actions |
| Operational API | `src/app/api/dashboard/operational/summary/route.ts` | 126 | Task counts, stale processing, callback health |
| Provider API | `src/app/api/dashboard/operational/provider/route.ts` | 112 | Per-provider readiness, callback metrics |
| Provider cache | `src/lib/data/provider-readiness.ts` | 102 | 5-min TTL cache on `provider_readiness_cache` table |
| Copy report | `SystemHealthCopyButton.tsx` | 33 | Markdown copy to clipboard |

### 3.2 Gaps

| # | Gap | Impact | Effort | Priority |
|---|-----|--------|--------|----------|
| H1 | **No automated health alert dispatch** | If health degrades (e.g., provider fails), no notification or alert is created | Medium | **High** |
| H2 | **No health history / trend data** | Health score is point-in-time only — no way to see degradation over time | High | Medium |
| H3 | **No scheduled health check cron** | Health is checked only when user visits the page or calls the API | Low | Medium |
| H4 | **No external uptime monitoring** | No Pingdom, Better Uptime, Healthchecks.io integration | Low | Medium |
| H5 | **No cross-workspace health aggregation** | Admin cannot see health across all workspaces in one view | Medium | Low |
| H6 | **No database connection pool metrics** | Only basic query test — no pool size, active connections, wait times | Low | Low |

### 3.3 Recommendations

**Phase 1 — Automated health alert dispatch (Medium priority, ~3-4 hours):**
- After `getSystemHealthSummary()` computes `actions[]`, call a new `dispatchHealthAlerts()` function
- Compare against previous state (stored in Redis or DB with short TTL)
- If new critical/high actions appeared that weren't in the previous state, create in-app notifications
- Integrate with the multi-channel notification system (Section 2) when available

**Phase 2 — Health trends (Medium priority, ~4-5 hours):**
- Create a `health_snapshots` DB table: `id, workspace_id, score, label, checks_json (jsonb), created_at`
- Insert a snapshot after each health check
- Dashboard shows a 7/30-day trend chart of score over time
- Cron job (daily) to capture baseline health

**Phase 3 — External uptime monitoring (Low priority, ~1-2 hours):**
- Integrate with Healthchecks.io (free, simple ping API)
- Add a cron endpoint at `/api/cron/health-ping` that runs the health check and pings Healthchecks.io with the result

---

## 4. Centralized Logging & Metrics

### 4.1 Current State

| Component | File | Status |
|-----------|------|--------|
| Structured logger | `src/lib/logger.ts` (216 lines) | 5 levels (`debug`→`fatal`), redaction, requestId/traceId, child loggers |
| Named loggers | 37 instances | `auth:*`, `data:*`, `queue:*`, `usage:*`, `worker:*`, etc. |
| Security audit log | `src/lib/security-audit-log.ts` (46 lines) | Best-effort inserts to `security_audit_logs` table |
| Metrics module | `src/lib/monitoring/metrics.ts` (35 lines) | `increment()` (used 14 times), `timing()` (used 0 times) |
| Console output | `logger.ts:97-115` | All levels map to `console.debug/info/warn/error` |
| Request logging | `src/lib/api-handler.ts` | Basic success/failure logging in API wrapper |

### 4.2 Gaps

| # | Gap | Impact | Effort | Priority |
|---|-----|--------|--------|----------|
| L1 | **No external log aggregation** | Logs are console-only — no Datadog, Logtail, BetterStack, Axiom | Medium | **High** |
| L2 | **No log level runtime filtering** | `logger.debug()` and `logger.info()` fire in production with no suppress | Medium | Medium |
| L3 | **`timing()` is defined but never called** | No database query timing, no HTTP request duration tracking, no external API timing | Medium | Medium |
| L4 | **No NDJSON format** | Console output is JS objects, not newline-delimited JSON — harder to ingest by tools | Low | Medium |
| L5 | **No HTTP request logging middleware** | No Morgan-style access log with method, path, status, duration | Low | Low |
| L6 | **No database query timing** | Supabase queries not wrapped with duration logging | Medium | Low |
| L7 | **No log correlation with Sentry** | `requestId`/`traceId` not propagated to Sentry breadcrumbs | Low | Low |

### 4.3 Recommendations

**Phase 1 — Log level runtime filtering (Low effort, ~30 min):**
- Read `process.env.LOG_LEVEL` in the logger constructor
- Skip emitting if the message level is below the configured level
- Default to `'info'` in production, `'debug'` in development

**Phase 2 — External log aggregation (Low effort if using existing Vercel integration, ~1-2 hours):**
- Option A: Use Vercel Log Drain (native, sends to compatible providers)
- Option B: Add a `LogTail` or `Axiom` integration via their respective SDKs
- Option C: Output NDJSON format for easier ingestion:
  ```typescript
  const logOutput = JSON.stringify({ ...context, message: context.message, timestamp: context.timestamp });
  ```

**Phase 3 — Query timing middleware (Medium effort, ~2-3 hours):**
- Create a `withTiming(label, fn)` wrapper for Supabase queries
- Log duration for queries exceeding a threshold (e.g., 200ms)
- Emit timing metrics using the existing `timing()` function

---

## 5. Alerting Infrastructure

### 5.1 Current State

| Component | File(s) | Status |
|-----------|---------|--------|
| Notification system | `src/lib/data/notifications.ts` (190 lines) | CRUD on `notifications` table |
| Notification types | `database.ts:94-129` | 34 types across 10 categories |
| Severities | `database.ts:131` | `info | success | warning | error | critical` |
| Notification creation callers | 12 locations | task, review, n8n callback, stale recovery, campaign, content, reels, creative assets, quota alerts |
| Notification bell | `src/components/notifications/NotificationBell.tsx` (251 lines) | Latest 5, unread count badge |
| Notification center | `NotificationsCenterClient.tsx` (578 lines) | Full page with filters, search, detail pane |
| Real-time | Supabase Realtime enabled in migration | **DB enabled but no client subscription** |
| Operational alerts API | `src/app/api/dashboard/operational/alerts/route.ts` (151 lines) | Heuristic alerts (stale tasks, callback failures, provider instability) — **display only** |
| Email | N/A | **Not implemented** |
| Slack | N/A | **Not implemented** |
| Webhook (outbound) | N/A | **Not implemented** |
| PagerDuty/OpsGenie | N/A | **Not implemented** |
| Incident response playbook | `docs/aos/playbooks/incident-response.md` (96 lines) | **Manual, documented only** |

### 5.2 Gaps

| # | Gap | Impact | Effort | Priority |
|---|-----|--------|--------|----------|
| N1 | **No external delivery channels** | Alerts are invisible outside the dashboard | High (new modules) | **High** |
| N2 | **Realtime enabled but not consumed** | `notifications` table is in `supabase_realtime` publication but no client `subscribe()` | Low | Medium |
| N3 | **Operational alerts are display-only** | Heuristic alerts computed but never create notification records or trigger delivery | Low | Medium |
| N4 | **No user notification preferences** | No per-user or per-workspace opt-in/out per type or channel | Medium | Low |
| N5 | **No alert escalation policy** | Unacknowledged critical alerts are not escalated | Medium | Low |
| N6 | **No on-call schedule** | No rotation, no incident assignment | Low | Low |
| N7 | **Notification DB CHECK is maintenance risk** | TypeScript `NotificationType` union and DB CHECK constraint must stay in sync manually | Low | Low |

### 5.3 Recommendations

**Phase 1 — Realtime notification subscription (Low effort, ~1-2 hours):**
- Add a `useRealtimeNotifications()` hook (or fix the existing one) that subscribes to `postgres_changes` on the `notifications` table
- Wire it into the notification bell to show new notifications instantly without polling
- The migration (`20260705000000_add_notifications_realtime.sql`) already sets up the DB side

**Phase 2 — Operational alerts → notifications bridge (Medium effort, ~2-3 hours):**
- After the operational alerts API computes heuristic alerts, create notification records for new/altered high/critical alerts
- Use the multi-channel notification system (Section 2) to deliver them
- This connects the operational health monitoring to the end-user alerting experience

**Phase 3 — Notification preferences (Medium effort, ~3-4 hours):**
- Create a `user_notification_preferences` table: `user_id, workspace_id, type (or '*'), channel (in_app/email/slack), enabled`
- Create a notification preferences UI page at `/dashboard/settings/notifications`
- Refactor `sendQuotaNotification()` and the multi-channel dispatcher to check preferences before sending

---

## 6. Priority Matrix

| # | Optimization | Area | Effort | Impact | Risk | Priority |
|---|-------------|------|--------|--------|------|----------|
| 1 | Set `SENTRY_DSN` + `release` in production env | Sentry | Low | High | None | **High** |
| 2 | Source map uploads in build pipeline | Sentry | Medium | High | Low | **High** |
| 3 | Add email delivery channel for quota alerts | Alerts | Medium | High | Low | **High** |
| 4 | Add Slack delivery channel for quota alerts | Alerts | Medium | High | Low | **High** |
| 5 | Automated health alert dispatch | Health | Medium | Medium | Low | **Medium** |
| 6 | Realtime notification subscription | Alerts | Low | Medium | Low | **Medium** |
| 7 | Operational alerts → notifications bridge | Alerts | Medium | Medium | Low | **Medium** |
| 8 | Log level runtime filtering | Logging | Low | Medium | None | **Medium** |
| 9 | External log aggregation | Logging | Low | Medium | Low | **Medium** |
| 10 | Custom Sentry performance spans | Sentry | Medium | Medium | Low | Medium |
| 11 | Health history / trend data | Health | High | Medium | Low | Medium |
| 12 | Debounce cache persistence (Redis) | Alerts | Low | Low | Low | Low |
| 13 | Enable profiling + Session Replay | Sentry | Low | Low | Low | Low |
| 14 | Notification preferences system | Alerts | Medium | Low | Low | Low |
| 15 | `timing()` function usage across queries | Logging | Medium | Medium | Low | Low |
| 16 | External uptime monitoring | Health | Low | Low | Low | Low |
| 17 | Cross-workspace health aggregation | Health | Medium | Low | Low | Low |

---

## 7. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    External Channels                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │  Email   │  │  Slack   │  │ Webhook  │  │ PagerDuty   │ │
│  │ (Resend) │  │ (Webhook)│  │ (Custom) │  │ (Future)    │ │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └──────┬──────┘ │
└────────┼──────────────┼──────────────┼──────────────┼───────┘
         │              │              │              │
┌────────▼──────────────▼──────────────▼──────────────▼───────┐
│              Channel Dispatcher (NEW)                        │
│         src/lib/notifications/channels/dispatcher.ts          │
│  - Iterates registered channels                              │
│  - Checks user preferences                                   │
│  - Best-effort per channel                                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
┌────────▼────────┐  ┌────────▼────────┐  ┌─────────▼─────────┐
│  Quota Alerts   │  │  Health Alerts  │  │ Operational       │
│  quota-alerts.ts│  │  (NEW)          │  │ Alerts            │
│  80%/95% thresh │  │  system-health  │  │ operational/      │
│  1h debounce    │  │  → dispatch on  │  │ alerts/route.ts   │
│                 │  │  new blockers   │  │ (display-only→    │
│                 │  │                 │  │  notification)    │
└─────────────────┘  └─────────────────┘  └───────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Sentry (v10.54)    │
                    │  Errors + Perf +    │
                    │  Replay (MISSING)    │
                    │  Profiling (MISSING) │
                    └─────────────────────┘
```

---

## 8. Files Referenced

| File | Role |
|------|------|
| `src/lib/usage/quota-alerts.ts` | Quota threshold alert system |
| `src/lib/usage/quotas.ts` | Usage increment + alert integration point |
| `src/lib/data/notifications.ts` | Notification CRUD |
| `src/lib/notifications-ui.ts` | Notification UI helpers |
| `src/lib/notifications/realtime-notifications.ts` | Realtime notification hook |
| `src/lib/data/system-health.ts` | Health check engine |
| `src/app/api/health/route.ts` | Health API endpoint |
| `src/app/(dashboard)/dashboard/system-health/page.tsx` | Health dashboard |
| `src/app/api/dashboard/operational/alerts/route.ts` | Operational heuristic alerts |
| `src/lib/logger.ts` | Structured logger |
| `src/lib/monitoring/metrics.ts` | Counter + timing metrics |
| `src/lib/error-handler.ts` | Sentry + logger bridge |
| `src/lib/sentry-client.tsx` | Client-side Sentry + user context |
| `src/instrumentation.ts` | Sentry initialization |
| `sentry.client.config.js` | Client Sentry config |
| `sentry.server.config.js` | Server Sentry config |
| `sentry.properties` | Sentry CLI project metadata (unused) |
| `src/app/api/dashboard/operational/summary/route.ts` | Operational summary API |
| `src/app/api/dashboard/operational/provider/route.ts` | Provider health API |
| `src/lib/data/provider-readiness.ts` | Provider readiness cache |
| `src/lib/security-audit-log.ts` | Security audit logging |
| `src/lib/api-handler.ts` | API route wrapper |
| `src/components/notifications/NotificationBell.tsx` | Notification bell UI |
| `NotificationsCenterClient.tsx` | Notification center UI |
| `src/lib/notifications/realtime-notifications.ts` | Realtime hook |
| `docs/aos/playbooks/incident-response.md` | Incident response playbook |
| `docs/orchestrator/reports/W5-USAGE-ALERTS.md` | Original quota alerts design |
