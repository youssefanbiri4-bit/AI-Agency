# AI Agency Dashboard

A professional light SaaS dashboard for managing an AI agency workspace with 18 specialized agents across 3 departments.

## Product Scope

- 18 specialized AI agents in a central catalog
- 3 departments: Research & Strategy, Content & Growth, Sales & Operations
- Landing page with SaaS positioning, workflow overview, agent catalog, department cards, and dashboard previews
- Dashboard pages for agents, agent details, tasks, task details, reviews, reports, and settings
- Reusable UI components for buttons, badges, cards, navigation, tables, states, and dashboard surfaces
- Supabase-ready and n8n-ready structure without connecting real workflows or exposing private keys

## Current Status

This project is prepared for future persistence and workflow automation, but Supabase and live n8n workflows are intentionally not connected yet. The interface does not ship seeded workspace metrics, task records, reviews, reports, notifications, or activity logs. Empty and onboarding states are shown until real data is connected.

Keep private credentials on the server side only when integrations are added.

## Supabase Phase A

Phase A adds schema and seed SQL for Supabase without applying it automatically:

- `supabase/migrations/20260502030000_phase_a_schema.sql`
- `supabase/migrations/20260502030100_seed_departments_agents.sql`

Run the schema migration first, then the seed migration. The seed migration only inserts the 3 departments and 18 agent catalog records. It does not insert tasks, reviews, reports, activity, users, workspaces, or metrics.

Client code may use only:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Server-only code may use:

- `SUPABASE_SERVICE_ROLE_KEY`

## Local Development

This Next.js version requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Then open the local URL printed by Next.js.

## Verification

```bash
npm run lint
npx tsc --noEmit
npm run build
```

If your system Node version is older than Node 20.9, run Next with a newer Node runtime before starting or building the app.
