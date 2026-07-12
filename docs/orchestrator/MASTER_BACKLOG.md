# MASTER BACKLOG — AgentFlow-AI

**Last Updated:** 2026-07-12T14:30:00Z  
**Owner:** Engineering Orchestrator

## Status Legend
- `todo` | `in_progress` | `done` | `blocked` | `cancelled`

## Wave 2 Backlog

| ID | Title | Priority | Status | Assigned Agent | Dependencies | Risk | Notes |
|----|-------|----------|--------|----------------|--------------|------|-------|
| W2-T1 | Complete Secret Hygiene + Verify .env.example | Critical | **done** | Security Engineer | - | High | Report: W2-R1-secret-hygiene.md |
| W2-T2 | Fix CSP violation endpoint or remove report directives | High | **done** | Security Engineer | - | Medium | Report: W2-T2-csp.md |
| W2-T3 | Harden /api/health public responses | High | **done** | Security Engineer | - | Medium | Report: W2-R2-health.md |
| W2-T4 | Standardize API Error Envelope + Request IDs | High | **done** | Backend Engineer | - | Medium | Report: W2-T4-api-envelope.md |
| W2-T5 | Decide & Document Billing Status | High | **done** | Architecture + Backend | - | High | Report: W2-R3-billing.md |
| W2-T6 | Deprecate one dual n8n callback route | Medium | **done** | Backend Engineer | - | Low | Report: W2-T6-n8n-callback.md |
| W2-T7 | Clean Dual RBAC system (document + mark legacy) | Medium | **done** | Security Engineer | - | Medium | Report: W2-R4-rbac.md |
| R6 | Final QA Verification | High | **done** | QA Engineer | - | Low | Report: W2-R6-qa.md |
| GATES-GREEN-1 | DashboardContext RBAC Fix | High | **done** | Architecture Engineer | - | Medium | Report: GATES-GREEN-1.md |
| STABILIZE-LINT | ESLint Zero-Error Gate | High | **done** | Lint Engineer | - | Low | Report: STABILIZE-LINT.md |

## Wave 3 Backlog

| ID | Title | Priority | Status | Assigned Agent | Dependencies | Risk | Notes |
|----|-------|----------|--------|----------------|--------------|------|-------|
| W3-T1 | Fix `@/lib/rate-limit` missing exports | High | todo | Backend Engineer | - | High | Resolves 47 typecheck errors + ~10 test failures |
| W3-T2 | Fix `preferenceDepartment` type | Medium | todo | Backend Engineer | - | Medium | Resolves 3 test failures |
| W3-T3 | Add SQL aggregates for task status counts | High | todo | Backend Engineer | W3-T1 | High | Performance: O(n) → O(1) |
| W3-T4 | Migration: `tasks(workspace_id, status)` index | High | todo | Database Engineer | - | High | Performance: composite index |
| W3-T5 | Pagination defaults on all list endpoints | Medium | todo | Backend Engineer | - | Medium | Consistency |
| W3-T6 | Code-split top 5 largest client components | High | todo | Frontend Engineer | - | Medium | Performance: bundle size |
| W3-T7 | PDF generation concurrency limits + timeouts | Medium | todo | Backend Engineer | - | Low | Operations |
