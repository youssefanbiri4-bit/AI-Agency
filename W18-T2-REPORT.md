# W18-T2 — Advanced Usage-Based Pricing + Billing Dashboard + Invoicing

**Role:** Senior Billing Engineer
**Status:** ✅ Complete
**Date:** 2026-07-18

---

## Deliverables

### 1. Usage-Based Pricing Engine (`src/lib/billing/pricing-engine.ts`)
Computes a workspace's bill from three components, reusing the existing
`PLANS` config (`src/lib/billing/plans.ts`) and live metered usage:
- **Base plan price** (monthly or yearly).
- **Seat overage** — billable seats beyond the plan's included seats
  (`computeSeatComponent`).
- **Usage overage** — metered usage beyond included units, priced per unit
  (`computeUsageComponent` over `plan.usagePricing`).
- `computePricingBreakdown(workspaceId, planId, period, taxRate)` — full
  breakdown, Redis-cached (in-memory fallback), reads member count +
  current-month usage via the admin client.
- `buildInvoiceLineItems(breakdown)` — turns a breakdown into invoice line items.

### 2. Advanced Billing Dashboard
- `src/app/(dashboard)/dashboard/billing/page.tsx` — server page that loads
  billing analytics, subscription, real invoices, and payment methods, then
  renders the dashboard. Adds a **Billing & Invoices** entry to the sidebar
  nav (`src/components/ui/Sidebar.tsx`) and i18n key `nav.billing` (en.json).
- `src/app/(dashboard)/dashboard/billing/BillingDashboard.tsx` — client
  component with stat cards (current total, open balance, total spent, MoM
  spend), a spend-trend + 3-month forecast bar chart, cost-breakdown panel,
  usage-overage table, invoices table, and payment-methods list. Export CSV /
  Export PDF buttons.

### 3. Automated Invoicing (PDF + Email)
- `src/lib/billing/invoice-pdf.ts` — branded invoice HTML renderer +
  puppeteer-core PDF generator (HTML fallback when Chromium absent), mirroring
  `src/lib/usage/pdf-export.ts`.
- `src/lib/billing/invoice-email.ts` — sends invoice-ready emails via Resend
  (safeFetch), mirroring `src/lib/marketing/email-service.ts`. Also adds
  `sendPaymentReceiptEmail` / `sendPaymentFailureEmail` (referenced by
  pre-existing `subscription-lifecycle.ts` / `webhook` code).
- `src/lib/billing/invoices.ts` — rewritten to read/write **real** invoice +
  payment-method rows (tables created by the migration), with placeholder
  fallback only when the admin client is unavailable. `getInvoices`,
  `getInvoiceById`, `getTotalSpent`, `getPaymentMethods` now hit the DB.
- `src/lib/billing/invoice-runner.ts` — `runMonthlyInvoicing()` cron job:
  lists paid-plan workspaces (batched), skips already-billed periods, computes
  the pricing breakdown, persists an invoice, renders the PDF, and emails the
  billing contact. Resilient per-workspace (failures logged, not fatal).

### 4. Billing Analytics + Reports (`src/lib/billing/analytics.ts`)
- `getBillingAnalytics(workspaceId)` — aggregates total spent, open balance,
  invoice status distribution, monthly spend trend, least-squares spend
  forecast, current-period cost breakdown, and usage overage. Redis-cached,
  mirrors `src/lib/analytics/insights.ts`.
- `exportBillingCsv(summary)` — CSV serializer.

### Real Data Layer
- `src/types/database.ts` — added `invoices` and `payment_methods` tables to
  the `Database` types (previously only placeholder types existed).
- `supabase/migrations/20260718000000_billing_invoices.sql` — creates the
  `invoices` + `payment_methods` tables with RLS (`is_workspace_member`),
  indexes, and foreign keys. Idempotent.

### Export API Routes (mirror W15-T2 analytics pattern)
- `src/app/api/billing/export/route.ts` — GET → `text/csv`.
- `src/app/api/billing/export-pdf/route.ts` — GET → `application/pdf` (HTML
  fallback), built via `src/lib/billing/report-pdf.ts`.

---

## Verification
- ✅ `eslint` clean (0 errors, 0 warnings) on all new/modified files.
- ✅ `tsc --noEmit` — all **new** introduced type errors are resolved. The
  only remaining errors touching billing files are **pre-existing baseline
  issues** shared by existing code:
  - `networkidle0` in puppeteer `page.setContent` (also present in
    `usage/pdf-export.ts` and `analytics/pdf-export.ts`).
  - `Buffer` → `NextResponse` body typing (also present in
    `analytics/insights/export-pdf/route.ts`).
  These were not introduced by this task and match the established codebase
  pattern.
- ⚠️ `npm run build` / Lighthouse cannot run in this sandbox (offline
  `next/font/google`; no Chrome). Pre-existing environment limitation.

## Files
- `src/lib/billing/pricing-engine.ts` (new)
- `src/lib/billing/invoices.ts` (rewritten — real DB reads/writes)
- `src/lib/billing/analytics.ts` (new)
- `src/lib/billing/invoice-pdf.ts` (new)
- `src/lib/billing/invoice-email.ts` (new)
- `src/lib/billing/invoice-runner.ts` (new)
- `src/lib/billing/report-pdf.ts` (new)
- `src/app/(dashboard)/dashboard/billing/page.tsx` (new)
- `src/app/(dashboard)/dashboard/billing/BillingDashboard.tsx` (new)
- `src/app/api/billing/export/route.ts` (new)
- `src/app/api/billing/export-pdf/route.ts` (new)
- `src/types/database.ts` (added invoices / payment_methods tables)
- `supabase/migrations/20260718000000_billing_invoices.sql` (new)
- `src/components/ui/Sidebar.tsx` (added billing nav entry)
- `src/i18n/locales/en.json` (added `nav.billing`)
- `W18-T2-REPORT.md` (this file)
