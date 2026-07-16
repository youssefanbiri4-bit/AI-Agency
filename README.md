# AgentFlow AI

> Production-ready AI Agency Dashboard with n8n automation, RBAC, Reels Studio, Creative Assets, Client Reporting, Quotas & Gates.

**Production URL:** https://agentflow-ai-sigma.vercel.app

## Quick Links for Teams

**New to the platform? Start here:**

- **[Team Onboarding Guide](docs/TEAM_ONBOARDING.md)** ← **Most important for everyone**
  - Separate sections for **Admins/Owners** and **New Team Members**.
  - Login, RBAC explained simply, create tasks, Reels + Creative Assets, generate reports, quotas, common issues, checklists.

**Admins / Owners:**
- Add team members, assign roles + departments, set quotas → see the Admin section in the Onboarding Guide.
- Full settings: `/dashboard/settings` (roles, branding, production gate).
- Monitor: `/dashboard/usage`, `/dashboard/production`, `/dashboard/reports`.

**Release / DevOps (start here for deploy):**
- **[Final Launch Checklist](docs/FINAL_LAUNCH_CHECKLIST.md)** ← step-by-step for Morad (Vercel + Supabase + pre/post launch)
- [Production Deploy Checklist](docs/PRODUCTION_DEPLOY_CHECKLIST.md) — quick operator sheet per deploy

**Detailed Documentation:**
- [Full Documentation & Architecture](docs/README.md)
- [Final Launch Plan](docs/FINAL_LAUNCH_PLAN.md) — analysis & 30-day roadmap
- [RBAC Implementation](docs/RBAC_IMPLEMENTATION.md)
- [Production Launch Checklist](docs/PRODUCTION_LAUNCH_CHECKLIST.md) — schema verification

## For Developers

See the detailed guide in `docs/README.md` for tech stack, flows, local dev, etc.

### Environment Setup

AgentFlow AI reads environment variables from `.env.local` during local development. A committed template lives at `.env.example` — copy it, then fill in real values.

#### 1. Create `.env.local` from the template

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values. **Never commit this file** — it is listed in `.gitignore`.

#### 2. Minimum variables for local dev

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | [Supabase Dashboard](https://supabase.com/dashboard) → Project → **Settings → API** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page (anon/public key) |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page (service_role key — **server-only**) |
| `OPENAI_API_KEY` | [OpenAI Platform](https://platform.openai.com/api-keys) |
| `AD_TOKEN_ENCRYPTION_KEY` | Generate locally: `openssl rand -base64 32` |

To test task execution and n8n callbacks locally, also set:

- `TASK_EXECUTION_ENABLED=true`
- `N8N_WEBHOOK_URL` — your n8n production webhook URL
- `N8N_CALLBACK_SECRET` — long random secret (must match n8n callback header)
- `N8N_WEBHOOK_HOST_ALLOWLIST` — hostname of your n8n instance (SSRF protection)

#### 3. Pull values from Vercel Dashboard

If the project is already deployed, sync production/staging values instead of creating them from scratch:

1. Open [Vercel Dashboard](https://vercel.com/dashboard) → select the **agentflow-ai** project.
2. Go to **Settings → Environment Variables**.
3. Filter by environment (**Production**, **Preview**, or **Development**).
4. Copy each variable name and value into your local `.env.local`.
5. Restart the dev server after changes: `npm run dev`.

Alternatively, pull all env vars via the Vercel CLI (requires project link):

```bash
npx vercel env pull .env.local
```

#### 4. Production-only variables

These are set in **Vercel → Production** only. Do not add them to `.env.local` unless you are testing the production launch gate locally.

| Variable | Purpose |
|---|---|
| `CRON_SECRET` | Protects `/api/cron/content-studio-scheduler` (Vercel Cron) |
| `RATE_LIMIT_STORE=upstash` | Persistent rate limits (requires Upstash vars below) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `PRODUCTION_AUDIT_PASSED` | Launch gate marker — set by CI after `npm audit` passes |
| `PRODUCTION_AUDIT_DATE` | Audit timestamp |
| `PRODUCTION_AUDIT_COMMIT_SHA` | Git commit SHA of the audited build |
| `OPERATIONAL_LOG_VISIBILITY_CONFIRMED` | Confirms Vercel logs/deploy visibility for operators |
| `VERCEL_URL` | Auto-injected by Vercel — do not set manually |

Provider OAuth variables (`META_*`, `GOOGLE_ADS_*`, `PINTEREST_*`) are only needed when enabling those integrations. See `.env.example` for the full list with comments.

#### 5. Verify configuration

```bash
npm run dev          # start local server
npm run lint         # lint check
npm run build        # production build check
```

Open `/dashboard/system-health` and `/dashboard/production` to confirm env readiness after starting the app.

### Database Migrations (Supabase)

The schema lives in a **single consolidated migration**:

```text
supabase/migrations/20260703000000_full_clean_schema.sql
```

It replaces the previous 38 incremental files (Phase A → RBAC). It includes extensions, enums, 31 tables, RLS policies, triggers, storage buckets, and seed data (4 departments, 27 agents).

#### Local development — full reset

Use when setting up a fresh local database or when you need a clean slate:

```bash
# Link project (first time only)
supabase link --project-ref <your-project-ref>

# Wipes local DB and applies the consolidated migration
supabase db reset
```

Verify in Supabase Studio: `departments` should have 4 rows, `agents` should have 27.

#### Production — push migration

Use when the remote Supabase project does not yet have this migration applied:

```bash
supabase link --project-ref <your-production-ref>
supabase db push
```

Notes:

- `db push` applies only migrations missing from the remote `supabase_migrations.schema_migrations` table.
- If production already ran the old incremental chain, `20260703000000_full_clean_schema.sql` is mostly idempotent (`CREATE IF NOT EXISTS`, `ON CONFLICT`) and should not break existing data.
- For a **brand-new** Supabase project, only this one file is required.
- Never run `supabase db reset` against production.

See also: [Final Launch Checklist](docs/FINAL_LAUNCH_CHECKLIST.md), [Production Launch Checklist](docs/PRODUCTION_LAUNCH_CHECKLIST.md), [Production Deploy Checklist](docs/PRODUCTION_DEPLOY_CHECKLIST.md).

## License / Notes

Portfolio + production-tested SaaS foundation project. Not for production client use without review.

---
*Last updated: 2026-07-04 (Final Launch Checklist + server PDF reporting)*