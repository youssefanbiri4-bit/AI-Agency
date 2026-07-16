# Wave 8, Task 5: Mobile Bottom Navigation

**Date:** 2026-07-13

**Goal:** Add a mobile bottom navigation bar for the internal HQ so primary destinations are one tap away (sidebar remains full menu).

---

## Changes Made

### New file: `src/components/ui/MobileBottomNav.tsx`

A fixed bottom navigation bar with 5 slots:

| Slot | Label | Icon | Route |
|------|-------|------|-------|
| 1 | Dashboard | Home | `/dashboard` |
| 2 | Tasks | FileText | `/dashboard/tasks` |
| 3 | Content | PenSquare | `/dashboard/content-studio` |
| 4 | Reports | BarChart3 | `/dashboard/reports` |
| 5 | More | Menu | → opens sidebar drawer |

**Behavior:**
- `lg:hidden` — only visible on screens smaller than `lg` (1024px)
- Active state determined by `usePathname()` (exact match for `/dashboard`, prefix match for others)
- `focus-visible:ring-2 focus-visible:ring-[#F7CBCA]/50` on all items
- "More" button calls `onMoreClick()` which toggles `isMobileMenuOpen` in DashboardShell → opens the existing sidebar drawer with full nav
- Backdrop blur and surface/glass styling consistent with Topbar theme

### Modified file: `src/components/layout/DashboardShell.tsx`

1. **Imported `MobileBottomNav`** from `@/components/ui/MobileBottomNav`
2. **Rendered `MobileBottomNav`** after the main content wrapper, with `onMoreClick={() => setIsMobileMenuOpen(...)}`
3. **Adjusted padding** on `<main>`:
   - Mobile: `pb-20` (80px) — content won't be hidden behind the fixed bottom bar
   - Desktop: `lg:pb-12` (48px) — restores original padding

### Desktop unchanged

- Sidebar remains `w-60` with `lg:ps-60` offset in DashboardShell
- Bottom nav is `lg:hidden` — invisible on desktop
- No changes to Topbar, CommandPalette, or any other component
- No routes, groups, or features removed

---

## Gates

| Gate | Status |
|------|:------:|
| `npm run typecheck` | **PASS** — 0 errors |
| `npx eslint` on changed files | **PASS** — 0 errors, 0 warnings |
| `npm test` | **PASS** — 203/203 pass (30 files) |

## Files Affected

| File | Change |
|------|--------|
| `src/components/ui/MobileBottomNav.tsx` | **New** — 64 lines, bottom nav with 5 slots |
| `src/components/layout/DashboardShell.tsx` | Import + render MobileBottomNav, `pb-20` mobile padding |

## Manual Checklist

- [x] Bottom nav visible only on mobile (`lg:hidden`)
- [x] 5 primary items: Dashboard, Tasks, Content, Reports, More
- [x] Active state by pathname (exact + prefix matching)
- [x] Safe area padding (`pb-20` on main content) so content not hidden
- [x] Desktop sidebar unchanged
- [x] Cmd+K shortcut untouched (CommandPalette integration unchanged)
- [x] All nav items are `<Link>` components with proper routing
- [x] All interactive items have `focus-visible:ring`
- [x] "More" opens existing sidebar drawer (reuses `isMobileMenuOpen` state)
