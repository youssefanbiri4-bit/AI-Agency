# W18-T1 REPORT: Stripe Production Setup + Subscription Management + Overage Billing

**📅 Date:** 2026-07-15  
**👤 Role:** Senior Payments Engineer  
**📋 Task ID:** W18-T1  
**📊 Status:** ✅ Complete

---

## Table of Contents

1. [Overview](#overview)
2. [Changes Summary](#changes-summary)
3. [Component 1: Stripe Production Mode](#component-1-stripe-production-mode)
4. [Component 2: Subscription Lifecycle Management](#component-2-subscription-lifecycle-management)
5. [Component 3: Overage Billing + Usage-based Pricing](#component-3-overage-billing--usage-based-pricing)
6. [Component 4: Invoice Email Generation](#component-4-invoice-email-generation)
7. [Webhook Enhancements](#webhook-enhancements)
8. [Stripe Production Setup Guide](#stripe-production-setup-guide)
9. [Testing Verification](#testing-verification)
10. [Next Steps](#next-steps)

---

## Overview

Implemented a complete Stripe production billing system with four integrated components:

| Component | Description | Files |
|-----------|-------------|-------|
| **Production Mode** | Live mode gate, product validation, env verification | `src/lib/stripe/live-mode-gate.ts` |
| **Subscription Lifecycle** | Provisioning, dunning, cancellations, reactivation | `src/lib/stripe/subscription-lifecycle.ts` |
| **Overage Billing** | Metered usage reporting to Stripe, overage calculation | `src/lib/stripe/overage-billing.ts` |
| **Invoice Email** | Payment receipts, failure alerts, invoices via Resend | `src/lib/billing/invoice-email.ts` |
| **Webhook Enhancement** | Integrated lifecycle + email dispatch | `src/app/api/billing/webhook/route.ts` (updated) |
| **Environment** | Stripe env vars documented | `.env.example` (updated) |

---

## Changes Summary

### New Files (5)

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/stripe/live-mode-gate.ts` | ~170 | Production readiness checks: key validation, connectivity, webhook secret, product/price validation. Returns structured `StripeGateResult` with per-check pass/fail. |
| `src/lib/stripe/subscription-lifecycle.ts` | ~340 | Full lifecycle manager: provisioning via Checkout, status transitions (`active ↔ past_due ↔ canceled`), dunning with 7-day grace period, auto-cancel, reactivation, audit logging. |
| `src/lib/stripe/overage-billing.ts` | ~280 | Stripe metered usage integration: calculates overage vs plan limits, reports usage to Stripe via `createUsageRecord`, threshold alerts at 80% usage. |
| `src/lib/billing/invoice-email.ts` | ~370 | Transactional billing emails via Resend: payment receipts, failure alerts, invoices, cancellation confirmations, overage warnings. All with AgentFlow brand HTML templates. |
| `docs/W18-T1-REPORT.md` | — | This report. |

### Modified Files (2)

| File | Changes |
|------|---------|
| `src/app/api/billing/webhook/route.ts` | Enhanced `handleInvoicePaid` → sends receipt email via Resend, logs lifecycle audit. Enhanced `handleInvoicePaymentFailed` → triggers dunning via `handlePaymentFailure` lifecycle manager. |
| `.env.example` | Added Stripe section with `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and optional price ID variables. |

---

## Component 1: Stripe Production Mode

### `src/lib/stripe/live-mode-gate.ts`

**Purpose:** Safeguards production billing by running a multi-check gate before enabling live charges.

**Key Features:**
- **7 Production Checks:**
  1. `STRIPE_SECRET_KEY` is set
  2. Valid key format (`sk_live_` or `sk_test_`)
  3. `STRIPE_WEBHOOK_SECRET` is set (required for lifecycle)
  4. Valid webhook secret format (`whsec_`)
  5. `NEXT_PUBLIC_APP_URL` is set (checkout redirects)
  6. Stripe API connectivity (retrieves balance)
  7. Live mode warning label
- Returns structured `StripeGateResult` with `allClear`, `status` (ready/test_mode_only/misconfigured/not_configured), and per-check details
- `isStripeReadyForProduction()` — lightweight check without API calls
- `getStripeModeLabel()` — readable mode label for UI
- `validateStripeProducts()` — validates that all paid plans have `stripePriceIds` configured

**Usage:**
```typescript
const gate = await runStripeProductionGate();
if (!gate.allClear) {
  // Block production billing
  console.error(gate.summary);
}
```

---

## Component 2: Subscription Lifecycle Management

### `src/lib/stripe/subscription-lifecycle.ts`

**Purpose:** End-to-end subscription lifecycle management.

**Key Features:**

#### Provisioning
- `provisionSubscription()` — Creates a Checkout Session for new subscriptions
- Supports optional trial periods via `trialDays` parameter
- Uses Stripe Price IDs when available, falls back to ad-hoc pricing
- Preserves plan and workspace metadata in Stripe subscription

#### Status Transitions
```
trialing ──→ active ←── past_due ──→ canceled
                ↑         ↓              │
                └── pays, reactivates ───┘
```
- `getSubscriptionStatus()` — Fetches detailed status from Stripe, including `daysUntilCancel` and `pastDueDays`
- `mapStripeStatus()` — Maps Stripe statuses to local subscription statuses

#### Dunning Management (Payment Recovery)
- **Grace period:** 7 days (`DUNNING_GRACE_PERIOD_DAYS`)
- **Max retries:** 3 attempts (`MAX_PAYMENT_RETRIES`)
- **Retry interval:** 24 hours between attempts
- `handlePaymentFailure()` — Updates status, sends alerts, notifies owner when grace period is near expiry
- `checkAndAutoCancel()` — Auto-cancels subscription after grace period elapsed

#### Cancellation Flows
- `cancelAtPeriodEnd()` — Standard cancellation, active until period end
- `reactivateSubscription()` — Reactivates a subscription scheduled for cancellation

#### Audit Trail
- `logSubscriptionEvent()` — Logs lifecycle events to `security_audit_logs` table

**Usage:**
```typescript
// Provision a new subscription
const result = await provisionSubscription({
  workspaceId,
  planId: 'pro',
  period: 'monthly',
  workspaceName: 'My Agency',
  email: 'owner@agency.com',
  trialDays: 14,
});

// Handle payment failure (dunning)
await handlePaymentFailure({
  workspaceId,
  stripeSubscriptionId: 'sub_xxx',
  attemptCount: 2,
  nextAttemptAt: new Date(Date.now() + 86400000),
});

// Check if auto-cancel is needed
const { canceled } = await checkAndAutoCancel({
  workspaceId,
  stripeSubscriptionId: 'sub_xxx',
  daysOverdue: 8, // Exceeds grace period
});
```

---

## Component 3: Overage Billing + Usage-based Pricing

### `src/lib/stripe/overage-billing.ts`

**Purpose:** Reports usage-based consumption to Stripe for overage billing via metered billing.

**Key Features:**

#### Overage Calculation
- `calculateOverage()` — Calculates overage per quota type (AI generations, tasks, creative assets, content items, reels publishes)
- Uses `getMonthlyUsageByType()` from the existing usage system
- Filters out overage below `MIN_OVERAGE_UNITS` (10 units) to avoid micro-charges
- Respects plan `usagePricing` configuration with per-unit rates

#### Stripe Metered Billing
- `reportOverageToStripe()` — Reports calculated overage to Stripe via `createUsageRecord`
- Supports metered subscription items with `usage_type: 'metered'`
- Matches subscription items by `quota_type` metadata on the Stripe price
- Gracefully handles missing metered items or non-Stripe subscriptions

#### Threshold Monitoring
- `checkOverageThresholds()` — Checks usage against plan limits at configurable threshold (default 80%)
- Returns warnings for near-limit quota types
- Integrates with existing alerting system

#### Setup Guidance
- `getMeteredPriceConfig()` — Returns the Stripe Price configuration needed for metered billing setup

**Configuration:**
Overage billing is configured per plan in `src/lib/billing/plans.ts`:
```typescript
usagePricing: {
  ai_generations: { includedUnits: 500, overagePerUnit: 0.02, unitLabel: 'generations/mo' },
  tasks: { includedUnits: 1000, overagePerUnit: 0.01, unitLabel: 'tasks/mo' },
  // ...
}
```

**Stripe Metered Price Setup:**
To enable metered billing, create metered prices in Stripe Dashboard:
1. Products → Add Product → "AgentFlow AI — AI Generations Overage"
2. Pricing model: "Metered usage" → "Per unit"
3. Unit price: $0.02 (matches `plans.ts` overagePerUnit)
4. Add metadata: `quota_type = ai_generations`
5. Add the resulting price ID to the subscription items in the checkout flow

**Usage:**
```typescript
// Report overage to Stripe
const result = await reportOverageToStripe(workspaceId, 'pro', 'monthly');

// Check thresholds for warning
const warnings = await checkOverageThresholds(workspaceId, 'pro', 80);
if (warnings.length > 0) {
  await dispatchAlert({
    source: 'billing',
    severity: 'warning',
    title: 'Usage nearing limits',
    message: warnings.map(w => w.message).join('\n'),
    workspaceId,
  });
}
```

---

## Component 4: Invoice Email Generation

### `src/lib/billing/invoice-email.ts`

**Purpose:** Sends branded transactional billing emails via Resend.

**Email Templates (6 types):**

| Template | Trigger | Content |
|----------|---------|---------|
| **Payment Receipt** | Invoice paid | Amount, plan, period, invoice number — "View Billing History" CTA |
| **Payment Failure** | Payment failed | Urgency color coding, attempt count, days until cancel, "Update Payment Method" CTA |
| **Invoice** | New invoice | Line items, totals, period, invoice number — "View Invoice" CTA |
| **Cancellation** | Sub canceled | Effective date, reactivation note, "Reactivate Subscription" CTA |
| **Overage Warning** | Usage exceeded | Per-category usage/cost breakdown, total overage cost — "View Usage Details" CTA |

**Send Functions:**
- `sendPaymentReceiptEmail()` — After successful invoice payment
- `sendPaymentFailureEmail()` — After payment failure (with urgency escalation)
- `sendInvoiceEmail()` — For new invoice notification
- `sendCancellationEmail()` — After subscription cancellation
- `sendOverageWarningEmail()` — When usage exceeds plan limits

All functions gracefully handle missing `RESEND_API_KEY` (log warning, return false).

**Usage:**
```typescript
// Send payment receipt
await sendPaymentReceiptEmail('owner@agency.com', {
  workspaceName: 'My Agency',
  planName: 'Pro',
  amount: 49.00,
  invoiceNumber: 'STRP-INV1234',
  periodStart: 'Jul 1, 2026',
  periodEnd: 'Jul 31, 2026',
});
```

---

## Webhook Enhancements

### `src/app/api/billing/webhook/route.ts` (Updated)

**Changes:**

1. **`handleInvoicePaid` — Enhanced:**
   - Now sends payment receipt email via `sendPaymentReceiptEmail()`
   - Logs lifecycle event to `security_audit_logs` via `logSubscriptionEvent()`
   - Fetches workspace owner email for receipt delivery

2. **`handleInvoicePaymentFailed` — Enhanced:**
   - Now triggers dunning process via `handlePaymentFailure()`
   - Passes `attemptCount` and `nextAttemptAt` to lifecycle manager
   - Sets `dunning_started_at` on first failure

---

## Stripe Production Setup Guide

### Step 1: Create Stripe Account & Get Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Toggle "View test data" off for live mode
3. Navigate to **Developers → API Keys**
4. Copy the **Secret key** (starts with `sk_live_`)

### Step 2: Set Up Webhook Endpoint

1. Go to **Developers → Webhooks**
2. Click **Add endpoint**
3. Endpoint URL: `https://yourdomain.com/api/billing/webhook`
4. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.trial_will_end`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_`)

### Step 3: Create Products & Prices

1. Go to **Products**
2. Create products matching your plans:
   - **Pro Plan (Monthly)** → $49/month → Copy price ID (`price_xxx`)
   - **Pro Plan (Yearly)** → $490/year → Copy price ID
   - **Enterprise Plan (Monthly)** → $149/month → Copy price ID
   - **Enterprise Plan (Yearly)** → $1,490/year → Copy price ID

### Step 4: Create Metered Prices (for overage billing)

1. Go to **Products → Add Product**
2. Product name: `AI Generations Overage`
3. Pricing model: **Metered usage → Per unit**
4. Unit price: $0.02 (match `plans.ts` overagePerUnit)
5. Add metadata key: `quota_type`, value: `ai_generations`
6. Repeat for: `tasks` ($0.01/unit), and other overage types

### Step 5: Configure Environment Variables

```bash
# Production (Vercel)
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Local testing
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Step 6: Configure Price IDs in Code

In `src/lib/billing/plans.ts`, add `stripePriceIds` to each paid plan:

```typescript
pro: {
  // ...existing config...
  stripePriceIds: {
    monthly: 'price_1ProMonthly...',
    yearly: 'price_1ProYearly...',
  },
}
```

### Step 7: Run Production Gate

```typescript
const gate = await runStripeProductionGate();
if (gate.allClear) {
  // ✅ Stripe is production-ready
}
```

### Step 8: Test with Stripe CLI (Test Mode)

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local
stripe listen --forward-to localhost:3000/api/billing/webhook

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger payment_intent.succeeded
stripe trigger invoice.paid
stripe trigger invoice.payment_failed
```

---

## Testing Verification

### TypeScript Compilation

```bash
npx tsc --noEmit --pretty
```
_All 5 new files and 2 modified files pass type checking._

### Test Cards (Stripe Test Mode)

| Scenario | Card Number | Expected Result |
|----------|-------------|-----------------|
| Successful payment | `4242 4242 4242 4242` | Checkout success, webhook fires `invoice.paid` |
| Requires authentication | `4000 0025 0000 3155` | 3D Secure flow, requires authentication |
| Payment declined | `4000 0000 0000 0002` | `invoice.payment_failed` event, dunning triggered |
| Insufficient funds | `4000 0000 0000 9995` | Card declined, dunning with retries |
| Generic decline | `4000 0000 0000 0002` | `charge.failed` + `invoice.payment_failed` |

### Manual Verification Checklist

- [ ] `POST /api/billing/webhook` returns `{ received: true }` for valid events
- [ ] `POST /api/billing/webhook` returns `400` for invalid signature
- [ ] Checkout session creates Stripe customer in `billing_customers`
- [ ] Webhook syncs subscription status to `subscriptions` table
- [ ] Invoice records appear in `invoices` table after payment
- [ ] Payment failure triggers `handlePaymentFailure` and updates status to `past_due`
- [ ] Subscription cancellation reverts plan to `free`
- [ ] Email sent for successful payment (if RESEND_API_KEY configured)
- [ ] Email sent for payment failure (if RESEND_API_KEY configured)
- [ ] `runStripeProductionGate()` returns correct status based on env vars

---

## Next Steps

1. **Configure Stripe Dashboard** — Follow Stripe Production Setup Guide to create products, prices, and webhook endpoint
2. **Add stripePriceIds to plans.ts** — After creating Stripe prices, add the price IDs to the plan definitions
3. **Create metered prices in Stripe** — For overage billing to work, create metered prices with matching `quota_type` metadata
4. **Test full flow in Stripe test mode** — Use test cards to verify checkout, webhook, subscription lifecycle, and email delivery
5. **Add cron job for overage reporting** — Create a scheduled job to periodically check and report overage to Stripe
6. **Add invoice PDF generation** — Generate PDF invoices using the existing server PDF system
7. **Add billing dashboard page** — Real-time subscription status, usage graphs, and payment history
```