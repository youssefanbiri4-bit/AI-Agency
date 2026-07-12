# TASK_QUEUE — Wave 2 Complete → Wave 3 Preparation

**Date:** 2026-07-12  
**Status:** Wave 2 complete (6 of 6 deliverable tasks); secret hygiene (W2-T1) still pending

---

## Wave 2 Complete ✅

All 6 deliverable tasks have been completed and verified:

| Task | Status | Report |
|------|:------:|--------|
| W2-T2: CSP Violation Endpoint Resolution | ✅ Done | `docs/orchestrator/reports/W2-T2-csp.md` |
| W2-T4: Standardize API Error Envelope + Request IDs | ✅ Done | `docs/orchestrator/reports/W2-T4-api-envelope.md` |
| W2-T6: Deprecate Dual n8n Callback Route | ✅ Done | `docs/orchestrator/reports/W2-T6-n8n-callback.md` |
| W2-R2: Harden `/api/health` Against Info Disclosure | ✅ Done | `docs/orchestrator/reports/W2-R2-health.md` |
| W2-R3: Billing Decision & Documentation | ✅ Done | `docs/orchestrator/reports/W2-R3-billing.md` |
| W2-R4: RBAC Dual Systems Cleanup (Documentation) | ✅ Done | `docs/orchestrator/reports/W2-R4-rbac.md` |
| W2-R6: Final QA — Zero Regressions Confirmed | ✅ Done | `docs/orchestrator/reports/W2-R6-qa.md` |

---

## Prerequisite for Production Claims

- [ ] **W2-T1: Secret Hygiene** — rotate keys, sanitize `.env.example`, scan git history
  - **Priority: Critical** — no production claims until completed

---

## Wave 3 — Performance & Resilience

### Database Performance

| Task | Priority | Dependencies |
|------|:--------:|--------------|
| Add SQL aggregates for dashboard/ops task counts (replace in-memory counting) | High | None |
| Migration: `tasks(workspace_id, status)` composite index | High | Schema review |
| Pagination defaults on all list endpoints | Medium | None |
| Fix `preferenceDepartment` type mismatch (3 test failures) | Medium | None |

### Frontend Performance

| Task | Priority | Dependencies |
|------|:--------:|--------------|
| Code-split top 5 largest client components (ContentStudio, Settings actions, etc.) | High | Architecture review |
| Expand dynamic import usage (current ~4 call sites) | Medium | None |
| Evaluate Lighthouse CI performance budget | Low | None |

### Operations

| Task | Priority | Dependencies |
|------|:--------:|--------------|
| PDF generation concurrency limits + timeouts | Medium | None |
| Worker deployment documentation | Medium | None |

### Quality Gates

| Task | Priority | Dependencies |
|------|:--------:|--------------|
| Fix `@/lib/rate-limit` missing exports → resolves 47 typecheck errors + ~10 test failures | **High** | Secret hygiene first |
| Fix setState-in-effect lint errors (MfaSection, SessionManagementPanel) | Medium | None |
| Fix Redis ECONNREFUSED in test infrastructure | Low | Infra setup |

---

## Wave 4 — Maintainability (Future)

| Task | Priority |
|------|:--------:|
| Migrate ~22 `workspace-permissions` call sites to `@/lib/auth/rbac` | Medium |
| Archive root-level audit markdown to `docs/archive/` | Medium |
| Split Content Studio + Settings actions into domain modules | Medium |
| Implement `/api/csp-violation` endpoint for violation telemetry | Low |
| Generate `database.ts` from Supabase CLI | Low |
| Rename package to `agentflow-ai` | Low |
