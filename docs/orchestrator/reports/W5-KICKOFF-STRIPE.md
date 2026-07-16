# W5-KICKOFF-STRIPE — Wave 5 Stripe Foundation (SUPERSEDED)

**Date:** 2026-07-12  
**Wave:** 5 — SaaS Foundation  
**Task:** W5-KICKOFF-STRIPE  
**Status:** **SUPERSEDED — Internal Platform Decision**  
**Agent:** Agent 2

> **⚠️ This report is superseded by the Internal Platform decision.**
> AgentFlow-AI is an internal operating platform for the owner + team — not a commercial SaaS product. The Stripe checkout, webhook, portal, and billing data layer implemented here are **dead code — not imported, not used, not maintained**.
> 
> The implementation remains in the codebase as a reference but is intentionally disconnected. See `docs/BILLING_STATUS.md` for the current position, and `docs/orchestrator/reports/INTERNAL-PLATFORM-DOCS.md` for the full decision report.

---

## Summary

Implemented the minimal clean foundation for Stripe billing: plan-to-price mapping, data access layer, checkout API, webhook handler, and customer portal API. All existing scaffold is preserved; no existing usage tracking or free/internal usage is broken.

---

## What Was Implemented

### 1. `src/lib/billing/plans.ts` — Plan Definitions & Price Mapping

- `PLAN_META` — Display names and descriptions for all 4 plans (free, starter, pro, agency)
- `getStripePriceId(plan)` — Reads Stripe Price IDs from env vars, gated by `isStripeCheckoutConfigured()`
- `requireStripePriceId(plan)` — Throws if price ID is missing (for checkout routes that already passed the gate)
- `PAID_PLANS` — List of paid plans for checkout UI
- `isPaidPlan(plan)` / `DEFAULT_PLAN` — Helpers for safe defaults

### 2. `src/lib/data/billing.ts` — Data Access Layer

- **`getBillingCustomer(workspaceId)`** — Fetch billing customer record
- **`upsertBillingCustomer(customer)`** — Create or update billing customer
- **`setStripeCustomerId(workspaceId, stripeCustomerId)`** — Update Stripe customer ID
- **`getSubscription(workspaceId)`** — Fetch subscription record
- **`upsertSubscription(subscription)`** — Create or update subscription
- **`updateSubscriptionPlan(workspaceId, plan, stripeSubId, status)`** — Update plan + sync usage limits
- **`getCurrentPlanInfo(workspaceId)`** — Get current plan with safe free fallback

### 3. `src/app/api/billing/checkout/route.ts` — Checkout API

- **Auth required** — Validates user session
- **Workspace context** — Resolves active workspace from cookie
- **Rate limited** — 20 req/min per IP
- **Stripe customer creation** — Creates Stripe customer if none exists, stores in DB
- **Config check** — Returns 501 if Stripe not configured
- **Duplicate check** — Returns 409 if workspace already has active paid subscription
- **Returns** `{ url, sessionId, plan, planName, workspaceId }`

### 4. `src/app/api/billing/webhook/route.ts` — Webhook Handler

- **Signature verification** — Uses `stripe.webhooks.constructEvent()` with STRIPE_WEBHOOK_SECRET
- **Handled events:**
  - `checkout.session.completed` — Creates subscription, ensures usage limits
  - `invoice.paid` — Activates subscription, syncs period dates
  - `invoice.payment_failed` — Marks subscription past_due
  - `customer.subscription.updated` — Syncs plan/status changes
  - `customer.subscription.deleted` — Reverts to free plan
- **Fails closed** on missing config, missing signature, or verification failure
- **Logging** — Structured logger on every event
- **Error isolation** — Processing errors are logged but return 200 to avoid retry storms

### 5. `src/app/api/billing/portal/route.ts` — Customer Portal API

- Creates Stripe Customer Portal session for self-service subscription management
- Creates Stripe customer if none exists (so free users can still access portal)
- Returns `{ url, returnUrl, workspaceId }`

### 6. `.env.example` — Updated

Added missing env vars:
- `STRIPE_PRICE_STARTER_MONTHLY`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_AGENCY_MONTHLY`
- `APP_BASE_URL`

### 7. `docs/BILLING_STATUS.md` — Updated

Added new sections documenting all Wave 5 additions with status and purpose.

---

## Design Decisions

### Gating Before Everything

All routes use `isStripeCheckoutConfigured()` from the existing `stripe-server.ts`. When Stripe env vars are not set, routes return 501 with a clear message. This ensures:
- **Zero impact on existing users** — Free internal usage is untouched
- **No accidental charges** — Without price IDs, checkout cannot create sessions
- **Clear error messages** — Developers know exactly what's missing

### Safe Free-Plan Fallback

`getCurrentPlanInfo()` always returns `{ plan: 'free', status: 'active' }` when no subscription record exists. All existing quota/usage code continues to work without changes.

### Frontend Not Wired (By Design)

The checkout, webhook, and portal routes are fully functional but not called from any frontend component. This allows us to:
1. Deploy the backend safely first
2. Build and test the billing UI separately
3. Activate billing gradually when ready

### Webhook Event Isolation

Each Stripe event type has its own handler function. Processing errors are logged via Sentry but the webhook always returns 200 to Stripe. This prevents retry loops from failed events while ensuring we capture errors for debugging.

### Known Gaps (Accepted for Foundation)

| Gap | Impact | Future Task |
|-----|--------|-------------|
| No role-based access control on billing routes (any workspace member can checkout) | Low — non-critical for internal use | Add owner/admin check to checkout + portal routes |
| Stale Stripe customer ID edge case (deleted via Stripe Dashboard) | Low — Stripe API will error, caught by try/catch | Add customer existence verification before reuse |
| `as any` casts in webhook route (SDK types mismatch with API version) | Low — runtime properties match the API | Define local interfaces for Stripe objects when SDK types catch up |
| No test coverage for new routes | Medium — needed before production activation | Add integration tests with Stripe test mode |

---

## Files Created/Modified

| File | Action |
|------|--------|
| `src/lib/billing/plans.ts` | **Created** |
| `src/lib/data/billing.ts` | **Created** |
| `src/app/api/billing/checkout/route.ts` | **Created** |
| `src/app/api/billing/webhook/route.ts` | **Created** |
| `src/app/api/billing/portal/route.ts` | **Created** |
| `.env.example` | **Updated** |
| `docs/BILLING_STATUS.md` | **Updated** |
| `docs/orchestrator/reports/W5-KICKOFF-STRIPE.md` | **This report** |

---

## What is Still Needed for Full Stripe

### Frontend (Next steps)

| Task | Effort | Details |
|------|--------|---------|
| Plan selection UI | Medium | Pricing cards with plan comparison, wire to checkout |
| Billing settings page | Medium | Replace stub with plan info, manage button → portal |
| Subscription status badge | Small | Show current plan in dashboard header |
| Usage dashboard | Medium | Show quota consumption vs plan limits |
| Cancel subscription flow | Small | Downgrade confirmation → portal |

### Backend / Integration

| Task | Effort | Details |
|------|--------|---------|
| Stripe CLI test harness | Small | `stripe trigger` events for local testing |
| Plan gating in middleware | Medium | Check subscription status before allowing features |
| Trial period management | Small | Trial length config, trial → paid conversion |
| Payment method management | Small | Add/update/remove cards (handled by portal) |
| Invoice list API | Small | List invoices for workspace (Stripe API) |

### Operations

| Task | Effort | Details |
|------|--------|---------|
| Create Stripe Price IDs | Small | In Stripe Dashboard: starter ($29), pro ($99), agency ($299) |
| Set env vars in Vercel | Small | Add all 4 new env vars to production/staging |
| Configure Stripe webhook | Small | Point Stripe → `{APP_BASE_URL}/api/billing/webhook` |
| Test in staging | Medium | End-to-end checkout → webhook → subscription sync |

---

## Success Criteria

- [x] Checkout route or clear foundation exists
- [x] Webhook skeleton exists and is secure
- [x] Documentation clear
- [x] typecheck + build green (verified)
- [x] Report written with next steps
