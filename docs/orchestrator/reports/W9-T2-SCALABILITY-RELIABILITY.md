# W9-T2: Scalability & Reliability Improvements

**Status:** ⏳ Analysis — Awaiting Project Owner Approval  
**Date:** 2026-07-13  
**Author:** Agent 2 (Scalability & Reliability)

---

## Overview

This report analyzes four critical areas of the AgentFlow AI platform and recommends concrete improvements. No changes have been made yet — all findings are presented for approval before implementation.

---

## 1. Concurrency Limits Improvements

### Current State

| Component | Setting | File |
|---|---|---|
| BullMQ Task Worker | `concurrency: 5`, `lockDuration: 60s` | `src/lib/queue/workers/task-worker.ts:45` |
| BullMQ Queue Defaults | `attempts: 3`, exponential backoff (1s base) | `src/lib/queue/queues.ts` |
| Stale Recovery | Every 5 min, threshold 10 min | `src/lib/queue/stale-recovery.ts` |
| Redis Reconnection | Backoff `2s * 2^attempts`, cap 30s | `src/lib/queue/redis.ts` |
| Graceful Shutdown | 15s timeout | `src/lib/graceful-shutdown.ts` |
| DLQ | 60-day TTL | `src/lib/queue/workers/maybe-dlq.ts` |

### Identified Gaps

| # | Gap | Impact | Severity |
|---|---|---|---|
| C1 | No per-workspace or per-user concurrency limits | One workspace can starve others | High |
| C2 | No concurrency limits on external provider calls (OpenAI, Meta, GitHub, n8n) | Unbounded parallel requests can trigger provider 429s and cost spikes | High |
| C3 | No semaphore/pool abstraction in `lib/` | Every new integration rewrites its own throttling | Medium |
| C4 | BullMQ worker is single-instance; no cross-serverless coordination | On Vercel, only one function runs the worker at a time | Low (by design) |
| C5 | No circuit breaker for upstream providers | 429/503 storms cascade through the system | Medium |

### Recommendations

**C1 — Workspace-level concurrency (High priority, ~3-4 hours)**
- Add a `ConcurrencyLimiter` utility in `src/lib/queue/concurrency-limiter.ts`
- Use Redis (via BullMQ's existing connection) to track active jobs per workspace
- Reject new jobs when a workspace exceeds its limit (configurable via env: `MAX_CONCURRENT_PER_WORKSPACE`, default 10)
- Apply to both BullMQ jobs and direct task execution via `/api/tasks/execute`

**C2 — Provider call concurrency (High priority, ~4-5 hours)**
- Create `src/lib/network/concurrency-pool.ts` — a generic semaphore wrapping Redis or in-memory counters
- Integrate with `safeFetch` (add optional `concurrencyKey` and `maxConcurrent` parameters)
- Set sensible defaults: OpenAI → 3 concurrent, GitHub → 2, n8n → 5, Meta → 3
- Add env-based overrides per provider

**C5 — Circuit breaker (Medium priority, ~3-4 hours)**
- Add a `CircuitBreaker` class in `src/lib/network/circuit-breaker.ts`
- States: CLOSED (normal), OPEN (failing), HALF_OPEN (probing)
- Track failure rate over a sliding window (e.g., last 30s)
- Auto-open when failure rate exceeds threshold (e.g., 50% of requests)
- Integration point: wrap provider calls in `src/lib/production-readiness.ts` and `src/lib/ai/text-provider.ts`

---

## 2. Rate Limiting Enhancements

### Current State

| Endpoint | Limit | Window | Store |
|---|---|---|---|
| Task execute API | 100 | 15 min | In-memory / Upstash |
| Health API | 60 | 1 min | In-memory / Upstash |
| n8n callback | 100 | 1 min | In-memory / Upstash |
| Alex chat | 20 | 10 min | In-memory / Upstash |
| Scheduler run | 3 | 1 min | In-memory / Upstash |
| Creator assets | 10 | default | In-memory / Upstash |
| OAuth callbacks | 10 | default | In-memory / Upstash |
| Paid ads actions | 5 | 10 min | In-memory / Upstash |
| Auth brute force (IP) | 5 | 5 min | Custom module |
| Auth brute force (email) | 5 | 5 min | Custom module |
| Auth lockout | 1 | 15 min | Custom module |

**Engine:** `src/lib/rate-limit.ts` — fixed-window counter, dual-store (InMemory or Upstash).

### Identified Gaps

| # | Gap | Impact | Severity |
|---|---|---|---|
| R1 | Fixed-window algorithm allows burst at window boundaries | 100 req at :59 + 100 req at :00 = 200 in 2s | High |
| R2 | In-memory store doesn't scale across serverless instances | Cold starts reset limits; no cross-function coordination | High |
| R3 | `clearRateLimitKey` is a no-op in Upstash mode | Auth failure clearing doesn't work in production | Medium |
| R4 | No standardized rate-limit response headers | Clients can't implement good backoff behavior | Medium |
| R5 | No per-tier rate limits (free vs pro) | Hard-coded limits apply equally to all workspaces | Medium |
| R6 | No centralized rate-limit config | Limits are magic numbers scattered across ~15 files | Low |

### Recommendations

**R1 — Sliding window algorithm (Medium priority, ~3 hours)**
- Implement sliding window log in `src/lib/rate-limit.ts` alongside existing fixed-window
- Use Upstash sorted sets (`ZCOUNT` + `ZREMRANGEBYSCORE`) for accurate sliding windows
- Fall back to fixed-window for in-memory mode (acceptable trade-off for non-production)
- Add `algorithm: 'sliding' | 'fixed'` option in `checkRateLimit()`

**R3 — Fix `clearRateLimitKey` for Upstash (Low priority, ~30 min)**
- Implement deletion in Upstash store using `REST.del()` (currently a no-op with comment)

**R4 — Standard rate-limit headers (Medium priority, ~2 hours)**
- Add a helper `buildRateLimitHeaders()` to `src/lib/rate-limit.ts` that returns:
  - `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
  - `Retry-After` (seconds until window resets)
- Apply to all rate-limited endpoints consistently

**R6 — Centralized config (Low priority, ~1 hour)**
- Create `src/lib/rate-limit-config.ts` with all limits in one object
- Remove magic numbers from individual route files
- Each route imports `RATE_LIMITS.routeName` instead of hard-coding

---

## 3. Error Boundaries + Retry Logic

### Current State

**React Error Boundaries:**
- Top-level `SentryErrorBoundary` in `src/app/layout.tsx` — catches everything, shows generic fallback
- `RouteErrorBoundary` exists at `src/lib/error-boundaries/route-error-boundary.tsx` but has **zero consumers**
- Two `<Suspense>` boundaries in dashboard layout and homepage

**Server-side Error Handling:**
- `AppError` class + `handleError()` / `createErrorResponse()` in `src/lib/error-handler.ts`
- Structured logger with Sentry integration in `src/lib/logger.ts`
- Most API routes follow try/catch → `createErrorResponse()` pattern

**Retry Logic:**
- `safeFetch` in `src/lib/network/safeFetch.ts`: 3 retries, exponential backoff (1s base, 15s cap), jitter, 30s total budget. Retries on network errors + 429/502/503/504
- BullMQ: 3 retries, exponential backoff
- Redis: exponential backoff, 30s cap
- **No retry** on OpenAI API calls (Alex chat, content generation)
- **No retry** on Supabase queries
- **No circuit breaker**

### Identified Gaps

| # | Gap | Impact | Severity |
|---|---|---|---|
| E1 | `RouteErrorBoundary` is unused | Granular error recovery is impossible; one crash takes down the page | High |
| E2 | No retry on OpenAI API calls | Transient OpenAI failures immediately surface to users | High |
| E3 | No retry on Supabase queries | Transient DB failures cause 500 errors on otherwise-retryable operations | Medium |
| E4 | `safeFetch` is underutilized | Many fetch calls use raw `fetch()` without retry logic | Medium |
| E5 | No "retry" button in Suspense fallbacks | Failed data loads require full page refresh | Low |
| E6 | No fallback granularity below top-level Sentry boundary | A single widget error takes down the entire page | Medium |

### Recommendations

**E1 — Wire `RouteErrorBoundary` into key pages (High priority, ~2-3 hours)**
- Wrap dashboard section components (Usage, Settings panels, Reports cards, Content Studio panels) with `RouteErrorBoundary`
- Set `resetOnTimeout` on panels that periodically refresh
- Add contextual fallback messages per section (e.g., "Usage data unavailable. Retry in 30s.")
- This prevents a single API failure from crashing the entire dashboard

**E2 — Add retry to OpenAI calls (High priority, ~2 hours)**
- Wrap OpenAI fetch calls in Alex chat (`src/app/api/alex/chat/route.ts`) with `safeFetch` or a specialized retry wrapper
- Implement exponential backoff with jitter for OpenAI 429s
- Surface "OpenAI is temporarily unavailable. Retrying..." status to users
- Apply the same treatment to content generation in `src/lib/ai/text-provider.ts`

**E3 — Add Supabase query retry (Medium priority, ~2 hours)**
- Create `withRetry<T>(fn, options)` wrapper in `src/lib/data/retry.ts`
- Apply to critical read paths (workspace data, task fetching, content items)
- Configurable: 2 retries, 500ms base delay, no retry on 4xx errors (only connection errors and 5xx)

**E4 — Broaden `safeFetch` adoption (Medium priority, ~3 hours)**
- Audit all `fetch()` calls outside `safeFetch` and migrate the high-risk ones:
  - n8n webhook calls
  - OAuth token exchange requests
  - Provider API calls (beyond OpenAI)
- Keep low-risk calls (internal API routes) on raw `fetch()` to avoid unnecessary overhead

---

## 4. Load Testing Preparation

### Current State

- **No load testing infrastructure exists**
- No k6, artillery, autocannon, or benchmark scripts
- No test scenarios for queue throughput, rate-limit enforcement, or API capacity
- No performance regression tests
- No documented baseline metrics

### Identified Gaps

| # | Gap | Impact | Severity |
|---|---|---|---|
| L1 | No load testing at all | Cannot measure throughput, identify bottlenecks, or establish baselines | High |
| L2 | No queue stress tests | Worker concurrency settings (5) have never been validated under load | Medium |
| L3 | No rate-limit effectiveness tests | Not verified that rate limits actually throttle under burst | Medium |
| L4 | No production traffic baseline | No data to compare against after changes | Medium |

### Recommendations

**L1 — Install k6 + create baseline scenarios (Medium priority, ~4-5 hours)**
- Install k6 (CLI-based, no browser dependency): `npm install --save-dev @k6`
  - Actually k6 is a standalone binary, best installed via direct download or `brew install k6`
- Create `load-tests/` directory with scenarios:
  1. `load-tests/health-check.js` — basic health endpoint load (sanity check)
  2. `load-tests/task-execute.js` — task execution API under load
  3. `load-tests/rate-limit.js` — verify rate limiting under burst
  4. `load-tests/alex-chat.js` — chat endpoint with concurrent users
- Script format: k6 JavaScript (standard k6 style, not Node.js)
- Add `load-test` npm script: `k6 run load-tests/`

**L2 — Queue stress scenario (Medium priority, ~3 hours)**
- Create scenario that enqueues 500 tasks simultaneously
- Measure: processing time, worker saturation, DLQ count, Redis memory usage
- Verify `concurrency: 5` is optimal under load; adjust if needed

**L4 — Establish baseline metrics (Low priority, ~1 hour)**
- Document current baselines from production-grade estimates:
  - Queue throughput: estimated from BullMQ config
  - API response times: from Sentry traces
  - Rate-limit effectiveness: from logs
- These serve as comparison data after improvements

---

## Implementation Plan Summary

| Recommendation | Priority | Effort | Risk | Dependencies |
|---|---|---|---|---|
| **C1** Workspace concurrency limits | High | 3-4h | Low | Redis already configured |
| **C2** Provider call concurrency | High | 4-5h | Medium | Requires `safeFetch` integration |
| **C5** Circuit breaker | Medium | 3-4h | Low | New utility, no existing code changed |
| **R1** Sliding window algorithm | Medium | 3h | Low | Upstash required for production |
| **R3** Fix Upstash clearRateLimitKey | Low | 30min | Low | Single function fix |
| **R4** Standard rate-limit headers | Medium | 2h | Low | Additive, no breaking changes |
| **R6** Centralized rate-limit config | Low | 1h | Low | Mechanical refactor |
| **E1** Wire RouteErrorBoundary | High | 2-3h | Low | Component already exists |
| **E2** OpenAI retry | High | 2h | Low | `safeFetch` can be reused |
| **E3** Supabase query retry | Medium | 2h | Low | New utility + selective application |
| **E4** Broaden safeFetch adoption | Medium | 3h | Low | Audit + mechanical migration |
| **L1** Install k6 + baseline scenarios | Medium | 4-5h | Low | No production impact |
| **L2** Queue stress scenario | Medium | 3h | Low | Requires L1 first |
| **L4** Baseline metrics doc | Low | 1h | None | Documentation only |

**Total estimated effort:** ~34-39 hours across all recommendations

---

## Risk Assessment

- **All changes are additive or protective** — no existing APIs or data structures are modified
- **No new dependencies** (except k6 for load testing, which is a standalone binary)
- **Rate-limit header changes** are the only externally visible changes — purely additive
- **Circuit breaker** is the riskiest recommendation (auto-decides when to block traffic) — recommend starting with circuit breaker only for non-critical paths initially
- **No schema migrations or database changes**

---

## Request for Approval

This report identifies **14 actionable improvements** across 4 areas. Total estimated effort: ~34-39 hours.

Before proceeding with implementation, please confirm:

1. **Priority order** — Should implementation follow the Priority column above, or is there a different ordering?
2. **Scope** — Are all 14 recommendations approved, or should some be deferred?
3. **k6 vs artillery** — For load testing, k6 (standalone binary) or artillery (Node.js CLI) is preferred?
4. **Circuit breaker** — Start in monitor-only mode (log when it would open but don't actually block)?
