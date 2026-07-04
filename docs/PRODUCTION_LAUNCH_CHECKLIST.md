# Production Launch Checklist

> AgentFlow AI — pre-launch verification including the consolidated Supabase schema.

**Last updated:** 2026-07-04

> For the complete go-live runbook (Vercel env, cron, pre/post launch, rollback), use **[Final Launch Checklist](FINAL_LAUNCH_CHECKLIST.md)**.

---

## 1. Database (Supabase)

### Schema

The project uses **one consolidated migration**:

```text
supabase/migrations/20260703000000_full_clean_schema.sql
```

Contents: `pgcrypto` extension, `department` + `rbac_role` enums, 31 tables, RLS, triggers, `creative-assets` storage bucket (private), seed (4 departments, 27 agents).

### Local verification

```bash
supabase link --project-ref <dev-or-staging-ref>
supabase db reset
```

Confirm after reset:

- [ ] `departments` → 4 rows
- [ ] `agents` → 27 rows
- [ ] `workspace_members.role` uses `rbac_role` enum
- [ ] `creative-assets` storage bucket is **private** (`public = false`)
- [ ] RLS enabled on all `public.*` tables
- [ ] `ad_connections` and `n8n_callback_events` have RLS but **no** authenticated write policies (service role only)

### Production apply

```bash
supabase link --project-ref <production-ref>
supabase db push
```

- [ ] Migration `20260703000000` appears in Supabase Dashboard → Database → Migrations
- [ ] No failed statements in migration logs
- [ ] Existing workspace data intact (if upgrading from incremental migrations)
- [ ] **Never** run `supabase db reset` on production

### Post-migration smoke

- [ ] Sign up / login works (profiles trigger)
- [ ] Create workspace (owner auto-added to `workspace_members`)
- [ ] Agent catalog loads (`/dashboard/agents`)
- [ ] Create a draft task

---

## 2. Environment & secrets

- [ ] All required env vars set in Vercel Production (see root `README.md` → Environment Setup)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` server-only
- [ ] `OPENAI_API_KEY` server-only (no `NEXT_PUBLIC_OPENAI_*`)
- [ ] `N8N_CALLBACK_SECRET` + `N8N_WEBHOOK_HOST_ALLOWLIST` set
- [ ] `CRON_SECRET` set for Vercel Cron

---

## 3. Application checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```

- [ ] Build passes
- [ ] `/dashboard/production` gate reviewed
- [ ] `/dashboard/system-health` green for configured providers

---

## 4. Deploy

```bash
npx vercel --prod
```

Fallback:

```bash
npx vercel build --prod
npx vercel deploy --prebuilt --prod --archive=tgz
```

---

## 5. Post-deploy validation

- [ ] Production URL loads
- [ ] Auth + workspace flow works
- [ ] Task create/list (no accidental n8n execution unless intended)
- [ ] Reels + Creative Assets pages load
- [ ] Reports page loads
- [ ] No secrets in browser network tab or console logs

---

## Related docs

- **[Final Launch Checklist](FINAL_LAUNCH_CHECKLIST.md)** — primary go-live document
- [Production Deploy Checklist](PRODUCTION_DEPLOY_CHECKLIST.md)
- [Production Operations Launch Gate](PRODUCTION_OPERATIONS_LAUNCH_GATE.md)
- [Final Launch Plan](FINAL_LAUNCH_PLAN.md)
- [RBAC Implementation](RBAC_IMPLEMENTATION.md)
- [Team Onboarding](TEAM_ONBOARDING.md)