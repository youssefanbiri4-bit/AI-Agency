# W5 — Admin Limit Adjustment UI

**Task:** W5-ADMIN-LIMITS-UI  
**Branch:** feature/wave5-admin-limit-adjustment-ui  
**Status:** ✅ Complete

---

## What Was Built

An **"Adjust Limits"** form on `/dashboard/usage` that lets workspace owners and admins override quota limits directly — no Stripe, no plan changes, no leaving the app.

### Features

- **5 form fields** covering all quota types:
  - AI Generations / month
  - Tasks
  - Creative Assets
  - Content Items
  - Reel Publishes / month
- Empty field = unlimited (`null` in DB)
- Save button with loading state
- Success/error toast feedback
- Page auto-refreshes after save (via `router.refresh()` + `revalidatePath`)
- Security audit event logged on every change

### Access control

| Role | Sees form? | Can save? |
|------|-----------|-----------|
| Owner | ✅ | ✅ |
| Admin | ✅ | ✅ |
| Operator | ❌ | ❌ |
| Editor | ❌ | ❌ |
| Viewer | ❌ | ❌ |

Non-admins see the original "Contact your workspace admin" message.

---

## Where It Sits

The form renders **below** the quota cards and cost tracking on `/dashboard/usage`, replacing the generic "Contact your admin" footer for admin users.

---

## Files Changed

| File | Change |
|------|--------|
| `src/app/(dashboard)/dashboard/usage/actions.ts` | **New** — Server action `updateUsageLimits()` with RBAC, DB update, audit logging, revalidation |
| `src/app/(dashboard)/dashboard/usage/AdjustLimitsForm.tsx` | **New** — Client component with form fields, toast feedback, loading state |
| `src/app/(dashboard)/dashboard/usage/page.tsx` | **Modified** — Added membership check, role normalization, current limits fetch, conditional form render |

---

## Architecture

### Server action (`actions.ts`)

1. Calls `getRBACContext()` to get authenticated user + workspace + role
2. Checks `hasPermission(role, 'admin')` — blocks operator/editor/viewer
3. Parses 5 form fields via `parsePositiveInt()` (empty/null → unlimited)
4. Updates `usage_limits` row using `getSupabaseAdmin()` (service role, bypasses RLS)
5. Writes `max_ai_generations_per_month`, `max_creative_assets`, `max_content_items` as direct columns
6. Writes `max_tasks` and `max_reels_publishes_per_month` inside `metadata` JSONB
7. Logs audit event via `logSecurityAuditEvent()`
8. Calls `revalidatePath()` for `/dashboard/usage`, `/dashboard`, `/dashboard/settings/billing`

### Form component (`AdjustLimitsForm.tsx`)

- `'use client'` component
- Uses `useTransition` for non-blocking submit
- Uses `useToast` for success/error notifications (`toast.success` / `toast.error`)
- Calls `router.refresh()` on success to reflect new limits
- Shows inline error message below form fields on failure

### Page integration (`page.tsx`)

- Fetches `getCurrentWorkspaceMembership()` + normalizes role via `normalizeWorkspaceRole()`
- Checks `hasPermission(role, 'admin')`
- Fetches `getUsageLimits(workspaceId)` for current limit values
- Conditionally renders `<AdjustLimitsForm>` or fallback message

---

## Gates

- ✅ Typecheck: clean (all errors are pre-existing in `settings/` directory)
- ✅ Tests: `tests/smoke/quotas.test.ts` — 8/8 passed
- ✅ No Stripe / payment code
- ✅ No existing usage display broken
- ✅ Only Owner/Admin can access
