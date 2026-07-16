# Production Infrastructure Setup Guide

**Task W20-T2 — Senior DevOps + Infrastructure Engineer**

This document describes the production infrastructure for AgentFlow AI, how to
deploy it, monitor it, back it up, and the launch checklist. It builds on
`SCALING.md` (horizontal scaling) and the prior hardening work (W14/W17/W18/W19).

---

## 1. Architecture

| Layer | Technology | Notes |
|-------|-----------|-------|
| App runtime | Next.js (App Router) on **Vercel** | `next start` via `npm start`; no custom server. Stateless (see `SCALING.md §1`). |
| DB | **Supabase Postgres** | RLS per tenant (`is_workspace_member`). Service-role client bypasses RLS — always scope by `workspace_id` (`withTenantScope`). |
| Cache / limits | **Redis** (ioredis) | Rate limiting, query cache, AI cache, cost budget. In-memory fallback if down. |
| Queue | **BullMQ** (Redis) | Async jobs; separate from web tier. |
| Auth | Supabase Auth (cookies) | `createSupabaseServerClient()` per request. |
| Secrets scan | `src/lib/secrets-scanning.ts` | Runs at boot (`instrumentation.ts`) + CI. |
| Tracing | Sentry | `instrumentation.ts` init; release tagged with commit. |
| PDF | puppeteer-core | HTML→PDF; HTML fallback when Chromium absent. |

**Statelessness:** no in-process state required to serve a request. Redis holds
all shared state (limits, cache, AI cache). Safe to run ≥2 instances behind
Vercel's edge/load balancer.

---

## 2. Environment Variables (required in prod)

See `.env.example`. Critical groups:
- **App:** `NODE_ENV=production`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`.
- **DB:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` (server-only).
- **Redis:** `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` (or `UPSTASH_REDIS_*`).
- **Auth/N8n:** `N8N_WEBHOOK_URL`, `N8N_CALLBACK_SECRET`.
- **Alerting (W20-T2):** `ALERTS_ENABLED`, `ALERT_ERROR_RATE_THRESHOLD`,
  `ALERT_LATENCY_P95_MS`, `ALERT_BACKUP_MAX_AGE_DAYS`, `ALERT_CHANNELS`,
  `SLACK_WEBHOOK_ENABLED`/`URL`, `EMAIL_ALERTS_*`, `WEBHOOK_ALERTS_*`,
  `PAGERDUTY_ROUTING_KEY`.
- **PDF (optional):** `CHROME_PATH`.

---

## 3. Deployment

Two paths:

### 3.1 One-shot orchestrator (recommended)
```bash
./scripts/deploy-production.sh            # preflight + migrate + deploy + smoke
./scripts/deploy-production.sh --preflight # checks only
./scripts/deploy-production.sh --smoke-only # post-deploy smoke
```
Preflight runs `verify:env`, tests, `security:audit`, and `build`. Then
`supabase db push` (migrations) and `vercel --prod`.

### 3.2 Manual
```bash
npm run build
supabase db push            # or Dashboard SQL editor for migrations
npx vercel --prod --yes
npm run smoke:prod
```

### 3.3 Cron jobs (vercel.json)
| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/content-studio-scheduler` | daily 09:00 | Content scheduling |
| `/api/cron/health-snapshot` | hourly | `snapshotSystemHealth()` → `system_health_snapshots` + alerts |
| `/api/cron/backup` | daily 02:00 | Backup freshness monitor (W20-T2) |

All cron routes require `Authorization: Bearer $CRON_SECRET`
(`src/lib/cron/auth.ts`, constant-time compare).

---

## 4. Monitoring & Alerting

- **Metrics:** app code emits `{type:"metric",name,labels,value}` JSON logs
  (shipped to a Vercel log drain). A per-instance Prometheus scrape endpoint
  is available at `GET /api/metrics` (protected by `CRON_SECRET`); exposes
  aggregated counters/gauges (e.g. `app_instance_up`, `app_build_info`,
  `ai.*`, `server.*`, `worker_*`).
- **Health:** `/api/health` (detailed, auth-gated), `/api/health/live`
  (liveness), `/api/health/ready` (readiness: DB + Redis). Wire to your
  orchestrator's probes.
- **Alert channels (W20-T2):** email (Resend), Slack (global + per-workspace
  via `workspace_alert_channels`), and a generic webhook / PagerDuty
  (`WEBHOOK_ALERTS_URL`). Channel allow-list via `ALERT_CHANNELS`.
- **Alert types:** health degradation, high error rate, high latency
  (p95), Redis memory pressure, **backup missing/stale**. Defined in
  `src/lib/alerts/index.ts`.

---

## 5. Backup & Disaster Recovery

- **Table `backup_jobs`** (migration `20260720000000_backup_dr`) records every
  backup run (type, status, size, RPO/RTO targets). Service-role only.
- **Dump script:** `scripts/backup-snapshot.sh` — `pg_dump | gzip` → Supabase
  Storage / S3. Run hourly via your scheduler (RPO target 60m).
- **Watchdog:** `/api/cron/backup` verifies the last successful `db_snapshot_real`
  is within `ALERT_BACKUP_MAX_AGE_DAYS` and alerts (critical) if missing/stale.
- **Targets (defaults):** RPO 60 min (hourly logical dump), RTO 15 min
  (restore from latest dump). Tune via `RPO_TARGET_MINUTES` / `RTO_TARGET_MINUTES`.
- **Restore:**
  ```bash
  gunzip -c <dump>.sql.gz | psql "$DATABASE_URL"
  ```
  Then `supabase db push` only if schema changed; never push migrations over
  restored data blindly.

---

## 6. Launch Infrastructure Checklist

See `SCALING.md §7` (extended below) and the checklist at the end of this doc.

### Pre-deploy
- [ ] `./scripts/deploy-production.sh --preflight` passes (env, tests, audit, build).
- [ ] All W*-T2 migrations applied (`scaling_isolation`, `billing_invoices`,
  `perf_optimization`, `backup_dr`).
- [ ] Redis provisioned + reachable; `getRedisClient()` non-null in logs.
- [ ] `verifyTenantIsolation()` smoke → `ok: true`.
- [ ] Secrets scan passes at boot (no `NEXT_PUBLIC_*` leaking a service-role key).

### Runtime
- [ ] ≥2 Vercel instances / regions for HA.
- [ ] Health probes wired: `/api/health/live` + `/api/health/ready`.
- [ ] `/api/metrics` scrape target registered in monitoring (token-protected).
- [ ] Alert channels configured + a test alert fires to each.
- [ ] Backup cron + `scripts/backup-snapshot.sh` scheduled (RPO met).
- [ ] Backup watchdog (`/api/cron/backup`) alerting on staleness.
- [ ] Sentry release tagged with `VERCEL_GIT_COMMIT_SHA`.
- [ ] Graceful shutdown registered (`instrumentation.ts`): redis quit, queue
  stop, Sentry flush.

### Post-deploy
- [ ] `npm run smoke:prod` passes against production URL.
- [ ] Manually trigger one backup + confirm a `backup_jobs` row appears.
- [ ] Trigger a test alert; confirm delivery to Slack/email/webhook.
