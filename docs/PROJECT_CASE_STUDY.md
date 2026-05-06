# Project Case Study: AgentFlow AI

## Problem

Many small agencies and solo operators want to use AI for research, content, and sales operations, but the work often becomes scattered across prompts, documents, spreadsheets, and automation tools. There is usually no clean review flow, no structured handoff, and no reliable way to turn AI output into a client-ready report.

AgentFlow AI was designed to solve that gap: a focused AI agency dashboard that connects task creation, automation execution, human review, revisions, approvals, and report delivery.

## Solution

AgentFlow AI combines a SaaS-style dashboard with an n8n automation backend. Users create tasks for specialized AI agents, send those tasks to n8n, receive structured results, review the output, request changes when needed, approve final work, and export client-ready reports.

The result is a portfolio-grade full-stack project that demonstrates both product engineering and practical AI automation delivery.

## My Role

I built AgentFlow AI as a Full Stack Developer and AI Automation Developer project. The work covered:

- Product planning and workflow design.
- UI and dashboard implementation.
- Supabase authentication and database integration.
- Workspace-scoped data model.
- Task lifecycle and review flows.
- Server-side API routes for execution and callbacks.
- n8n workflow integration contract.
- Structured report rendering.
- Copy and PDF export actions.
- Error handling and retry behavior.
- Production deployment verification.
- Documentation and portfolio packaging.

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Supabase Auth and Postgres
- n8n v5/7B production workflows
- Vercel
- Tailwind CSS / CSS
- Server-side API routes

## Architecture

AgentFlow AI is organized around a protected dashboard and a server-side automation boundary.

The frontend handles dashboard navigation, task creation, review actions, report rendering, and export interactions. Supabase handles authentication, workspace data, task persistence, reviews, events, and report source data. n8n handles AI automation execution through a production webhook and returns results through a protected callback route.

The architecture keeps secret values on the server side and documents the stable integration contract separately in `docs/N8N_V5_CONTRACT.md`.

## Key Product Flows

### Authentication And Workspace

Users sign in through Supabase Auth. Dashboard access is protected, and task data is scoped to the active workspace.

### Agent Catalog

The app includes 18 AI agents across:

- Research & Strategy
- Content & Growth
- Sales & Operations

Each task is associated with an agent and department so reports can be filtered and understood by business function.

### Task Creation

A user selects an agent, writes a task title and description, chooses a priority, and creates a task. New tasks start in `pending` status.

### Task Execution

From Task Details, the user runs a pending or failed task. The server sends the task payload to n8n, updates the task to `processing`, and waits for the workflow callback.

### Review

Successful callbacks move tasks to `needs_review`. The user can inspect the Client-ready Report, approve it, or request changes.

### Approval

Approval creates a review record and moves the task from `needs_review` to `completed`.

### Request Changes

Request Changes v2 stores reviewer feedback and returns the task to `pending`. When rerun, the saved feedback is included in the n8n payload as `revisionNotes` and `revision_notes`, allowing the automation prompt to improve the next version.

## n8n Automation Workflow

n8n is the automation engine behind task execution. AgentFlow AI sends:

- Task ID and workspace ID.
- Agent ID and agent name.
- Department.
- Task title and description.
- Priority.
- Callback URL.
- Compatibility fields in camelCase and snake_case.
- Optional revision notes from the latest request-change review.

n8n returns success or failure through the callback route. Successful results are stored and moved to `needs_review`; failures are stored with an error message and moved to `failed`.

## Supabase Data And Auth

Supabase provides the authentication and database layer for:

- Users.
- Workspaces.
- Workspace memberships.
- Departments.
- Agent catalog records.
- Tasks.
- Task events.
- Task reviews.
- Task results.

Privileged callback and execution updates use server-side Supabase access.

## Review And Revision System

The review system keeps AI work from going directly to final delivery. Every successful task result enters `needs_review`, where a human can approve it or request revisions.

This creates a practical human-in-the-loop workflow:

```text
pending -> processing -> needs_review -> completed
```

For revisions:

```text
needs_review -> pending -> processing -> needs_review
```

## Reports And PDF Export

AgentFlow AI converts structured n8n output into a Client-ready Report. Users can view the report in Task Details, copy it as Markdown-style text, or export it as a PDF.

The Reports Page collects generated reports from `completed` and `needs_review` tasks. It excludes pending, processing, and failed tasks, and supports search plus department and status filters.

## Error Handling And Retry

If n8n execution fails or a callback returns an error, the task moves to `failed` and stores the error message. Failed tasks can be retried from Task Details, allowing the workflow to recover without creating duplicate tasks.

## Challenges Solved

- Keeping a stable contract between Next.js and n8n.
- Supporting both fresh tasks and revised tasks.
- Preserving human review before final approval.
- Rendering structured AI output cleanly while still supporting raw fallback output.
- Separating client-facing report content from internal callback metadata.
- Handling failed automation runs with a retry path.
- Creating a production-tested portfolio app without exposing secrets.

## Results

The current production version verifies:

- Supabase/Auth/Workspace work.
- 18 agents work.
- Task creation and Task Details work.
- n8n v5/7B execution works.
- Research, Content, and Sales tasks work.
- Approve and Request Changes v2 work.
- `revisionNotes` reach n8n and are used in the prompt.
- Client-ready Report, Copy Report, and Export PDF work.
- Error Handling + Retry works.
- Reports Page works in production.

## Future Improvements

- Ads & Growth Command Center.
- Campaign planner and analyzer.
- Better analytics.
- Optional direct ads API integrations.
- Stronger automated tests.
- Public SaaS features only if the project moves beyond portfolio/demo scope.
