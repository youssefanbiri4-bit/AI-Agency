# AgentFlow-AI — Project Dossier

**Document type:** Technical product specification · System design · SaaS strategy  
**Project:** AgentFlow-AI (repository: AI-Agency)  
**Production URL:** https://agentflow-ai-sigma.vercel.app  
**Document date:** 2026-07-10  
**Audience:** Founders, investors, product, engineering, and future AI assistants  
**Authority:** Derived from the live codebase, Supabase schema, API routes, and internal audits — not from marketing copy alone

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Origin & Evolution](#2-project-origin--evolution)
3. [Core Vision](#3-core-vision)
4. [Current Technical Stack](#4-current-technical-stack)
5. [Current Database Architecture](#5-current-database-architecture)
6. [Existing Features](#6-existing-features)
7. [API Architecture](#7-api-architecture)
8. [User Journey](#8-user-journey)
9. [SaaS Transformation Roadmap](#9-saas-transformation-roadmap)
10. [AI Agent Vision](#10-ai-agent-vision)
11. [Security & Governance](#11-security--governance)
12. [Production Readiness Checklist](#12-production-readiness-checklist)
13. [Recommended Next Steps](#13-recommended-next-steps)
14. [Final Vision Statement](#14-final-vision-statement)

---

## 1. Executive Summary

### What AgentFlow-AI is

AgentFlow-AI is a full-stack, multi-tenant **AI operations platform** that turns specialized AI agents into governed business workflows. It is not a chat wrapper. It is an operational system that:

- assigns work to domain-specific AI agents
- executes automation through n8n (with a stable callback contract)
- forces **human review** before work is considered complete
- stores structured results as client-ready reports
- scopes all operational data by **workspace** (tenant boundary)
- enforces **RBAC**, **usage quotas**, and **production safety gates**

Today the product is best described as a production-tested **AI Agency Dashboard** with deep automation, content, ads-readiness, and governance layers. The strategic product direction expands that foundation into a complete **AI-powered SaaS** that diagnoses businesses, identifies bottlenecks, produces strategy, evaluates execution readiness, and only then orchestrates agents through human-approved pipelines.

### Why it exists

Most AI work in small agencies and growth teams is fragmented:

- prompts live in chat tools
- drafts live in docs
- metrics live in ad platforms
- automation lives in n8n or Zapier
- approvals happen in Slack or email
- nothing is tenant-scoped, auditable, or reusable

That fragmentation produces three failures:

1. **No diagnostic loop** — teams generate content without first diagnosing bottlenecks.
2. **No governance loop** — AI output ships without structured review.
3. **No execution OS** — recommendations never become tracked, approved, automated work.

AgentFlow-AI exists to close those loops inside one product surface.

### The business problem it solves

| Problem | Without AgentFlow-AI | With AgentFlow-AI (target state) |
|--------|----------------------|----------------------------------|
| Scattered AI work | Prompts, docs, and tools with no shared state | Workspace-scoped tasks, events, reviews, reports |
| Unreviewed automation | n8n runs and posts directly | `processing → needs_review → completed` with revision notes |
| Weak strategy-to-execution path | Diagnosis in one place, tasks in another | Diagnosis → opportunities → strategy → candidate evaluation → tasks |
| Multi-user chaos | Shared logins or ad-hoc access | RBAC roles + department scoping |
| Uncontrolled cost | OpenAI/n8n usage with no limits | Plan quotas, usage events, production gates |
| Client delivery friction | Manual copy/paste of AI output | Structured reports, PDF export, share links |

### The long-term SaaS vision

AgentFlow-AI becomes a **multi-tenant, subscription-based AI operating system for business growth and execution**:

1. **Diagnose** a business (profile, bottlenecks, opportunities).
2. **Plan** strategy and readiness.
3. **Approve** recommendations with human checkpoints.
4. **Orchestrate** specialized agents for analysis, marketing, ops, finance, content, and automation.
5. **Execute** through controlled pipelines (n8n + future agent runtimes).
6. **Measure** usage, outcomes, and governance compliance.

The platform will support multiple businesses per operator, teams, dashboards, automation workflows, billing, and scalable cloud deployment.

---

## 2. Project Origin & Evolution

### Phase A — Business Intelligence Engine (origin concept)

**Assumption (labeled):** Early product intent framed AgentFlow as a **Business Intelligence Engine**: collect business context, surface bottlenecks, map opportunities, and produce strategy reports. Internal audits explicitly note that a formal **Client Intelligence / Diagnosis Engine** was still largely unimplemented as a dedicated module, even while the surrounding agency platform matured.

The conceptual BI objects that define that origin are:

| Conceptual object | Purpose |
|-------------------|---------|
| Business profile | Structured description of the company, market, offers, channels, constraints |
| Bottlenecks | Ranked operational or growth constraints |
| Opportunities | Actionable growth levers derived from diagnosis |
| Strategy reports | Founder-facing synthesis of diagnosis + recommended path |
| AgentFlow candidates | Proposed agent-executable work packages |
| AgentFlow tasks | Approved execution units |
| Audit trail | Immutable record of who approved what, when |

These objects are the **product north star** for the diagnostic layer even when they are not yet first-class tables under those exact names.

### Phase B — AI Agency Dashboard (implemented core)

The codebase evolved into a concrete, deployable **AI Agency Dashboard**:

- Supabase Auth + workspace tenancy
- Agent catalog (seeded departments + agents)
- Task lifecycle with n8n execution
- Human review (approve / request changes)
- Client-ready report rendering + PDF
- Content Studio, Reels Studio, Creative Assets
- Read-only ads integrations (Meta, Google Ads; Pinterest foundation)
- RBAC + department scoping
- Usage quotas + production launch gate
- Security hardening (MFA, rate limits, SSRF protection, audit logs)

This phase proved the hard parts of SaaS infrastructure: multi-user access, automation contracts, review loops, and cloud deployment.

### Phase C — AgentFlow orchestration layer (current emphasis)

Orchestration is no longer “call an LLM.” It is a governed pipeline:

```text
Create task → Validate RBAC/quota/gate → Execute via n8n
  → Callback with structured output → Human review
  → Approve OR Request Changes (revision notes) → Complete / Retry
```

Key engineering decisions in this phase:

- **Human-in-the-loop is mandatory** for successful automation outcomes (`needs_review` before `completed`).
- **Revision notes** flow back into n8n so feedback improves the next run.
- **Callback secrets + idempotency** protect automation webhooks.
- **Workspace isolation + RLS** keep tenant data separated.
- **Alex + Agent Library + Workflow Builder** help operators compose agent work without auto-executing unsafe actions.

### Why candidate evaluation, task generation, and human approval were added

| Capability | Reasoning |
|------------|-----------|
| **Candidate evaluation** | Not every diagnosis insight should become automated work. Candidates score readiness, risk, and value before task creation. |
| **Task generation** | Strategy without tasks is a PDF. Tasks are the unit of execution that n8n, agents, and reviewers understand. |
| **Human approval** | AI and automation can fabricate plausible but wrong or brand-damaging output. Approval is a product feature, not an afterthought. |

This progression is deliberate:

```text
Intelligence (diagnose) → Judgment (evaluate/approve) → Action (orchestrate) → Learning (audit/report)
```

Without judgment, automation is reckless. Without intelligence, automation is random. Without action, intelligence is inert.

---

## 3. Core Vision

### Desired future platform

AgentFlow-AI should become a production SaaS with the following pillars.

#### 3.1 SaaS architecture

- Next.js App Router application on Vercel (or equivalent edge-capable host)
- Supabase Postgres as system of record
- Server-only privileged operations (service role, encryption keys, webhooks)
- Background workers (BullMQ/Redis) for long-running work and recovery
- n8n (and future agent runtimes) as execution backends behind a stable contract
- Observability (Sentry, structured logs, operational dashboard)

#### 3.2 Multi-tenant system

- **Workspace** is the tenant boundary (already implemented)
- Future: organizations that own multiple workspaces/businesses
- Future: business profiles nested under workspaces for multi-client agencies
- All operational entities keyed by `workspace_id` with RLS

#### 3.3 Subscription-based model

Plans already modeled in schema and quota code:

| Plan | Intent |
|------|--------|
| `free` | Trial / portfolio / limited usage |
| `starter` | Solo operators |
| `pro` | Small teams |
| `agency` | High volume / multi-client (near-unlimited quotas in code defaults) |

Billing tables (`billing_customers`, `subscriptions`) and route stubs (`/api/billing/*`) exist; full Stripe checkout/portal/webhook lifecycle still needs product completion.

#### 3.4 AI agent orchestration

Specialized agents across research, content, sales, and engineering departments execute through:

1. task records
2. execution APIs
3. n8n workflows
4. structured callbacks
5. review queues

Future: multi-agent DAGs, playbook-driven campaigns, and automatic candidate→task materialization after approval.

#### 3.5 Business diagnostics

**Assumption (target product):** Guided intake produces a business profile; deterministic + LLM analysis produces bottlenecks and opportunities; founder reviews the diagnosis before strategy generation.

#### 3.6 Strategic planning

Strategy reports synthesize diagnosis into prioritized initiatives, channel plans, KPI targets, and execution readiness scores — then hand off to AgentFlow candidates.

#### 3.7 Automated execution pipeline

```text
Business Profile
  → Diagnosis (bottlenecks + opportunities)
  → Strategy Report
  → Founder Approval
  → AgentFlow Candidate Evaluation
  → Task Generation
  → Human Review of Tasks / Outputs
  → Automation Execution (n8n / agents)
  → Reports + Analytics + Audit Trail
```

Every dashed arrow that crosses an approval boundary must remain explicit and reversible.

---

## 4. Current Technical Stack

> **Note:** Some product notes mention Drizzle ORM. **The production codebase does not use Drizzle.** Persistence is Supabase/Postgres accessed via `@supabase/supabase-js` and server helpers. That is documented accurately below.

### Core application

| Layer | Technology | Role |
|-------|------------|------|
| Framework | **Next.js 16** (App Router) | SSR/RSC UI, API routes, middleware |
| Language | **TypeScript** (strict) | End-to-end typing |
| UI library | **React 19** | Dashboard and marketing surfaces |
| Styling | **Tailwind CSS 4** + global CSS | Design system, responsive layout, RTL-ready i18n |
| Validation | **Zod** | Request/body schemas on critical routes |
| PDF | **pdf-lib** + **puppeteer-core** | Client report generation |
| Icons | **lucide-react** | UI iconography |

### Data & auth

| Layer | Technology | Role |
|-------|------------|------|
| Backend-as-a-service | **Supabase** | Auth (GoTrue), Postgres, Storage, optional Realtime |
| Auth helpers | `@supabase/ssr`, `@supabase/auth-helpers-nextjs` | Cookie sessions, server/client clients |
| ORM | **None (direct Supabase client)** | Table access via typed clients; schema via SQL migrations |
| Migrations | `supabase/migrations/*.sql` | Consolidated clean schema + follow-on migrations |

### Automation & jobs

| Layer | Technology | Role |
|-------|------------|------|
| Workflow engine | **n8n** (v5 contract) | External AI/automation execution |
| Integration | REST webhook + signed callback | `POST /api/tasks/execute` → n8n → `POST /api/n8n/callback` |
| Queue | **BullMQ** + **Redis** (ioredis / Upstash) | Task queue, DLQ, stale recovery |
| Cron | Vercel Cron | Content Studio scheduler |

### Infrastructure & ops

| Layer | Technology | Role |
|-------|------------|------|
| Hosting | **Vercel** | Production deploy (`agentflow-ai`) |
| Error monitoring | **Sentry** (`@sentry/nextjs`) | Client/server error capture |
| Rate limiting | Upstash Redis REST or in-memory fallback | API and auth protection |
| Testing | **Vitest** | Unit/smoke tests (200+ tests in recent audit state) |
| Lint | ESLint + `eslint-config-next` | Static quality |
| Node | **≥ 20.9.0** | Runtime requirement |

### AI / external providers

| Provider | Use |
|----------|-----|
| OpenAI (server-only key) | Content, images, video helpers; Creative Assets generation |
| Meta | Ads read + organic Reels publish foundation |
| Google Ads | OAuth, encrypted tokens, read-only campaigns/metrics |
| Pinterest | Ads provider foundation |
| Stripe | Billing schema + route stubs; live mode gated |

### Internationalization

- Locales: English, Arabic, French, Spanish (`src/i18n/locales/`)
- RTL support work documented in Arabic audit reports

### Repository layout (high level)

```text
src/
  app/                 # App Router pages + API routes
  actions/             # Server actions (auth, tasks, reports, reels, …)
  components/          # UI + domain components
  lib/                 # Domain logic, auth, n8n, queue, usage, security
  data/                # Static catalogs (agents)
  types/               # Shared TypeScript types + database types
  i18n/                # Translations
supabase/migrations/   # Schema source of truth
docs/                  # Architecture, contracts, launch checklists
tests/                 # Vitest suites
scripts/               # Deploy, smoke, security audit
```

---

## 5. Current Database Architecture

### 5.1 Source of truth

Primary consolidated migration:

```text
supabase/migrations/20260703000000_full_clean_schema.sql
```

Follow-on migrations:

- `20260704000000_create_saved_reports.sql` — `saved_reports`, `report_share_links`
- `20260705000000_create_user_preferences.sql` — preferences reinforcement
- `20260705000000_add_notifications_realtime.sql` — realtime publication
- `20260705000001_create_usage_events.sql` — metered usage events

### 5.2 Tenant model

```text
auth.users
   └── profiles
   └── workspace_members ──► workspaces (tenant root)
                                ├── tasks / reviews / events
                                ├── content / reels / creative assets
                                ├── billing / usage
                                └── security_audit_logs
```

**`workspaces`** is the multi-tenant boundary. Operational rows carry `workspace_id`. RLS policies enforce membership-based access; privileged automation uses the service role on the server only.

### 5.3 Production tables (implemented) — purpose

#### Identity & tenancy

| Table | Purpose |
|-------|---------|
| `profiles` | Mirror of auth user display fields (email, name, avatar) |
| `workspaces` | Tenant root: name, slug, owner |
| `workspace_members` | Membership with `rbac_role` + optional `department` + permissions JSON |
| `user_preferences` | Per-user, per-workspace UI/feature preferences |

#### Agent catalog

| Table | Purpose |
|-------|---------|
| `departments` | Global agent grouping (seeded; not workspace-scoped) |
| `agents` | Agent definitions (id, department, role, capabilities metadata) |

#### Execution core

| Table | Purpose |
|-------|---------|
| `tasks` | Primary work unit: agent, title, description, status, priority, result JSON, n8n execution id |
| `task_reviews` | Human review feedback and ratings |
| `task_events` | Append-only activity log for task lifecycle |
| `n8n_callback_events` | Callback idempotency / delivery tracking |

**Task status enum (CHECK):** `draft | pending | processing | needs_review | completed | failed | cancelled`

#### Integrations & ads

| Table | Purpose |
|-------|---------|
| `integration_settings` | Per-workspace Supabase/n8n readiness flags |
| `ad_connections` | OAuth connections for Meta / Google Ads / Pinterest (encrypted tokens server-side) |
| `provider_readiness_cache` | Cached readiness signals for providers |

#### Content systems

| Table | Purpose |
|-------|---------|
| `reels` | Instagram Reels planning, AI script/caption tasks, publish state |
| `creative_assets` | Prompt + image generation workflow and storage references |
| `content_studio_items` | Multi-platform content drafts/schedules |
| `content_studio_item_assets` | Join between content items and assets |
| `content_studio_publish_attempts` | Publish attempt audit with status machine |

#### Delivery & internal ops

| Table | Purpose |
|-------|---------|
| `projects` | Internal/client project tracking |
| `prompt_library` | Saved prompts for operators |
| `releases` | Release management records |
| `safe_patch_plans` | Controlled change plans |
| `backup_records` | Backup center metadata |
| `github_issue_task_links` | Links GitHub issues to tasks |
| `pull_request_reviews` | PR assistant review storage |
| `notifications` | In-app notifications (workspace + user scoped) |
| `saved_reports` | Persisted report versions |
| `report_share_links` | Signed/public share tokens for reports |

#### Agent library analytics

| Table | Purpose |
|-------|---------|
| `agent_template_usage_events` | Analytics for template/playbook actions |
| `agent_workflow_playbooks` | Saved multi-agent workflow playbooks |

#### Security, billing, usage

| Table | Purpose |
|-------|---------|
| `security_audit_logs` | Security/ops audit trail (service-role writes) |
| `billing_customers` | Stripe customer mapping |
| `subscriptions` | Stripe subscription mirror (`free|starter|pro|agency`) |
| `usage_limits` | Plan quotas per workspace |
| `usage_events` | Metered consumption events for aggregation |

### 5.4 Relationships (implemented)

```text
workspaces 1──* workspace_members *──1 auth.users
workspaces 1──* tasks 1──* task_reviews
workspaces 1──* tasks 1──* task_events
agents 1──* tasks (via agent_type)
workspaces 1──1 integration_settings
workspaces 1──* ad_connections
workspaces 1──* reels | creative_assets | content_studio_items | notifications
workspaces 1──* security_audit_logs | usage_limits | subscriptions
content_studio_items 1──* content_studio_publish_attempts
saved_reports 1──* report_share_links
```

### 5.5 Conceptual BI / diagnostic tables (product vision)

The dossier requirements name the following tables. They represent the **Business Intelligence → AgentFlow handoff layer**.

> **Status as of 2026-07-10:** These are **not present as named tables** in the consolidated schema. Audits mark the Client Intelligence / Diagnosis engine as largely missing. Below is the **target schema design** for the next product phase, mapped to existing primitives where possible.

#### Target tables

| Target table | Purpose | Closest existing primitive |
|--------------|---------|----------------------------|
| `business_profiles` | Structured company intake: industry, offer, channels, ICP, constraints, goals | `workspaces` + future child entity; partially `projects` |
| `bottlenecks` | Ranked constraints (acquisition, conversion, ops, cash, brand, product) | Can be derived from Meta/Google diagnosis helpers + future LLM diagnosis |
| `opportunities` | Prioritized levers with impact/effort scores | Strategy/task recommendations in agent outputs |
| `strategy_reports` | Founder-facing strategy synthesis | `saved_reports` + task `result.structuredOutput` |
| `agentflow_candidates` | Pre-task proposals with readiness/risk scoring | Workflow builder pending tasks; Agent Library plans |
| `agentflow_tasks` | Approved executable units | **`tasks` table (implemented)** |
| `audit_trail` | Cross-entity approval and security history | `task_events` + `security_audit_logs` + publish attempts |

#### Recommended target relationships

```text
workspaces 1──* business_profiles
business_profiles 1──* bottlenecks
business_profiles 1──* opportunities
business_profiles 1──* strategy_reports
strategy_reports 1──* agentflow_candidates
agentflow_candidates 1──* agentflow_tasks  (maps to public.tasks)
* ──* audit_trail entries (polymorphic entity_type + entity_id)
```

#### Suggested column design (for implementers)

**`business_profiles`**

- `id`, `workspace_id`, `name`, `industry`, `stage`, `monthly_revenue_band`
- `offer_summary`, `target_customer`, `primary_channels[]`
- `constraints` jsonb, `goals` jsonb, `intake_answers` jsonb
- `status` (`draft|ready|archived`), timestamps

**`bottlenecks`**

- `id`, `workspace_id`, `business_profile_id`
- `category`, `title`, `severity` (1–5), `evidence` jsonb
- `source` (`user|metrics|ai`), `status`

**`opportunities`**

- `id`, `workspace_id`, `business_profile_id`, optional `bottleneck_id`
- `title`, `impact_score`, `effort_score`, `priority_score`
- `recommended_agents[]`, `status`

**`strategy_reports`**

- `id`, `workspace_id`, `business_profile_id`
- `summary`, `body` jsonb, `readiness_score`
- `approval_status` (`draft|pending_approval|approved|rejected`)
- `approved_by`, `approved_at`

**`agentflow_candidates`**

- `id`, `workspace_id`, `strategy_report_id`, `opportunity_id`
- `proposed_agent_id`, `title`, `rationale`
- `readiness_score`, `risk_flags` jsonb
- `evaluation_status` (`proposed|accepted|rejected|deferred`)

**`agentflow_tasks`**

- Prefer **extending** `public.tasks` with nullable FKs:
  - `business_profile_id`, `strategy_report_id`, `candidate_id`
- Avoid a second parallel task table unless a hard product reason appears.

**`audit_trail`**

- Prefer unifying writes into `security_audit_logs` + `task_events` with consistent `event_type` taxonomy rather than a third silo, unless compliance requires a dedicated append-only table with immutability guarantees.

---

## 6. Existing Features

### 6.1 Authentication & onboarding

| Feature | Status | Notes |
|---------|--------|-------|
| Email signup/login | Implemented | Supabase Auth; signup allowlist available server-side |
| Session management | Implemented | HttpOnly cookies, refresh, idle timeout, logout-all |
| MFA / TOTP | Implemented | Supabase authenticator app; `/auth/mfa`, settings enrollment |
| Auth brute-force protection | Implemented | IP + email attempt limits and lockout |
| Workspace onboarding | Implemented | `/onboarding` creates workspace context |
| Active workspace cookie | Implemented | Scopes dashboard and execute routes |

### 6.2 Multi-user access control

| Feature | Status | Notes |
|---------|--------|-------|
| Workspace membership | Implemented | `workspace_members` |
| RBAC roles | Implemented | `viewer < editor < operator < admin < owner` |
| Department scoping | Implemented | `content`, `creative`, `social`, `strategy`, `paid_ads`, `operations` |
| Sidebar filtering by role | Implemented | `canViewArea` |
| Server-side RBAC guards | Implemented | `requireWorkspaceAccessWithRBAC` |

### 6.3 Agent catalog & orchestration UI

| Feature | Status | Notes |
|---------|--------|-------|
| Seeded departments + agents | Implemented | 4 departments, ~27 agents in DB seed; richer catalogs in code/templates |
| Agents dashboard | Implemented | `/dashboard/agents` |
| Create task | Implemented | `/dashboard/create-task` |
| Tasks list + detail | Implemented | Status badges, run, retry |
| Agent Library | Implemented | Templates, readiness, recommendations |
| Workflow Builder | Implemented | Plans/playbooks; safe export; no auto live n8n edits |
| Alex assistant | Implemented | `/api/alex/chat` + tool registry (draft/read tools) |
| Automation blueprints / industry packs | Implemented | Opinionated starting points |

### 6.4 Task lifecycle & human review

| Feature | Status | Notes |
|---------|--------|-------|
| Task statuses | Implemented | Full lifecycle including failed/cancelled |
| Execute via n8n | Implemented | `POST /api/tasks/execute` |
| Callback handling | Implemented | `POST /api/n8n/callback` (+ `/api/tasks/callback`) |
| Structured output validation | Implemented | Callback payload validation helpers |
| Approve | Implemented | `needs_review → completed` |
| Request Changes v2 | Implemented | Feedback stored; revision notes on rerun |
| Stale failure recovery | Implemented | `fail-stale` + queue stale recovery |
| BullMQ / DLQ | Implemented | Background reliability layer |

### 6.5 Reporting

| Feature | Status | Notes |
|---------|--------|-------|
| Structured client-ready report | Implemented | summary, analysis, plans, recommendations, next actions |
| Copy report | Implemented | Markdown-friendly |
| Export PDF | Implemented | Client + server PDF paths |
| Reports library | Implemented | `/dashboard/reports` filters |
| Save report + share links | Implemented | `saved_reports`, tokenized share page |

### 6.6 Content, creative, and growth tooling

| Feature | Status | Notes |
|---------|--------|-------|
| Content Studio | Implemented | Multi-platform drafts, scheduler, publish attempts |
| Reels Studio | Implemented | Organic Instagram planning + gated publish foundation |
| Creative Assets | Implemented | Prompt workflow + OpenAI image generation when keyed |
| Campaigns | Implemented | Manual + connected ad metrics surfaces |
| Meta Ads (read-only) | Implemented | OAuth, accounts, campaigns, 30-day insights, local diagnosis |
| Google Ads (read-only) | Implemented | OAuth, customer accounts, campaigns, metrics → analysis tasks |
| Pinterest Ads | Foundation | Provider scaffolding; connection gated by env |
| Paid draft helpers | Partial | Meta paused draft helpers exist; full ads write remains guarded |

### 6.7 Platform operations

| Feature | Status | Notes |
|---------|--------|-------|
| Personalized + command dashboards | Implemented | Role-based view mode |
| Operational dashboard APIs | Implemented | summary, execution, provider, alerts |
| System health / production gate UI | Implemented | Launch readiness scoring |
| Usage / quotas UI | Implemented | Plan limits enforced on create/publish paths |
| Notifications + realtime | Implemented | Bell + center; postgres_changes subscription |
| Security center | Implemented | Audit-oriented surface |
| Settings (branding, MFA, sessions) | Implemented | Admin controls |
| Knowledge base / prompt library / projects / releases | Implemented | Internal operator tooling |
| Quality review / safe patch planner / backups | Implemented | Engineering-governance features |
| i18n (en/ar/fr/es) | Implemented | Dashboard labels + marketing |
| Accessibility work | In progress | Docs + partial UI hardening |

### 6.8 Diagnostic engine features (vision vs reality)

| Feature named in product vision | Status | Reality in codebase |
|---------------------------------|--------|---------------------|
| Business profile creation | **Partial / planned** | Workspace + projects exist; dedicated `business_profiles` module not shipped |
| Diagnostic engine | **Planned** | Meta local diagnosis exists for ads metrics; full business diagnosis engine missing |
| Bottleneck detection | **Planned** | Not first-class |
| Opportunity mapping | **Planned** | Appears in agent copy and templates, not as schema entity |
| Strategy report generation | **Partial** | Task reports + saved reports; not founder-strategy pipeline |
| Approval workflow | **Implemented** | Strong for tasks; extend pattern to strategy/candidates |
| AgentFlow candidate evaluation | **Partial** | Workflow readiness/review helpers; not full scoring product |
| Task generation | **Implemented** | Manual + workflow/playbook task creation |
| Task review system | **Implemented** | Mature |
| Audit logging | **Implemented** | Task events + security audit logs |
| Dashboards and admin pages | **Implemented** | Extensive dashboard surface |

---

## 7. API Architecture

### Design principles

1. **Browser never holds secrets** — service role, n8n secrets, ad encryption keys, OpenAI keys are server-only.
2. **Workspace is required** for operational mutations.
3. **RBAC is enforced in app layer** (and RLS at DB).
4. **Automation callbacks are secret-protected** and idempotent where implemented.
5. **Zod validation + payload size limits** on sensitive POST routes.
6. **Rate limiting** on `/api/*` and auth endpoints.
7. **Production gate** can block execution/publish when env/readiness fails.

### 7.1 Auth

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/signup` | POST | Create account (subject to allowlist / validation) |
| `/api/auth/login` | POST | Password login; may require MFA step-up |
| `/api/auth/logout` | POST | End session / clear cookies |
| `/api/auth/refresh` | POST | Refresh session tokens |
| `/auth/callback` | GET | Supabase OAuth/magic-link callback page route |

Server actions under `src/actions/auth/*` complement these for form-driven flows (login, signup validation, MFA, session).

### 7.2 Tasks & automation

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/tasks/execute` | POST | Validate user/workspace/RBAC/gate; mark task `processing`; enqueue/call n8n |
| `/api/n8n/callback` | POST | n8n result webhook; requires `x-n8n-callback-secret`; success → `needs_review`, failure → `failed` |
| `/api/tasks/callback` | POST | Alternate/compat callback path for task results |
| `/api/tasks/fail-stale` | POST | Mark stuck `processing` tasks failed (ops/recovery) |

### 7.3 Alex

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/alex/chat` | POST | Conversational assistant with tool registry (read/draft; safety-constrained) |

### 7.4 Reports

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/reports/client-pdf` | POST/GET | Generate client PDF from task/report data |
| `/api/reports/save` | POST | Persist report version |
| `/api/reports/share/[token]` | GET | Resolve public/shared report by token |

### 7.5 Ads OAuth

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/ads/meta/connect` | GET/POST | Start Meta OAuth |
| `/api/ads/meta/callback` | GET | Complete Meta OAuth; store encrypted tokens |
| `/api/ads/google/connect` | GET/POST | Start Google Ads OAuth |
| `/api/ads/google/callback` | GET | Complete Google Ads OAuth |
| `/api/ads/pinterest/connect` | GET/POST | Start Pinterest OAuth (when enabled) |
| `/api/ads/pinterest/callback` | GET | Complete Pinterest OAuth |

### 7.6 Dashboard / ops

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/dashboard/operational/summary` | GET | Ops KPIs summary |
| `/api/dashboard/operational/execution` | GET | Execution metrics |
| `/api/dashboard/operational/provider` | GET | Provider readiness/status |
| `/api/dashboard/operational/alerts` | GET | Operational alerts feed |
| `/api/dashboard/content-studio/run-scheduler` | POST | Manual scheduler trigger (authorized) |
| `/api/cron/content-studio-scheduler` | GET/POST | Vercel cron entry (protected by `CRON_SECRET`) |
| `/api/health` | GET | Liveness/readiness probe |

### 7.7 Billing (scaffold)

| Route | Purpose | Status |
|-------|---------|--------|
| `/api/billing/checkout` | Create Stripe Checkout session | Route directory present; implementation incomplete |
| `/api/billing/portal` | Customer billing portal | Scaffold |
| `/api/billing/subscription` | Read current subscription | Scaffold |
| `/api/billing/webhook` | Stripe webhooks → `subscriptions` | Scaffold |

### 7.8 n8n contract (summary)

Stable contract document: `docs/N8N_V5_CONTRACT.md`

**Outbound payload includes:** task/workspace/agent IDs, names, department, title, description, priority, callback URL, dual camelCase/snake_case fields, optional `revisionNotes` / `revision_notes`.

**Inbound success path:** store `result` (expect `callbackPayload.structuredOutput`), set `needs_review`, write task event.

**Inbound failure path:** store error, set `failed`, write task event.

---

## 8. User Journey

This section describes the **complete product journey** combining what is built today with the diagnostic layer under construction. Steps marked **(planned)** are product targets; unmarked steps exist.

### Stage 0 — Registration & access

1. User visits marketing landing (`/`).
2. Signs up / logs in (`/auth/signup`, `/auth/login`).
3. Completes MFA challenge if enrolled (`/auth/mfa`).
4. Creates or joins a workspace (`/onboarding`).
5. Lands on role-appropriate dashboard (`/dashboard`).

### Stage 1 — Business registration / profile **(planned core; partial today)**

1. Operator creates a **business profile** for a client or own company.
2. Captures industry, offer, ICP, channels, constraints, goals.
3. Profile becomes the root object for diagnosis.

**Today’s substitute:** workspace name + projects + free-text task descriptions.

### Stage 2 — Diagnosis **(planned; ads diagnosis partial)**

1. System collects signals: intake answers, connected ad metrics, optional knowledge base.
2. Diagnostic engine produces **bottlenecks** with severity and evidence.
3. Human can edit/confirm bottlenecks before continuing.

**Today’s partial path:** Meta/Google campaign metrics → local deterministic diagnosis → create analysis task.

### Stage 3 — Opportunities **(planned)**

1. Bottlenecks map to **opportunities** with impact/effort scoring.
2. Recommended agent types are attached (e.g., SEO, ads script, ops).
3. Operator prioritizes the opportunity backlog.

### Stage 4 — Strategy report **(partial)**

1. System generates a **strategy report** synthesizing diagnosis + opportunities.
2. Report includes readiness score and proposed initiative sequence.
3. Founder/admin reviews the report in-product.

**Today’s partial path:** specialized agents produce structured reports on tasks; reports library + PDF/share.

### Stage 5 — Founder approval **(pattern exists; extend to strategy)**

1. Founder approves strategy or requests changes.
2. Approval is written to audit trail.
3. Only approved strategies unlock candidate generation at scale.

**Today:** approve/request-changes exists on **task outputs**, not yet on strategy objects.

### Stage 6 — AgentFlow evaluation **(partial)**

1. System proposes **candidates**: agent + objective + risk flags + readiness.
2. Workflow Builder / readiness checks block unsafe auto-actions.
3. Operator accepts, defers, or rejects candidates.

### Stage 7 — Task generation **(implemented)**

1. Accepted candidates become `tasks` (`pending`).
2. Tasks can also be created manually from agent catalog or Alex/playbooks.
3. Quotas are checked; RBAC must allow create (`editor+` typical).

### Stage 8 — Human review of execution **(implemented)**

1. Operator runs task (`operator+` typical) → `processing`.
2. n8n returns structured result → `needs_review`.
3. Reviewer inspects client-ready report.
4. **Approve** → `completed` **or** **Request Changes** → `pending` with revision notes.

### Stage 9 — Future automation execution **(partial / guarded)**

1. Content Studio scheduler publishes on cron when configured.
2. Reels publish remains explicit-click + provider-gated.
3. Ads write/publish remains intentionally restricted pending stronger approval UX.
4. Long-term: approved playbooks run multi-step agent graphs with intermediate checkpoints.

### End-to-end target flow (ASCII)

```text
Register → Workspace
  → Business Profile (planned)
  → Diagnosis / Bottlenecks (planned)
  → Opportunities (planned)
  → Strategy Report (partial)
  → Founder Approval (extend)
  → Candidate Evaluation (partial)
  → Task Generation (live)
  → n8n Execution (live)
  → Human Review (live)
  → Reports / Share / PDF (live)
  → Analytics + Audit (live foundation)
  → Continuous automation (guarded)
```

---

## 9. SaaS Transformation Roadmap

### 9.1 Authentication — mostly complete

| Item | Status |
|------|--------|
| Email/password auth | Done |
| Session hardening | Done |
| MFA TOTP | Done |
| Signup controls | Done (allowlist capability) |
| SSO / SAML / Google OAuth productization | Future |
| SCIM / enterprise directory | Long-term |

### 9.2 Organizations / workspaces

| Item | Status |
|------|--------|
| Workspaces as tenants | Done |
| Multi-workspace membership | Foundation present |
| Organizations above workspaces | Planned |
| Multi-business profiles per agency workspace | Planned (BI layer) |
| Workspace transfer / ownership recovery | Needs productization |

### 9.3 Role management

| Item | Status |
|------|--------|
| Five-tier RBAC | Done |
| Department scoping | Done |
| Invite UI + role assignment | Partial (settings-driven; polish invites/email) |
| Custom permission overrides via `permissions` jsonb | Reserved, not fully productized |
| Client portal role (external client viewer) | Planned |

### 9.4 Billing & Stripe

| Item | Status |
|------|--------|
| DB tables for customers/subscriptions | Done |
| Plan enum + usage limits | Done |
| Stripe Checkout / Portal / Webhook routes | Scaffold |
| Pricing page + upgrade UX | Missing / incomplete |
| Live mode gate (`STRIPE_ALLOW_LIVE_MODE`) | Env-ready |
| Dunning, invoices UI, tax | Future |

### 9.5 Subscription tiers & usage limits

| Plan (code) | AI gens / mo | Tasks | Creative assets | Content items | Reels publishes / mo |
|-------------|--------------|-------|-----------------|---------------|----------------------|
| free | 20 | 40 | 50 | 30 | 10 |
| starter | 100 | 200 | 200 | 100 | 50 |
| pro | 500 | 1000 | 1000 | 500 | 200 |
| agency | unlimited (`null`) | unlimited | unlimited | unlimited | unlimited |

Hard limits already block over-quota operations on covered create/publish paths. Billing should **drive plan changes** into `usage_limits`.

### 9.6 Team collaboration

| Item | Status |
|------|--------|
| Shared workspace data | Done |
| Review assignments | Basic (reviewer is acting user) |
| Comments threads on tasks/strategy | Future |
| Mentions + email notifications | Future |
| Activity feed beyond notifications | Partial |

### 9.7 Analytics

| Item | Status |
|------|--------|
| Operational execution metrics APIs | Done foundation |
| Usage dashboard | Done foundation |
| Funnel from diagnosis → approved tasks → completed | Planned |
| Revenue / client outcome analytics | Future |

### 9.8 Notifications

| Item | Status |
|------|--------|
| In-app notifications + realtime | Done foundation |
| Email notifications | Missing |
| Push / Slack / webhooks out | Future |
| Preference matrix per event type | Partial via preferences |

### 9.9 Multi-tenant security

| Item | Status |
|------|--------|
| RLS + workspace membership | Done |
| Service role isolation (server-only) | Done |
| SSRF protection for outbound webhooks | Done |
| Token encryption for ad connections | Done |
| Security audit log | Done |
| Pen test / formal SOC2 program | Not started |
| Per-tenant encryption keys | Future enterprise |

### 9.10 Cloud deployment

| Item | Status |
|------|--------|
| Vercel production | Live |
| Supabase managed Postgres | Live |
| Upstash Redis | Supported |
| Deploy scripts + smoke tests | Done |
| Staging environment parity | Recommended gap |
| Custom domain automation | Manual DNS guidance only |
| Multi-region | Future |

---

## 10. AI Agent Vision

### 10.1 Current agent model

Agents are **specialized roles** grouped by department. Tasks bind to an agent id; n8n receives agent identity and produces structured output for that role.

Representative catalog domains (code + seed):

**Research & Strategy**

- Market Research, Competitor Analysis, Audience Persona, Product Idea, SEO Keyword, Strategy Planner

**Content & Growth**

- Social Media Content, Copywriting, Ads Script, Email Marketing, Blog SEO Article, Visual Brief, Content Creator

**Sales & Operations**

- Lead Finder, Lead Qualifier, Outreach Message, CRM Update, Customer Support, Analytics Report, Offer Builder, Outreach, Report

**Engineering / delivery (extended)**

- Code Review, Bug Fix, Architecture, Testing, Documentation, Deployment, Security Review, Database, UI/UX Review

Agent Library templates expand this with workflow-ready prompt packages (research, SWOT, competitive landscape, quality review, etc.).

### 10.2 Future specialized agent architecture

```text
                    ┌──────────────────────────┐
                    │   Orchestrator (AgentFlow)│
                    │  policy · quotas · approval│
                    └────────────┬─────────────┘
           ┌─────────────────────┼─────────────────────┐
           ▼                     ▼                     ▼
   Analysis Agents      Go-to-Market Agents      Execution Agents
           │                     │                     │
           ▼                     ▼                     ▼
   Diagnostics store      Content/Ads systems     n8n / publishers
```

#### Business analysis agents

- Business profiler / intake interviewer
- Bottleneck detector (metrics + qualitative)
- Opportunity scorer
- Competitive intelligence
- KPI and health-score reporter

#### Marketing strategy agents

- Positioning and offer design
- Channel strategy
- Campaign brief generator
- SEO and content strategy
- Paid media analyst (read-only first, write later with approval)

#### Operations optimization agents

- Process bottleneck analyst
- Delivery capacity planner
- SLA / review-turnaround optimizer
- Tooling stack recommender

#### Financial recommendation agents

- Pricing experiment designer
- Unit economics commentator
- Budget allocation advisor
- **Guardrail:** advisory only; never moves money without explicit human + provider approval UX

#### Content generation agents

- Copy, scripts, email, blog, creative briefs
- Reels script/caption
- Creative Assets prompt → image generation
- Localization (ar/en/fr/es)

#### Workflow automation agents

- Playbook compiler (Agent Library → pending tasks)
- n8n plan exporter (reference-only unless explicitly executed)
- Scheduler coordinator
- Recovery agent for failed runs

#### Reporting agents

- Client-ready report synthesizer
- Executive weekly digest
- Attribution narrative from ad metrics
- Audit summary for compliance

### 10.3 Orchestration rules (non-negotiable)

1. Agents propose; humans dispose (approve).
2. High-risk actions (publish, spend, delete, credential changes) require elevated role + explicit confirmation.
3. Every automated run must be attributable to workspace, user, agent, and task.
4. Structured outputs beat free-form chat for product reliability.
5. Multi-agent chains must insert review checkpoints between irreversible steps.

---

## 11. Security & Governance

### 11.1 Human approval checkpoints

| Checkpoint | Mechanism |
|------------|-----------|
| Task output acceptance | `needs_review` required before `completed` |
| Request changes | Feedback mandatory (v2); loops into n8n |
| Workflow builder | Blocks auto n8n execution / live provider writes |
| Content / Reels publish | Explicit user action + provider readiness |
| Ads management writes | Intentionally not enabled as default write path |
| Production gate | Blocks execution when env/readiness fails |
| Strategy approval **(planned)** | Founder approval before mass task generation |

### 11.2 Audit trail requirements

Must record, at minimum:

- task state transitions
- review decisions and feedback
- execution attempts and callback outcomes
- publish attempts and failures
- security-sensitive events (login anomalies, permission changes, gate failures)
- billing-affecting events (when Stripe goes live)

**Implemented stores:** `task_events`, `security_audit_logs`, `content_studio_publish_attempts`, `n8n_callback_events`.

### 11.3 Access control

- RBAC hierarchy enforced in server actions and key API routes
- Department scoping for non-admin roles
- RLS on Postgres tables
- Signup allowlist capability for controlled beta
- MFA for elevated assurance

### 11.4 Data isolation

- Workspace scoping on operational data
- Active workspace cookie checked against body `workspaceId` on execute path
- No service-role keys in client bundles (`BrowserSecretGuard`, public env validation)
- Ad tokens encrypted with `AD_TOKEN_ENCRYPTION_KEY`

### 11.5 Rate limiting

- Middleware-level limits on `/api/*`
- Auth brute-force limits (attempts / lockout windows)
- Per-route limits (e.g., task execute)
- Upstash Redis preferred in production; in-memory fallback for dev

### 11.6 Validation

- Zod schemas on critical APIs
- Payload size limits
- SSRF host allowlists for n8n webhooks
- Structured output validation for callbacks
- Status transition guards (`pending|failed` → execute, etc.)

### 11.7 Additional hardening already present

- CSP configuration
- Session idle timeout and secure cookie flags
- Security audit logging helper
- Post-deploy smoke and security audit scripts
- Safety guardrails for Alex / Agent Library (no secret leakage, no auto spend)

---

## 12. Production Readiness Checklist

Legend: **Done** · **Partial** · **Missing**

### 12.1 Product core

| Item | State |
|------|-------|
| Marketing site + auth pages | Done |
| Workspace onboarding | Done |
| Agent catalog + tasks | Done |
| n8n execute/callback contract | Done |
| Human review loop | Done |
| Reports + PDF + share | Done / Partial (Chromium on all prod shapes) |
| Business profile module | Missing |
| Diagnosis / bottlenecks / opportunities | Missing (ads local diagnosis Partial) |
| Strategy approval pipeline | Missing |
| Candidate evaluation product | Partial |
| End-to-end multi-agent campaigns | Partial |

### 12.2 SaaS commercial

| Item | State |
|------|-------|
| Plan limits + usage events | Done |
| Billing tables | Done |
| Stripe checkout/portal/webhooks | Partial (scaffold) |
| Pricing page + self-serve upgrade | Missing |
| Invoices / tax / dunning | Missing |
| Public docs / status page | Partial / Missing |

### 12.3 Security

| Item | State |
|------|-------|
| RLS + server RBAC | Done |
| MFA | Done |
| Rate limits + brute-force | Done |
| SSRF protections | Done |
| Audit logs | Done |
| Formal pen test | Missing |
| Privacy program (DPA, retention jobs) | Partial (privacy/terms pages exist) |

### 12.4 Reliability & ops

| Item | State |
|------|-------|
| Vercel deploy | Done |
| Health endpoint | Done |
| Sentry | Partial / configured |
| BullMQ/DLQ/stale recovery | Done foundation |
| Staging environment | Partial / recommended |
| On-call runbooks | Partial (docs exist) |
| Log aggregation beyond Vercel | Partial |

### 12.5 Quality

| Item | State |
|------|-------|
| Vitest unit/smoke suite | Done (200+ tests reported in July 2026 audit) |
| CI lint/typecheck | Partial → improving on `fix/ci-deps-cleanup` |
| E2E (Playwright) | Missing / not primary |
| Load testing | Missing |
| Lint clean zero errors | Partial |

### 12.6 Launch gate (operator)

Before inviting paying customers:

- [ ] Production migrations applied (clean schema + saved reports + usage events + realtime)
- [ ] All production env vars set (see `.env.example` + `docs/FINAL_LAUNCH_CHECKLIST.md`)
- [ ] `npm run build` and `npm test` green on release commit
- [ ] `/dashboard/production` gate Green for paid automation features
- [ ] n8n webhook + callback secret verified with a real task
- [ ] Stripe test mode full path verified before `STRIPE_ALLOW_LIVE_MODE=true`
- [ ] MFA enforced for owner/admin accounts
- [ ] Backup / restore drill documented
- [ ] Support contact + incident channel defined

---

## 13. Recommended Next Steps

### 13.1 Immediate tasks (0–2 weeks)

1. **Freeze and document the diagnostic domain model**  
   Add migrations for `business_profiles`, `bottlenecks`, `opportunities`, `strategy_reports`, `agentflow_candidates` (or document explicit mapping onto existing tables). Prefer FK extensions on `tasks` over a second task system.

2. **Complete Stripe path in test mode**  
   Implement checkout, portal, webhook → `subscriptions` + `usage_limits.plan` sync. Hide live mode behind existing gate.

3. **Unify task creation behind `taskService`**  
   Reduce bypass paths; ensure every create checks RBAC + quota + audit event.

4. **Production env + migration parity**  
   Apply pending migrations; run deploy preflight + smoke.

5. **CI green on mainline branch**  
   Lint/typecheck/test as merge gates on `fix/ci-deps-cleanup` → `main`.

### 13.2 Short-term tasks (2–6 weeks)

1. **Business intake UI** → writes `business_profiles`.
2. **Diagnosis v1**  
   Hybrid: deterministic rules + LLM structured JSON; human editable bottlenecks/opportunities.
3. **Strategy report v1**  
   Approval state machine mirroring tasks (`draft → pending_approval → approved`).
4. **Candidate generation v1**  
   From approved strategy; readiness scoring reuses Agent Library workflow readiness.
5. **Email notifications** for `needs_review`, publish failures, billing events.
6. **Staging workspace** with isolated Supabase project.

### 13.3 Medium-term tasks (6–16 weeks)

1. **Self-serve SaaS packaging** — pricing page, upgrade, plan enforcement UX, invoices.
2. **Team invites + better collaboration** — email invites, review assignment, comments.
3. **Analytics product** — diagnosis→task→completion funnel; agent performance.
4. **Multi-agent playbooks in production** — still with checkpoints; optional auto-run only for low-risk steps.
5. **Client portal** — external viewer for approved reports only.
6. **E2E test suite** for critical journeys (auth → task → callback mock → approve → PDF).

### 13.4 Long-term SaaS milestones

| Milestone | Outcome |
|-----------|---------|
| **M1 — Governed Agency OS** | Current platform stabilized for internal/agency teams |
| **M2 — Diagnostic SaaS** | Full BI path from profile to approved strategy |
| **M3 — Execution Marketplace** | Agent packs / industry packs monetized per plan |
| **M4 — Autonomous (bounded)** | Conditional auto-execution for low-risk, pre-approved playbooks |
| **M5 — Enterprise** | SSO, audit exports, retention policies, multi-region, SLAs |

---

## 14. Final Vision Statement

AgentFlow-AI is being built as the **AI operating system for business growth and execution**.

Not another chatbot. Not a disconnected automation board. Not a static dashboard of vanity charts.

It is a system that will:

- **understand** a business through structured profiles and evidence
- **diagnose** bottlenecks with traceable severity and proof
- **map** opportunities to the agents that can actually act on them
- **compose** strategy that a founder can approve or reject
- **evaluate** execution readiness before automation spends attention or money
- **orchestrate** specialized agents under quotas, roles, and secrets hygiene
- **require humans** at the moments that matter
- **record** every meaningful action in an audit trail
- **deliver** client-ready artifacts instead of chat transcripts
- **scale** across teams, tenants, and subscription tiers in the cloud

The platform already proves the hardest operational truths of that vision: multi-tenant workspaces, RBAC, n8n contracts, human review loops, report delivery, provider safety rails, and production deployment.

What remains is to complete the intelligence layer that sits *above* execution — the diagnostic and strategic brain — and the commercial layer that makes the system a durable SaaS.

When those layers meet the orchestration core that exists today, AgentFlow-AI becomes something rare: a product where **insight, judgment, and action share one governed loop**.

That loop is the product.

---

## Appendix A — Key internal references

| Document | Path |
|----------|------|
| Architecture | `docs/ARCHITECTURE.md` |
| n8n contract | `docs/N8N_V5_CONTRACT.md` |
| Roadmap | `docs/ROADMAP.md` |
| RBAC | `docs/RBAC_IMPLEMENTATION.md` |
| Safety guardrails | `docs/SAFETY_GUARDRAILS.md` |
| Final launch checklist | `docs/FINAL_LAUNCH_CHECKLIST.md` |
| Team onboarding | `docs/TEAM_ONBOARDING.md` |
| Case study | `docs/PROJECT_CASE_STUDY.md` |
| Schema | `supabase/migrations/20260703000000_full_clean_schema.sql` |
| README | `README.md` |

## Appendix B — Assumption log

| ID | Assumption | Why labeled |
|----|------------|-------------|
| A1 | BI tables (`business_profiles`, etc.) are the intended diagnostic domain model | Named in product brief; not present as tables in schema |
| A2 | `tasks` should absorb `agentflow_tasks` via FKs rather than a duplicate table | Avoid dual lifecycle systems; `tasks` already production-critical |
| A3 | Drizzle is **not** part of the stack despite some external notes | No Drizzle dependency in `package.json` or codebase |
| A4 | Stripe is the billing provider of record | Schema + env gates reference Stripe |
| A5 | Long-term multi-business agencies use many `business_profiles` per workspace | Standard agency SaaS pattern; aligns with multi-client ops |
| A6 | Full autonomous execution remains bounded by human approval for high-risk actions | Consistent with safety guardrails and ads read-only posture |

## Appendix C — Glossary

| Term | Definition |
|------|------------|
| Workspace | Tenant boundary for data isolation |
| Task | Atomic unit of agent work |
| needs_review | Post-automation human checkpoint status |
| Candidate | Proposed future task prior to approval/materialization |
| Production gate | Server-side readiness check blocking unsafe execution |
| n8n v5 contract | Stable webhook/callback payload agreement |
| RBAC | Role-based access control within a workspace |
| Structured output | Typed JSON report payload from automation |

---

*End of dossier. This document is intended to be sufficient for a new engineering team or AI assistant to continue AgentFlow-AI without relying on undocumented tribal knowledge.*
