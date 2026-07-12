# W2-R3 — Billing Decision Report

**Task:** Remove all ambiguity about Billing  
**Agent:** Architecture Engineer  
**Priority:** High  
**Date:** 2026-07-11  
**Branch:** fix/wave2-r3-billing-decision

---

## Decision

**Option B: Keep as Scaffold and document what is missing for full Stripe.**

Billing is intentionally disabled for internal/Beta use. All existing database schema, TypeScript types, usage-tracking logic, and Stripe utility are preserved as-is. No Stripe checkout, webhook, or portal is implemented.

---

## Rationale

1. **Usage tracking is real, not scaffold.** `usage-limits.ts` (335 lines) and `quotas.ts` (384 lines) are production-grade, actively used by the content studio. They enforce plan limits, manage counters, and verify quotas via 3-source strategy.

2. **DB schema is production-ready.** 3 billing tables + 1 usage events table with RLS, indexes, triggers. Deleting wastes 2-3 days of future work.

3. **Stripe client is scaffold only.** `stripe-server.ts` is functional but never imported. It correctly detects mode and checks config readiness.

4. **Platform is pre-revenue.** No paying customers. Billing is a future task.

5. **No ambiguity left.** The system is clearly "scaffold + functional usage tracking." Future engineers know exactly what works and what doesn't.

---

## Files Inspected

| File | Assessment |
|------|------------|
| `supabase/migrations/20260512000000_create_billing_foundation.sql` | Production-ready schema |
| `src/types/database.ts` | Complete billing types |
| `src/lib/stripe-server.ts` | Scaffold — functional, orphaned |
| `src/lib/usage/usage-limits.ts` | **Real** — 335 lines, production-grade |
| `src/lib/usage/quotas.ts` | **Real** — 384 lines, production-grade |
| `src/lib/usage/cost-tracking.ts` | **Real** — estimation works, recording is log-only |
| `src/app/(dashboard)/dashboard/settings/billing/page.tsx` | Stub — redirects to settings |
| `src/components/ui/StatusBadge.tsx` | `billing_required` status variant only |
| `src/app/api/billing/` | Does not exist |
| `src/actions/*billing*` | Do not exist |
| `src/lib/data/*billing*` | Do not exist |

---

## Files Created/Modified

| File | Action |
|------|--------|
| `docs/BILLING_STATUS.md` | **Created** — comprehensive billing status documentation |
| `docs/orchestrator/reports/W2-R3-billing.md` | **Created** — this report |
| `docs/orchestrator/MASTER_BACKLOG.md` | **Created** — full backlog with W2-R3 marked done |
| `docs/orchestrator/RISK_REGISTER.md` | **Created** — risk register with billing-related risks |

---

## Risks Identified

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Scaffold drift — schema changes without code updates | Low | Low | Documented in BILLING_STATUS.md; billing tables are stable |
| Orphaned code confusion | Medium | Low | BILLING_STATUS.md clearly lists all scaffold files |
| Env var gap — price IDs missing from `.env.example` | Low | Low | Noted in BILLING_STATUS.md |

---

## Success Criteria

- [x] Clear written decision
- [x] `docs/BILLING_STATUS.md` exists
- [x] Report: `docs/orchestrator/reports/W2-R3-billing.md`
- [x] MASTER_BACKLOG updated
- [x] RISK_REGISTER updated
- [x] No ambiguity left for future engineers
