# W7-T6-OPS-USAGE-POLISH

**Status:** Done  
**Branch:** `feature/wave7-ops-usage-polish`  
**Owner:** Agent 2  

## Summary

Polished internal language and clarity across the OpsCard and Usage surfaces. All copy changes are internal/HQ wording — no commercial billing language. Stripe/redesign/feature removal forbidden and untouched.

## Changes

### 1. OpsCard — `src/app/(dashboard)/dashboard/components.tsx:589-590`

| Before | After |
|--------|-------|
| `title="Ops"` | `title="Internal Ops"` |
| `description="Quick daily ops — usage, health, and notifications."` | `description="Quick-access panel for workspace usage, system health, and team notifications."` |

### 2. Usage page — `src/app/(dashboard)/dashboard/usage/page.tsx`

| Location | Before | After |
|----------|--------|-------|
| PageHeader title | `"Usage & Quotas"` | `"Usage & Limits"` (matches nav label) |
| PageHeader description | `"Monitor your workspace consumption. Hard limits will block operations when reached."` | `"Track monthly consumption per feature. Hard limits (set by admins) block new operations when exceeded — admins can adjust limits below."` |
| 80% alert | `"Near limit — contact your admin"` | `"80% used — nearing the limit. Ask an admin to raise the cap."` (only shown 80-94%) |
| 95% alert | `"Limit reached — actions may be blocked"` | `"95% used — nearly at the hard limit. New operations will be blocked."` |
| Spend card description | `"OpenAI + n8n estimated costs (last 30 days)"` | `"Estimated AI provider and automation costs (last 30 days)"` |
| Non-admin footer | Plain `<div>` with raw text | Styled `.rounded-xl` notice box explaining who sets limits |

### 3. TeamUsageSection — `src/app/(dashboard)/dashboard/usage/TeamUsageSection.tsx:130`

| Before | After |
|--------|-------|
| `"Monthly consumption attributed to each workspace member."` | `"Per-member usage tracked from workspace events this month."` |

### 4. UsageHistorySection — `src/app/(dashboard)/dashboard/usage/UsageHistorySection.tsx:36`

| Before | After |
|--------|-------|
| `"Daily totals for each quota type. Bars are relative to the daily max in each column."` | `"Daily totals per quota type. Bar widths are relative to each column's daily max."` |

### 5. i18n — `src/i18n/locales/en.json` + `ar.json`

Added new `dashboard.internalOps`, `dashboard.opsDescription`, and a complete `usage` section with keys for all page strings (title, description, alerts, notices, spend card, team usage, history). Arabic translations provided for all new keys.

## Files Modified

| File | Change |
|------|--------|
| `src/app/(dashboard)/dashboard/components.tsx` | OpsCard title + description |
| `src/app/(dashboard)/dashboard/usage/page.tsx` | PageHeader, alerts, spend card, non-admin footer |
| `src/app/(dashboard)/dashboard/usage/TeamUsageSection.tsx` | Card description |
| `src/app/(dashboard)/dashboard/usage/UsageHistorySection.tsx` | Card description |
| `src/i18n/locales/en.json` | Added `dashboard.internalOps`, `dashboard.opsDescription`, `usage.*` keys |
| `src/i18n/locales/ar.json` | Arabic translations for all new keys |

## Gates

| Gate | Result |
|------|--------|
| `npm run typecheck` | Passed (0 errors) |
| `npm run lint` | Passed (0 errors, 17 pre-existing warnings) |

## Success Criteria

- [x] Clearer internal copy on Ops + Usage
- [x] Gates green
- [x] Report written
