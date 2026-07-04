# AgentFlow AI — Tech Debt & Improvements

> Last updated: 2026-07-04 (Reels Studio unified — H1)

## Database / Migrations

- [x] **Consolidated schema** — 38 incremental migrations replaced by `supabase/migrations/20260703000000_full_clean_schema.sql`
- [x] Single file: 31 tables, enums (`department`, `rbac_role`), RLS, triggers, storage, seed (4 depts / 27 agents)
- [ ] Add CI step to validate migration SQL syntax (e.g. `supabase db lint` or dry-run against ephemeral Postgres)
- [x] DB-level RLS on `tasks` using `has_min_role()` + `user_can_access_task_department()` + `catalog_dept_rbac_values()`
- [x] Department RLS on `creative_assets`, `content_studio_items`, `reels`, `content_studio_publish_attempts` via `user_can_access_rbac_department()` + resource dept mappers
- [x] Billing tables locked: `subscriptions` + `billing_customers` — SELECT owner/admin only; no client INSERT/UPDATE (service role + webhook)
- [x] `usage_limits` seeded in `handle_new_workspace_owner` trigger; owner UPDATE policy; server increments via service role
- [ ] Dedicated `usage_events` table for metered billing (see Usage Quotas section below)

## P0 Blockers (2026-07-04 fix)

- [x] **Build fix** — split client-safe RBAC into `src/lib/auth/rbac-client.ts`; `Sidebar.tsx` imports from there (no `server-only` in client)
- [x] **Run Task fix** — `src/components/tasks/RunTaskButton.tsx` sends `workspaceId` + `taskPayload` (built via `buildTaskExecutionPayload`)
- [x] **Execute route** — `/api/tasks/execute` uses `assertProductionGate`, `taskService.canExecuteTask`, `getN8nReadiness`, session workspace binding
- [x] **TaskService** — uses `createSupabaseServerClient()` instead of browser Supabase client fallback
- [x] Department mapping (RBAC enum ↔ agent catalog) via `DEPARTMENT_MAP` in `rbac-client.ts`
- [x] Task department scoping in `task-service` (`canCreateTask`, `canExecuteTask`, list filter)
- [x] `agent_department` column on `tasks` + department-aware RLS (`has_min_role` + `user_can_access_task_department`)
- [x] `TasksClient` + dashboard use server-side department-filtered task lists

## RBAC + Personalization

- [x] Core RBAC + Departments implemented (server + types + guards)
- [x] Client-safe RBAC helpers in `src/lib/auth/rbac-client.ts` for Sidebar and other Client Components
- [x] Sidebar filtering + Department badge + Switcher (in Topbar + Sidebar)
- [x] Enhanced DashboardContext with cookie support for effective department view (admins)
- [x] PersonalizedDashboard component (My Tasks, Dept Stats, Role-based Quick Actions, Welcome)
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

See also: `RBAC_SUMMARY.md`, `docs/RBAC_IMPLEMENTATION.md`, `docs/FINAL_LAUNCH_PLAN.md` (full analysis + launch plan)

**Post Final Review (2026-07-02):**
- Readiness scored at 90/100.
- Major remaining: persistent rate limits, server PDF + billing metering, deeper Reels/asset previews.
- Launch plan created with phased checklist, monitoring, risks, and 30-day recs.
- Recommend following `docs/FINAL_LAUNCH_PLAN.md` exactly before production exposure.
