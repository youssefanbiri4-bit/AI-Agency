# AgentFlow AI / AI Agency Dashboard

AgentFlow AI is a production-tested AI agency dashboard that combines a full-stack SaaS interface with **n8n-powered automation workflows**. A workspace user can create AI tasks, run them through specialized agents, review structured outputs, request revisions, approve final reports, and collect generated reports in a dedicated Reports dashboard.

**Production URL:** https://agentflow-ai-sigma.vercel.app

This repository was created as a portfolio project to demonstrate product workflow design, authentication, database-backed automation state, server-side automation integration, human review loops, report rendering, and production deployment.

---

## 1) What problem this project solves

In real agencies, AI work often gets split across disconnected tools: prompts, documents, spreadsheets, and automation workflows. AgentFlow AI turns that into a **single operational loop**:

1. Create a structured task (belongs to a workspace + assigned agent).
2. Execute it via automation (n8n).
3. Receive structured output.
4. Human review (approve or request changes).
5. Revision loop (feedback is sent back into n8n).
6. Deliver a client-ready report (copy Markdown + export PDF).
7. Keep a searchable Reports library.

---

## 2) Tech Stack

- **Next.js 16** (App Router)
- **React 19**
- **TypeScript**
- **Supabase** Auth + Postgres (workspace-scoped data + RLS)
- **n8n** production webhooks (v5 contract)
- **Vercel** production deployment
- **Tailwind CSS / CSS**
- Server-side API routes coordinating execution, callbacks, and state transitions

---

## 3) End-to-End Product Flow (from zero to “it works”)

### Step A — Authentication + Workspace context
- Users sign in with **Supabase Auth**
- The app requires an **active workspace** before allowing task operations
- All operational data (tasks, events, reviews, reports, notifications) is scoped to the active workspace

### Step B — Task creation (the unit of work)
- The UI provides a catalog of **18 AI agents** across:
  - Research & Strategy
  - Content & Growth
  - Sales & Operations
- A user creates a task with:
  - agent selection
  - title + description
  - priority
- The task is persisted in Supabase with status **`pending`**

### Step C — Task execution (handoff to n8n)
- From **Task Details**, the user triggers **Run Task**
- A server route validates:
  - user is authenticated
  - workspace exists
  - task belongs to the workspace
  - task status is allowed (`pending` or `failed`)
- Before calling n8n, the app updates the task to:
  - `status: processing`
  - `result: null`
- The app then sends a payload to the configured n8n webhook

### Step D — Callback (execution result → review step)
- n8n calls the app callback endpoint
- On success:
  - the app stores `result` (structured output)
  - moves the task to **`needs_review`**
  - creates a task event
- On failure:
  - stores an error object
  - moves the task to **`failed`**
  - creates a task event

### Step E — Human-in-the-loop review (approve or revise)
- If task status is `needs_review`, the user can:
  - **Approve** → `needs_review -> completed`
  - **Request Changes v2** → `needs_review -> pending`

### Step F — Revision loop (feedback is used in the next run)
- When requesting changes:
  - reviewer feedback is saved
  - next execution includes optional:
    - `revisionNotes` (camelCase)
    - `revision_notes` (snake_case)
- n8n uses these revision notes to produce an improved output

### Step G — Delivery (Reports + exports)
- Reports are rendered from structured output:
  - summary, analysis, recommendations, next actions, quality notes, etc.
- Actions:
  - **Copy Report** (Markdown-friendly)
  - **Export PDF** (client-ready handoff)
- The Reports page `/dashboard/reports` lists tasks with:
  - `completed` or `needs_review`
  - excludes `pending`, `processing`, `failed`

---

## 4) Task Status Flow

Primary successful flow:

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

Notes:
- Request Changes v2 moves back to `pending` and ensures feedback is included in the next n8n call.
- Failed tasks keep error details and can be retried from Task Details.

---

## 5) Architecture Overview

AgentFlow AI is a **Next.js application** with:

- protected dashboard routes
- server-side Supabase access
- API routes that coordinate automation execution

High-level responsibilities:
- **Frontend**
  - UI, navigation, task creation, task list/details, review actions
  - report rendering from stored structured output
- **Supabase**
  - authentication sessions, workspace-scoped persistence, RLS isolation
- **n8n**
  - workflow execution and callback into the app

Key internal modules and routes are documented in:
- `docs/ARCHITECTURE.md`

---

## 6) n8n v5 Integration Contract (stable contract)

This project relies on a stable integration contract between AgentFlow AI and **n8n v5**.

Full contract reference:
- `docs/N8N_V5_CONTRACT.md`

### Execution request
Tasks are executed from:

- `POST /api/tasks/execute`

Before the n8n call:
- task is updated to:
  - `status: processing`
  - `result: null`

The app sends a payload including:
- task/workspace/agent identity
- title/description/priority
- callback URL
- optional revision notes in both field styles:
  - `revisionNotes`
  - `revision_notes`

### Callback endpoint
n8n must call:

- `POST /api/n8n/callback`

Required header:
- `x-n8n-callback-secret: <N8N_CALLBACK_SECRET>`

Stable callback behavior:
- success → stores `result`, moves to `needs_review`
- failure → stores `error_message`, moves to `failed`

### What the app expects for report rendering
The stored `result` must contain `callbackPayload.structuredOutput` fields such as:

- `summary`
- `analysis`
- `contentPlan`
- `outreachPlan`
- `recommendations[]`
- `nextActions[]`
- `qualityNotes[]`
- `metadata` (taskId, workspaceId, agent identifiers)

---

## 7) Supabase Integration (Auth + Workspace scoping + RLS)

Supabase provides:
- user sessions and authentication
- workspace records and membership
- department & agent catalog data
- tasks, task events
- task reviews + revision feedback
- stored task results used for report rendering
- operational modules (notifications, Reels Studio, Creative Assets)

Security concept:
- server-side privileged flows perform sensitive writes/reads
- client-side code uses only public Supabase config values
- RLS keeps tasks/reviews/reports isolated by workspace and user membership

Workspace model + task lifecycle are documented in:
- `docs/ARCHITECTURE.md`

---

## 8) Reports and Export System

Task results from n8n are normalized into a Client-ready report when structured output is available.

Report UI supports:
- executive summary
- main sections
- recommendations
- next actions
- quality notes
- raw JSON fallback when required
- **Copy Report** (Markdown delivery)
- **Export PDF** (client-ready output)

Reports page `/dashboard/reports` includes only:
- `completed` and `needs_review` tasks
- excludes `pending`, `processing`, `failed`

---

## 9) Demo walkthrough (talk track you can follow)

Production demo URL:
- https://agentflow-ai-sigma.vercel.app

Step-by-step demo script:
- `docs/DEMO_SCRIPT.md`

Short version:
1. Login (Supabase Auth)
2. Open `/dashboard`
3. Explore `/dashboard/agents`
4. Create a task in `/dashboard/create-task`
5. Run task from Task Details (pending → processing)
6. Wait for callback (processing → needs_review)
7. Review and request changes (revision loop via revision notes)
8. Approve (needs_review → completed)
9. Open `/dashboard/reports` and demonstrate filters/search
10. Copy or export PDF from Task Details

---

## 10) Local Development

This Next.js version requires **Node.js 20.9+**.

```bash
npm install
npm run dev
```

Open the local URL printed by Next.js.

Verification:

```bash
npm run lint
npm run build
```

For local execution of automation flows (n8n + Supabase), configure required environment variables in your runtime environment. Do not commit secrets.

---

## 11) Security & Performance (high-level)

See:
- `SECURITY_HARDENING.md`

Includes:
- CSP (Content Security Policy) tuning in production
- rate limiting on API endpoints
- centralized error handling and structured logging
- Zod validation on request payloads
- Sentry integration for error/performance visibility
- guidance on not leaking secrets or sensitive tokens

---

## 12) Current Stable State + Next Improvements

Stable state and guardrails:
- `docs/ROADMAP.md`

Current direction focuses on:
- Ads & Growth Command Center (read-only tracking first)
- Better analytics
- Notifications improvements
- continued Reels Studio and Creative Assets evolution

Guardrails include:
- do not change n8n callback contract without a dedicated integration plan
- do not change task status flow logic without coordination

---

## 13) Documentation shortcuts

- Architecture: `docs/ARCHITECTURE.md`
- Roadmap: `docs/ROADMAP.md`
- n8n contract: `docs/N8N_V5_CONTRACT.md`
- Demo walkthrough: `docs/DEMO_SCRIPT.md`
- Security: `SECURITY_HARDENING.md`
- Production audit + review: `docs/FINAL_PRODUCTION_AUDIT.md`

---

## 14) Production checklist (what “done” means)

The current production state has been manually tested and verified:
- production URL works
- Supabase/Auth/Workspace work
- 18 agents work
- task creation + tasks pages work
- task execution via n8n works
- approve and request changes v2 works
- revision notes reach n8n and improve output
- client-ready report rendering works
- copy + export PDF works
- error handling + retry works
- reports page works: `/dashboard/reports`
