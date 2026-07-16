# W5-ADMIN-LIMITS-BACKEND — Admin Limit Adjustment Backend

**Task ID:** W5-ADMIN-LIMITS-BACKEND  
**Priority:** High  
**Branch:** feature/wave5-admin-limit-adjustment  
**Wave:** 5 — Internal Platform  
**Date:** 2026-07-12  

---

## Goal

Allow Owner/Admin to **increase or decrease workspace quota limits from inside the platform** (no code deploy needed for day-to-day changes).

---

## Design

### Override Storage

Limits are stored as overrides in the `usage_limits.metadata.overrides` JSONB column:

```json
{
  "max_tasks": 40,
  "max_reels_publishes_per_month": 10,
  "overrides": {
    "max_ai_generations_per_month": 50,
    "max_creative_assets": 100,
    "max_content_items": 60,
    "max_tasks": 80,
    "max_reels_publishes_per_month": 25
  }
}
```

### Fallback Chain

When reading limits, the system uses this priority:

1. **Admin override** (`metadata.overrides[type]`) — set by owner/admin
2. **DB column** (e.g., `max_ai_generations_per_month`) — set by plan sync
3. **Plan default** (`PLAN_LIMITS[plan]`) — static per plan
4. **Hardcoded fallback** — safety net

### Limit Fields

| Field | Storage | Max Cap |
|-------|---------|---------|
| `max_ai_generations_per_month` | DB column + override | 10,000 |
| `max_creative_assets` | DB column + override | 10,000 |
| `max_content_items` | DB column + override | 10,000 |
| `max_tasks` | metadata JSONB + override | 10,000 |
| `max_reels_publishes_per_month` | metadata JSONB + override | 1,000 |

---

## Server Actions

### `getEditableLimitsAction()`

**Purpose:** Read current overrides for the workspace.  
**Authorization:** Owner/Admin only.  
**Returns:** `LimitsState` with current overrides, plan, and `isOverridden` flag.

### `updateWorkspaceLimitsAction(state, formData)`

**Purpose:** Update workspace quota limits.  
**Authorization:** Owner/Admin only.  
**Input:** FormData with limit values (numbers or empty for null/unlimited).  
**Validation:**
- Must be finite integers
- Must be ≥ 0
- Must be ≤ max cap (10,000 or 1,000)
- `null` = unlimited (revert to plan default)

**Audit:** Logs `quota_limits_updated` event with old/new values.

### `resetWorkspaceLimitsAction()`

**Purpose:** Reset all limits to plan defaults (remove overrides).  
**Authorization:** Owner/Admin only.  
**Audit:** Logs `quota_limits_reset` event.

---

## Authorization

All actions use the established RBAC pattern:

```typescript
const context = await getSettingsWorkspaceContext();
if (!hasPermission(context.role, 'admin')) {
  await denySettingsAction(context, 'Attempted to ... without admin role.');
  return { error: 'Only workspace owners and admins can ...' };
}
```

**Blocked roles:** `editor`, `viewer`, `operator`  
**Allowed roles:** `owner`, `admin`

---

## Audit Logging

All limit changes are logged to `security_audit_logs`:

| Event Type | Severity | When |
|------------|----------|------|
| `quota_limits_updated` | info | Limits changed |
| `quota_limits_reset` | info | Limits reset to defaults |
| `permission_denied` | warning | Non-admin attempted change |

**Logged data:**
- `workspace_id`
- `user_id`
- `event_type`
- `entity_type: 'usage_limits'`
- `message`
- `metadata: { overrides, role }`

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/usage/quotas.ts` | Updated `getUsageLimits()` to use `resolveLimit()` with override fallback chain |
| `src/app/(dashboard)/dashboard/settings/actions/limits.ts` | **New** — Server actions for CRUD on quota limits |
| `src/app/(dashboard)/dashboard/settings/actions/index.ts` | Added exports for limits actions and types |

---

## Verification

| Gate | Status |
|------|--------|
| typecheck | **PASS** (0 errors) |
| build | **PASS** |
| tests | **203/203 PASS** |

---

## Usage Example

### Setting Limits

```typescript
// In a server action or API route
const formData = new FormData();
formData.set('max_ai_generations_per_month', '100');
formData.set('max_creative_assets', '200');
formData.set('max_content_items', '100');
formData.set('max_tasks', '150');
formData.set('max_reels_publishes_per_month', '50');

const result = await updateWorkspaceLimitsAction(initialState, formData);
```

### Reading Limits

```typescript
const result = await getEditableLimitsAction();
if (result.limits) {
  console.log('AI generations limit:', result.limits.max_ai_generations_per_month);
  console.log('Has overrides:', result.isOverridden);
}
```

### Resetting to Defaults

```typescript
const result = await resetWorkspaceLimitsAction();
// All limits now use PLAN_LIMITS defaults
```

---

## How Quota System Uses Effective Limits

The `getUsageLimits()` function now uses `resolveLimit()`:

```typescript
function resolveLimit(
  metadata: JsonObject,
  overrideKey: string,
  dbValue: number | null | undefined,
  planDefault: number | null,
  hardcodedFallback: number
): number | null {
  // 1. Check admin override in metadata.overrides
  const overrides = metadata.overrides as JsonObject | undefined;
  if (overrides) {
    const overrideVal = readMetadataNumber(overrides, overrideKey);
    if (overrideVal !== null) return overrideVal;
  }

  // 2. Check dedicated DB column
  if (dbValue !== null && dbValue !== undefined) return dbValue;

  // 3. Check plan default
  if (planDefault !== null && planDefault !== undefined) return planDefault;

  // 4. Hardcoded fallback
  return hardcodedFallback;
}
```

This ensures:
- **Overrides take priority** — admin-set limits are always used first
- **Plan defaults remain** — if no override, the plan's limits apply
- **No breaking changes** — existing behavior is preserved when no overrides exist

---

## Summary

Owner/Admin can now:

1. **Read current limits** via `getEditableLimitsAction()`
2. **Update limits** via `updateWorkspaceLimitsAction()` with validation
3. **Reset to defaults** via `resetWorkspaceLimitsAction()`

All changes are:
- **Authorized** — only owner/admin can modify
- **Validated** — positive integers with sane max caps
- **Audited** — logged to `security_audit_logs`
- **Effective immediately** — quota system reads overrides in real-time

---

**End of W5-ADMIN-LIMITS-BACKEND Report**
