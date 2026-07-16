# W6-T7-CODE-SPLIT-3 — Code-split remaining heavy client components

## Summary

Code-split **3 of 5** target client components using `next/dynamic` with `LoadingState` fallbacks. The 4th was already split, and the 5th was deferred as lower-impact.

## What was split

| Component | Lines | Pages saved | Parent page | Change |
|---|---|---|---|---|
| **`ContentStudioClient`** | 618 | `content-studio/page.tsx` (339 lines) | Server component | Replaced static `import` with `dynamic()` + `LoadingState` |
| **`SoftwarePlannerClient`** | 600 | `software-planner/page.tsx` (67 lines) | Server component | Replaced static `import` with `dynamic()` + `LoadingState` |
| **`NotificationsCenterClient`** | 578 | `notifications/page.tsx` (97 lines) | Server component | Replaced static `import` with `dynamic()` + `LoadingState` |

**~1,800 lines of client JS** moved out of the initial server bundles.

## What was already split

| Component | Lines | Status |
|---|---|---|
| **`CodebaseAnalyzer`** | 546 | Already `dynamic()` in `projects/[id]/page.tsx` — no action needed |

## What was skipped and why

| Component | Lines | Reason |
|---|---|---|
| **`CampaignPlanner`** | 628 | Imported inside `ContentStudioClient` (another client component), not at the page level. Splitting inside a client component requires conditional rendering for benefit; without it, `ContentStudioClient` is loaded eagerly anyway. Documented for future conditional-render optimization. |

## Pattern used

All 3 splits follow the same established pattern (matching `CodebaseAnalyzer` and `AdvancedAnalyticsClient`):

```tsx
import dynamic from 'next/dynamic';
import { LoadingState } from '@/components/ui/LoadingState';

const Component = dynamic(
  () => import('./Component').then((mod) => mod.Component),
  {
    loading: () => (
      <LoadingState title="..." description="..." />
    ),
  }
);
```

Each parent was already a server component importing a `'use client'` component — no architectural changes needed.

## Files changed

```
M  src/app/(dashboard)/dashboard/content-studio/page.tsx
M  src/app/(dashboard)/dashboard/software-planner/page.tsx
M  src/app/(dashboard)/dashboard/notifications/page.tsx
```

## Remaining heavy clients (for future consideration)

| Component | Lines | Path | Note |
|---|---|---|---|
| `CampaignPlanner` | 628 | `content-studio/CampaignPlanner.tsx` | Inside `ContentStudioClient`, only worth splitting if behind a conditional |
| `CampaignsPage` (page itself) | ~786 | `campaigns/page.tsx` | Server component with heavy inline rendering, not a client import |
| `RecoveryPage` (page itself) | ~663 | `recovery/page.tsx` | Same — inline server rendering |

## Verification

- `npm run typecheck` — 0 errors
- `npx vitest run` — 30 files, 203 tests, all passed
- Zero behavior change — same named exports, same props, same rendering
