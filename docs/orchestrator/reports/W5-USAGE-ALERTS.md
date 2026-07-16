# W5-USAGE-ALERTS — Quota Alert System

**Task ID:** W5-USAGE-ALERTS  
**Priority:** High  
**Branch:** feature/wave5-usage-alerts  
**Wave:** 5 — Internal Platform  
**Date:** 2026-07-12  

---

## Goal

Notify the team when internal quotas reach warning / critical levels (80% and 95%).

---

## How Alerts Work

### Threshold Levels

| Level | Threshold | Severity | Notification Type |
|-------|-----------|----------|-------------------|
| **Warning** | 80% | `warning` | `quota_warning` |
| **Critical** | 95% | `critical` | `quota_critical` |

### Alert Flow

1. **User performs an action** (creates task, generates AI content, etc.)
2. **`incrementUsage()` is called** to update the quota counter
3. **`checkAndSendQuotaAlertWithLimits()` is called** (non-blocking, async)
4. **Current usage and limit are fetched** from the quota system
5. **Thresholds are checked** against the current usage percentage
6. **If threshold is crossed**, an in-app notification is created
7. **Notification appears** in the user's notification center and bell dropdown

### Debounce Logic

To prevent spam, alerts are debounced with the following rules:

- **Debounce window:** 1 hour per workspace + quota type + threshold combination
- **Example:** If AI Generations hits 80% at 10:00 AM, no duplicate warning is sent until 11:00 AM
- **Critical overrides warning:** If usage reaches 95%, only the critical alert is sent (not both)
- **Cache:** In-memory `Map<string, number>` storing last alert timestamp per key

### Notification Recipients

Alerts are sent to the **workspace owner or admin** (first found in `workspace_members` table with role `owner` or `admin`).

---

## Where Alerts Appear

### 1. Notification Center

- **Route:** `/dashboard/notifications`
- **Full page** with filtering, search, and detail pane
- Shows all quota alerts with severity badges

### 2. Notification Bell (Topbar)

- **Component:** `NotificationBell.tsx`
- **Dropdown panel** showing recent notifications
- Unread count badge

### 3. Structured Logs

- **Logger:** `usage:quota-alerts` child logger
- **Logs:** Alert creation success/failure, debounce skips
- **Format:** JSON structured logs for observability

---

## Files Changed

| File | Change |
|------|--------|
| `src/types/database.ts` | Added `quota_warning` and `quota_critical` to `NotificationType` enum |
| `src/lib/usage/quota-alerts.ts` | **New** — Alert system with threshold detection, debounce, and notification creation |
| `src/lib/usage/quotas.ts` | Integrated alert calls into `incrementUsage()` flow |

---

## Quota Types Covered

| Quota Type | Label | Limit Source |
|------------|-------|--------------|
| `ai_generations` | AI Generations | `max_ai_generations_per_month` |
| `tasks` | Tasks | `max_tasks` |
| `creative_assets` | Creative Assets | `max_creative_assets` |
| `content_items` | Content Items | `max_content_items` |
| `content_publishes` | Content Publishes | `max_content_items` |
| `reels_publishes` | Reel Publishes | `max_reels_publishes_per_month` |

**Note:** `paid_ads_spend` and `cost_usd` are excluded from alerts (no hard limits).

---

## Configuration & Tuning

### Threshold Adjustment

To change alert thresholds, edit `src/lib/usage/quota-alerts.ts`:

```typescript
// Threshold constants
export const WARNING_THRESHOLD = 80;  // Change to desired % (e.g., 70)
export const CRITICAL_THRESHOLD = 95; // Change to desired % (e.g., 90)
```

### Debounce Adjustment

To change the debounce window, edit the `DEBOUNCE_MS` constant:

```typescript
// Debounce: minimum time (ms) between alerts for the same workspace+type+threshold
const DEBOUNCE_MS = 60 * 60 * 1000; // 1 hour — change as needed
```

### Disabling Alerts

To disable quota alerts entirely, comment out or remove the `checkAndSendQuotaAlertWithLimits()` call in `incrementUsage()`:

```typescript
// In src/lib/usage/quotas.ts, incrementUsage() function:
// checkAndSendQuotaAlertWithLimits(workspaceId, type, amount).catch(...)
```

---

## Verification

| Gate | Status |
|------|--------|
| typecheck | **PASS** (0 errors) |
| build | **PASS** |
| tests | **203/203 PASS** |

---

## Example Notification

### Warning (80%)

```
Title: AI Generations quota warning
Severity: warning
Message: AI Generations usage is at 80% (16/20). Consider reducing usage.
Related URL: /dashboard/usage
Metadata: { quota_type: "ai_generations", threshold: "warning", current: 16, limit: 20, percent_used: 80 }
```

### Critical (95%)

```
Title: Tasks quota critical
Severity: critical
Message: Tasks usage has reached 95% (38/40). Operations may be blocked soon.
Related URL: /dashboard/usage
Metadata: { quota_type: "tasks", threshold: "critical", current: 38, limit: 40, percent_used: 95 }
```

---

## Summary

The quota alert system is now active and will notify the team when:

- **80% warning:** "Consider reducing usage"
- **95% critical:** "Operations may be blocked soon"

Alerts are:
- **In-app notifications** (visible in notification center and bell)
- **Debounced** (once per hour per quota type)
- **Non-blocking** (failures don't break quota increments)
- **Tunable** (thresholds and debounce can be adjusted)

---

**End of W5-USAGE-ALERTS Report**
