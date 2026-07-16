# W16-T1: Final Deploy Checklist + Vercel + Stripe + Monitoring Setup

> **Task:** Final Production Checklist, Env Verification, Stripe Production Testing, Monitoring/Alerting Setup, Rollback/Backup Strategy  
> **Date:** 2026-07-15  
> **Status:** ✅ Complete  

---

## 1. Final Production Checklist

### ✅ Vercel Deployment

| Check | Status | Details |
|-------|--------|---------|
| Framework preset | ✅ | Next.js 16.2.6 |
| Node version | ✅ | ≥ 20.9 (enforced via `.nvmrc` + `scripts/next-node20.sh`) |
| Build command | ✅ | `npm run build` (uses `next-node20.sh` wrapper) |
| Install command | ✅ | `npm install` |
| Server external packages | ✅ | `puppeteer-core`, `pdf-lib` in `next.config.ts` |
| Production domain | ✅ | `agentflow-ai-sigma.vercel.app` (custom domain ready) |
| SSL/TLS | ✅ | Auto-provisioned; HSTS preload configured |
| Cron jobs | ✅ | Content scheduler (`0 9 * * *`) + Health snapshot (`0 * * * *`) |
| Cache headers | ✅ | Static assets: 1 year immutable; Images: 30d SWR; API: 30-60s SWR |
| Security headers | ✅ | CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP, COEP, CORP, Reporting-Endpoints |
| Image optimization | ✅ | WebP/AVIF, remote patterns for Supabase storage |

### ✅ Supabase (Database & Auth)

| Check | Status | Details |
|-------|--------|---------|
| Production project | ✅ | Separate from dev/staging |
| Migrations applied | ✅ | Consolidated migration `20260703000000` applied |
| RLS enabled | ✅ | All `public.*` tables have RLS policies |
| Departments seeded | ✅ | 4 departments |
| Agents seeded | ✅ | 27 agents |
| Auth enabled | ✅ | Email signup, redirect URLs configured |
| Storage buckets | ✅ | `creative-assets` bucket (private) |
| MFA available | ✅ | TOTP available via Supabase Auth (enable in Dashboard) |
| Point-in-time recovery | ✅ | Available via Supabase Dashboard (Pro plan+) |

### ✅ Stripe Integration

| Check | Status | Details |
|-------|--------|---------|
| Package installed | ✅ | `stripe` added to `package.json` |
| Server client | ✅ | `src/lib/stripe/stripe-server.ts` — lazy singleton |
| Checkout API | ✅ | `POST /api/billing/create-checkout` |
| Portal API | ✅ | `POST /api/billing/create-portal` |
| Webhook handler | ✅ | `POST /api/billing/webhook` — 6 event types |
| Subscription status | ✅ | `GET /api/billing/subscription` |
| Billing page integration | ✅ | `src/app/(dashboard)/dashboard/settings/billing/` — payment flow |
| Graceful fallback | ✅ | All Stripe functions return `null` when not configured |

### ✅ Sentry (Error Tracking & Performance)

| Check | Status | Details |
|-------|--------|---------|
| Client SDK | ✅ | `sentry.client.config.js` — DSN, Replay, tags |
| Server SDK | ✅ | `instrumentation.ts` — DSN, tags, startup validation capture |
| Source maps | ✅ | `withSentryConfig` in `next.config.ts` — upload on build |
| Error boundary | ✅ | `SentryErrorBoundary` wraps all app content |
| Web Vitals | ✅ | `web-vitals.tsx` — reports LCP, CLS, INP, FCP, TTFB to Sentry |
| Logger integration | ✅ | `logger.ts` — `Sentry.captureException()` on error/warn |
| CSP allowlist | ✅ | `*.ingest.sentry.io` in CSP connect-src |

---

## 2. Environment Variables Verification

### 2.1 Required (Core App)

| Variable | Status | Notes |
|----------|--------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | ⚠️ Set in Vercel | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ⚠️ Set in Vercel | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ Set server-only | **Never expose to client** |
| `OPENAI_API_KEY` | ⚠️ Set server-only | No `NEXT_PUBLIC_` prefix |
| `AD_TOKEN_ENCRYPTION_KEY` | ⚠️ Set server-only | `openssl rand -base64 32` |
| `APP_BASE_URL` | ⚠️ Set | Production URL |
| `NEXT_PUBLIC_APP_URL` | ⚠️ Set | Same as production URL |

### 2.2 Required (Stripe — Payment Processing)

| Variable | Status | Notes |
|----------|--------|-------|
| `STRIPE_SECRET_KEY` | ⚠️ Must set | `sk_test_...` or `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | ⚠️ Must set | `whsec_...` from Stripe Dashboard |
| `STRIPE_ALLOW_LIVE_MODE` | ⚠️ Must set | `false` for test, `true` for production |

### 2.3 Required (Task Execution + n8n)

| Variable | Status | Notes |
|----------|--------|-------|
| `TASK_EXECUTION_ENABLED` | ⚠️ Set | `true` for live n8n execution |
| `N8N_WEBHOOK_URL` | ⚠️ Set | Production webhook endpoint |
| `N8N_CALLBACK_SECRET` | ⚠️ Set | Must match n8n callback header |
| `N8N_WEBHOOK_HOST_ALLOWLIST` | ⚠️ Set | SSRF protection |

### 2.4 Required (Cron + Scheduler)

| Variable | Status | Notes |
|----------|--------|-------|
| `CRON_SECRET` | ⚠️ Set | Long random secret |

### 2.5 Required (Monitoring & Alerts)

| Variable | Status | Notes |
|----------|--------|-------|
| `SENTRY_DSN` | ⚠️ Set | Sentry project DSN |
| `SENTRY_AUTH_TOKEN` | ⚠️ Set | For source map uploads |
| `SENTRY_ORG` | ⚠️ Set | Sentry org name |
| `SENTRY_PROJECT` | ⚠️ Set | Sentry project name |
| `RESEND_API_KEY` | ⚠️ Set | For email alerts |
| `EMAIL_ALERTS_TO` | ⚠️ Set | Alert recipient email |
| `SLACK_WEBHOOK_URL` | ⚠️ Optional | Slack alert channel |

### 2.6 Strongly Recommended (Production)

| Variable | Status | Notes |
|----------|--------|-------|
| `RATE_LIMIT_STORE` | ⚠️ Must set | `upstash` |
| `UPSTASH_REDIS_REST_URL` | ⚠️ Must set | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | ⚠️ Must set | Upstash token |
| `PRODUCTION_AUDIT_PASSED` | ⚠️ Set after CI | `true` after audit passes |
| `PRODUCTION_AUDIT_DATE` | ⚠️ Set after CI | ISO date of audit |
| `PRODUCTION_AUDIT_COMMIT_SHA` | ⚠️ Set after CI | Git SHA of audited build |
| `OPERATIONAL_LOG_VISIBILITY_CONFIRMED` | ⚠️ Set after CI | `true` after log access confirmed |

### 2.7 Secrets Hygiene Checklist

- [ ] **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** — is the public anon key (not service_role)
- [ ] **`SUPABASE_SERVICE_ROLE_KEY`** — is server-only (not in `NEXT_PUBLIC_*`)
- [ ] **`OPENAI_API_KEY`** — is server-only (no `NEXT_PUBLIC_` prefix)
- [ ] **`STRIPE_SECRET_KEY`** — is server-only (starts with `sk_`)
- [ ] **`STRIPE_WEBHOOK_SECRET`** — is server-only (starts with `whsec_`)
- [ ] **`.env.local`** — not committed (in `.gitignore`)
- [ ] **`AD_TOKEN_ENCRYPTION_KEY`** — stable across deploys (rotating invalidates stored ad tokens)
- [ ] **`N8N_CALLBACK_SECRET`** — rotated if ever leaked
- [ ] **`CRON_SECRET`** — rotated if ever leaked
- [ ] **Supabase anon key ≠ service role key** — startup validation checks this

---

## 3. Stripe Production Testing

### 3.1 Pre-Production Checklist (Test Mode)

Before enabling live mode, complete all steps in test mode:

- [ ] **Stripe account created** — [dashboard.stripe.com](https://dashboard.stripe.com)
- [ ] **API keys obtained** — `sk_test_...` secret key from Developers → API keys
- [ ] **Products & prices created** — Free ($0), Pro ($49/mo), Enterprise ($149/mo)
- [ ] **Webhook endpoint configured** — URL: `https://agentflow-ai-sigma.vercel.app/api/billing/webhook`
- [ ] **Webhook events enabled**: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.trial_will_end`
- [ ] **Webhook signing secret stored** — `whsec_...` in `STRIPE_WEBHOOK_SECRET`
- [ ] **Test card purchase** — `4242 4242 4242 4242` → Pro plan checkout
- [ ] **Webhook delivery verified** — Check Stripe Dashboard → Webhooks → Recent deliveries
- [ ] **Subscription syncs to DB** — Check `subscriptions` table in Supabase
- [ ] **Customer Portal works** — Manage subscription, change plan, update payment method
- [ ] **Failed payment test** — Use card `4000 0000 0000 0002` → verify `past_due` status
- [ ] **Subscription cancellation test** — Cancel in Portal → verify `canceled` status → plan reverts to `free`

### 3.2 Stripe CLI Testing (Local)

```bash
# Install Stripe CLI
# brew install stripe/stripe-cli/stripe  (macOS)

# Forward webhooks to localhost
stripe listen --forward-to localhost:3000/api/billing/webhook

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.paid
stripe trigger invoice.payment_failed
```

### 3.3 Enabling Live Mode

After all test mode checks pass:

1. **Switch to live keys** — Replace `sk_test_...` with `sk_live_...`
2. **Create live products/prices** — In Stripe Dashboard (Live mode)
3. **Configure live webhook** — Create new endpoint in Live mode with same URL
4. **Set `STRIPE_ALLOW_LIVE_MODE=true`** — Enables live mode gate
5. **Test with real card** — Complete a $1 test purchase (refund immediately)
6. **Monitor webhook delivery** — Check first 24 hours of live webhooks

---

## 4. Monitoring & Alerting Setup

### 4.1 Sentry Configuration

| Feature | Status | Details |
|---------|--------|---------|
| Error tracking | ✅ | Both client (`sentry.client.config.js`) and server (`instrumentation.ts`) |
| Performance monitoring | ✅ | `startSpan()` in AI providers, DB queries, PDF generation |
| Source maps | ✅ | Uploaded on build via `withSentryConfig` |
| Release tracking | ✅ | `VERCEL_GIT_COMMIT_SHA` as release name |
| User context | ✅ | `SentrySetup` sets user ID for error attribution |
| Web Vitals | ✅ | LCP, CLS, INP, FCP, TTFB reported as custom measurements |
| Replay | ✅ | `Sentry.replayIntegration()` for session replay |
| CSP violation reporting | ✅ | `/api/csp-violation` → Sentry (best-effort) |

### 4.2 Alert Channels

| Channel | Status | Configuration |
|---------|--------|---------------|
| **Email (Resend)** | ✅ | `EMAIL_ALERTS_ENABLED=true`, `RESEND_API_KEY`, `EMAIL_ALERTS_TO` |
| **Slack** | ⚠️ Optional | `SLACK_WEBHOOK_ENABLED=true`, `SLACK_WEBHOOK_URL` |

Alert thresholds (configurable via env vars):

| Alert Type | Threshold | Channel | File |
|------------|-----------|---------|------|
| Error rate | > 5% of requests | Email + Slack | `alerts/config.ts` |
| Quota warning | 80% usage | In-app notification | `quota-alerts.ts` |
| Quota critical | 95%+ usage | In-app + Email | `quota-alerts.ts` |
| Health degradation | Status changes from healthy | Email + Slack | `alerts/index.ts` |
| CSP violations | Any violation | Sentry (best-effort) | `api/csp-violation/route.ts` |

### 4.3 Health Check System

| Endpoint | Frequency | Purpose |
|----------|-----------|---------|
| `GET /api/health` | On-demand | Liveness/readiness probe — checks DB, n8n, storage, env |
| Cron: health-snapshot | Every hour | Writes health status to DB for historical tracking |
| System Health Dashboard | Real-time | `/dashboard/system-health` — UI for current health state |

Health checks verify:
- **Supabase** — Can read from DB
- **n8n** — Can execute tasks (webhook + callback configured)
- **Storage** — `/tmp` writable
- **Environment** — Required env vars present

### 4.4 Web Vitals Targets

| Metric | Target | Monitoring |
|--------|--------|------------|
| LCP (Largest Contentful Paint) | < 2.5s | Sentry custom measurement |
| FID (First Input Delay) | < 100ms | Sentry custom measurement |
| CLS (Cumulative Layout Shift) | < 0.1 | Sentry custom measurement |
| INP (Interaction to Next Paint) | < 200ms | Sentry custom measurement |
| FCP (First Contentful Paint) | < 1.8s | Sentry custom measurement |
| TTFB (Time to First Byte) | < 800ms | Sentry custom measurement |

### 4.5 Production Readiness Dashboard

Internal dashboard at `/dashboard/production` provides a real-time view:

- **Gate Status**: Green/Yellow/Red with detailed check breakdown
- **Environment**: 7 critical env var checks
- **Migrations**: n8n callback + security audit tables
- **Security**: Alex auth, n8n idempotency, CSP, audit marker
- **Rate Limits**: In-memory + persistent store status
- **Providers**: OpenAI, Meta, Google Ads, Pinterest readiness
- **Backups**: Latest successful backup check
- **Monitoring**: Error logging, audit logs, Vercel log visibility

---

## 5. Rollback & Backup Strategy

### 5.1 Rollback Plan

#### Vercel Rollback (Instant — < 2 minutes)

```bash
# Method 1: Vercel CLI
vercel rollback

# Method 2: Vercel Dashboard
# → Project → Deployments → ... → Rollback to previous
```

**Steps:**
1. **Identify bad deployment** — Check Sentry spike, Vercel logs, user reports
2. **Rollback Vercel** — Click "Rollback" on the previous known-good deployment
3. **Verify health** — Check `/api/health`, run smoke tests
4. **Communicate** — Notify team via Slack/email

#### Git Rollback (For code + migration recovery)

```bash
# For urgent hotfix
git checkout -b hotfix/rollback-YYYYMMDD <last-known-good-commit>
git push origin hotfix/rollback-YYYYMMDD

# For reverting a specific commit
git revert <bad-commit-hash>
git push origin main
```

#### Database Rollback (Supabase)

| Scenario | Method | Recovery Time |
|----------|--------|---------------|
| Last migration was bad | Revert migration (write compensating migration) | 15-30 min |
| Data corruption | Point-in-time recovery (Pro plan+) | 30-60 min |
| Accidental data loss | Supabase backup → restore | 1-4 hours |

**Supabase Point-in-Time Recovery:**
1. Go to Supabase Dashboard → Database → Backups
2. Click "Restore" → select point-in-time
3. Choose the timestamp just before the incident
4. Confirm restore (creates a new project with restored data)
5. Update `NEXT_PUBLIC_SUPABASE_URL` in Vercel to point to restored project

### 5.2 Automated Backup System

| Feature | Status | Details |
|---------|--------|---------|
| Backup Center | ✅ | `/dashboard/backups` — UI for creating workspace backups |
| Backup types | ✅ | Configurations, Workspace Data, Content & Creative, Agent Settings |
| Backup records | ✅ | Stored in `backup_records` table |
| Sanitization | ✅ | Secrets excluded from backups automatically |
| Backup verification | ✅ | Production readiness checks for latest successful backup |

### 5.3 Backup Operations

**Creating a backup:**
```bash
# Via Backup Center UI
# → /dashboard/backups → Select categories → Create Backup
```

**Backup data includes:**
- Workspace configurations
- Member list and roles
- Content studio items
- Creative assets metadata
- Agent and workflow settings
- Task and review records (metadata only)
- Integration settings (no tokens/secrets)

**Backup retention:**
- Backups stored in `backup_records` table (metadata)
- Actual data can be exported as JSON download
- Supabase automatic daily backups (Project settings → Backups)

### 5.4 Disaster Recovery (DR) Runbook

| Scenario | Action | Owner | RTO |
|----------|--------|-------|-----|
| App down (Vercel) | Rollback Vercel deployment | DevOps | < 5 min |
| App down (bad deploy) | Git revert + redeploy | DevOps | < 15 min |
| Database corrupted | Point-in-time restore | DevOps | 30-60 min |
| Database deleted | Supabase backup restore | DevOps | 1-4 hours |
| Credentials leaked | Rotate keys in Stripe → Supabase → Vercel | Security | < 30 min |
| Stripe webhook failing | Check endpoint URL → resend events | DevOps | < 15 min |
| Sentry not reporting | Check DSN → flush queue | DevOps | < 15 min |
| n8n not executing | Check webhook URL → callback secret | DevOps | < 30 min |

### 5.5 Monitoring for Rollback Triggers

Rollback should be triggered when:
- Error rate > 5% across API routes (detected by Sentry)
- Key user flows failing (signup, login, task creation)
- Database query timeouts > 10% of requests
- Stripe webhook delivery failure rate > 10%
- Health check returns `error` for database or n8n
- CSP violation rate spikes (possible XSS attempt)

---

## 6. Verification Checklist Summary

```
═══════════════════════════════════════════════════
           FINAL PRODUCTION VERIFICATION
═══════════════════════════════════════════════════

PRE-DEPLOY:
□ npm run lint                         (0 errors)
□ npx tsc --noEmit                     (0 errors)  
□ npm test                             (64+ passing)
□ npm run build                        (successful)
□ npm audit --audit-level=moderate     (0 vulns)
□ npm run security:audit               (no secrets leaked)

VERCEL:
□ Production domain configured
□ All env vars set (see Section 2)
□ Cron jobs visible (content-studio + health-snapshot)
□ SSL green padlock
□ Security headers verified (CSP, HSTS, etc.)

SUPABASE:
□ Migration applied (20260703000000)
□ RLS enabled on all public tables
□ Departments (4) + Agents (27) seeded
□ Storage bucket (creative-assets) private
□ MFA available (enable in Dashboard)

STRIPE:
□ Test mode: checkout, portal, webhook all verified
□ Live keys: configured (or test mode for now)
□ Products + prices created in Stripe Dashboard
□ Webhook endpoint configured + signing secret set

SENTRY:
□ DSN set for both client and server
□ Source maps uploading (SENTRY_AUTH_TOKEN set)
□ Error boundary wrapping app content

MONITORING:
□ Email alerts configured (RESEND_API_KEY)
□ Slack webhook configured (optional)
□ Health cron: every hour
□ Web Vitals being reported

BACKUPS:
□ Latest successful backup exists
□ Supabase automatic backups verified
□ Rollback procedures documented

LAUNCH:
□ Production gate: GREEN (or YELLOW with documented warnings)
□ Launch mode: set (internal or production)
□ OPERATIONAL_LOG_VISIBILITY_CONFIRMED=true
□ PRODUCTION_AUDIT_PASSED=true
═══════════════════════════════════════════════════
```

---

## 7. Key Decisions

### 1. Stripe Mode Gate
`STRIPE_ALLOW_LIVE_MODE=false` is the safe default. Set to `true` only after:
- All test mode checks pass
- A small real transaction is verified
- Webhook delivery is confirmed in production

### 2. Alert Fatigue Prevention
Alerts are disabled-by-config:
- `EMAIL_ALERTS_ENABLED=true` — enable only after confirming alert thresholds
- `SLACK_WEBHOOK_ENABLED=true` — enable only after testing alert payload
- Error rate threshold defaults to 5% — adjust based on baseline data

### 3. Rollback Before Debug
The primary rollback strategy is **Vercel instant rollback** — always roll back to a known-good state before debugging. This minimizes downtime and allows root cause analysis to happen post-recovery.

### 4. Backup Verification
The production readiness check includes `backup:latest` which verifies a **successful** backup exists. This is a gate that must pass before the platform can be marked production-ready.

---

## 8. Appendix: Related Documents

| Document | Path | Purpose |
|----------|------|---------|
| Production Deploy Checklist | `docs/PRODUCTION_DEPLOY_CHECKLIST.md` | Quick pre/post deploy reference |
| Final Launch Plan | `docs/FINAL_LAUNCH_PLAN.md` | Strategic launch plan |
| Final Launch Checklist | `docs/FINAL_LAUNCH_CHECKLIST.md` | Detailed go-live steps |
| Production Operations Launch Gate | `docs/PRODUCTION_OPERATIONS_LAUNCH_GATE.md` | Launch gate documentation |
| W14-T1 (SEO + Marketing) | `docs/W14-T1-REPORT.md` | SEO, landing pages, marketing assets |
| W15-T1 (Stripe Integration) | `docs/W15-T1-REPORT.md` | Stripe setup, webhooks, subscription lifecycle |
| Deployment Playbook (AR) | `docs/aos/playbooks/deployment-playbook.md` | Arabic deployment playbook |
| Rollback Playbook (AR) | `docs/aos/playbooks/rollback-playbook.md` | Arabic rollback playbook |
| Incident Response (AR) | `docs/aos/playbooks/incident-response.md` | Arabic incident response plan |
| SOC2 Readiness Checklist | `docs/compliance/SOC2_READINESS_CHECKLIST.md` | Security compliance |

---

*Report generated 2026-07-15 | W16-T1 ✅ Complete*
