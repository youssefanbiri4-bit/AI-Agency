# AgentFlow-AI — Project Health Report

**Task:** 001 — Full Engineering Audit & Project Cleanup  
**Role:** CTO / Principal Software Architect  
**Audit date:** 2026-07-10  
**Branch:** `fix/ci-deps-cleanup`  
**Scope:** Read-only full-system audit — **no code changes applied**  
**Rule:** Fixes require explicit owner approval before implementation  

---

## Executive scores

| Metric | Score | Notes |
|--------|------:|-------|
| **Project Completion** | **72%** | Agency OS core strong; BI diagnostic layer + commercial SaaS incomplete |
| **Production Readiness** | **66 / 100** | Builds & tests pass; secret hygiene + lint gate + billing holes block “safe public prod” |
| **SaaS Readiness** | **52 / 100** | Multi-tenant + RBAC + quotas present; orgs/billing/analytics incomplete |
| **Security** | **61 / 100** | Strong control plane; critical local secret leakage risk; CSP report endpoint missing |
| **Performance** | **68 / 100** | Some caching/dynamic imports; heavy pages + unbounded ops queries |
| **Maintainability** | **54 / 100** | God-files, doc sprawl, dual RBAC legacy paths, package name still temp |
| **Scalability** | **67 / 100** | Workspace tenancy + indexes good; horizontal worker story partial |
| **Code Quality** | **62 / 100** | Typecheck clean, tests green; ESLint 17 errors with **exit code 0** |

### Aggregate readiness verdict

| Verdict | Detail |
|---------|--------|
| **Internal / team-controlled use** | Conditionally ready if secrets rotated, env gates green, n8n verified |
| **Public multi-tenant SaaS launch** | **Not ready** — commercial, secret, quality-gate, and product-surface gaps remain |
| **Recommended next mode** | Cleanup & harden only (Task 001 fix waves) — **no new features** |

### Issue counts (this audit)

| Severity | Count |
|----------|------:|
| **Critical** | **6** |
| **High** | **14** |
| **Medium** | **22** |
| **Low** | **16** |
| **Total** | **58** |

---

## Verification evidence (executed 2026-07-10)

| Check | Result |
|-------|--------|
| `npm run typecheck` | **PASS** (exit 0) |
| `npm test` | **PASS** — 30 files, **208/208** tests |
| `npm run build` | **PASS** (exit 0, ~6 min) |
| `npm run lint` | **FAIL quality** — **17 errors, 54 warnings**, but **process exit 0** (CI false-green risk) |
| `npm audit` | **PASS** — 0 known vulnerabilities |
| Source scale | ~**453** TS/TSX files, ~**115k** LOC under `src/` |
| Dashboard routes | **55+** app routes under `/dashboard/*` |
| API `route.ts` files | **25** implemented handlers |
| Billing API routes | **0** (`checkout/portal/subscription/webhook` empty dirs) |
| Root markdown clutter | **34** `*.md` at repo root + **31** under `docs/` |

---

# Phase findings

## Phase 1 — Project Structure Audit

### Strengths

- Clear App Router layout: `src/app`, `src/lib`, `src/actions`, `src/components`, `src/types`
- Supabase schema consolidated into a primary migration + small follow-ons
- Domain modules exist (`auth`, `tasks`, `ads`, `queue`, `usage`, `security`)
- Proxy/middleware auth edge path exists (`src/proxy.ts` → dashboard edge auth)

### Issues

| Sev | ID | Finding |
|-----|-----|---------|
| High | S1 | **Documentation sprawl** — 30+ historical audit reports at repo root (`AgentFlow_*.md`, Arabic reviews, overlapping checklists). No single source of truth for operators. |
| High | S2 | **God-files** — multiple files >1.5k LOC (see Phase 3). Hard to review, test, or refactor safely. |
| Medium | S3 | **Backup / temp artifacts tracked or present** — `src/app/(dashboard)/layout.tsx.backup`; `run_jobs.json`, `run_logs.zip` present in tree. |
| Medium | S4 | **Route aliases / duplication** — `/dashboard/reels` vs `/dashboard/reels-studio` (re-export); `/dashboard/reviews` → redirect to `/dashboard/review`. Increases nav noise. |
| Medium | S5 | **Empty product shells** — `src/app/api/billing/*` empty directories; `src/lib/billing/` empty; `src/components/billing/` empty. Signals incomplete SaaS surface. |
| Medium | S6 | **Package identity** — `package.json` name is still `ai-agency-temp` (not `agentflow-ai`). |
| Medium | S7 | **Dual permissions stacks** — `workspace-permissions.ts` + `rbac.ts` / `rbac-client.ts` (partially migrated per TECH_DEBT). |
| Low | S8 | **Naming inconsistency** — mix of kebab dirs and feature folders; some agent ids use `_` vs `-`. |
| Low | S9 | **Orphaned / low-value paths** — `odysseus/` present; multiple overlapping TODO observability files. |
| Low | S10 | **i18n locale drift** — `en/ar/fr` = 1960 keys; **`es` missing 234 keys**. |

---

## Phase 2 — Build Audit

| Check | Status | Notes |
|-------|--------|-------|
| TypeScript | Clean | `tsc --noEmit` pass |
| Production build | Clean | Next.js 16 build succeeds; Proxy middleware registered |
| Unit/smoke tests | Clean | 208 tests green |
| ESLint | Unclean | 17 errors (react-hooks/refs, set-state-in-effect, etc.) |
| ESLint exit code | **Broken gate** | `npx eslint …` returns **exit 0** even with severity “error” → CI can merge red code |
| Circular deps | Not exhaustively scanned | No build-time circular failure observed |
| Missing files | Partial | CSP reports to `/api/csp-violation` but **route missing** |
| Import errors | None at build time | — |

### Build-related issues

| Sev | ID | Finding |
|-----|-----|---------|
| Critical | B1 | **Lint quality gate is ineffective** — errors reported but exit code 0. CI step `npm run lint` can pass incorrectly. |
| High | B2 | **17 ESLint errors** block “clean main” claim (Sidebar, realtime notifications, setState-in-effect patterns, etc.). |
| Medium | B3 | **54 ESLint warnings** (unused imports/vars) add noise; hide real regressions. |
| Medium | B4 | **CI branch filter** — workflow only on `main`/`develop`; feature branches like `fix/ci-deps-cleanup` may not get GitHub Actions unless PR targets those branches. |
| Low | B5 | `npm audit` in CI has `continue-on-error: true` — weakens dependency security gate. |

---

## Phase 3 — Code Quality Audit

### Extreme file sizes (maintainability risk)

| Lines | File |
|------:|------|
| 2737 | `src/app/(dashboard)/dashboard/content-studio/ContentStudioClient.tsx` |
| 2577 | `src/app/(dashboard)/dashboard/content-studio/actions.ts` |
| 2449 | `src/app/(dashboard)/dashboard/settings/actions.ts` |
| 1944 | `src/types/database.ts` |
| 1836 | `src/lib/agent-library/templates.ts` |
| 1548 | `src/app/(dashboard)/dashboard/reports/page.tsx` |
| 1316 | `AdvancedAnalyticsClient.tsx` |
| 1267 | `src/lib/data/ad-connections.ts` |
| 1173+ | reels/creative-assets actions |
| 1046 | `dashboard/page.tsx` |

### Issues

| Sev | ID | Finding |
|-----|-----|---------|
| High | Q1 | **God components/actions** — Content Studio + Settings actions violate SRP; high regression risk. |
| High | Q2 | **Inconsistent API error contracts** — some routes use `createApiSuccess`/`createApiError`; others ad-hoc `NextResponse.json({ ok, success, error })`. |
| Medium | Q3 | **Hardcoded product emails** — signup allowlist & special auth limits default to a personal Gmail (`validate-signup.ts`, `auth-brute-force.ts`). Fine for private beta; not multi-tenant SaaS. |
| Medium | Q4 | **Database types not generated** — TECH_DEBT notes empty `Enums` and manual types; drift risk vs SQL. |
| Medium | Q5 | **Duplicate callback paths** — `/api/n8n/callback` and `/api/tasks/callback` both handle n8n-style payloads (maintenance surface ×2). |
| Medium | Q6 | **Business logic in route handlers** — operational summary loads all task rows into memory for counting (see Phase 8). |
| Medium | Q7 | **Deprecated auth helper still used** — `@supabase/auth-helpers-nextjs` alongside `@supabase/ssr`. |
| Low | Q8 | Low `any` density (~8 hits) — good. |
| Low | Q9 | Limited `console.*` in src (~20) — logging mostly structured. |
| Low | Q10 | Static agent catalogs in both `src/data/agents.ts` and DB seed — dual sources of truth. |

---

## Phase 4 — Security Audit

### Strengths

- Server/client Supabase key separation + `BrowserSecretGuard`
- MFA/TOTP, session idle timeout, secure cookies, refresh rate limits
- Auth brute-force protection
- n8n callback secret header
- SSRF host allowlisting for webhooks (`N8N_WEBHOOK_HOST_ALLOWLIST`)
- Payload size limits on sensitive routes
- Rate limiting (middleware + route)
- RLS enabled broadly on public tables
- Ad token encryption
- Security audit log helper
- CSP + security headers in `next.config.ts` and edge auth
- `npm audit` clean at audit time

### Issues

| Sev | ID | Finding |
|-----|-----|---------|
| **Critical** | SEC1 | **Real secrets present in `.env.example` on disk** — includes live-looking `SUPABASE_SERVICE_ROLE_KEY`, full `OPENAI_API_KEY` (`sk-proj-…`), and `AD_TOKEN_ENCRYPTION_KEY`. File is **currently untracked** (`??`) but **gitignored with exception `!.env.example`**, so a single `git add .` can leak production credentials to the remote. **Immediate action required:** rotate keys, replace with placeholders, never commit real secrets. |
| **Critical** | SEC2 | **Service role JWT material in local templates** — if these keys are production keys, assume compromise until rotated. |
| High | SEC3 | **Missing `/api/csp-violation` endpoint** — CSP `report-uri` / `report-to` point to a non-existent route (noise + missed violation telemetry). |
| High | SEC4 | **CSP still allows `'unsafe-inline'` + `'unsafe-eval'` for scripts** — pragmatic for Next, but weaker XSS containment. |
| High | SEC5 | **Health endpoint may surface internal error messages** from Supabase/n8n readiness to callers (info disclosure risk if public). |
| High | SEC6 | **Signup allowlist is single hardcoded email** — not a vulnerability alone, but policy is not env-driven for multi-operator SaaS; risk of accidental lockout or incomplete policy. |
| Medium | SEC7 | **Operational APIs auth** — use workspace access context; ensure all remain behind auth middleware (spot-check OK for summary). |
| Medium | SEC8 | **Report share tokens** — public share path exists; ensure token entropy + expiry reviewed in fix wave. |
| Medium | SEC9 | **No formal CSRF tokens** — mitigated partly by SameSite cookies + Next server actions patterns; document threat model. |
| Medium | SEC10 | **SQL injection** — using Supabase query builder (parameterized) — low risk; raw SQL in app code not observed in sampling. |
| Medium | SEC11 | **XSS** — no `dangerouslySetInnerHTML` found in `src/`; residual risk from rendering untrusted Markdown/AI HTML if introduced later. |
| Low | SEC12 | Dependency audit clean today — keep gate strict (remove `continue-on-error`). |
| Low | SEC13 | MFA not enforced as mandatory for all owners/admins (policy gap). |

### Security domain coverage matrix

| Domain | Assessment |
|--------|------------|
| Authentication | Strong (MFA, sessions, brute-force) |
| Authorization | Strong foundation (RBAC + RLS); residual dual-stack debt |
| SSRF | Hardened for n8n |
| Injection (SQL/cmd) | Low risk in sampled paths |
| XSS | Low static risk; CSP partially weak |
| Secrets management | **Critical local template issue** |
| Rate limiting | Present |
| Dependency vulns | Clean (snapshot) |
| File upload | Storage buckets private by design; continue review on creative-assets policies |

---

## Phase 5 — Database Audit

### Strengths

- Consolidated clean schema migration
- Workspace-centric multi-tenancy
- RBAC enums + membership table
- Extensive indexes on hot tables (tasks, notifications, content, etc.)
- RLS enabled on core tables
- Triggers for `updated_at`, workspace owner bootstrap, usage_limits seed
- Follow-on migrations for saved reports, preferences, usage events, realtime

### Issues

| Sev | ID | Finding |
|-----|-----|---------|
| High | D1 | **Missing composite index** `tasks(workspace_id, status)` — common filter pattern; only separate `workspace_id` and `status` indexes today. |
| High | D2 | **Operational summary loads all tasks** for a workspace into app memory to count statuses (scalability cliff). Prefer SQL aggregates. |
| Medium | D3 | **department enum ≠ departments catalog table** (known TECH_DEBT) — conceptual dual model. |
| Medium | D4 | **Billing tables exist without application lifecycle** — orphan schema surface (`billing_customers`, `subscriptions`). |
| Medium | D5 | **No BI diagnostic tables** (`business_profiles`, `bottlenecks`, …) — product vision gap, not runtime bug. |
| Medium | D6 | **Type generation gap** — `database.ts` hand-maintained; enums incomplete. |
| Medium | D7 | Some tables noted historically with thinner indexes (`backup_records`, `github_issue_task_links`). |
| Low | D8 | Dual migration filenames same date prefix (`20260705000000_*` twice) — works but confusing. |
| Low | D9 | Append-only audit tables lack retention/partition strategy for long-term scale. |

---

## Phase 6 — Backend Audit

### Strengths

- Task execute path: Zod validation, RBAC (`operator`), production gate, workspace cookie bind, rate limit, payload limit
- n8n callback secret + structured validation helpers
- Queue: BullMQ, DLQ, stale recovery (tested)
- Usage quotas integrated on create/publish paths
- Logger + request IDs on many routes
- Cron protected by `CRON_SECRET` pattern

### Issues

| Sev | ID | Finding |
|-----|-----|---------|
| **Critical** | BE1 | **Billing API completely unimplemented** — empty directories under `/api/billing/*`. Not production SaaS. |
| High | BE2 | **Inconsistent authorization helpers** — mix of `requireWorkspaceAccessWithRBAC` vs `getWorkspaceAccessContext` vs page `requirePageAccess`. |
| High | BE3 | **Inconsistent validation** — critical routes use Zod; not universal across all server actions (large action files). |
| Medium | BE4 | **Duplicate n8n callback endpoints** — dual maintenance. |
| Medium | BE5 | **Error handling variance** — risk of leaking internals on health/ops routes. |
| Medium | BE6 | **Service layer incomplete** — some domains still query from routes/actions directly (harder to unit-test). |
| Medium | BE7 | **Alex chat** — good rate limits + tool blocking heuristics; still depends on OpenAI availability and prompt safety discipline. |
| Low | BE8 | Swagger/internal docs exist as code; not a full public OpenAPI product surface. |

---

## Phase 7 — Frontend Audit

### Strengths

- Shared UI primitives (`Button`, `Card`, `PageHeader`, `StatusBadge`, …)
- Role-based dashboard split (Personalized vs Command Center)
- Mobile bottom nav + responsive work documented (July 2026)
- i18n infrastructure for en/ar/fr/es; ar/fr key parity with en
- Loading skeletons on key dashboard routes
- Accessibility docs present

### Issues

| Sev | ID | Finding |
|-----|-----|---------|
| High | FE1 | **Product surface overload** — 30+ sidebar destinations without strong information architecture; onboarding cognitive load. |
| High | FE2 | **Mega client components** — ContentStudioClient, WorkflowBuilder, CampaignsClient hard to test and slow to load. |
| Medium | FE3 | **Spanish locale incomplete** (−234 keys). |
| Medium | FE4 | **ESLint react-hooks errors** in Sidebar + realtime notifications — potential cascading renders / ref misuse. |
| Medium | FE5 | **Alias routes** add redundant nav entries if both linked. |
| Medium | FE6 | Accessibility: tooling removed (`a11y:audit` echoes removal); manual checklist only. |
| Medium | FE7 | RTL: audited previously; ongoing risk when new pages skip dir-aware styles. |
| Low | FE8 | Topbar search incomplete (TECH_DEBT). |
| Low | FE9 | Initial notifications empty array in layout (stale UX). |

---

## Phase 8 — Performance Audit

### Strengths

- `next/dynamic` used for some heavy dashboard pieces
- Image optimization (AVIF/WebP), static asset cache headers
- React.cache + NodeCache helpers
- Content-visibility CSS utilities
- Bounded scheduler/query windows in some ops code

### Issues

| Sev | ID | Finding |
|-----|-----|---------|
| High | P1 | **Ops summary fetches all task rows** then counts in JS — O(n) memory/latency per request. |
| High | P2 | **Very large client bundles risk** from 2k+ LOC client components without full code-splitting discipline. |
| Medium | P3 | **Pagination inconsistent** — some list helpers support limit/range; not universal on all list UIs. |
| Medium | P4 | **Command Center parallel sections** still heavy for admins (TECH_DEBT). |
| Medium | P5 | **Missing composite DB indexes** for frequent workspace+status filters. |
| Medium | P6 | **Puppeteer PDF** — heavyweight on serverless; needs careful concurrency limits. |
| Low | P7 | Only ~4 dynamic import call sites counted — more candidates exist. |
| Low | P8 | No Lighthouse/CI performance budget configured. |

---

## Phase 9 — SaaS Readiness Audit

| Capability | Score (0–10) | Status |
|------------|-------------:|--------|
| Multi-tenant (workspace) | 8 | Solid workspace isolation + RLS |
| Organizations (above workspace) | 2 | Not implemented |
| Teams / invites UX | 5 | Membership + roles; invite/email polish incomplete |
| Roles & permissions | 7.5 | RBAC hierarchy + departments |
| Subscription plans | 6 | Plan enum + `usage_limits` + quotas |
| Billing (Stripe live path) | 2 | Schema only; API empty |
| Notifications | 7 | In-app + realtime foundation; email missing |
| Audit logs | 7 | `security_audit_logs` + `task_events` |
| Analytics (product) | 4 | Ops metrics partial; business funnel missing |
| Monitoring | 6 | Sentry wired; health route; ops dashboard |
| Horizontal scaling | 6 | Stateless Next + Redis queues; workers need prod ops story |
| BI diagnostic product | 2 | Vision documented; schema/product missing |

**SaaS Readiness Score: 52 / 100**

---

# Prioritized issue register

## Critical (block honest “production ready” claims)

1. **SEC1/SEC2** — Real secrets in `.env.example`; rotate OpenAI, Supabase service role, encryption key; replace template with placeholders only.  
2. **B1** — Fix ESLint so **errors fail the process** (CI gate).  
3. **BE1** — Decide billing: implement Stripe test path **or** remove empty billing shells + document “internal platform / no self-serve billing”.  
4. **Secret rotation follow-through** — if keys ever left the machine, revoke in provider dashboards.  
5. **Production env parity** — ensure production never used the leaked template values.  
6. **Public launch gate** — do not enable open signup until allowlist/env policy is deliberate and billing/quotas enforced end-to-end.

## High

1. Resolve **17 ESLint errors** (hooks/refs).  
2. Add SQL aggregate for task status counts; add `tasks(workspace_id, status)` index.  
3. Implement or stub-document CSP violation endpoint.  
4. Split Content Studio / Settings god-files into modules (no behavior change).  
5. Unify API response + auth helper conventions.  
6. Collapse dual n8n callback routes or formally deprecate one.  
7. Complete Spanish i18n keys **or** hide `es` until complete.  
8. Sanitize health endpoint responses for public exposure.  
9. Make CI run on PR branches + fail on audit high vulns.  
10. Reduce dashboard IA complexity (group nav; archive low-value routes).  
11. Generate Supabase types from schema.  
12. Enforce MFA for owner/admin (policy).  
13. Remove/git-ignore backup artifacts (`layout.tsx.backup`, zip logs).  
14. Rename package to `agentflow-ai`.

## Medium

- Dual RBAC stack cleanup  
- Pagination standardization  
- Report share token review  
- Deprecated auth-helpers migration  
- Index gaps on secondary tables  
- Accessibility automated smoke restore  
- Command Center fetch budget  
- PDF concurrency limits  
- Doc consolidation (archive historical audits under `docs/archive/`)  
- Observability correlation TODOs  
- Retention policy for audit/event tables  
- Env-driven signup allowlist  
- Align agent catalog single source of truth  
- Fix ES locale, nav aliases  
- Production gate coverage consistency  
- Worker deployment documentation  
- Staging environment parity  
- OpenAPI for critical routes  
- Reduce unused lint warnings  
- Sidebar grouping  
- Topbar search completeness  
- Notifications initial load in layout  

## Low

- Naming convention pass  
- Remove `odysseus/` if unused  
- Prefetch / content-visibility expansion  
- Lighthouse CI budget  
- Partition strategy for logs  
- MFA SMS optional  
- SCIM/SSO later  
- Client portal later  
- BI tables (feature phase — after cleanup)  

---

# Scores — detailed rationale

### Production Readiness — 66/100

**+** Build/typecheck/tests green, deploy scripts, production gate UI, MFA, RLS, quotas  
**−** Secret template risk, lint false-green, empty billing, health info disclosure, CSP endpoint gap, product sprawl  

### Security — 61/100

**+** Mature control plane for an app this size  
**−** SEC1 dominates score until rotation + template sanitization proven  

### Maintainability — 54/100

Driven by file size, dual systems, doc noise, incomplete shells.

### Performance — 68/100

Acceptable for early multi-tenant; ops counting and mega clients will hurt at scale.

### Scalability — 67/100

Tenancy model is right; need aggregates, indexes, worker ops, retention.

### Code Quality — 62/100

Strong typing + tests; lint/process discipline and modularity lag.

### SaaS Readiness — 52/100

Excellent for “AI agency workspace product”; incomplete for “self-serve SaaS business.”

### Project Completion — 72%

Rough model:

| Area | Weight | Done |
|------|-------:|-----:|
| Auth / tenancy / RBAC | 15% | 90% |
| Task orchestration / n8n / review | 20% | 85% |
| Content / ads / creative | 15% | 75% |
| Security hardening | 10% | 80% |
| Quotas / usage | 5% | 85% |
| Billing / commercial | 10% | 15% |
| BI diagnostic vision | 10% | 10% |
| Quality gates / cleanup | 10% | 55% |
| Ops / monitoring | 5% | 65% |

---

# Cleanup roadmap (priority-ordered — no feature work)

> Implement only after approval, wave by wave.

## Wave 0 — Emergency hygiene (same day)

1. **Rotate** OpenAI, Supabase service role, ad encryption key if they match `.env.example`.  
2. **Rewrite `.env.example`** to placeholders only (`your-service-role-key`, `sk-...`).  
3. Confirm `.env.local` gitignored; never `git add .env*`.  
4. Scan git history if `.env.example` was ever pushed on any remote.

## Wave 1 — Quality gates (1–3 days)

1. Fix ESLint exit code / config so errors fail CI.  
2. Clear all 17 ESLint errors.  
3. Make `npm audit` blocking for high/critical.  
4. Ensure CI runs on PRs for current working branches.  
5. Add minimal smoke that fails if `/api/billing/*` dirs exist without `route.ts` **or** implement documented “disabled billing” guard.

## Wave 2 — Security & API consistency (3–7 days)

1. CSP violation route (or remove report directives until ready).  
2. Harden `/api/health` public payload.  
3. Standardize API error envelope + request IDs.  
4. Auth helper consolidation plan (no behavior change).  
5. Document CSRF/session threat model.  
6. MFA required for owner/admin flag.

## Wave 3 — Performance & data (1–2 weeks)

1. SQL aggregates for dashboard/ops task counts.  
2. Migration: `tasks(workspace_id, status)` (+ other hot composites).  
3. Pagination defaults on all list endpoints.  
4. Code-split top 5 largest client components **without UX redesign**.  
5. PDF generation concurrency limits + timeouts.

## Wave 4 — Maintainability cleanup (1–2 weeks)

1. Archive root audit markdown → `docs/archive/2026-06/`.  
2. Delete `layout.tsx.backup`, `run_logs.zip` if unused.  
3. Split Content Studio + Settings actions into domain modules.  
4. Deprecate one of the dual callback routes.  
5. Generate `database.ts` from Supabase CLI.  
6. Rename package `agentflow-ai`.  
7. Complete or disable Spanish locale.

## Wave 5 — SaaS foundation decision (product call)

**Option A — Internal platform**  
- Remove billing shells or mark “disabled”.  
- Keep allowlist signup.  
- Target score: Production Readiness ≥ 80 for private teams.

**Option B — Public SaaS**  
- Implement Stripe test mode end-to-end.  
- Env-driven allowlist/open signup policy.  
- Orgs/teams invites.  
- Then BI features (separate program).

> Per constitution: **no architecture rewrite and no BI feature build in cleanup waves** without a separate approved design.

---

# What is already good (do not casually rewrite)

- Workspace multi-tenancy + RLS baseline  
- Task lifecycle + human review + n8n contract  
- MFA / session / brute-force defenses  
- SSRF protections for webhooks  
- Quota system wiring  
- 208 automated tests + successful production build  
- Production deploy/smoke scripts  

These are assets. Cleanup should **stabilize**, not replace them.

---

# Recommended decision requests for the owner

Please approve **one** path before any fix PR:

### Decision 1 — Secret response
- [ ] Confirm keys in `.env.example` are production/live → **rotate now**  
- [ ] Confirm they are disposable dev keys → still sanitize template  

### Decision 2 — Product mode
- [ ] **Internal / portfolio platform** (billing out of scope)  
- [ ] **Public SaaS** (billing Wave 5 required)

### Decision 3 — First fix wave authorization
- [ ] Approve **Wave 0 + Wave 1 only** (recommended)  
- [ ] Approve Waves 0–2  
- [ ] Hold all fixes  

---

# Appendix A — Commands re-run for future audits

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm audit
```

# Appendix B — Related documents

- `docs/AGENTFLOW_AI_PROJECT_DOSSIER.md` — product/system dossier  
- `TECH_DEBT.md` — ongoing debt tracker  
- `docs/FINAL_LAUNCH_CHECKLIST.md` — ops launch steps  
- `docs/N8N_V5_CONTRACT.md` — automation contract  
- Historical audits at repo root (candidates for archive)

---

# Appendix C — Audit method notes

- Static review of schema, API routes, auth edge, security modules  
- Dynamic verification: typecheck, lint, tests, build, npm audit  
- Sampling of largest modules and high-risk routes  
- Cross-check against `TECH_DEBT.md` and July 2026 platform audit  
- **No runtime penetration test** against production  
- **No intentional exploit development**  

---

**Status:** Audit complete. Awaiting owner approval before any remediation PR.

*Prepared for AgentFlow-AI Task 001 — Engineering Audit & Project Cleanup.*
