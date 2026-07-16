# Production Deploy Checklist

> **Operator quick sheet** — use with the full [Final Launch Checklist](FINAL_LAUNCH_CHECKLIST.md) for Morad's step-by-step go-live.

**Last updated:** 2026-07-04  
**Production URL:** https://agentflow-ai-sigma.vercel.app

---

## Before every production deploy

### 1. Code & git

- [ ] `git status` — only intended changes on release branch
- [ ] PR reviewed (if applicable)
- [ ] Release commit SHA recorded for audit marker

### 2. Local verification (same commit as deploy)

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
npm audit --audit-level=moderate
```

- [ ] All pass
- [ ] Update Vercel env after audit:
  - `PRODUCTION_AUDIT_PASSED=true`
  - `PRODUCTION_AUDIT_DATE=<ISO date>`
  - `PRODUCTION_AUDIT_COMMIT_SHA=<git sha>`

### 3. Security sanity

- [ ] No `.env` / `.env.local` changes committed
- [ ] No tokens or provider secrets in logs or client bundles
- [ ] `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `N8N_CALLBACK_SECRET` remain server-only
- [ ] `npm run security:audit` — review any new findings

---

## Database (Supabase)

**One consolidated migration** (replaces 38 incremental files):

```text
supabase/migrations/20260703000000_full_clean_schema.sql
```

| Environment | Command |
|-------------|---------|
| Local reset | `supabase db reset` |
| Production | `supabase db push` |

**Never** run `db reset` on production.

### Post-migration checks

- [ ] `departments` → 4 rows · `agents` → 27 rows
- [ ] RLS enabled on all tables
- [ ] `creative-assets` storage bucket private
- [ ] `usage_limits` seeded on new workspaces
- [ ] Billing tables: client writes blocked

Full DB steps: [Final Launch Checklist → Phase 1.3](FINAL_LAUNCH_CHECKLIST.md#13-supabase--database-migration)

---

## Vercel environment (Production)

### Minimum required

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only |
| `OPENAI_API_KEY` | Server only |
| `AD_TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32` |
| `APP_BASE_URL` | Production URL |
| `TASK_EXECUTION_ENABLED` | `true` when n8n live |
| `N8N_WEBHOOK_URL` | |
| `N8N_CALLBACK_SECRET` | |
| `N8N_WEBHOOK_HOST_ALLOWLIST` | |
| `CRON_SECRET` | For Vercel Cron |

### Strongly recommended

| Variable | Notes |
|----------|-------|
| `RATE_LIMIT_STORE=upstash` | |
| `UPSTASH_REDIS_REST_URL` | |
| `UPSTASH_REDIS_REST_TOKEN` | |
| `OPERATIONAL_LOG_VISIBILITY_CONFIRMED=true` | After log access verified |
| `SENTRY_DSN` | Error tracking |

### Optional integrations

Meta (`META_*`), Google Ads (`GOOGLE_ADS_*`), Pinterest (`PINTEREST_*`), PDF Chromium (`PUPPETEER_EXECUTABLE_PATH`).

Full table: [Final Launch Checklist → Phase 1.5](FINAL_LAUNCH_CHECKLIST.md#15-vercel--environment-variables-production)

---

## Vercel Cron

Configured in `vercel.json`:

| Path | Schedule |
|------|----------|
| `/api/cron/content-studio-scheduler` | `0 9 * * *` (daily 09:00 UTC) |

- [ ] `CRON_SECRET` set in Vercel Production
- [ ] Cron visible under Vercel → Cron Jobs

---

## Production gate & quotas

Before enabling real publishing, generation, or paid ads:

- [ ] `/dashboard/production` reviewed — target: Green (or Yellow for internal beta only)
- [ ] `integration_settings.settings.production_operations` configured:
  - `launch_mode`: `internal` | `production` | `blocked`
  - `paid_ads_enabled`: default `false`
  - `max_daily_ad_spend` if ads enabled
- [ ] `/dashboard/usage` — quotas active and incrementing
- [ ] Sensitive actions call `assertProductionGate` (execute, image gen, publish)

---

## Deploy commands

```bash
npx vercel --prod
```

**Fallback** if packaging fails:

```bash
npx vercel build --prod
npx vercel deploy --prebuilt --prod --archive=tgz
```

---

## Post-deploy smoke (15 minutes)

- [ ] Production URL loads; login works
- [ ] `/dashboard/agent-library` · `/dashboard/alex` · `/dashboard/reports`
- [ ] Create one safe pending task (no unintended n8n spend)
- [ ] Download **Client PDF** from `/dashboard/reports` — verify `%PDF-` file
- [ ] `/dashboard/system-health` — providers as expected
- [ ] `/dashboard/production` — gate status unchanged or improved
- [ ] No secrets in browser devtools Network tab

**Do not** on first smoke: live ad spend, mass scheduling, or bulk n8n runs.

---

## Rollback

1. Vercel → Deployments → Promote previous deployment (fastest).
2. If DB migration caused issues: fix-forward SQL or Supabase PITR — never `db reset` on prod.
3. Emergency: set `TASK_EXECUTION_ENABLED=false` and `launch_mode: "blocked"`.

Details: [Final Launch Checklist → Phase 4.4](FINAL_LAUNCH_CHECKLIST.md#44-rollback-plan)

---

## Related documentation

- **[Final Launch Checklist](FINAL_LAUNCH_CHECKLIST.md)** — complete pre/post launch for Morad
- [Production Launch Checklist](PRODUCTION_LAUNCH_CHECKLIST.md) — schema-focused pre-launch
- [Final Launch Plan](FINAL_LAUNCH_PLAN.md) — architecture analysis & 30-day roadmap
- [Production Operations Launch Gate](PRODUCTION_OPERATIONS_LAUNCH_GATE.md) — gate markers & spend controls
- [Team Onboarding](TEAM_ONBOARDING.md) — post-deploy team setup
- Root [README.md](../README.md) — env setup reference