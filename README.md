# AgentFlow AI / AI Agency Dashboard

AgentFlow AI is a production-tested AI agency dashboard that combines a full-stack SaaS interface with n8n-powered automation workflows. It lets a workspace user create AI tasks, run them through specialized agents, review structured outputs, request revisions, approve final reports, and collect generated reports in a dedicated reports dashboard.

Production URL: https://agentflow-ai-sigma.vercel.app

This project was built as a professional portfolio project for Full Stack Developer and AI Automation Developer positioning. It demonstrates product design, authentication, database-backed workflows, server-side automation integration, review loops, report rendering, and production deployment.

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Supabase Auth and Postgres
- n8n production webhooks
- Vercel production deployment
- Tailwind CSS / CSS
- Server-side API routes for task execution, callbacks, and stale-task handling

## Core Features

- Supabase authentication for protected dashboard access.
- Workspace onboarding and active workspace scoping.
- Catalog of 18 AI agents across Research & Strategy, Content & Growth, and Sales & Operations.
- Task creation with agent selection, title, description, and priority.
- Task execution through n8n v5/7B production workflow integration.
- Task status tracking across pending, processing, needs_review, completed, and failed states.
- Task Details page with automation controls, status feedback, review actions, and report output.
- Structured review system with Approve and Request Changes v2.
- Request Changes revision loop where reviewer feedback is sent back to n8n as `revisionNotes` and `revision_notes`.
- Client-ready Report rendering from structured n8n output.
- Copy Report action for Markdown-ready delivery.
- Export PDF action for client-facing report delivery.
- Error Handling + Retry for failed automation runs.
- Reports Page at `/dashboard/reports` listing generated reports from completed and needs_review tasks.
- Reports search plus department and status filters.

## Task Status Flow

Primary successful flow:

```text
pending -> processing -> needs_review -> completed
```

Revision flow:

```text
needs_review -> pending
```

The Request Changes v2 action stores reviewer feedback, moves the task back to `pending`, and includes the feedback as revision notes the next time the task is sent to n8n.

Failure and retry flow:

```text
processing -> failed -> retry -> processing
```

Failed tasks keep an error result and can be retried from Task Details.

## Architecture Overview

AgentFlow AI is built as a Next.js application with protected dashboard routes, server-side Supabase access, and API routes that coordinate automation execution.

High-level flow:

1. A user signs in with Supabase Auth.
2. The user creates or selects a workspace.
3. The user creates a task for one of the 18 AI agents.
4. The app stores the task in Supabase with `pending` status.
5. The user runs the task from Task Details.
6. A server route sends the task payload to n8n and marks the task `processing`.
7. n8n executes the workflow and calls back into AgentFlow AI.
8. The callback stores structured output and moves the task to `needs_review`.
9. The user approves the result or requests changes.
10. Approved tasks become completed reports and appear on the Reports Page.

## n8n v5/7B Integration

n8n is used as the automation engine for AI task execution. AgentFlow AI sends task context, agent metadata, workspace metadata, callback URL, and optional revision notes to the configured n8n production webhook.

The callback route accepts successful and failed workflow responses. Successful responses are stored as task results and moved to `needs_review`. Failed responses are stored with error details and moved to `failed`.

The integration preserves the stable `callbackPayload` and `structuredOutput` contract. Both camelCase and snake_case compatibility fields are documented in `docs/N8N_V5_CONTRACT.md`.

No secret values are stored in the repository. Runtime secrets are expected to stay in the hosting environment.

## Supabase Integration

Supabase provides authentication and database persistence for:

- Users and sessions.
- Workspaces and active workspace context.
- Department and agent catalog data.
- Tasks and task results.
- Task events.
- Task reviews and revision feedback.

Server-only database access is used for privileged operations such as task callbacks and execution state changes. Client code only uses public Supabase configuration values.

## Reports And Export System

Task results from n8n are normalized into a Client-ready Report when structured output is available. The report view supports:

- Executive summary.
- Main report sections.
- Recommendations.
- Next actions.
- Quality notes.
- Raw output fallback when needed.
- Copy Report for Markdown delivery.
- Export PDF for client-ready handoff.

The Reports Page lists generated reports from `completed` and `needs_review` tasks only. Pending, processing, and failed tasks are excluded.

## Demo Flow

Suggested demo path:

1. Open the production app.
2. Sign in and enter the dashboard.
3. Show the workspace-scoped dashboard and agent catalog.
4. Create a task for a Research, Content, or Sales agent.
5. Run the task and explain the n8n automation handoff.
6. Open Task Details when the task reaches `needs_review`.
7. Show the Client-ready Report, Copy Report, and Export PDF actions.
8. Use Request Changes to demonstrate the revision loop.
9. Approve a completed result.
10. Open `/dashboard/reports` and show search, department filter, status filter, and report links.

## Current Production Status

The current production state has been manually tested and verified:

- Production URL works.
- Supabase/Auth/Workspace work.
- 18 agents work.
- Task creation works.
- Tasks page works.
- Task Details works.
- n8n v5/7B works.
- Research, Content, and Sales tasks work.
- Approve works.
- Request Changes v2 works.
- `revisionNotes` reach n8n and are used in the prompt.
- Client-ready Report works.
- Copy Report works.
- Export PDF works.
- Error Handling + Retry works.
- Reports Page works.
- `/dashboard/reports` works in production.

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
npm run build
```

For production automation testing, configure the required Supabase and n8n environment variables in the runtime environment. Do not commit secret values.

## Next Improvements

- Ads & Growth Command Center.
- Campaign planner and campaign analyzer.
- Better analytics for task volume, agent usage, and report outcomes.
- Optional direct ads API integrations.
- Stronger automated test coverage for auth, task execution, callbacks, reports, and review flows.
- Public SaaS features only if the project moves beyond portfolio/demo scope.
