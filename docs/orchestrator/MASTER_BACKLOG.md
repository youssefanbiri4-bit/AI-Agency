# MASTER BACKLOG — AgentFlow-AI

**Last Updated:** 2026-07-13T23:30:00Z  
**Owner:** Engineering Orchestrator  
**Status:** Wave 8 Complete — Accessibility + Nav IA + Design Tokens + A11y Foundation

---

## Status Legend
- `todo` | `in_progress` | `done` | `blocked` | `cancelled`

---

## Wave 2 (COMPLETE — All Tasks Done)

| ID | Title | Priority | Status | Report |
|----|-------|----------|--------|--------|
| W2-T1 | Complete Secret Hygiene | Critical | **done** | W2-R1-secret-hygiene.md |
| W2-T2 | Fix CSP violation endpoint | High | **done** | W2-T2-csp.md |
| W2-T3 | Harden /api/health | High | **done** | W2-R2-health.md |
| W2-T4 | Standardize API Error Envelope | High | **done** | W2-T4-api-envelope.md |
| W2-T5 | Decide & Document Billing | High | **done** | W2-R3-billing.md |
| W2-T6 | Deprecate dual n8n callback | Medium | **done** | W2-T6-n8n-callback.md |
| W2-T7 | RBAC Documentation | Medium | **done** | W2-R4-rbac.md |
| R6 | QA Verification | High | **done** | W2-R6-qa.md |

---

## Wave 3 (COMPLETE — All Tasks Done)

| ID | Title | Priority | Status | Report |
|----|-------|----------|--------|--------|
| W3-T1 | Fix rate-limit exports | High | **done** | W3-T1-rate-limit.md |
| GATES-GREEN-1 | DashboardContext RBAC | High | **done** | GATES-GREEN-1.md |
| GATES-GREEN-2 | Remaining typecheck fixes | High | **done** | GATES-GREEN-2.md |
| STABILIZE-LINT | ESLint zero-error | High | **done** | STABILIZE-LINT.md |
| STABILIZE-INDEX-TESTS | Auth brute-force fixes | High | **done** | STABILIZE-INDEX-TESTS.md |
| RBAC-MIGRATE-1 | RBAC migration (phase 1) | High | **done** | RBAC-MIGRATE-1.md |
| RBAC-MIGRATE-2 | RBAC migration (phase 2) | High | **done** | RBAC-MIGRATE-2.md |
| GOD-SPLIT-CONTENT-ACTIONS | Split content-studio actions | High | **done** | GOD-SPLIT-CONTENT-ACTIONS.md |
| GOD-SPLIT-CONTENT-CLIENT-HOOKS | Extract content-studio hooks | High | **done** | GOD-SPLIT-CONTENT-CLIENT-HOOKS.md |
| GOD-SPLIT-CONTENT-CLIENT-UI | Extract content-studio components | High | **done** | GOD-SPLIT-CONTENT-CLIENT-UI.md |
| GOD-SPLIT-CONTENT-FIX-TYPES | Fix content split type errors | High | **done** | GOD-SPLIT-CONTENT-FIX-TYPES.md |
| GOD-SPLIT-REPORTS-OR-DASHBOARD | Split dashboard/page.tsx | High | **done** | GOD-SPLIT-REPORTS-OR-DASHBOARD.md |
| GOD-SPLIT-REPORTS-PAGE | Split reports/page.tsx | Medium | **done** | GOD-SPLIT-REPORTS-PAGE.md |
| GOD-SPLIT-SETTINGS-ACTIONS | Split settings/actions.ts | High | **done** | GOD-SPLIT-SETTINGS-ACTIONS.md |
| PERF-AGGREGATES-1 | Usage counters table | High | **done** | PERF-AGGREGATES-1.md |
| PERF-AGGREGATES-TYPES-FIX | Fix usage counters types | High | **done** | PERF-AGGREGATES-TYPES-FIX.md |

---

## Wave 4 (COMPLETE — All Tasks Done)

| ID | Title | Priority | Status | Agent | Effort | Report |
|----|-------|----------|--------|-------|--------|--------|
| W4-T1 | Fix execute-route test timeout | High | **done** | Agent 1 | Small | W4-T1-T2-test-stabilization.md |
| W4-T2 | Fix brute-force auth test mocks | High | **done** | Agent 1 | Small | W4-T1-T2-test-stabilization.md |
| W4-T3 | Fix user-preferences test | Medium | **done** | Agent 2 | Small | W4-T3-T4-preferences-and-reports.md |
| W4-T4 | Split reports/page.tsx (1,080→619) | High | **done** | Agent 2 | Medium | W4-T3-T4-preferences-and-reports.md |
| W4-T5 | Split AdvancedAnalyticsClient (1,316→491) | High | **done** | Agent 1 | Medium | W4-T5-advanced-analytics-split.md |

---

## Wave 5 (COMPLETE — Internal Platform Closed)

| ID | Title | Priority | Status | Agent | Effort | Report |
|----|-------|----------|--------|-------|--------|--------|
| W5-T1 | Remove Stripe billing (6 files, npm package) | High | **done** | Agent 1 | Medium | REMOVE-STRIPE-BACKEND |
| W5-T2 | Replace billing UI with Usage & Limits | High | **done** | Agent 2 | Medium | W5-INTERNAL-KICKOFF |
| W5-T3 | Add Usage & Limits sidebar navigation | High | **done** | Agent 2 | Small | W5-INTERNAL-KICKOFF |
| W5-T4 | Implement quota alert system (80%/95%) | High | **done** | Agent 1 | Medium | W5-USAGE-ALERTS |
| W5-T5 | Admin limit adjustment backend | High | **done** | Agent 1 | Medium | W5-ADMIN-LIMITS-BACKEND |
| W5-T6 | Add quota_warning/quota_critical to NotificationType | Medium | **done** | Agent 1 | Small | W5-USAGE-ALERTS |
| W5-T7 | Settings page "Usage & Limits" section | Medium | **done** | Agent 2 | Small | W5-INTERNAL-KICKOFF |
| W5-T8 | i18n for Usage & Limits (EN/FR/ES/AR) | Medium | **done** | Agent 2 | Small | W5-INTERNAL-KICKOFF |

---

## Wave 6 (COMPLETE — Performance & Developer Experience)

| ID | Title | Priority | Status | Agent | Effort | Report |
|----|-------|----------|--------|-------|--------|--------|
| W6-KICKOFF | Code-split AdvancedAnalyticsClient (reports page) | High | **done** | Agent 2 | Small | W6-KICKOFF.md |
| W6-T1 | Code-split CreativeAssetForm (1,115 lines) | High | **done** | Agent 1 | Small | W6-T1-CODE-SPLIT.md |
| W6-T2 | PDF concurrency limit (cap = 2) | Low | **done** | Agent 1 | Small | W6-T2-PDF-CONCURRENCY.md |
| W6-T3 | ESLint warning cleanup (165 → 0) | Medium | **done** | Agent 1 | Small | W6-T3-ESLINT.md |
| W6-T5 | Client-side pagination (4 list pages) | Medium | **done** | Agent 2 | Medium | W6-T5-PAGINATION-UX.md |
| W6-T6 | Code-split MonthlyAgencyReportClient (757 lines) | Medium | **done** | Agent 1 | Small | W6-T6-CODE-SPLIT-2.md |

---

## Wave 7 (COMPLETE — Team UX & Polish)

| ID | Title | Priority | Status | Agent | Effort | Report |
|----|-------|----------|--------|-------|--------|--------|
| W7-T1 | userId coverage (per-member usage attribution) | Medium | **done** | Agent 1 | Medium | W7-T1-USAGE-USERID-COVERAGE.md |
| W7-T2 | Ops Dashboard polish | Medium | **done** | Agent 2 | Small | W7-T2-OPS-DASHBOARD-POLISH.md |
| W7-T3 | Usage History (7/30 day daily totals) | Medium | **done** | Agent 1 | Medium | W7-T3-USAGE-HISTORY.md |
| W7-T4 | Team Usage polish | Medium | **done** | Agent 2 | Small | W7-T4-TEAM-USAGE-POLISH.md |
| W7-T5 | Limit Changes audit UI (admin) | Medium | **done** | Agent 1 | Medium | W7-T5-LIMITS-AUDIT-UI.md |
| W7-T6 | Ops/Usage copy polish | Low | **done** | Agent 2 | Small | W7-T6-OPS-USAGE-POLISH.md |

---

## Wave 8 (COMPLETE — Accessibility + Nav IA + Design Tokens + A11y Foundation)

| ID | Title | Priority | Status | Agent | Effort | Report |
|----|-------|----------|--------|-------|--------|--------|
| W8-T1 | UI/UX Quick Wins (7 sub-tasks) | Medium | **done** | Agent 1 | Small | W8-T1-QUICK-WINS.md |
| W8-T2 | Nav IA — collapsible sidebar groups | Critical | **done** | Agent 2 | Medium | W8-T2-NAV-IA.md |
| W8-T3 | Design tokens foundation (WCAG AA) | High | **done** | Agent 3 | Large | W8-T3-DESIGN-TOKENS.md |
| W8-T4 | Sidebar merge verify | High | **done** | Agent 1 | Small | W8-MERGE-VERIFY-SIDEBAR.md |
| W8-T5 | Mobile bottom navigation (5 slots) | High | **done** | Agent 1 | Small | W8-T5-MOBILE-BOTTOM-NAV.md |
| W8-T6 | A11y gate: form labels batch | Medium | **done** | Agent 3 | Small | — |
| W8-T7 | Docs sync / Wave 8 close-out | Medium | **done** | Agent 1 | Small | W8-CLOSE-DOCS.md |
