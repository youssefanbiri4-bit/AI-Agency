# AgentFlow AI — Final Launch Checklist

> **For:** Morad (Release Engineer / DevOps)  
> **Project:** [AI-Agency](https://github.com/youssefanbiri4-bit/AI-Agency)  
> **Production URL:** https://agentflow-ai-sigma.vercel.app  
> **Last updated:** 2026-07-04  
> **Status:** Ready for **controlled production deploy** (internal team + early clients). Not public GA without P1 items below.

This is the **single source of truth** for go-live. Work top-to-bottom; do not skip Phase 1 (infrastructure) before Phase 2 (verification).

**Related docs:** [Production Deploy Checklist](PRODUCTION_DEPLOY_CHECKLIST.md) · [Team Onboarding](TEAM_ONBOARDING.md) · [Production Operations Launch Gate](PRODUCTION_OPERATIONS_LAUNCH_GATE.md)

---

## Quick reference — what must be green before launch

| Area | Pass criteria |
|------|----------------|
| Supabase | Migration `20260703000000` applied; RLS on; 4 departments + 27 agents seeded |
| Vercel | Production env vars set; cron configured; deploy succeeds |
| CI local | `npm run lint` · `npx tsc --noEmit` · `npm test` · `npm run build` all pass |
| Gate | `/dashboard/production` ≥ Yellow for internal; Green before paid ads / heavy automation |
| RBAC | Roles + departments tested for viewer/editor/operator/admin/owner |
| Quotas | `/dashboard/usage` shows limits; hard block on over-limit image gen / publish |
| Reports | Client PDF downloads from `/dashboard/reports` and task detail (real data, not print) |

---

## Phase 1 — Production deployment (Vercel + Supabase)

### 1.1 Repository & branch

- [ ] Confirm deploying branch: `fix/ci-deps-cleanup` (or merged `main` after PR review)
- [ ] Latest commit includes server PDF reporting (`feat(reports)` or equivalent)
- [ ] `git status` clean on release commit
- [ ] GitHub repo linked to Vercel project **agentflow-ai**

### 1.2 Supabase — project setup

- [ ] Production Supabase project created (separate from dev/staging recommended)
- [ ] Note **Project URL**, **anon key**, **service_role key** (Settings → API)
- [ ] Auth: email signup enabled; redirect URLs include production domain
- [ ] Storage: `creative-assets` bucket exists and is **private** (`public = false`)

### 1.3 Supabase — database migration

**Single consolidated migration:**

```text
supabase/migrations/20260703000000_full_clean_schema.sql
```

**Apply to production (never `db reset` on prod):**

```bash
supabase link --project-ref <PRODUCTION_PROJECT_REF>
supabase db push
```

- [ ] Migration appears in Dashboard → Database → Migrations
- [ ] No failed statements in migration logs
- [ ] Post-push verification:
  - [ ] `departments` → **4 rows**
  - [ ] `agents` → **27 rows**
  - [ ] `workspace_members.role` uses `rbac_role` enum
  - [ ] RLS enabled on all `public.*` tables
  - [ ] `usage_limits` seed trigger on new workspace (`handle_new_workspace_owner`)
  - [ ] `subscriptions` / `billing_customers` — no authenticated INSERT/UPDATE policies

### 1.4 Vercel — project settings

- [ ] Framework: Next.js; Node **≥ 20.9**
- [ ] Build command: `npm run build` (uses `scripts/next-node20.sh`)
- [ ] Install command: `npm install`
- [ ] Root directory: repository root
- [ ] `serverExternalPackages`: `puppeteer-core`, `pdf-lib` (in `next.config.ts`)

### 1.5 Vercel — environment variables (Production)

Set in **Vercel → Settings → Environment Variables → Production**.

#### Required (core app)

| Variable | Scope | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | All | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | **Never** expose to client |
| `OPENAI_API_KEY` | Server only | No `NEXT_PUBLIC_OPENAI_*` |
| `AD_TOKEN_ENCRYPTION_KEY` | Server only | `openssl rand -base64 32` |
| `APP_BASE_URL` | Server | `https://agentflow-ai-sigma.vercel.app` or custom domain |
| `NEXT_PUBLIC_APP_URL` | Public | Same as production URL |

#### Task execution + n8n

| Variable | Scope | Notes |
|----------|-------|-------|
| `TASK_EXECUTION_ENABLED` | Server | `true` for live n8n execution |
| `N8N_WEBHOOK_URL` | Server | Production webhook endpoint |
| `N8N_CALLBACK_SECRET` | Server | Must match n8n callback header |
| `N8N_WEBHOOK_HOST_ALLOWLIST` | Server | Hostname only (SSRF protection) |

#### Cron + scheduler

| Variable | Scope | Notes |
|----------|-------|-------|
| `CRON_SECRET` | Server | Long random secret; Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` |

`vercel.json` cron (already in repo):

```json
{ "path": "/api/cron/content-studio-scheduler", "schedule": "0 9 * * *" }
```

- [ ] Cron job visible in Vercel → Cron Jobs
- [ ] `CRON_SECRET` matches what cron invocations use

#### Production gate markers (set by CI / release engineer)

| Variable | When to set |
|----------|-------------|
| `PRODUCTION_AUDIT_PASSED` | `true` after `npm audit --audit-level=moderate` passes on release commit |
| `PRODUCTION_AUDIT_DATE` | ISO date of audit |
| `PRODUCTION_AUDIT_COMMIT_SHA` | Git SHA of audited build |
| `OPERATIONAL_LOG_VISIBILITY_CONFIRMED` | `true` after confirming Vercel logs + deploy access |

#### Rate limiting (strongly recommended for prod)

| Variable | Notes |
|----------|-------|
| `RATE_LIMIT_STORE` | `upstash` |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash token |

Without Upstash, rate limits are **in-memory** (not safe across serverless instances).

#### Optional — providers (enable when needed)

| Group | Variables |
|-------|-----------|
| Meta / Instagram | `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `META_GRAPH_API_VERSION` |
| Google Ads | `GOOGLE_ADS_*` (OAuth, developer token, customer ID) |
| Pinterest | `PINTEREST_APP_ID` or `PINTEREST_CLIENT_ID`, `PINTEREST_APP_SECRET`, `PINTEREST_REDIRECT_URI` |
| Stripe billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs, `STRIPE_ALLOW_LIVE_MODE=true` for live |
| Sentry | `SENTRY_DSN` |
| Client PDF (HTML branding) | `PUPPETEER_EXECUTABLE_PATH` or `CHROME_PATH` — optional; pdf-lib fallback works without Chromium |
| PDF password | Install `qpdf` on build image if password protection required (optional) |

- [ ] All required vars set for target launch scope (internal vs full providers)
- [ ] No secrets in `NEXT_PUBLIC_*` except Supabase anon key
- [ ] Preview/Development envs use separate Supabase project or keys where possible

### 1.6 Secrets hygiene

- [ ] `.env.local` not committed (in `.gitignore`)
- [ ] Service role key only in Vercel server env
- [ ] Rotate `N8N_CALLBACK_SECRET` and `CRON_SECRET` if ever leaked
- [ ] `AD_TOKEN_ENCRYPTION_KEY` stable across deploys (rotating invalidates stored ad tokens)

---

## Phase 2 — Pre-launch verification

Run on the **exact commit** you will deploy.

### 2.1 Automated checks

```bash
npm run lint
npx tsc --noEmit
npm test          # expect 64+ passing
npm run build
npm run security:audit
npm audit --audit-level=moderate
```

- [ ] All commands pass with zero errors
- [ ] Set `PRODUCTION_AUDIT_*` env vars on Vercel after audit passes

### 2.2 Security

- [ ] No `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, or provider secrets in browser Network tab
- [ ] `/api/tasks/execute` requires auth + production gate + n8n readiness
- [ ] `/api/n8n/callback` validates `N8N_CALLBACK_SECRET`
- [ ] `/api/cron/content-studio-scheduler` rejects requests without `CRON_SECRET`
- [ ] Billing webhook uses `STRIPE_WEBHOOK_SECRET` / `BILLING_WEBHOOK_SECRET`
- [ ] RLS: two test workspaces cannot read each other's tasks/assets

### 2.3 Production gate

Open `/dashboard/production` and `/dashboard/settings` (Production section) as **owner**:

- [ ] Lightweight checks: env, n8n, Supabase — green
- [ ] `launch_mode` set deliberately in `integration_settings.settings.production_operations`:
  - **Internal beta:** `"launch_mode": "internal"` · `paid_ads_enabled: false`
  - **Production:** `"launch_mode": "production"` only after spend controls configured
- [ ] `max_daily_ad_spend` set if `paid_ads_enabled: true`
- [ ] Gate status documented before enabling publish/execute at scale

### 2.4 RBAC + departments

Test with **separate accounts** per role (or Supabase `workspace_members` rows):

| Role | Must work | Must block |
|------|-----------|------------|
| `viewer` | Read tasks, reports | Create task, execute, publish, generate images |
| `editor` | Create tasks, creative assets | Execute, publish reels |
| `operator` | Execute, publish (if gate green) | Billing settings, member admin |
| `admin` | Settings, roles view | Owner-only billing delete |
| `owner` | Full workspace control | — |

- [ ] Sidebar hides areas user cannot access (`canViewArea`)
- [ ] Department scoping: non-admin in `social` dept does not see other dept tasks (server list filter)
- [ ] `ClientReportButton` requires editor+ (`downloadClientReportPdfAction`)

### 2.5 Usage quotas

- [ ] `/dashboard/usage` loads limits for workspace
- [ ] New workspace has `usage_limits` row (seed trigger)
- [ ] Image generation blocks when `ai_generations` at limit
- [ ] Task create/execute increments counters via service role
- [ ] Near-limit warnings visible on usage page

### 2.6 Feature smoke (staging or preview deploy)

- [ ] Sign up → onboarding → create workspace
- [ ] Create task → Run Task (n8n) → callback → review → complete
- [ ] Creative asset: prompt → generate image (if OpenAI key set)
- [ ] Reel: create → link asset → publish readiness panel
- [ ] **Client report:** `/dashboard/reports` → Download Client PDF (file is `%PDF-`, real workspace counts)
- [ ] Task detail → Download Task PDF (scoped to single task)
- [ ] Content Studio scheduler cron path returns 401 without secret, 200 with secret (manual curl)

### 2.7 Monitoring prep

- [ ] Sentry project connected (`SENTRY_DSN`) or decision to launch without it documented
- [ ] Vercel log drain / alert email configured for 5xx spikes
- [ ] Bookmark: `/dashboard/system-health`, `/dashboard/recovery`, `/dashboard/usage`

---

## Phase 3 — Deploy day

### 3.1 Deploy

```bash
# Option A — Vercel Git integration (recommended)
git push origin <release-branch>
# Wait for Vercel production deployment

# Option B — CLI
npx vercel --prod

# Option C — Prebuilt (if packaging fails)
npx vercel build --prod
npx vercel deploy --prebuilt --prod --archive=tgz
```

- [ ] Production deployment status: **Ready**
- [ ] No build warnings for missing `puppeteer` full package (uses `puppeteer-core`)

### 3.2 Post-deploy smoke (production URL)

- [ ] Login + active workspace cookie works
- [ ] `/dashboard` loads without 5xx
- [ ] Create one **safe** pending task (no accidental live spend)
- [ ] Download one client PDF
- [ ] `/api/health` or system-health page responds
- [ ] Cron: check Vercel Cron logs after next `0 9 * * *` run (or trigger manually with Bearer secret)

### 3.3 Custom domain (optional)

- [ ] Domain added in Vercel → DNS verified
- [ ] Update `APP_BASE_URL` + `NEXT_PUBLIC_APP_URL`
- [ ] Update Supabase Auth redirect URLs + OAuth provider callbacks (`META_REDIRECT_URI`, etc.)
- [ ] Redeploy after URL changes

---

## Phase 4 — Post-launch (first 7–30 days)

### 4.1 Monitoring cadence

**Daily (owner/operator):**

- [ ] Sentry: new errors on execute, image gen, publish, PDF generation
- [ ] Vercel: 5xx rate on `/api/tasks/execute`, `/api/n8n/callback`, `/api/reports/client-pdf`
- [ ] `/dashboard/usage` — quota blocks and spend trajectory
- [ ] `/dashboard/production` — gate still green/yellow as expected

**Weekly:**

- [ ] Review operational reports copy from `/dashboard/reports`
- [ ] Update `TECH_DEBT.md` with new findings
- [ ] Check Supabase disk/connection metrics

### 4.2 Backups & recovery

- [ ] Enable Supabase **Point-in-Time Recovery** (Pro plan) or document backup policy
- [ ] Export critical workspace config (brand kit, integration_settings) documented
- [ ] Test restore procedure on staging once
- [ ] `backup_records` table used for operator-initiated exports (if feature enabled)

### 4.3 Team onboarding

- [ ] Share [Team Onboarding Guide](TEAM_ONBOARDING.md) with all members
- [ ] Owner adds members via Supabase `workspace_members` (role + department)
- [ ] Each member completes: login → dashboard → role-appropriate first task
- [ ] Admin walkthrough: settings → providers → production gate → usage

### 4.4 Rollback plan

| Scenario | Action |
|----------|--------|
| Bad deploy | Vercel → Deployments → **Promote** previous deployment (instant) |
| Schema issue | Do **not** run `db reset` on prod; fix-forward migration or PITR restore |
| Runaway spend | Set `launch_mode: "blocked"` in production_operations; disable `TASK_EXECUTION_ENABLED` |
| n8n incident | Pause n8n workflow; set `TASK_EXECUTION_ENABLED=false` until root cause fixed |
| OAuth leak | Rotate provider secrets + `AD_TOKEN_ENCRYPTION_KEY` (forces re-connect ads) |

- [ ] Rollback owner assigned (Morad + tech lead)
- [ ] Previous known-good Vercel deployment ID recorded: `________________`

---

## Critical fixes — status at launch (2026-07-04)

| ID | Item | Status |
|----|------|--------|
| C1–C8 | Build, execute, RLS, billing, usage_limits | ✅ Done |
| H1 | Reels Studio unified | ✅ Done |
| H14 | Fake report metrics removed | ✅ Done |
| M15 | Server PDF (not window.print) | ✅ Done |
| M16 | Brand kit wired in reports | ✅ Done |
| P1 | Persistent rate limits (Upstash) | ⚠️ Required before public scale |
| P1 | Full task-create path quota coverage | ⚠️ Partial — monitor |
| P1 | Stripe Checkout / portal | ⚠️ Foundation only |
| P1 | `PUPPETEER_EXECUTABLE_PATH` on Vercel | ⚠️ Optional — pdf-lib fallback active |

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Release Engineer | Morad | | |
| Tech Lead | | | |
| Product Owner | | | |

**Launch mode authorized:** ☐ Internal beta only · ☐ Production (paid ads disabled) · ☐ Full production

---

*After sign-off, archive this checklist with deployment ID and git SHA in your runbook.*