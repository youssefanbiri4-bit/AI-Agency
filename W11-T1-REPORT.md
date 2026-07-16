# W11-T1: Advanced Billing System + Plans Management

**Date:** 2026-07-15  
**Status:** ✅ Complete  
**Branch:** `fix/wave1.2-green-gates`

---

## Task Summary

Built a comprehensive **Advanced Billing System** for AgentFlow-AI, an internal platform. The system includes plan definitions (Free, Pro, Enterprise), seat-based and usage-based billing, a full Billing & Plans management page with upgrade/downgrade flow, integration with existing hard limits enforcement, and invoice/payment history placeholders.

---

## Changes Made

### 1. Type System (`src/types/database.ts`)

| Change | Description |
|--------|-------------|
| `BillingPlan` union | Added `'enterprise'` to the existing plan types |
| New interfaces | `PlanFeature`, `SeatPricing`, `UsagePricing`, `PlanDefinition`, `InvoiceRecord`, `PaymentMethodRecord`, `BillingPeriod`, `InvoiceStatus` |

### 2. Billing Library — Plans (`src/lib/billing/plans.ts`)

**New file.** Complete plan definitions for:
- **Free** — $0/mo, 20 AI generations, 40 tasks, no seat pricing, hard limits
- **Pro** — $49/mo base, seat-based ($10/seat after 5 included), 500 generations, 1000 tasks
- **Enterprise** — $149/mo base, seat-based ($15/seat after 20 included), 5000 generations, 10000 tasks, no hard limits
- **Legacy** — `starter` and `agency` kept for backward compatibility (not shown in upgrade UI)

Key exports: `PLANS`, `ACTIVE_PLANS`, `calculateMonthlyCost()`, `getPlanPricingDescription()`, `hasUnlimitedLimits()`

### 3. Billing Library — Service (`src/lib/billing/billing-service.ts`)

**New file.** Core billing operations:
- `getSubscription()` — Full subscription details with plan, member count, pricing
- `getWorkspacePlan()` — Lightweight plan lookup
- `getMemberCount()` — Count workspace members for seat billing
- `changePlan()` — Secure plan change with **role validation** (owner/admin only), usage limits sync, enforcement cache clear
- `ensureSubscription()` — Create free plan on workspace creation
- `getEstimatedMonthlyCost()` — Cost calculator

### 4. Billing Library — Invoices (`src/lib/billing/invoices.ts`)

**New file.** Invoice and payment history management:
- `getInvoices()` — Returns placeholder invoices (internal platform — no real charges)
- `getTotalSpent()` — Total across paid invoices
- `getPaymentMethods()` — Placeholder payment method
- `generateInvoiceForPlanChange()` — Generates invoice records when plan changes

### 5. Usage Limits (`src/lib/usage/usage-limits.ts`)

| Plan | Generations | Assets | Content | Tasks | Reels |
|------|------------|--------|---------|-------|-------|
| Free | 20 | 50 | 30 | 40 | 10 |
| Starter | 100 | 200 | 100 | 200 | 50 |
| Pro | 500 | 1000 | 500 | 1000 | 200 |
| **Enterprise** | **5000** | **10000** | **5000** | **10000** | **2000** |
| Agency | ∞ | ∞ | ∞ | ∞ | ∞ |

### 6. Billing Page Actions (`src/app/(dashboard)/dashboard/settings/billing/actions.ts`)

**New file.** Server actions:
- `loadBillingPageData()` — Loads subscription, quotas, usage, invoices, payment methods
- `changePlanAction()` — Form action for upgrade/downgrade with role validation
- `clearBillingCacheAction()` — Manual enforcement cache clear (admin tooling)

### 7. Billing & Plans Page (`src/app/(dashboard)/dashboard/settings/billing/page.tsx`)

**Replaced** the old simple usage display page with a full Billing & Plans page containing:

| Section | Description |
|---------|-------------|
| **Current Plan Banner** | Active plan display with member count, seat cost, total monthly |
| **Available Plans** | 3-column plan comparison cards (Free, Pro, Enterprise) |
| **Plan Change Confirmation** | Upgrade/downgrade flow with period selector (monthly/yearly) |
| **Monthly Usage Summary** | Progress bars per quota type with hard limit indicators |
| **Seat-Based Billing** | Seat usage breakdown (included vs extra seats) |
| **Invoices & Payment History** | Invoice list with line items, download buttons, status badges |
| **Payment Methods** | Saved payment methods display |
| **Hard Limits Enforcement** | Per-quota-type limit mode display (hard vs soft) |

The page uses `useActionState` for plan change mutations and auto-reloads data after successful changes.

---

## Verification

| Check | Status |
|-------|--------|
| TypeScript compilation (billing files) | ✅ No errors |
| Plan definitions completeness | ✅ Free, Pro, Enterprise defined |
| Role validation in plan changes | ✅ Owner/Admin only |
| Hard limits integration | ✅ sync + cache clear on plan change |
| Upgrade/downgrade flow | ✅ Confirmation dialog with cost breakdown |

### Pre-existing Errors (not introduced by this task)

These type errors exist in other files and are outside the scope of W11-T1:
- `src/app/(dashboard)/dashboard/tasks/TasksClient.tsx` — `t()` function argument count
- `src/app/api/usage/export-pdf/route.ts` — `Buffer` type mismatch with `NextResponse`
- `src/lib/data/content-studio.ts` — `.catch()` chaining on Supabase query builder
- `src/hooks/useKeyboardShortcuts.ts` — `KeyboardEvent` type in event listener
- `src/components/ui/KeyboardShortcutsHelp.tsx` — `open` prop not in props interface

---

## Architecture

```
src/
├── types/
│   └── database.ts               ← BillingPlan + new billing interfaces
├── lib/
│   ├── billing/
│   │   ├── plans.ts              ← Plan definitions (Free/Pro/Enterprise)
│   │   ├── billing-service.ts    ← Core billing operations + security
│   │   └── invoices.ts           ← Invoice/payment history (placeholder)
│   └── usage/
│       ├── usage-limits.ts       ← Enterprise plan limits added
│       ├── quotas.ts             ← (unchanged — uses BillingPlan type)
│       └── billing-enforcement.ts ← (unchanged — cache clear hooked)
└── app/(dashboard)/dashboard/
    └── settings/
        └── billing/
            ├── actions.ts        ← Server actions (load data, change plan)
            └── page.tsx          ← Full Billing & Plans page UI
```

---

## Next Steps (W11-T2+)

1. Add `invoices` and `payment_methods` tables to the Supabase schema
2. Integrate with real payment provider (when applicable)
3. Add usage-based overage billing (charge for extra usage above plan limits)
4. Add plan change email notifications
5. Add SSO/custom domain to Enterprise plan features
