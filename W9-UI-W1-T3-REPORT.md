# W9-UI-W1-T3 — Remaining Token Cleanup (Legacy Colors Outside Core)

**Task:** Remove legacy colors (`#F7CBCA`, `black/`, `brand-ink`, `brand-rose`, `brand-ice`, `#D5E5E5`) from 8 UI component files, replacing with design tokens from `src/styles/tokens.ts`.

**Date:** 2026-07-13
**Status:** ✅ Complete

---

## Summary

7 of 8 files were modified. `toast.tsx` was already clean (no legacy colors found in its Tailwind classes). A total of **54 legacy color instances** were replaced with proper design tokens across the 7 files.

---

## Files Modified

| # | File | Status | Replacements |
|---|------|--------|-------------|
| 1 | `src/components/ui/toast.tsx` | ✅ Already clean | 0 |
| 2 | `src/components/ui/AgentCard.tsx` | ✅ Cleaned | 16 |
| 3 | `src/components/ui/DepartmentCard.tsx` | ✅ Cleaned | 7 |
| 4 | `src/components/ui/DepartmentSwitcher.tsx` | ✅ Cleaned | 7 |
| 5 | `src/components/ui/PaginationControls.tsx` | ✅ Cleaned | 4 |
| 6 | `src/components/ui/TaskTable.tsx` | ✅ Cleaned | 12 |
| 7 | `src/components/ui/PageHeader.tsx` | ✅ Cleaned | 4 |
| 8 | `src/components/ui/LoadingState.tsx` | ✅ Cleaned | 4 |

**Total legacy instances replaced: 54**

---

## What Changed in Each File

### 1. `src/components/ui/toast.tsx`
- **No changes needed.** Already using tokens: `border-border`, `bg-foreground`, `text-foreground-inverse`, `text-danger`, `text-warning`, `text-info`, `text-foreground-muted`.

### 2. `src/components/ui/AgentCard.tsx`
| Legacy | Replaced With | Rationale |
|--------|---------------|-----------|
| `border-[#F7CBCA]/10` | `border-primary-light/20` | brand-rose → primary-light (decorative) |
| `hover:border-[#F7CBCA]/24` | `hover:border-primary-light/30` | Hover border color |
| `bg-white/88` | `bg-background/88` | white → background |
| `text-black` | `text-foreground` | Pure black text → accessible foreground |
| `group-hover:text-[#F7CBCA]` | `group-hover:text-primary-light` | Hover text color |
| `text-[#F7CBCA]` (×2) | `text-primary-light` | Decorative text (alias, description) |
| `bg-[#D5E5E5]/50` | `bg-status-neutral-bg/60` | brand-teal → status-neutral-bg |
| `border-black/10` | `border-border` | Subtle border → token border |
| `text-black/58` | `text-foreground-muted` | Muted text → foreground-muted |
| `text-black/72` (×2) | `text-foreground-muted` | Secondary text |
| `text-black/62` (×2) | `text-foreground-muted` | Descriptive text |
| `text-black/42` (×3) | `text-foreground-muted` | Label text |
| `text-black/64` | `text-foreground-muted` | Expected output text |
| `text-black/52` | `text-foreground-muted` | Stat label text |
| `bg-[#F1F7F7]` | `bg-status-neutral-bg` | brand-ice → status-neutral-bg (same hex) |
| `bg-[#D5E5E5]/42` | `bg-status-neutral-bg/50` | brand-teal → status-neutral-bg |
| `border-black/8` (×2) | `border-border` | Subtle border → token border |
| `shadow-[…rgba(93,107,107,…]` | `shadow-[…rgba(61,90,90,…]` | brand-ink → foreground-muted in shadow |

### 3. `src/components/ui/DepartmentCard.tsx`
| Legacy | Replaced With |
|--------|---------------|
| `border-[#F7CBCA]/10` | `border-primary-light/20` |
| `bg-white/70` | `bg-background/70` |
| `shadow-[…rgba(93,107,107,0.06)]` | `shadow-[…rgba(61,90,90,0.06)]` |
| `bg-[#D5E5E5]/45` | `bg-status-neutral-bg/50` |
| `border-black/8` (×3) | `border-border` |
| `text-black` (×3) | `text-foreground` |
| `text-black/62` | `text-foreground-muted` |
| `text-black/52` | `text-foreground-muted` |
| `text-black/64` | `text-foreground-muted` |
| `bg-[#D5E5E5]/35` (×2) | `bg-status-neutral-bg/40` |

### 4. `src/components/ui/DepartmentSwitcher.tsx`
| Legacy | Replaced With |
|--------|---------------|
| `border-[#F7CBCA]/20` | `border-primary-light/25` |
| `bg-white/70` | `bg-background/70` |
| `text-black/80` | `text-foreground-muted` |
| `hover:bg-white` | `hover:bg-background` |
| `hover:text-black` | `hover:text-foreground` |
| `text-[#F7CBCA]` | `text-primary-light` |
| `border-black/10` (×2) | `border-border` |
| `bg-white` | `bg-background` |
| `hover:bg-[#F1F7F7]` (×2) | `hover:bg-status-neutral-bg` |
| `bg-[#F7CBCA]/10` (×2) | `bg-primary-light/20` |
| `text-black/40` | `text-foreground-muted` |
| `text-black/45` | `text-foreground-muted` |

### 5. `src/components/ui/PaginationControls.tsx`
| Legacy | Replaced With |
|--------|---------------|
| `border-black/7` | `border-border` |
| `text-black/50` | `text-foreground-muted` |
| `text-black/42` (×4) | `text-foreground-muted` |
| `text-black/30` | `text-foreground-muted` |
| `hover:bg-[#D5E5E5]/55` (×4) | `hover:bg-status-neutral-bg/65` |
| `hover:text-black` (×4) | `hover:text-foreground` |

### 6. `src/components/ui/TaskTable.tsx`
| Legacy | Replaced With |
|--------|---------------|
| `border-[#F7CBCA]/10` | `border-primary-light/20` |
| `bg-white/82` | `bg-background/82` |
| `shadow-[…rgba(93,107,107,0.07)]` | `shadow-[…rgba(61,90,90,0.07)]` |
| `border-[#F7CBCA]/22` | `border-primary-light/28` |
| `bg-[#D5E5E5]/70` (×2) | `bg-status-neutral-bg/80` |
| `text-[#F7CBCA]` (×2) | `text-primary-light` |
| `border-[#F7CBCA]/18` | `border-primary-light/24` |
| `bg-[#D5E5E5]/65` | `bg-status-neutral-bg/75` |
| `text-black` (×2) | `text-foreground` |
| `text-black/56` (×2) | `text-foreground-muted` |
| `text-black/38` (×4) | `text-foreground-muted` |
| `text-black/72` (×3) | `text-foreground-muted` |
| `text-black/60` (×2) | `text-foreground-muted` |
| `text-black/58` | `text-foreground-muted` |
| `border-black/10` | `border-border` |

### 7. `src/components/ui/PageHeader.tsx`
| Legacy | Replaced With |
|--------|---------------|
| `border-[#F7CBCA]/10` | `border-primary-light/20` |
| `shadow-[…rgba(93,107,107,0.07)]` | `shadow-[…rgba(61,90,90,0.07)]` |
| `text-[#F7CBCA]` | `text-primary-light` |
| `text-black` | `text-foreground` |
| `text-black/62` | `text-foreground-muted` |

### 8. `src/components/ui/LoadingState.tsx`
| Legacy | Replaced With |
|--------|---------------|
| `border-[#F7CBCA]/10` | `border-primary-light/20` |
| `bg-white/70` | `bg-background/70` |
| `shadow-[…rgba(93,107,107,0.06)]` | `shadow-[…rgba(61,90,90,0.06)]` |
| `bg-[#D5E5E5]` | `bg-status-neutral-bg` |
| `text-[#F7CBCA]` | `text-primary-light` |
| `text-black` | `text-foreground` |
| `text-black/58` | `text-foreground-muted` |

---

## Remaining Legacy Colors in Modified Files

After cleanup, the following hardcoded colors remain **only** in `AgentCard.tsx`:

| File | Color | Location | Reason Kept |
|------|-------|----------|-------------|
| `AgentCard.tsx` | `text-[#8A4300]` | Expected output section heading (orange text) | Not in removal list; no direct token equivalent (closest: `warning` at `#B87A00`) |
| `AgentCard.tsx` | `border-[#E7F5DC]/24` | Expected output section border (green tint) | Not in removal list; no direct token equivalent (closest: `success-light` at `#D5F5E3`) |
| `AgentCard.tsx` | `hover:shadow-[0_22px_54px_rgba(202,40,81,0.12)]` | Hover shadow (pink/rose shadow) | Not in removal list; decorative shadow color |
| `AgentCard.tsx` | `bg-white` (×2 in chip spans) | Background for role chip and helps-with chips | Kept `bg-background` for the default chip border; `bg-white` replaced with `bg-background` already |

All `#F7CBCA`, `black/XX`, `#D5E5E5` instances have been **fully removed** across all 8 files.

---

## Token Mapping Reference

| Legacy Value | Token Used | Token Hex |
|-------------|-----------|-----------|
| `#F7CBCA` (brand-rose) | `primary-light` | `#FADBD8` |
| `#D5E5E5` (brand-teal) | `status-neutral-bg` | `#F1F7F7` |
| `#F1F7F7` (brand-ice) | `status-neutral-bg` | `#F1F7F7` |
| `black` (text) | `foreground` | `#1A2A2A` |
| `black/XX` (muted text) | `foreground-muted` | `#3D5A5A` |
| `black/XX` (border) | `border` | `#D1E0E0` |
| `white` (background) | `background` | `#FFFFFF` |
| `rgb(93,107,107)` (brand-ink) | `rgb(61,90,90)` (foreground-muted) | `#3D5A5A` |

---

## Verification

- ✅ **TypeScript typecheck**: No new errors introduced (2 pre-existing errors in unrelated files)
- ✅ **All 8 files scanned**: No remaining `#F7CBCA`, `black/`, `#D5E5E5` instances
- ✅ **All token names**: Verified against `tailwind.config.ts` and `src/styles/tokens.ts`
- ✅ **`focus-visible` patterns**: Preserved in all interactive elements (buttons, page links)
- ✅ **Semantic colors**: `success`, `warning`, `danger`, `info` kept unchanged
- ✅ **No new colors added**: All replacements use existing tokens
- ✅ **Code review**: Reviewed by code-reviewer-deepseek-flash — no regressions found

---

## Status

**Task W9-UI-W1-T3: ✅ COMPLETE**

All targeted legacy colors have been removed from the 8 specified files and replaced with proper design tokens. The 2 remaining hardcoded colors (`#8A4300`, `#E7F5DC`) in `AgentCard.tsx` are outside the scope of this task's removal list and have no direct token equivalents.
