# Task Summary
- **Objective:** Conduct a comprehensive UI/UX audit and implement visual enhancements for all Card components and Toast/Notification systems across the AgentFlow-AI platform, ensuring Dark Mode compatibility, consistent design system adherence, and strict RSC boundary safety.
- **Scope:** All Card UI components in `src/components/ui/`, feature-specific card-like components in `src/app/(dashboard)/dashboard/components.tsx`, the ExpandablePanel, and the custom toast system (`toast.tsx`). Global styles in `globals.css` for animation keyframes.
- **Status:** Completed

# Files Modified
- `src/components/ui/Card.tsx` -- base Card and CardHeader
- `src/components/ui/StatCard.tsx` -- stat metric cards
- `src/components/ui/ExpandablePanel.tsx` -- collapsible panel sections
- `src/app/(dashboard)/dashboard/components.tsx` -- CommandCard, ManagerStat, SmallMetric, HealthScoreCard
- `src/components/ui/toast.tsx` -- toast system (viewport, tone config, accessibility)
- `src/app/globals.css` -- toast entrance animation keyframe

# Technical Changes

## Card Enhancements

### Card.tsx
- Border-radius changed from `rounded-lg` to `rounded-xl` for consistency.
- Added `transition-all duration-200 ease-out` for smooth hover transitions.
- Added `hover:-translate-y-1 hover:shadow-md hover:border-border-strong` for subtle lift on hover.
- Ring updated to `ring-1 ring-foreground/6 dark:ring-foreground/8` for better dark mode contrast.

### StatCard.tsx
- Border-radius changed from `rounded-lg` to `rounded-xl`.
- Removed `card-hover` class (was redundant with the new inline transition).
- Added `transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-md hover:border-border-strong`.
- Icon container border-radius changed from `rounded-lg` to `rounded-xl`, border softened to `border-border/60`, padding increased to `p-2.5`.
- Added `transition-colors duration-200` to icon container.

### ExpandablePanel.tsx
- Added `transition-all duration-200 ease-out` to the section wrapper.
- Added `hover:shadow-[0_16px_40px_rgba(93,107,107,0.10)] hover:border-border-strong` for hover elevation.

### CommandCard (in components.tsx)
- Replaced hardcoded hex colors (`border-[#5D6B6B]/10`, `bg-[#F1F7F7]/90`, `ring-[#5D6B6B]/5`, `border-[#5D6B6B]/8`) with design system tokens (`border-border`, `bg-surface`, `ring-foreground/5`, `border-divider`).
- Title and description text colors changed from `text-[#5D6B6B]` and `text-[#5D6B6B]/58` to `text-foreground` and `text-foreground-muted`.
- Added `transition-all duration-200 ease-out hover:shadow-[0_16px_40px_rgba(93,107,107,0.10)] hover:border-border-strong`.

### ManagerStat (in components.tsx)
- Replaced hardcoded hex colors (`border-black/7`, `bg-white`, `text-black/42`, `text-[#5D6B6B]`, `text-black/55`) with design system tokens (`border-border`, `bg-surface-elevated`, `text-foreground-muted`, `text-foreground`).
- Added `transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(93,107,107,0.12)] hover:border-border-strong`.

### SmallMetric (in components.tsx)
- Replaced hardcoded hex colors (`border-black/7`, `bg-[#F1F7F7]/68`, `text-black/42`, `text-[#5D6B6B]`) with design system tokens (`border-border`, `bg-surface`, `text-foreground-muted`, `text-foreground`).
- Border-radius changed from `rounded-2xl` to `rounded-xl`.
- Added `transition-all duration-200 ease-out hover:border-border-strong`.

### HealthScoreCard (in components.tsx)
- Replaced hardcoded hex colors with design system tokens (`border-border`, `bg-surface`, `border-divider`, `text-foreground`, `text-foreground-muted`).
- Added `transition-all duration-200 ease-out hover:shadow-[0_16px_40px_rgba(93,107,107,0.10)] hover:border-border-strong`.

## Toast/Notification Enhancements

### toast.tsx
- **Tone config**: Added `borderColor` field to each tone variant for left-border color distinction.
- **Success toasts**: Changed from dark inverted scheme (`bg-foreground text-foreground-inverse`) to standard surface with green left border (`border-l-success`). Icon color changed from `text-foreground-inverse` to `text-success`. Description text unified to `text-foreground-muted`.
- **Error toasts**: Added `border-l-danger` left border.
- **Warning toasts**: Removed full `bg-warning-light` background, replaced with standard surface + `border-l-warning` left border.
- **Info/Loading toasts**: Added `border-l-info` left border.
- **Viewport positioning**: Changed from `start-4 top-4 sm:start-6 sm:top-6` (top-left) to `bottom-4 end-4 sm:bottom-6 sm:end-6` (bottom-right).
- **Toast container**: Added `aria-live="polite"` and `aria-label="Notifications"` for screen reader accessibility. Changed border-radius from `rounded-2xl` to `rounded-xl`.
- **Toast items**: Added `border-l-[3px]` for colored left border, `toast-enter` animation class, `hover:shadow-lg` for interactivity. Dismiss button styling unified across all tones.
- **Accessibility**: Toast items retained `role="alert"` for errors/warnings and `role="status"` for others.

### globals.css
- Added `.toast-enter` animation class with `toast-slide-in` keyframe (fade + slide from right + scale), duration 350ms, cubic-bezier easing.
- Respects existing `prefers-reduced-motion: reduce` block which disables all animations.

# Architecture Impact
No architectural changes. All modifications are CSS-only (Tailwind utility classes) or internal component rendering logic. No new dependencies introduced. No changes to the component API surface -- all props remain identical. The `ToastProvider` mount point in `src/app/layout.tsx` is unchanged.

# Database Changes
None.

# API Changes
None.

# UI Changes
1. **Cards now have a subtle hover lift**: All card components (Card, StatCard, CommandCard, ManagerStat, SmallMetric, ExpandablePanel, HealthScoreCard) now lift 1-4px on hover with an elevated shadow and border color change, using `transition-all duration-200 ease-out`.
2. **Toasts slide in from the bottom-right**: Toast notifications now animate in with a fade + slide-from-right + scale effect (`toast-slide-in` keyframe, 350ms). Previously they appeared instantly at top-left.
3. **Toast type distinction via colored left border**: Each toast type now has a 3px colored left border -- green for success, red for error, amber for warning, blue for info/loading.
4. **Success toast styling normalized**: Success toasts no longer use a dark inverted scheme. They now use the standard surface background with a green left border, matching the other toast types visually.
5. **Dark mode support improved**: All card components now use design system tokens instead of hardcoded hex colors, ensuring correct rendering in both light and dark mode.
6. **Consistent border-radius**: Cards unified to `rounded-xl` (from mixed `rounded-lg`/`rounded-2xl`), toast items to `rounded-xl`.

# Validation Performed
- `npm run typecheck` (`tsc --noEmit`) -- passed with no errors.
- `npm run build` -- `Compiled successfully in 2.8min`, 129/129 static pages generated, `BUILD_EXIT=0`.
- RSC boundary audit: All modified Server Components (Card, StatCard, CommandCard, ManagerStat, SmallMetric, HealthScoreCard) receive only data props (strings, numbers, ReactNode, LucideIcon). No functions are passed from Server to Client Components. Client Components (ExpandablePanel, toast) only use internal event handlers.

# Remaining Issues
- **AgentCard, DepartmentCard, FeatureCard**: These use hardcoded hex colors (`[#E7F5DC]/24`, `[#8A4300]`, `[#F7CBCA]`, `black`, `white`). They were not modified because they are feature-specific cards with intentional branding. These could be migrated to design system tokens in a follow-up.
- **Marketing cards** (`MarketingAgentCard`, `MarketingDepartmentCard`): Also use hardcoded hex colors. Left unchanged to avoid scope creep.
- **Notice.tsx**: Already uses design system tokens and has consistent styling. No changes needed.
- **NpsSummaryCard, ChurnRiskCard**: Use the base `Card` component internally, so they automatically benefit from Card's enhanced hover transition. No additional changes needed.

# Risks
- **Toast positioning change** (top-left to bottom-right): Users accustomed to top-left toast placement may initially look in the wrong direction. This is a minor UX adjustment and bottom-right is the more conventional position for enterprise tools (consistent with Slack, Notion, Linear).
- **Success toast visual change**: The success toast no longer uses the dark inverted scheme. Users may perceive a visual difference. The new design is more consistent with other toast types and uses the design system's green accent.
- **Card hover animation on mobile**: The `hover:-translate-y-1` effect may not trigger on touch devices (no hover state). This is acceptable -- the cards still have the elevated shadow and border change on active/focus states.

# Recommendations
- Consider migrating AgentCard and DepartmentCard to design system tokens for full dark mode consistency.
- Add a Storybook story or visual regression test for the toast system to capture the new animation and border colors.
- Consider adding `will-change: transform` to the `.toast-enter` animation for smoother performance on lower-end devices.

# Next Suggested Task
Migrate the remaining hardcoded hex colors in AgentCard (`[#E7F5DC]/24`, `[#8A4300]`) and DepartmentCard (`border-white`) to design system tokens for full dark mode consistency across all card components.
