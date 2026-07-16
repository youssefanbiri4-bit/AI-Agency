# TECHNICAL DEBT — AgentFlow-AI

**Last Updated:** 2026-07-13 (Wave 8 Complete — Accessibility + Nav IA + Design Tokens)

---

## Active Debt

| Item | Details | Effort | Impact |
|------|---------|--------|--------|
| God component: reports/page.tsx | 619 lines — could be reduced further | Medium | Maintainability |
| Spanish i18n incomplete | Some UI strings not translated | Small | i18n |
| Documentation sprawl at root level | Audit markdown files in project root | Small | DX |
| A11y debt: partial WCAG AA coverage | Non-core pages not fully audited; focus order not verified on every page; color-only indicators exist in a few places | Medium | Accessibility |

---

## Resolved

| Item | Wave | Resolution |
|------|------|------------|
| Flat 32-item sidebar with no grouping | Wave 8 | Restructured into 7 collapsible groups with localStorage persistence, width reduced 288→240px |
| Pre-WCAG color contrast (10-20% compliant) | Wave 8 | Design token system brings 90%+ WCAG AA compliance, 6 components migrated |
| No skip-to-content link | Wave 8 | Added as first tabbable element targeting `#main-content` |
| No focus-visible ring system | Wave 8 | Consistent `focus-visible:ring-2` across all interactive elements |
| Missing aria-labels on icon buttons | Wave 8 | All icon-only buttons properly labeled |
| Content Studio notices stacked (4 independent) | Wave 8 | Consolidated into single collapsible accordion |
| No mobile sidebar close button | Wave 8 | Visible X button on mobile overlay |
| Small touch targets on key controls | Wave 8 | Sidebar links bumped to ~38px hit area |
| Sidebar not fully merged across agents | Wave 8 | Merge verify completed: single component, all 5 behaviors, focus rings fixed |
| No mobile bottom navigation | Wave 8 | 5-slot MobileBottomNav with More → sidebar drawer |
| Pre-existing type/lint errors in CommandPalette | Wave 8 | Fixed KeyboardEvent type conflict + set-state-in-effect lint error |
| No per-member usage attribution | Wave 7 | Added userId coverage across usage counters and quota tracking |
| Ops Dashboard lacked polish | Wave 7 | Refined layout, loading states, empty states, responsive spacing |
| No usage history view | Wave 7 | Added 7-day and 30-day daily totals with chart-friendly data shape |
| Team Usage page lacked polish | Wave 7 | Refined team usage table, filters, sorting, empty states |
| No audit trail for limit changes | Wave 7 | Added admin audit UI showing who changed what limit and when |
| Ops/Usage copy inconsistent | Wave 7 | Standardized copy across usage, limits, quota, and ops pages |
| 165 ESLint warnings (unused vars/imports) | Wave 6 | Eliminated all warnings across 41 files (165→0) |
| No code-splitting on heavy clients | Wave 6 | Split AdvancedAnalyticsClient, CreativeAssetForm (1,115 lines), MonthlyAgencyReportClient (757 lines) via `next/dynamic` |
| No pagination on heavy list pages | Wave 6 | Added client-side pagination (prev/next, numbered pages) to projects, releases, content-library, reels |
| PDF generation unbounded concurrency | Wave 6 | Global semaphore caps concurrent PDF jobs at 2 |
| Stripe billing (6 files, npm package) | Wave 5 | Deleted — internal platform, no billing needed |
| Billing UI confusion | Wave 5 | Replaced with "Usage & Limits" (sidebar, settings, full page) |
| No quota alerts | Wave 5 | Added 80% warning / 95% critical thresholds with 1-hour debounce |
| No admin limit adjustment | Wave 5 | Added server actions with RBAC (owner/admin only) |
| NotificationType missing quota alerts | Wave 5 | Added `quota_warning`, `quota_critical` to enum |
| user-preferences test (5 failures) | Wave 4 | Test expectation corrected, all 6 tests pass |
| 3 test failures (2 test files) | Wave 4 | execute-route timeout fixed, brute-force auth mocks corrected |
| AdvancedAnalyticsClient (1,316 lines) | Wave 4 | Split into 491 lines (63% reduction) |
| 47 typecheck errors | Wave 3 | Rate-limit exports fixed, RBAC types resolved |
| 3 ESLint errors | Wave 3 | setState-in-effect fixed, any type removed |
| workspace-permissions.ts | Wave 3 | RBAC migration completed, file deleted |
| 6 COUNT(*) quota queries | Wave 3 | usage_counters table + DB triggers |
| ContentStudioClient.tsx (2,734 lines) | Wave 3 | Split into 669 lines + 11 components + 5 hooks |
| settings/actions.ts (2,331 lines) | Wave 3 | Split into 9 modules |
| dashboard/page.tsx (1,218 lines) | Wave 3 | Split into 380 lines + utils + components |
| content-studio/actions.ts (2,477 lines) | Wave 3 | Split into 6 modules |
| Secret hygiene | Wave 2 | .env.example clean, .gitignore hardened |
| CSP directives | Wave 2 | report-uri/report-to removed |
| API error envelope | Wave 2 | Standardized across 7+ routes |
| Dual n8n callback | Wave 2 | Deprecated wrapper |
| Health endpoint disclosure | Wave 2 | Two-tier auth gate |
| Billing ambiguity | Wave 2 | Documented in BILLING_STATUS.md |
| Dual RBAC | Wave 2 | Documented, then migrated in Wave 3 |

---

## Decision

**Stripe and all external billing infrastructure have been removed.** The platform uses an internal quota system only.

### What Exists

| Component | Purpose | Status |
|-----------|---------|--------|
| `usage-limits.ts` | Plan defaults, counter sync, event recording | ✅ Active |
| `quotas.ts` | Multi-source quota checking with override chain | ✅ Active |
| `cost-tracking.ts` | OpenAI/n8n cost estimation | ✅ Active (log-only) |
| `quota-alerts.ts` | 80%/95% threshold alerts | ✅ Active |
| `limits.ts` (settings actions) | Admin limit CRUD | ✅ Active |
| `billing_customers` table | Maps workspace → (formerly) Stripe customer | Schema only |
| `subscriptions` table | Tracks plan, status, period dates | All rows `free` |
| `usage_limits` table | Per-workspace quota caps | ✅ Active |
| `usage_events` table | Audit log of quota-consuming actions | ✅ Active |
| `stripe` npm package | — | ❌ Removed |
| Stripe API routes | — | ❌ Removed |
| Stripe client code | — | ❌ Removed |

### Recommendation

**Do not reintroduce Stripe billing.** The platform is internal. Quota enforcement is sufficient. If the platform ever transitions to a commercial product (not currently planned), billing should be rebuilt from scratch.

**Priority:** N/A (not on the roadmap)
