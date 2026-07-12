# TASK_QUEUE — Wave 2 Complete / Wave 3 Ready

**Date:** 2026-07-12  
**Status:** Wave 2 **CLOSED** — all tasks verified.  
**Next:** Wave 3 (Performance & Resilience)

---

## Wave 2 (CLOSED — All Tasks Complete)

All tasks verified complete with reports in `docs/orchestrator/reports/`:

- [x] **W2-T1** — Complete Secret Hygiene + Verify `.env.example` → `W2-R1-secret-hygiene.md`
- [x] **W2-T2** — Fix CSP violation endpoint or remove report directives → `W2-T2-csp.md`
- [x] **W2-T3** — Harden `/api/health` public responses → `W2-R2-health.md`
- [x] **W2-T4** — Standardize API Error Envelope + Request IDs → `W2-T4-api-envelope.md`
- [x] **W2-T5** — Decide & Document Billing Status → `W2-R3-billing.md`
- [x] **W2-T6** — Deprecate one dual n8n callback route → `W2-T6-n8n-callback.md`
- [x] **W2-T7** — Clean Dual RBAC system (document + mark legacy) → `W2-R4-rbac.md`
- [x] **R6** — Final QA Verification → `W2-R6-qa.md`

**Wave 2 gate: PASSED.** Proceed to Wave 3.

---

## Wave 3 (Following the gate)

With Wave 2 complete, begin Wave 3 performance + resilience cleanup:

1. Fix `@/lib/rate-limit` missing exports → resolves 47 typecheck errors + ~10 test failures
2. Fix `preferenceDepartment` type → resolves 3 test failures
3. Add SQL aggregates for dashboard/ops task counts
4. Migration: `tasks(workspace_id, status)` composite index
5. Pagination defaults on all list endpoints
6. Code-split top 5 largest client components
7. PDF generation concurrency limits + timeouts
8. Address setState-in-effect lint errors (MfaSection, SessionManagementPanel)

### Agent Allocation
Continue using 6 agents as decided in Wave 1.
