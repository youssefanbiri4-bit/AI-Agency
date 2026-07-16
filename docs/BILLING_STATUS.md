# BILLING STATUS — AgentFlow-AI

**Last Updated:** 2026-07-12 (Wave 5 Complete — Internal Platform Closed)
**Decision:** **Billing is Disabled — Internal Platform Only**
**Platform Purpose:** Internal HQ for the owner + team. Not a commercial SaaS product.

---

## Decision

**AgentFlow-AI is an internal operating platform — not a commercial SaaS product.**

There is no Stripe integration, no plan-based monetization, and no intention to charge for access. The platform exists to serve the owner and team as a command centre for AI agent operations, task management, reporting, and workflow orchestration.

### Rationale

1. **Internal tool, not a product.** The platform is the team's operational backbone — not something being sold to external users.

2. **Usage tracking is for internal operational limits only.** `usage-limits.ts` and `quotas.ts` exist to prevent resource exhaustion and ensure fair use among team members. They are not billing-enforcement mechanisms. They protect the platform from runaway costs (OpenAI API, n8n execution, storage).

3. **Stripe has been fully removed (Wave 5).** All Stripe routes, client code, npm package, and env vars were deleted. The `billing_customers` and `subscriptions` tables remain in the schema but are not wired to any payment flow. The `subscriptions` table rows all default to `free` plan.

4. **No commercial roadmap.** The project has no revenue targets, no customer acquisition funnel, and no Stripe integration on the horizon.

---

## What Exists (Active Internal System)

### Database Tables (4 tables, kept as-is)

| Table | Purpose | Status |
|-------|---------|--------|
| `billing_customers` | Maps workspace → (formerly) Stripe customer | Schema only, no data |
| `subscriptions` | Tracks plan, status, period dates | All rows default `free` |
| `usage_limits` | Per-workspace quota caps | Populated by seed defaults |
| `usage_events` | Audit log of quota-consuming actions | Used by usage-limits.ts |

### Server-Side Usage Logic (Active — internal operational limits)

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| `src/lib/usage/usage-limits.ts` | Plan defaults, counter sync, event recording | 362 | Active — internal resource governance |
| `src/lib/usage/quotas.ts` | Multi-source quota checking, usage retrieval | 298 | Active — internal resource governance |
| `src/lib/usage/cost-tracking.ts` | OpenAI/n8n cost estimation | 161 | Log-only — cost awareness, not billing |
| `src/lib/usage/quota-alerts.ts` | 80%/95% threshold alerts | ~80 | Active — notification system |
| `src/app/(dashboard)/dashboard/settings/actions/limits.ts` | Admin limit CRUD | ~150 | Active — owner/admin only |

### UI Pages (Active — internal usage visibility)

| Route | Purpose | Status |
|-------|---------|--------|
| `/dashboard/usage` | Full usage dashboard with quota cards and cost tracking | **Active** — accessible from sidebar |
| `/dashboard/settings/billing` | Internal Usage & Limits summary | **Active** — shows plan, quotas, limits |
| `/dashboard/settings` (Usage & Limits section) | Settings page summary card | **Active** — links to full usage page |

### Sidebar Navigation

The sidebar includes "Usage & Limits" linking to `/dashboard/usage`.

### Admin Limit Adjustment

Owner or admin can modify per-workspace quota caps via server actions:
- `getEditableLimitsAction` — returns current limits with override status
- `updateWorkspaceLimitsAction` — sets per-type caps (validated: max 10,000 most / 1,000 reels)
- `resetWorkspaceLimitsAction` — clears overrides, reverts to plan defaults

Override chain: override > DB column > PLAN_LIMITS default > hardcoded fallback.

---

## What Was Removed (Wave 5)

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/stripe-server.ts` | Lazy-init Stripe client | **Deleted** |
| `src/lib/billing/plans.ts` | Plan definitions, price ID lookup | **Deleted** |
| `src/lib/data/billing.ts` | CRUD for billing tables | **Deleted** |
| `src/app/api/billing/checkout/route.ts` | Create Stripe Checkout session | **Deleted** |
| `src/app/api/billing/webhook/route.ts` | Stripe event handler | **Deleted** |
| `src/app/api/billing/portal/route.ts` | Stripe Customer Portal session | **Deleted** |
| `stripe` npm package | Stripe SDK | **Removed from package.json** |

### Environment Variables

Stripe env vars have been removed from `.env.example`. Only `APP_BASE_URL` was kept.

---

## How to Think About "Billing" Going Forward

The platform does not need a Stripe or commercial billing system. Instead, focus on **internal operational governance**:

| Concept | Internal Platform Equivalent |
|---------|------------------------------|
| Paid plans | N/A — every user is a team member |
| Stripe checkout | N/A |
| Subscription management | N/A |
| Usage-based billing | N/A |
| Quota enforcement | Internal resource limits (AI gens, creative assets, tasks, etc.) |
| Cost tracking | Cost awareness for the owner (log-only, no enforcement) |
| Plan upgrades | N/A |
| Admin limit adjustment | Owner/admin can modify per-workspace caps |

---

## Team Usage & Limits

The team can view and monitor usage through:

1. **Sidebar "Usage & Limits"** — Quick access to the full usage dashboard
2. **Settings "Usage & Limits" section** — Summary card with link to full dashboard
3. **Full Usage Dashboard** (`/dashboard/usage`) — Detailed quota cards with progress bars

### Current Internal Free Tier Limits

| Resource | Limit | Reset |
|----------|-------|-------|
| AI Generations | 20/month | Monthly |
| Creative Assets | 50 cumulative | Never |
| Content Items | 30 cumulative | Never |
| Tasks | 40 cumulative | Never |
| Reel Publishes | 10/month | Monthly |

---

## Recommendation

**Do not build Stripe billing.** The platform is an internal operating tool for the owner and team. Commercial billing would add complexity (PCI compliance, tax handling, refunds, customer support) with zero benefit.

If the platform ever transitions to a commercial product (not currently planned), the schema and types provide a starting point — but a full rebuild would be more appropriate at that time.

**Priority:** N/A (not a priority — not on the roadmap)

**Ambiguity level:** None. The platform is internal. Billing is not happening.
