# Roadmap

Date updated: 2026-05-06
Project: AgentFlow AI / AI Agency Dashboard

## Current Stable State

AgentFlow AI is currently in a production-tested portfolio state. The core SaaS dashboard, Supabase-backed workspace model, n8n automation flow, review system, report rendering, retry path, and reports dashboard have been verified in production.

Phase 10A is a documentation-only portfolio polish phase. It does not change application code, Supabase schema, n8n workflows, callback routes, callback payloads, task execution logic, environment variables, or deployment settings.

## Completed

- Core dashboard shell and protected dashboard pages.
- Supabase Auth integration.
- Workspace onboarding and active workspace scoping.
- 18 AI agents across 3 departments.
- Task creation.
- Tasks page.
- Task Details page.
- n8n v5/7B production integration.
- Stable callback handling.
- Stable `callbackPayload` and `structuredOutput` rendering.
- Structured reviews.
- Approve flow from `needs_review` to `completed`.
- Request Changes v2 from `needs_review` to `pending`.
- `revisionNotes` loop back into n8n.
- Client-ready Report rendering.
- Copy Report.
- Export PDF.
- Error Handling + Retry.
- Reports Page at `/dashboard/reports`.
- Production deployment on Vercel.

## Stable Task Flow

Successful flow:

```text
pending -> processing -> needs_review -> completed
```

Revision flow:

```text
needs_review -> pending
```

Failure and retry flow:

```text
processing -> failed -> retry -> processing
```

## Stable Contract References

- `docs/N8N_V5_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/FINAL_PRODUCTION_AUDIT.md`
- `TESTING_CHECKLIST.md`

These documents should be reviewed before changing task execution, callback handling, report rendering, review transitions, or n8n workflow behavior.

## Next Product Directions

### Ads & Growth Command Center

Build a focused command center for marketing operators and growth teams.

- Campaign overview dashboard.
- Channel and objective selection.
- Campaign status and performance summaries.
- Saved campaign briefs.
- AI-generated campaign recommendations.

### Campaign Planner And Analyzer

Add deeper planning and analysis workflows on top of the existing agent/task foundation.

- Campaign brief generator.
- Audience and offer analyzer.
- Creative angle planner.
- Landing page and funnel checklist.
- Post-campaign analysis reports.

### Better Analytics

Improve visibility into real usage and delivery outcomes.

- Task volume by agent and department.
- Completion and failure rates.
- Review turnaround time.
- Report generation trends.
- Workspace-level activity metrics.

### Optional Direct Ads API Integrations

Only after the portfolio version remains stable, consider direct platform integrations.

- Meta Ads API.
- Google Ads API.
- TikTok Ads API.
- LinkedIn Ads API.

These should remain optional because the current n8n-based automation layer is already suitable for portfolio and client-demo use.

### Public SaaS Features

Add public SaaS capabilities only if the project moves beyond personal portfolio scope.

- Billing.
- Team roles and permissions.
- Organization settings.
- Public documentation.
- Usage limits.
- Customer onboarding flows.

## Guardrails

Do not change the following without a separate implementation plan:

- Supabase schema.
- Auth logic.
- Workspace logic.
- Task creation behavior.
- Task status flow.
- Approve logic.
- Request Changes logic.
- n8n callback API.
- `callbackPayload` structure.
- Environment variable names or values.
- n8n workflow routing.
- Vercel project settings.
