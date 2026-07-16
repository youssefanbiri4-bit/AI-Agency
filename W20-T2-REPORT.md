# W20-T2 — Senior DevOps + Infrastructure Engineer

**Production Infrastructure + Monitoring + Backup Strategy + Launch Checklist**

Status: ✅ Complete (code, config, docs, lint). Build verification blocked by
pre-existing sandbox limits (no Google Fonts / no Chromium → `next build` hangs).
Type-check clean for all W20-T2 files; remaining `tsc` errors are pre-existing
baseline in unrelated files (billing webhook, launch-metrics, ai-performance).

---

## Deliverables

### 1. Monitoring
- **Prometheus metrics endpoint** — `src/app/api/metrics/route.ts`
  (`GET /api/metrics`, protected by `CRON_SECRET`). Exposes aggregated
  counters/gauges via `renderPrometheusMetrics()`.
- **In-memory metric registry** — extended `src/lib/monitoring/metrics.ts`
  with `setGauge()`, `renderPrometheusMetrics()`, `collectAndResetMetrics()`.
  Existing `increment()`/`timing()` now also aggregate by name+labels so they
  are scrapeable (not only JSON logs).
- **Startup gauges** — `instrumentation.ts` emits `app_instance_up` and
  `app_build_info{version,commit,environment}` at boot for fleet/rollout
  observability.
- JSON metric logs (`{type:"metric",...}`) remain for Vercel log-drain shipping.

### 2. Alerting (hardened)
- **Generic webhook / PagerDuty channel** — `src/lib/alerts/webhook.ts`
  (`WEBHOOK_ALERTS_ENABLED`, `WEBHOOK_ALERTS_URL`, `PAGERDUTY_ROUTING_KEY`).
  Sends incidents in PagerDuty Events API v2 shape (or raw JSON if no routing key).
- **Channel allow-list** — `AlertConfig.channels` (+ `ALERT_CHANNELS` env).
  `dispatchAlert` (index.ts) respects the allow-list; defaults to all enabled.
- **Threshold config** — `src/lib/alerts/config.ts` `ThresholdConfig`:
  `errorRate`, `latencyP95` (ms), `redisMemoryWarnMb`, `dbReplicaLagWarnSeconds`,
  `backupMaxAgeDays` — all env-overridable.
- **Per-workspace Slack** — `resolveWebhookUrl` now reads `workspace_alert_channels`.
- **New alert helpers** (index.ts): `alertHighLatency`, `alertBackupFailure`,
  `alertCachePressure`.

### 3. Backup & DR
- **`backup_jobs` table** — migration `supabase/migrations/20260720000000_backup_dr.sql`
  (service-role-only RLS, indexed). Records every backup run with RPO/RTO targets.
- **`src/lib/backup/backup-jobs.ts`** — `startBackupJob`, `finishBackupJob`,
  `getLatestSuccessfulBackups`, `daysSinceLastBackup`.
- **Backup watchdog cron** — `src/app/api/cron/backup/route.ts` (daily 02:00 in
  `vercel.json`). Verifies the last real dump is within `ALERT_BACKUP_MAX_AGE_DAYS`
  and fires a critical `alertBackupFailure` if missing/stale.
- **`scripts/backup-snapshot.sh`** — `pg_dump | gzip` → Supabase Storage / S3.
  RPO target 60m, RTO 15m (env-tunable). Syntax-checked.
- **Shared cron auth** — `src/lib/cron/auth.ts` (`isCronAuthorized`, constant-time
  Bearer compare). Refactored `health-snapshot` route to use it (DRY).
- **`src/types/database.ts`** — added `backup_jobs` (+ earlier `invoices`,
  `payment_methods`, `usage_costs`, `sum_workspace_cost`, `list_rls_enabled_tables`).

### 4. Docs / Launch readiness
- **`INFRASTRUCTURE.md`** — architecture, env spec, deploy paths, cron table,
  monitoring/alerting, backup/restore, full launch checklist (§6).
- **`SCALING.md` §7** — checklist extended with monitoring, alerting, backup,
  cron-secret, Sentry release, graceful shutdown, and a pointer to `INFRASTRUCTURE.md`.
- **`.env.example`** — documented all new `ALERT_*`, `WEBHOOK_ALERTS_*`,
  `PAGERDUTY_ROUTING_KEY` vars.
- **`vercel.json`** — added `/api/cron/backup` daily cron.
- **`next.config.ts`** — added `no-store` header for `/api/metrics`.

---

## Verification
- `eslint` (max-warnings=0): ✅ clean on all W20-T2 files.
- `tsc --noEmit`: ✅ no errors in any W20-T2 file. Pre-existing baseline errors
  remain in `api/billing/webhook/route.ts`, `lib/data/launch-metrics.ts`,
  `lib/monitoring/ai-performance.ts`, and the known `puppeteer networkidle0` /
  `Buffer→NextResponse` typings in the W14–W15 PDF export routes.
- `bash -n scripts/backup-snapshot.sh`: ✅ syntax OK.
- `npm run build` / Lighthouse: ❌ blocked (offline fonts + no Chromium) — pre-existing.

## RPO / RTO
- RPO: 60 min (hourly logical dump via `scripts/backup-snapshot.sh`).
- RTO: 15 min (restore from latest dump + `supabase db push` only if schema changed).
