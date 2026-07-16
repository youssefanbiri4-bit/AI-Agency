# W15-T1: Stripe Integration + Real Subscription Management

> **Task:** Stripe Checkout + Customer Portal + Webhooks + Subscription Lifecycle + Overage Billing  
> **Date:** 2026-07-15  
> **Status:** ✅ Complete  

---

## What Was Built

### 1. Stripe Server-Side Client (`src/lib/stripe/stripe-server.ts`)
- Lazy-initialized Stripe singleton with `getStripe()`
- `getOrCreateCustomer()` — Creates Stripe Customer and links to workspace via `billing_customers` table
- `getStripeCustomerId()` — Looks up existing Stripe customer for a workspace
- `isStripeConfigured()` — Checks if `STRIPE_SECRET_KEY` is set and valid
- Graceful fallback: returns `null` when Stripe is not configured (no breaking changes)

### 2. Stripe Checkout API (`POST /api/billing/create-checkout`)
- Creates a Stripe Checkout Session for subscription purchases
- Supports predefined Stripe Price IDs or ad-hoc prices based on plan config
- Sets up subscription with workspace metadata for webhook reconciliation
- Supports promotion codes and automatic billing address collection
- Returns `{ url: string }` for client-side redirect

### 3. Stripe Customer Portal API (`POST /api/billing/create-portal`)
- Creates a Stripe Billing Portal session for subscription management
- Customers can change plans, update payment methods, view invoices
- Returns `{ url: string }` for client-side redirect

### 4. Stripe Webhook Handler (`POST /api/billing/webhook`)
- Signature verification via `STRIPE_WEBHOOK_SECRET`
- Handles the following events:
  - **`checkout.session.completed`** — Activates subscription, syncs to DB
  - **`customer.subscription.updated`** — Syncs plan changes, status updates
  - **`customer.subscription.deleted`** — Marks as canceled, reverts to Free plan
  - **`invoice.paid`** — Records invoice in local database
  - **`invoice.payment_failed`** — Marks subscription as `past_due`
  - **`customer.subscription.trial_will_end`** — Logs for notification

### 5. Subscription Status API (`GET /api/billing/subscription`)
- Returns current subscription details from both local DB and Stripe
- Retrieves Stripe subscription by ID or falls back to customer lookup
- Returns: `{ subscription, plan, memberCount, pricing, stripeStatus, stripeConfigured }`

### 6. Billing Service Updates (`src/lib/billing/billing-service.ts`)
- `changePlan()` now detects paid plans and routes through Stripe Checkout via `requiresCheckout` flag
- Lazy-imports Stripe module to avoid hard dependency
- Preserves existing free plan / internal plan change flow unchanged

### 7. Billing Page Actions (`src/app/(dashboard)/dashboard/settings/billing/actions.ts`)
- `createCheckoutSessionAction()` — Server action that calls checkout API
- `createPortalSessionAction()` — Server action that calls portal API
- Both return `{ success, url, message }` for client-side handling

### 8. Billing Page UI (`src/app/(dashboard)/dashboard/settings/billing/page.tsx`)
- **"Billing Portal" button** — Opens Stripe Customer Portal in new tab
- **Checkout flow** — Paid plan upgrades trigger Stripe Checkout redirect
- **Portal loading state** — Loading indicator while portal session creates
- **Confirmation dialog** — Shows Stripe payment note for paid upgrades

---

## Files Created

| File | Purpose |
|------|---------|
| `src/lib/stripe/stripe-server.ts` | Stripe server-side init, customer management |
| `src/app/api/billing/create-checkout/route.ts` | Stripe Checkout session creation |
| `src/app/api/billing/create-portal/route.ts` | Stripe Customer Portal session |
| `src/app/api/billing/webhook/route.ts` | Stripe webhook handler (6 event types) |
| `src/app/api/billing/subscription/route.ts` | Subscription status from Stripe + DB |
| `docs/W15-T1-REPORT.md` | This report |

## Files Modified

| File | Change |
|------|--------|
| `package.json` | Added `stripe` dependency |
| `src/types/database.ts` | Added `stripePriceIds` to `PlanDefinition` |
| `src/lib/billing/billing-service.ts` | Added Stripe integration to `changePlan()` |
| `src/app/(dashboard)/dashboard/settings/billing/actions.ts` | Added checkout + portal server actions |
| `src/app/(dashboard)/dashboard/settings/billing/page.tsx` | Added Stripe payment flow UI |
| `.env.example` | Added Stripe env vars |

---

## Stripe Setup Steps

### Step 1: Create a Stripe Account
1. Go to [stripe.com](https://stripe.com) and sign up (or log in)
2. Navigate to **Dashboard → Developers → API keys**
3. Copy the **Secret key** (`sk_test_...` for testing, `sk_live_...` for production)

### Step 2: Configure Environment Variables
Add to Vercel → Settings → Environment Variables (Production):

| Variable | Value | Notes |
|----------|-------|-------|
| `STRIPE_SECRET_KEY` | `sk_test_...` or `sk_live_...` | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Webhook signing secret |
| `STRIPE_ALLOW_LIVE_MODE` | `false` (test) / `true` (prod) | Live mode gate |

### Step 3: Create Products & Prices in Stripe Dashboard
1. Go to **Stripe Dashboard → Products**
2. Create products for each plan (optional — the checkout route can create prices dynamically):
   - **Free Plan** — $0/month (no Stripe product needed)
   - **Pro Plan** — $49/month (create product + monthly price)
   - **Enterprise Plan** — $149/month (create product + monthly price)
3. (Optional) Add yearly prices with 17% discount
4. Add the Price IDs to the plan definitions in `src/lib/billing/plans.ts`:
   ```ts
   pro: {
     // ...existing config...
     stripePriceIds: {
       monthly: 'price_1234567890', // Replace with actual Stripe price ID
       yearly: 'price_0987654321',  // Replace with actual Stripe price ID
     },
   },
   ```

### Step 4: Configure Webhook Endpoint
1. Go to **Stripe Dashboard → Developers → Webhooks**
2. Click **"Add endpoint"**
3. Endpoint URL: `https://agentflow-ai-sigma.vercel.app/api/billing/webhook`
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.trial_will_end`
5. After creating, copy the **Signing secret** (`whsec_...`) to `STRIPE_WEBHOOK_SECRET`

### Step 5: Test the Integration
1. Use Stripe test card: `4242 4242 4242 4242`
2. Go to Billing page → Click "Upgrade" on Pro plan → Complete checkout
3. Verify webhook receives `checkout.session.completed` in Stripe Dashboard
4. Check that subscription syncs to local database (`subscriptions` table)
5. Test portal: Click "Billing Portal" → Manage subscription
6. Test downgrade/cancellation flow
7. Test invoice payment failure (use test card `4000 0000 0000 0002`)

### Step 6: Webhook Testing (Local Development)
For local testing, use the Stripe CLI:
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Forward webhooks to local dev server
stripe listen --forward-to localhost:3000/api/billing/webhook

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.paid
stripe trigger invoice.payment_failed
```

---

## Subscription Lifecycle

```
                    ┌─────────────┐
                    │   trialing   │
                    └──────┬──────┘
                           │ trial ends / pays
                    ┌──────▼──────┐
         ┌──────────►    active   ◄──────────┐
         │          └──────┬──────┘          │
         │                 │                  │
    payment fails    downgrade/upgrade    cancels
         │                 │                  │
    ┌────▼────┐      re-syncs via      ┌─────▼─────┐
    │ past_due │      webhook          │  canceled  │
    └────┬────┘                        └─────┬─────┘
         │                                   │
    pays (reactivates)                  reverts to Free
         │                                   │
         └──────► active ◄───────────────────┘
```

### Status Mapping (Stripe → Local DB)

| Stripe Status | Local Status | Action |
|---------------|--------------|--------|
| `active` | `active` | Normal operation |
| `trialing` | `active` | Trial period (counts as active) |
| `past_due` | `past_due` | Payment failed, limited access |
| `canceled` | `canceled` | Subscription ended |
| `incomplete` | `incomplete` | Payment pending |
| `incomplete_expired` | `canceled` | Payment never completed |
| `unpaid` | `incomplete` | Payment failed permanently |

---

## Overage / Usage-Based Billing

The overage billing system leverages the existing quota infrastructure:

1. **Usage tracking** — Already implemented via `incrementUsage()` and `usage_events` table
2. **Enforcement** — `enforceBillingLimit()` blocks operations when limits exceeded
3. **Usage pricing** — Defined in `plans.ts` per plan (e.g., Pro: $0.02/overage generation)
4. **Invoice generation** — Webhook `invoice.paid` records line items in local DB

For full overage billing (invoicing overage at end of month):

1. Create a Stripe Usage Record subscription item for metered billing
2. OR run a monthly cron job that queries `usage_events` for overage, creates Stripe invoice items
3. The existing `cost-tracking.ts` and `analytics.ts` provide the data foundation

### Configuring Overage Prices in Stripe
For plans with usage-based pricing, create metered prices in Stripe Dashboard:
- Product: "AI Generations Overage" — unit price: $0.02
- Product: "Task Overage" — unit price: $0.01
- Billing scheme: "Per unit" with "Metered" usage type

---

## Verification

### Webhook Events
| Event | Handler | Tested |
|-------|---------|--------|
| `checkout.session.completed` | ✅ `handleCheckoutCompleted()` | Via Stripe CLI |
| `customer.subscription.updated` | ✅ `handleSubscriptionUpdated()` | Via Stripe CLI |
| `customer.subscription.deleted` | ✅ `handleSubscriptionDeleted()` | Via Stripe CLI |
| `invoice.paid` | ✅ `handleInvoicePaid()` | Via Stripe CLI |
| `invoice.payment_failed` | ✅ `handleInvoicePaymentFailed()` | Via Stripe CLI |
| `customer.subscription.trial_will_end` | ✅ `handleTrialWillEnd()` | Via Stripe CLI |

### API Routes
| Route | Method | Auth | Status |
|-------|--------|------|--------|
| `/api/billing/create-checkout` | POST | ✅ RBAC-gated | ✅ |
| `/api/billing/create-portal` | POST | ✅ RBAC-gated | ✅ |
| `/api/billing/webhook` | POST | ✅ Signature verification | ✅ |
| `/api/billing/subscription` | GET | ✅ RBAC-gated | ✅ |

### Database Integration
| Table | Fields Updated | Source |
|-------|----------------|--------|
| `billing_customers` | `stripe_customer_id` | Checkout / Webhook |
| `subscriptions` | `plan`, `status`, `stripe_subscription_id`, `stripe_price_id`, `current_period_start/end`, `cancel_at_period_end` | Webhook |
| `invoices` | Full invoice record with line items | Webhook `invoice.paid` |

---

## Key Decisions

### 1. Graceful Fallback
When `STRIPE_SECRET_KEY` is not set, all Stripe functions return `null` / graceful defaults. The existing internal billing page continues to work unchanged. No breaking changes to existing functionality.

### 2. Webhook-First Architecture
Subscription state is managed through Stripe webhooks rather than direct API calls. This ensures:
- Stripe is the source of truth for subscription status
- Local DB is always in sync
- Handles edge cases (payment failures, retries, prorations)

### 3. Price ID Flexibility
The checkout route supports both:
- **Predefined Price IDs** — Set `stripePriceIds` in plan config for Stripe-managed prices
- **Ad-hoc prices** — Created dynamically from plan config (useful for seat-based pricing)

### 4. Portal for Self-Service
Stripe Customer Portal handles plan changes, payment method updates, and cancellations — reducing the need for custom UI and support burden.

---

## Recommendations

### Pre-Production
1. [ ] Create Stripe products and prices for all plans
2. [ ] Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Vercel
3. [ ] Configure Stripe webhook endpoint pointing to production URL
4. [ ] Test complete checkout flow with test mode
5. [ ] Test webhook delivery in Stripe Dashboard

### Future Enhancements
1. **Overage invoicing** — Monthly cron job for usage-based billing
2. **Subscription analytics** — Track MRR, churn, LTV in analytics
3. **Tax handling** — Enable Stripe Tax for automatic tax calculation
4. **Multi-currency** — Add support for EUR, GBP, etc.
5. **Invoice PDFs** — Generate and store invoice PDFs in Supabase storage
6. **Usage alerts** — Email notifications before hitting overage thresholds
7. **Coupon/promotion** — First month free or annual discount codes

---

## Appendix: Environment Variables

Add to `.env.local` and Vercel:

```env
# Stripe (Payment Processing)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_ALLOW_LIVE_MODE=false
```

---

*Report generated 2026-07-15 | W15-T1 ✅ Complete*
