# W6-T5-PAGINATION-UX — Pagination / Load More for Dashboard Lists

## Summary

Added client-side pagination to 4 dashboard list pages that previously had only hard `.limit()` fetches with no way to browse beyond the first batch. Reports page is excluded — it computes aggregations, not raw lists.

## Scope: pages that got pagination

| Page | Limit | Page size | Max pages | Pagination type |
|---|---|---|---|---|
| `/dashboard/projects` | 200 | 50 | 4 | Client-side (`usePagination` + `PaginationControls`) |
| `/dashboard/releases` | 200 | 50 | 4 | Client-side (`usePagination` + `PaginationControls`) |
| `/dashboard/content-library` | 500 | 50 | 10 | Client-side (`usePagination` + `PaginationControls`) |
| `/dashboard/reels` | 500 | 50 | 10 | Client-side (`usePagination` + `PaginationControls`) |

## How it works

### Reusable infrastructure (shared, 2 files)

- **`src/hooks/usePagination.ts`** — Generic hook. Takes `items: T[]` + `pageSize: number`. Returns `currentPage`, `totalPages`, `pageItems`, `goToPage`, `nextPage`, `prevPage`, `hasNext`, `hasPrev`, `startIndex`, `endIndex`. Clamps page to valid range when filters reduce results.

- **`src/components/ui/PaginationControls.tsx`** — Presentational component. Prev/next buttons (`ChevronLeft`/`ChevronRight`), numbered page buttons with active highlight (`bg-[#F7CBCA]`), ellipsis gaps for large page counts, and "startIndex–endIndex of totalItems" label. Only renders when `totalPages > 1`. Hover/focus/disabled states match the Button component design system.

### Per-page integration

| Page | Change |
|---|---|
| **Projects** (`ProjectsClient.tsx`) | Import `usePagination` + `PaginationControls`. Wrap grid in a `<div>`, use `pageItems` instead of `filteredProjects`. Controls at bottom. Card-header counter shows "X projects" or "Showing X of Y" when filtered. |
| **Releases** (`ReleasesClient.tsx`) | Same pattern as Projects. |
| **Content Library** | New `PaginatedContentLibraryTable.tsx` client component. Server page passes `items` (filtered array) instead of rendering the table inline. Removed unused imports. |
| **Reels** | New `PaginatedReelsList.tsx` client component. Server page maps reel data to props. Removed inline `ReelItem` + `Badge` dependencies from page. |

### Interaction with existing hard limits

- The hard server-side limits (200 / 500) remain unchanged — they guard the DB query.
- Pagination is purely client-side on the already-fetched array.
- When filters narrow results below the page size, pagination controls disappear automatically (`totalPages <= 1`).
- Filters reset the page to 1 automatically (new array resets `useState(1)`).
- Empty states show correctly whether the full fetch returned 0 items or filters narrowed to 0.

### Pages intentionally NOT paginated

| Page | Reason |
|---|---|
| `/dashboard/reports` | Uses data for summaries, metrics, charts — not raw lists. Limits (2000) are sufficient. |
| `/dashboard/calendar` | Date-navigated calendar view; pagination doesn't fit the UX. |
| `/dashboard/recovery` | Shows all issues/blockers; filtering by category is the right UX, not pagination. |

## Files changed

```
M  src/hooks/usePagination.ts                    (new)
M  src/components/ui/PaginationControls.tsx       (new)
M  src/app/(dashboard)/dashboard/projects/ProjectsClient.tsx
M  src/app/(dashboard)/dashboard/releases/ReleasesClient.tsx
M  src/app/(dashboard)/dashboard/content-library/page.tsx
M  src/app/(dashboard)/dashboard/content-library/PaginatedContentLibraryTable.tsx (new)
M  src/app/(dashboard)/dashboard/reels/page.tsx
M  src/app/(dashboard)/dashboard/reels/PaginatedReelsList.tsx     (new)
```

## Verification

- `npm run typecheck` — passes (0 errors)
- Existing hard server limits preserved
- Empty states correct for both 0-fetch and 0-after-filter
- Filters + sorting continue to work (client-side state, pagination slices after filtering)
