# W9-INT-T2 — Sliding Window Rate Limiter Integration

**Date:** 2026-07-13  
**Status:** ✅ Complete  
**Task ID:** W9-INT-T2  
**Title:** Integrate Sliding Window Rate Limiter into Sensitive Routes

---

## Summary

Integrated the sliding window rate limiter (`src/lib/sliding-window-rate-limit.ts`) into all sensitive API routes, server actions, and bulk operations. The sliding window algorithm provides more accurate rate limiting than the existing fixed-window approach by tracking request timestamps within a moving window.

All integrations use **workspace + user scoped keys** where available, with **IP-based fallback** for routes without user context. The existing `checkRateLimit` (fixed-window) from `src/lib/rate-limit.ts` is **preserved and layered** — the sliding window check runs alongside it for defense-in-depth.

Fail-open behavior is built into the sliding window library: if the store throws an error, the request is allowed through.

---

## Routes/Endpoints Integrated

### 1. `/api/tasks/execute` — Task Execution
| Detail | Value |
|--------|-------|
| **File** | `src/app/api/tasks/execute/route.ts` |
| **Scope** | Workspace + IP (user not resolved at rate-limit time) |
| **Action** | `RATE_LIMIT_ACTIONS.TASK_EXECUTE` (30/min default) |
| **Response** | `AppError` with `retryAfterSeconds`, `resetAt`, `limit`, `remaining` |
| **Notes** | Added after existing fixed-window check. Uses `checkWorkspaceUserRateLimit` with IP as user proxy. |

### 2. `/api/n8n/callback` — n8n Callback Webhook
| Detail | Value |
|--------|-------|
| **File** | `src/app/api/n8n/callback/route.ts` |
| **Scope** | IP-based (no user context in callbacks) |
| **Action** | `n8n:callback` custom action (50/min) |
| **Response** | 429 JSON with `Retry-After`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers |
| **Notes** | Uses `buildIpRateLimitKey` with stricter rate than the existing fixed-window check (100/min). |

### 3. Content Publish Endpoints
| Endpoint | File | Scope | Action | Limit |
|----------|------|-------|--------|-------|
| Content Studio Publish | `publishing.ts` | workspace + user | `CONTENT_PUBLISH` | 20/min |
| Reel Publish | `reels.ts` | workspace + user (from RBAC context) | `CONTENT_PUBLISH` | 20/min |
| Paid Ads Publish | `paid-ads.ts` | workspace + user | `CONTENT_PUBLISH` | 10/min (stricter) |

### 4. AI Generation Endpoints
| Endpoint | File | Scope | Action | Limit |
|----------|------|-------|--------|-------|
| Content Studio AI Generation | `content-generation.ts` | workspace + user | `CONTENT_GENERATE` | 15/min |
| Creative Assets AI Generation | `creative-assets/actions.ts` | workspace + user | `AI_GENERATE_IMAGE` | 5/min |
| Alex Chat | `alex/chat/route.ts` | user-scoped | `AI_CHAT` | 15/min |
| AI Studio | `ai-studio/actions.ts` | workspace + user | `AI_GENERATE_IMAGE` | 5/min |
| Assistant | `assistant/actions.ts` | user-scoped | `AI_CHAT` | 10/min |

### 5. Bulk Operations
| Endpoint | File | Scope | Action | Limit |
|----------|------|-------|--------|-------|
| Manual Scheduler Run | `run-scheduler/route.ts` | workspace + user | `BULK_OPERATION` | 2/min |
| Report PDF Export | `reports/client-pdf/route.ts` | workspace-scoped | `REPORT_EXPORT_PDF` | 3/min |
| Report Save | `reports/save/route.ts` | workspace-scoped | `REPORT_GENERATE` | 5/min |

---

## Integration Pattern

The integration follows a consistent pattern across all routes:

```typescript
// Fixed-window rate limit (existing - preserved)
const fixedResult = await checkRateLimit({ key, limit: 100, windowMs: 15 * 60_000 });
if (!fixedResult.allowed) {
  // Return 429
}

// Sliding window rate limit (new - added for more accurate limiting)
const slidingResult = await checkWorkspaceUserRateLimit(workspaceId, userId, RATE_LIMIT_ACTIONS.TASK_EXECUTE);
if (!slidingResult.allowed) {
  // Return 429 with retry-after headers
}
```

### Key Design Decisions

1. **Layered approach**: Both fixed-window and sliding-window checks run together. The sliding window catches abuse patterns that fixed windows miss (e.g., burst requests near window boundaries).

2. **Workspace + user scoping**: All server actions integrate with available `workspace.id` and `user.id` from RBAC context. API routes without direct user access use IP or workspace-only keys.

3. **Clear 429 responses**: All blocked requests return a 429 status with `Retry-After` header in seconds. JSON responses include `retryAfterMs` for programmatic consumption.

4. **Fail-open**: The `checkSlidingWindowRateLimit` function wraps store calls in try/catch. On store error, the request is allowed through with `allowed: true` and `current: 0`.

5. **No breaking changes**: The existing `checkRateLimit` from `@/lib/rate-limit.ts` continues to work exactly as before. The sliding window check is additive.

---

## Files Modified

| File | Lines Changed | Type |
|------|--------------|------|
| `src/app/api/tasks/execute/route.ts` | +25 | API Route |
| `src/app/api/n8n/callback/route.ts` | +25 | API Route |
| `src/app/api/alex/chat/route.ts` | +16 | API Route |
| `src/app/api/dashboard/content-studio/run-scheduler/route.ts` | +12 | API Route |
| `src/app/api/reports/client-pdf/route.ts` | +18 | API Route |
| `src/app/api/reports/save/route.ts` | +18 | API Route |
| `src/app/(dashboard)/dashboard/content-studio/actions/publishing.ts` | +16 | Server Action |
| `src/app/(dashboard)/dashboard/content-studio/actions/content-generation.ts` | +14 | Server Action |
| `src/app/(dashboard)/dashboard/creative-assets/actions.ts` | +17 | Server Action |
| `src/app/(dashboard)/dashboard/ai-studio/actions.ts` | +13 | Server Action |
| `src/app/(dashboard)/dashboard/assistant/actions.ts` | +17 | Server Action |
| `src/actions/paid-ads.ts` | +15 | Server Action |
| `src/actions/reels.ts` | +13 | Server Action |

---

## Verification Criteria

- [x] Workspace + user scoped keys used where available
- [x] Fail-open on store error (built into sliding-window-rate-limit.ts)
- [x] 429 responses with clear retry-after information
- [x] Existing `rate-limit.ts` is not modified or broken
- [x] Sliding window check runs alongside existing fixed-window check
- [x] `RATE_LIMIT_ACTIONS` constants used for consistent action naming
- [x] Default limits from `DEFAULT_RATE_LIMITS` used where appropriate

---

## Next Steps

1. Consider adding sliding window rate limiting to remaining API routes (`/api/ads/*`, `/api/auth/*`, `/api/cron/*`)
2. Configure Upstash Redis store for production: implement `SlidingWindowStore` with Upstash
3. Add monitoring/alerts for rate limit exceeded events
