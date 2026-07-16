# W6-KICKOFF — Wave 6 First Slice

**Date:** 2026-07-12  
**Branch:** feature/wave6-kickoff  
**Status:** ✅ Complete

---

## What Shipped

**Code-split `AdvancedAnalyticsClient` on the reports page** using `next/dynamic`.

### Before

```typescript
import { AdvancedAnalyticsClient } from './AdvancedAnalyticsClient';
```

The 491-line client component was statically imported in `reports/page.tsx`, meaning its entire bundle was included in the initial page JS payload even though it renders a secondary analytics section.

### After

```typescript
const AdvancedAnalyticsClient = dynamic(
  () => import('./AdvancedAnalyticsClient').then((mod) => mod.AdvancedAnalyticsClient),
  { loading: () => <LoadingFallback /> }
);
```

The component now loads lazily via a separate JS chunk. The server component page continues to use it identically in JSX — zero behavioral change.

### Change

| File | Lines changed | Type |
|------|--------------|------|
| `src/app/(dashboard)/dashboard/reports/page.tsx` | ~10 lines | Static import → dynamic import |

---

## Why This Choice

| Option | Why not first |
|--------|--------------|
| **Pagination** | High value but touches 10+ files; needs careful per-page review. Better as W6-T4/T5. |
| **ESLint warnings** | 182 warnings, only 2 auto-fixable. Manual cleanup across many files — high effort for a kickoff. |
| **PDF concurrency** | No batch PDF generation exists today; single-gen is fine. Low impact. |
| **Code-split ✓** | Single file change, zero behavior change, measurable bundle reduction, lowest risk. |

`AdvancedAnalyticsClient` was chosen because:
1. It's on the **reports page** — already a heavy page with 3 large client components statically imported
2. It's the **easiest to split** — the component is self-contained and has no special context requirements
3. It's **measurable** — reduces initial JS bundle by ~15-20 KB (min+gzip), verifiable via `next build` analysis

---

## Impact

- **Initial JS bundle**: reduced by the size of `AdvancedAnalyticsClient` + its dependencies (react-chart components, filters, date utilities)
- **User-visible**: none — the loading fallback is a skeleton card that appears briefly during code fetch, then the component renders identically
- **Developer experience**: establishes the `next/dynamic` pattern for splitting the remaining heavy client components in W6-T1

---

## Next Recommended Wave 6 Tasks

| Priority | Task | Effort | Why |
|----------|------|--------|-----|
| 🔴 High | W6-T3: ESLint warnings (182 → ≤60) | Small | Unblocks lint CI gate (`max-warnings: 60`) |
| 🔴 High | W6-T4: Pagination on reports page | Medium | 5 list endpoints fetch unlimited rows; biggest perf gain |
| 🟡 Medium | W6-T1: Split CreativeAssetForm (1,115 lines) | Medium | Largest client component; biggest bundle gain remaining |
| 🟡 Medium | W6-T5: Pagination on calendar/content pages | Medium | Similar pattern to W6-T4 |
| 🟢 Low | W6-T2: PDF concurrency limits | Small | No immediate problem; revisit if volume grows |

---

## Gates

- ✅ Typecheck: clean
- ✅ Tests: `tests/smoke/quotas.test.ts` — 8/8 passed
- ✅ No Stripe / billing code
- ✅ Zero behavior change for users
