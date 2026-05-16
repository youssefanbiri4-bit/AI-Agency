# Production Deploy Checklist

## Before Deploy

- Run `git status`.
- Review changed files.
- Run `npm run lint`.
- Run `npx tsc --noEmit`.
- Run `npm run build`.
- Confirm `.env` files were not changed.
- Confirm no tokens or provider secrets are printed in logs.
- Confirm OpenAI remains server-side.
- Confirm Supabase service-role keys remain server-side.

## Required Migrations

Apply these Supabase migrations before deploying Agent Library analytics and playbooks:

```text
supabase/migrations/20260515090000_create_agent_template_usage_events.sql
supabase/migrations/20260515093000_extend_agent_template_usage_workflow_actions.sql
supabase/migrations/20260515100000_extend_agent_template_usage_review_actions.sql
supabase/migrations/20260515103000_create_agent_workflow_playbooks.sql
```

The playbooks migration creates `agent_workflow_playbooks`; no duplicate workflow table is created.

## Deploy

After migrations and checks pass:

```bash
npx vercel --prod
```

Fallback if Vercel packaging fails:

```bash
npx vercel build --prod
npx vercel deploy --prebuilt --prod --archive=tgz
```

## Post Deploy

- Open `/dashboard/agent-library`.
- Open `/dashboard/alex`.
- Open `/dashboard/agent-library/workflows`.
- Open `/dashboard/agent-library/playbooks`.
- Create one safe pending task from a template.
- Save and reopen one playbook.
- Confirm no n8n execution, publishing, scheduling, live ads, spending, or provider mutation happened.
