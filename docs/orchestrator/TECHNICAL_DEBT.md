# TECHNICAL DEBT — AgentFlow-AI

**Last Updated:** 2026-07-12 (Wave 2 Full Merge)

## High Priority Debt
- God components (ContentStudioClient ~2.7k lines, Settings actions ~2.4k lines)
- Pre-existing typecheck failures (47 errors from `@/lib/rate-limit` missing exports)
- Pre-existing test failures (14 failures in 4 test files — rate-limit, preferenceDepartment, Redis)

## Medium Priority Debt
- 51 ESLint warnings (unused variables/imports across ~15 files)
- setState-in-effect in MfaSection and SessionManagementPanel (react-hooks/set-state-in-effect)
- Spanish i18n incomplete
- Documentation sprawl at root level

## Low Priority Debt
- Billing scaffold orphaned — `stripe-server.ts` and `cost-tracking.ts` have no callers (documented in BILLING_STATUS.md)
- Missing `.env.staging` pattern was added to `.gitignore` in W2-R1

## Resolved in Wave 2
- Secret hygiene (W2-R1) — `.env.example` clean, `.gitignore` hardened, full scan clean
- CSP violation endpoint (W2-T2) — directives removed
- API error envelope inconsistency (W2-T4) — standardized across 7+ routes
- Dual n8n callback (W2-T6) — `/api/tasks/callback` is thin deprecation wrapper
- Billing ambiguity (W2-R3) — decision documented in BILLING_STATUS.md
