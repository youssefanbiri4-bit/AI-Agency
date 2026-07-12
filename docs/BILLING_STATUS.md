# BILLING STATUS — AgentFlow-AI

**Decision Date:** 2026-07-11  
**Decision:** Billing is scaffolded but intentionally **disabled** for internal/Beta use. Keep all existing DB schema, types, and utilities. Do not implement Stripe checkout.

---

## Decision

**Option B: Keep as Scaffold and document what is missing for full Stripe.**

### Rationale

1. **Usage tracking is real and functional.** `usage-limits.ts` (335 lines) and `quotas.ts` (384 lines) provide production-grade plan-limit enforcement, counter management, and multi-source quota verification. These are not stubs — they are actively used by the content studio and scheduler.

2. **Database schema is production-ready.** Three tables (`billing_customers`, `subscriptions`, `usage_limits`) have correct column types, foreign keys, cascade deletes, RLS policies, and indexes. A fourth table (`usage_events`) is migrated for audit logging.

3. **Stripe client utility is scaffold only.** `src/lib/stripe-server.ts` provides lazy-init Stripe client and config-readiness checks, but is never imported anywhere. It is correct and complete for its scope.

4. **Platform is pre-revenue.** No external paying customers yet. Billing activation is a future task.

5. **Deleting tables would waste work.** The schema and types are well-designed. Preserving them saves 2-3 days of future schema design.

---

## What Exists

### Database Tables (4 tables, fully migrated)

| Table | Purpose | RLS | Status |
|-------|---------|-----|--------|
| `billing_customers` | Maps workspace → Stripe customer | Owners/admins SELECT; owners CRUD | Schema ready, no data |
| `subscriptions` | Tracks plan, status, period dates | Owners/admins SELECT; owners CRUD | Schema ready, all rows default `free` |
| `usage_limits` | Per-workspace quota caps per plan | Members SELECT; owners UPDATE/DELETE | Schema ready, populated by seed defaults |
| `usage_events` | Audit log of quota-consuming actions | Members SELECT; service role INSERT | Schema ready, used by usage-limits.ts |

### Server-Side Usage Logic (REAL, functional)

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| `src/lib/usage/usage-limits.ts` | Plan defaults, counter sync, event recording | 335 | Production-ready |
| `src/lib/usage/quotas.ts` | Multi-source quota checking, usage retrieval | 384 | Production-ready |
| `src/lib/usage/cost-tracking.ts` | OpenAI/n8n cost estimation | 161 | Functional; recording is log-only (TODO) |

### Stripe Client Utility (SCAFFOLD, orphaned)

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/stripe-server.ts` | Lazy-init Stripe client, config checks | Functional, never imported |

### TypeScript Types (COMPLETE)

- `BillingPlan` = `'free' | 'starter' | 'pro' | 'agency'` — `src/types/database.ts:4`
- `BillingCustomerRecord`, `SubscriptionRecord`, `UsageLimitRecord` — `src/types/database.ts:1895-1897`
- Full Row/Insert/Update types for all 3 billing tables

### Frontend

| File | Purpose | Status |
|------|---------|--------|
| `src/app/(dashboard)/dashboard/settings/billing/page.tsx` | Billing settings | **Stub** — redirects to `/dashboard/settings` |
| `src/components/ui/StatusBadge.tsx` | `billing_required` status variant | UI only, no billing logic |

### Environment Variables

From `.env.example`:
```
# --- Stripe (scaffold only) ---
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_ALLOW_LIVE_MODE=false
```

**Missing from `.env.example`** (referenced in `stripe-server.ts`):
- `STRIPE_PRICE_STARTER_MONTHLY`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_AGENCY_MONTHLY`
- `APP_BASE_URL`

---

## What Does NOT Exist (Required for Full Stripe)

### API Routes (none exist)

| Route | Purpose |
|-------|---------|
| `/api/billing/checkout` | Create Stripe Checkout session |
| `/api/billing/webhook` | Handle Stripe events (invoice.paid, subscription.updated, etc.) |
| `/api/billing/portal` | Stripe Customer Portal redirect |

### Server Actions

- No billing-related server actions in `src/actions/`

### Data Access Layer

- No CRUD functions for `billing_customers`, `subscriptions`, or `usage_limits` in `src/lib/data/`

### Billing UI

- No plan selection, invoice list, or subscription management UI
- No upgrade/downgrade flow
- No usage dashboard showing quota consumption vs limits

### Integration Wiring

- No code writes to `usage_events` for billing-gated actions (only usage-limits.ts does this)
- No enforcement of `usage_limits` at the billing layer (enforcement happens at the quota layer)
- No plan-based feature gating tied to `subscriptions.plan`
- No webhook handler to sync Stripe subscription events → database

---

## What Future Engineers Need to Build

When billing is activated, implement in this order:

1. **Data access layer** — CRUD functions for billing tables in `src/lib/data/`
2. **Checkout flow** — `/api/billing/checkout` route + plan selection UI
3. **Webhook handler** — `/api/billing/webhook` to sync Stripe events → `subscriptions` table
4. **Customer portal** — `/api/billing/portal` for self-service subscription management
5. **Billing UI** — Dashboard page showing current plan, invoices, usage
6. **Plan gating** — Feature flags based on `subscriptions.plan` (not just `usage_limits`)
7. **Usage tracking integration** — Wire `usage_events` writes into all quota-consuming actions

**Note:** Steps 6-7 are partially done in the quota layer (`usage-limits.ts`, `quotas.ts`). The gap is connecting them to Stripe subscription state.

---

## Recommendation

**Do not delete any existing scaffold.** The schema, types, and usage logic are production-quality. When billing is activated, the existing foundation saves ~2-3 days of schema design and ~1-2 days of quota logic.

**Priority:** Medium. Billing is not required for internal/Beta use. Activate when the platform has external users ready to pay.

**Ambiguity level:** None. The system is clearly in "scaffold + functional usage tracking" mode. No future engineer should be confused about what works and what doesn't.
