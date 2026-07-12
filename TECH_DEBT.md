# AgentFlow AI — Tech Debt & Improvements

> Last updated: 2026-07-12 (Wave 2 Full Merge)

## Database / Migrations

- [x] **Consolidated schema** — 38 incremental migrations replaced by `supabase/migrations/20260703000000_full_clean_schema.sql`
- [x] Single file: 31 tables, enums (`department`, `rbac_role`), RLS, triggers, storage, seed (4 depts / 27 agents)
- [ ] Add CI step to validate migration SQL syntax (e.g. `supabase db lint` or dry-run against ephemeral Postgres)
- [x] DB-level RLS on `tasks` using `has_min_role()` + `user_can_access_task_department()` + `catalog_dept_rbac_values()`
- [x] Department RLS on `creative_assets`, `content_studio_items`, `reels`, `content_studio_publish_attempts` via `user_can_access_rbac_department()` + resource dept mappers
- [x] Billing tables locked: `subscriptions` + `billing_customers` — SELECT owner/admin only; no client INSERT/UPDATE (service role + webhook)
- [x] `usage_limits` seeded in `handle_new_workspace_owner` trigger; owner UPDATE policy; server increments via service role
- [ ] Dedicated `usage_events` table for metered billing (see Usage Quotas section below)

## Wave 2 — Security & Consistency ✅

### Completed in Wave 2

- [x] **W2-T2: CSP Violation Endpoint Resolution** — Removed `report-uri` and `report-to` directives pointing to non-existent `/api/csp-violation` endpoint
- [x] **W2-T4: Standardize API Error Envelope + Request IDs** — Unified error shape `{ success: false, error, message, requestId, timestamp }` across 7+ routes (auth/login, auth/signup, auth/refresh, auth/logout, n8n/callback, tasks/fail-stale, rate-limit handler)
- [x] **W2-T6: Deprecate Dual n8n Callback Route** — `/api/tasks/callback` became thin deprecation wrapper; `/api/n8n/callback` is canonical; backward compatibility maintained with deprecation headers
- [x] **W2-R2: Harden Health Endpoint** — Two-tier response: public gets `{ status, timestamp }` only; authenticated users see full diagnostics
- [x] **W2-R3: Billing Decision** — Option B: Keep scaffold; `docs/BILLING_STATUS.md` created with comprehensive gap analysis
- [x] **W2-R4: RBAC Dual Systems Documentation** — Legacy files marked `@deprecated`; architecture table + migration plan added to TECH_DEBT.md

### Not Started (Critical Gap)

- [ ] **W2-T1: Secret Hygiene** — Rotate keys in `.env.example`, sanitize template to placeholders, scan git history

### All Wave 2 Reports
| Report | Location |
|--------|----------|
| W2-T2 (CSP) | `docs/orchestrator/reports/W2-T2-csp.md` |
| W2-T4 (API Envelope) | `docs/orchestrator/reports/W2-T4-api-envelope.md` |
| W2-T6 (n8n callback) | `docs/orchestrator/reports/W2-T6-n8n-callback.md` |
| W2-R2 (Health) | `docs/orchestrator/reports/W2-R2-health.md` |
| W2-R3 (Billing) | `docs/orchestrator/reports/W2-R3-billing.md` |
| W2-R4 (RBAC) | `docs/orchestrator/reports/W2-R4-rbac.md` |
| W2-R6 (QA) | `docs/orchestrator/reports/W2-R6-qa.md` |

## Route protection (middleware)

- [x] **`src/middleware.ts`** — edge entry (auth + workspace + RBAC/department on `/dashboard/*`)
- [x] **`src/lib/auth/require-page-access.ts`** — shared `evaluatePageAccess` / `buildPageAccessContext` (edge + server)
- [x] **`src/lib/auth/dashboard-edge-auth.ts`** — edge handler (CSP, Supabase session, membership query)
- [x] Dashboard layout defense-in-depth via `PATHNAME_HEADER` + `evaluatePageAccess`
- [x] `requirePageAccess()` server helper in `rbac.ts`
- [x] Unit tests: `tests/require-page-access.test.ts`
- [x] Edge handler extracted to `dashboard-edge-auth.ts` (CSP + Supabase session + membership)
- [ ] Migrate to `proxy.ts` export when dropping `middleware.ts` filename (Next.js 16 deprecation warning only)
- [ ] Extend `requirePageAccess` with per-route minimum role map (settings/billing/production)
- [ ] Align Sidebar fail-open (`!role → true`) with middleware fail-closed behavior

## P0 Blockers (2026-07-04 fix)

- [x] **Build fix** — split client-safe RBAC into `src/lib/auth/rbac-client.ts`; `Sidebar.tsx` imports from there (no `server-only` in client)
- [x] **Run Task fix** — `src/components/tasks/RunTaskButton.tsx` sends `workspaceId` + `taskPayload` (built via `buildTaskExecutionPayload`)
- [x] **Execute route** — `/api/tasks/execute` uses `assertProductionGate`, `taskService.canExecuteTask`, `getN8nReadiness`, session workspace binding
- [x] **TaskService** — uses `createSupabaseServerClient()` instead of browser Supabase client fallback
- [x] Department mapping (RBAC enum ↔ agent catalog) via `DEPARTMENT_MAP` in `rbac-client.ts`
- [x] Task department scoping in `task-service` (`canCreateTask`, `canExecuteTask`, list filter)
- [x] `agent_department` column on `tasks` + department-aware RLS (`has_min_role` + `user_can_access_task_department`)
- [x] `TasksClient` + dashboard use server-side department-filtered task lists

## RBAC / Dual Systems

> **Source of truth:** `@/lib/auth/rbac` (`rbac.ts`) with client-safe helpers in `@/lib/auth/rbac-client.ts`.
> **Legacy layer:** `@/lib/workspace-permissions` — still used by ~22 call sites; new code must NOT import from it.

### Architecture

| Layer | File | Role |
|-------|------|------|
| **Current (source of truth)** | `src/lib/auth/rbac.ts` | Server-side context (`RBACContext`), guards (`requireRole`, `requireDepartment`, `requireWorkspaceAccessWithRBAC`), page access (`requirePageAccess`), membership updates |
| **Client-safe helpers** | `src/lib/auth/rbac-client.ts` | Pure role/department helpers (`hasPermission`, `normalizeRole`, `canAccessDepartment`, `canViewArea`, catalog↔RBAC mapping) — safe for Client Components |
| **Page access rules** | `src/lib/auth/require-page-access.ts` | Edge-safe page access evaluation (`evaluatePageAccess`, `buildPageAccessContext`) — used by middleware and server |
| **Legacy foundation** | `src/lib/workspace-permissions.ts` | Legacy role normalization + individual `canX()` functions. **Imported by `rbac.ts`** for backwards compat. Has no department awareness |
| **Legacy role types** | `src/lib/permissions-matrix.ts` | `StrictWorkspaceRole` type + `permissionsMatrix` table. Shared by both systems (identical values to `RBACRole`) |
| **Canonical types** | `src/types/auth.ts` | `RBACRole`, `Department`, `ROLE_HIERARCHY`, `DEPARTMENT_FEATURES`, labels — single source of truth for type definitions |

### Migration Plan

- [x] Core RBAC + Departments implemented (server + types + guards)
- [x] Client-safe RBAC helpers in `src/lib/auth/rbac-client.ts` for Sidebar and other Client Components
- [x] Sidebar filtering + Department badge + Switcher (in Topbar + Sidebar)
- [x] Enhanced DashboardContext with cookie support for effective department view (admins)
- [x] PersonalizedDashboard component (My Tasks, Dept Stats, Role-based Quick Actions, Welcome)
- [x] **W2-R4: Dual RBAC systems documented** — legacy files marked `@deprecated` with TODOs
- [ ] **Migrate all `workspace-permissions` imports** — replace `getWorkspaceAccessContext()` with `getRBACContext()`, and individual `canX()` calls with `requireWorkspaceAccessWithRBAC()` + `hasPermission()` (~22 call sites)
- [ ] Deprecation warning or console.warn on legacy import (post-migration)
- [ ] Remove `src/lib/workspace-permissions.ts` entirely (post-migration)
- [ ] **Future**: Persist selected department preference server-side (user_preferences or dedicated table)
- [x] Filter tasks server-side by department (`taskService.listTasksForCurrentUser`, dashboard scoped tasks)
- [x] RLS blocks cross-dept writes on assets/reels/content studio (DB layer); server-side list filtering still optional
- [ ] Extend Role management UI (`settings/roles`) to allow setting `department` on members
- [ ] Add visual indication in Topbar when admin is "viewing as" a different department

## Dashboard

- Heavy DashboardContent still fetches everything for all roles. Consider splitting into:
  - Personalized lightweight view for non-admins
  - Full Command Center for admins/operators
- Add loading skeletons personalized to role
- My Tasks section should eventually use a dedicated "my tasks" query filtered by user + dept

## General

- Many server components still fetch membership/role independently instead of relying on shared layout context.
- Consider adding a server `getCurrentRBACContext()` helper that can be reused.
- i18n: ROLE_LABELS and DEPARTMENT_LABELS are ready but not yet wired into all nav labels.

## Known Limitations

- `canViewArea` heuristic is basic (path matching). Should become more declarative mapping.
- Cookie override is client-only. On full page reload admins lose "view as" unless persisted.
- RLS uses `department` on tasks + content resources; `workspace_members.department` UI assignment still pending.

## Client Reporting
- [x] Professional report-generator with templates (Executive, Insights, Plan, Performance, Recs), branding, cover + TOC
- [x] Real workspace data only — tasks, reels, creative assets, brand kit (no fabricated engagement/ad metrics)
- [x] Server-side PDF via `generateServerPDF` (Puppeteer HTML→PDF when Chromium available; pdf-lib text fallback)
- [x] Optional AES-256 password protection via qpdf when installed on server
- [x] `ClientReportButton` — server action download (base64 → blob); integrated in `/dashboard/reports` and `tasks/[id]`
- [x] `POST /api/reports/client-pdf` streaming endpoint + `downloadClientReportPdfAction`
- [x] `gatherClientReportData` loads brand kit + workspace branding for report cover
- [x] Unit tests: `tests/report-generator.test.ts` asserts no fake engagement text
- [ ] Persistent report versions + share links (signed URLs)
- [ ] Full customization UI for sections/colors
- [ ] Integrate with agent report outputs for richer data in client templates
- [ ] Production Chromium path (`PUPPETEER_EXECUTABLE_PATH` or `@sparticuz/chromium` on serverless)

## Usage Quotas + Cost Tracking
- [x] `src/lib/usage/quotas.ts` + `cost-tracking.ts` implemented (DB backed via limits + counts + metadata)
- [x] `src/lib/billing/billing-service.ts` — plan limits sync, `incrementUsageCounter` via service role, webhook upsert
- [x] `incrementUsage` enforced via admin client (bypasses owner-only UPDATE RLS for metadata counters)
- [x] Quota checks + increment in tasks creation/execution, creative image gen, publish flows
- [x] `/dashboard/usage` page with progress bars, warnings for near limits
- [x] `GET /api/billing/subscription` (owner/admin read) + `POST /api/billing/webhook` (service-role writes)
- [ ] Add dedicated usage_events table for precise monthly tracking (current uses counts + metadata)
- [ ] Integrate cost estimates into every OpenAI call (lib/ai/*) and record via cost-tracking
- [ ] Full Stripe signature verification + Checkout/Portal integration

## Reels Studio + Creative Assets Integration + RBAC (current)
- [x] **Unified Reels Studio** — `reels` table is source of truth; no redirects to Content Studio
- [x] List/detail/new pages use `ReelForm` + `ReelPublishPanel` on `/dashboard/reels/*`
- [x] RBAC operator + dept scoping (social/content/creative) on create/edit/publish
- [x] Asset linking via server action gallery modal + bidirectional `linked_reel_id`
- [x] Auto sync video/cover URLs from linked assets (`public_url` + legacy `publicUrl`)
- [x] List page thumbnails/previews; detail page side-by-side preview panel
- [x] Publish panel: status timeline, progress bar, production gate + n8n readiness
- [x] Quota check + `incrementUsage` on publish (`reels_publishes`)
- [x] `data/reels.ts` workspace-scoped CRUD + `deleteReel`
- [ ] Dedicated reels storage bucket integration in upload flows (bucket helper exists)
- [ ] Schedule-to-publish cron for `reels.status = scheduled`

## Task Lifecycle RBAC (Sprint update)

- [x] Centralized `src/lib/tasks/task-service.ts` with RBAC wrappers for create/execute/review
- [x] createTask: min 'editor' + department match validation
- [x] Execute: min 'operator' + production gate via n8n readiness
- [x] New centralized Production Gate (lib/production/gate.ts) with lightweight + full checks + assert
- [x] Gate enforced on `/api/tasks/execute`, image gen, reel publish, paid ads
- [x] Settings page now shows Gate status (Green/Yellow/Red + issues)
- [x] Review (approve/changes): min 'operator'
- [x] Task list/details UI: server-side dept filter + role gated buttons
- [ ] Full coverage across all entry points (alex, campaigns auto-create etc.)
- [ ] Persist agent_dept on task row at creation for reliable filtering

## Launch & Operations Documentation

- [x] **`docs/FINAL_LAUNCH_CHECKLIST.md`** — single source of truth for Morad: Vercel, Supabase, env, cron, pre/post launch, rollback
- [x] **`docs/PRODUCTION_DEPLOY_CHECKLIST.md`** — updated operator quick sheet per deploy
- [x] `docs/PRODUCTION_LAUNCH_CHECKLIST.md` — schema-focused verification
- [x] `docs/FINAL_LAUNCH_PLAN.md` — architecture analysis + 30-day roadmap
- [x] `docs/TEAM_ONBOARDING.md` — post-launch team setup
- [ ] CI pipeline to set `PRODUCTION_AUDIT_*` env vars automatically on release
- [ ] Vercel `PUPPETEER_EXECUTABLE_PATH` or `@sparticuz/chromium` for branded HTML PDFs in serverless

See also: `RBAC_SUMMARY.md`, `docs/RBAC_IMPLEMENTATION.md`, `FULL_PLATFORM_AUDIT_REPORT.md`

**Launch readiness (2026-07-12):**
- Controlled production deploy: **conditionally ready** (internal team + early clients)
- **Must complete W2-T1 (Secret Hygiene) before confident production claims**
- Wave 2 (CSP, API envelopes, health hardening, n8n callback, billing decision, RBAC documentation): **complete**
- Next: Wave 3 — performance (indexes, aggregates, code-splitting)
