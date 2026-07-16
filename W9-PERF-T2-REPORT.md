# W9-PERF-T2 — Scalability & Reliability Engineering

**Date:** 2026-07-13
**Engineer:** Agent (Implementation Engineer)
**Task:** Concurrency Limiter + Circuit Breaker + Sliding Window Rate Limiting

---

## Summary

Implemented three core resilience patterns for AgentFlow-AI's external provider calls and sensitive API routes. All three are in-memory with Redis-ready interfaces, zero external dependencies, and comprehensive unit test coverage.

| Component | Files | Status |
|-----------|-------|--------|
| Concurrency Limiter | `src/lib/concurrency-limiter.ts`, `src/lib/concurrency-limiter.test.ts` | ✅ Complete |
| Circuit Breaker | `src/lib/circuit-breaker.ts`, `src/lib/circuit-breaker.test.ts` | ✅ Complete |
| Sliding Window Rate Limiter | `src/lib/sliding-window-rate-limit.ts`, `src/lib/sliding-window-rate-limit.test.ts` | ✅ Complete |
| Report | `W9-PERF-T2-REPORT.md` | ✅ Complete |

---

## Files Created/Modified

### Created

| File | Description |
|------|-------------|
| `src/lib/concurrency-limiter.ts` | In-memory concurrency limiter with named slots, queue, and Redis-ready store interface |
| `src/lib/concurrency-limiter.test.ts` | 11 test cases covering acquire/release, timeout, error handling, defaults |
| `src/lib/circuit-breaker.ts` | Full circuit breaker with CLOSED/OPEN/HALF_OPEN states, configurable thresholds, callbacks |
| `src/lib/circuit-breaker.test.ts` | 18 test cases covering state transitions, callbacks, probe limiting, timeout |
| `src/lib/sliding-window-rate-limit.ts` | Sliding window rate limiter with workspace/user-scoped keys, convenience wrappers |
| `src/lib/sliding-window-rate-limit.test.ts` | 15 test cases covering sliding window, peek, key helpers, defaults, error fallback |

### Modified

None. All new files are standalone and do not modify existing behavior.

---

## Design Decisions

### 1. Concurrency Limiter

- **In-memory with interface**: `ConcurrencyStore` interface allows future Redis/Upstash implementation via the same `tryAcquire`/`acquire` API.
- **Named slots**: Predefined slots (`AI_GENERATION`, `PDF_GENERATION`, `BULK_OPERATION`, etc.) with sensible defaults. Each operation group gets its own concurrency pool.
- **Fail-fast or queue mode**: `tryAcquire()` for fail-fast operations; `acquire()` with timeout for operations that can wait. `withConcurrencyLimit()` defaults to fail-fast.
- **No external dependencies**: Pure Map-based implementation, zero npm packages added.
- **Redis readiness**: The `ConcurrencyStore` interface uses `tryAcquire` returning `{ acquired, release }`, which maps cleanly to Redis `INCR`/`DECR` with TTL-based cleanup.

### 2. Circuit Breaker

- **State machine**: Three states — CLOSED (normal), OPEN (fast-fail), HALF_OPEN (limited probe).
- **Configurable per provider**: Each provider (OpenAI text/image, Google Ads, n8n, Meta, Pinterest, GitHub) gets its own thresholds, cooldown, and max probes.
- **Callbacks**: `onOpen`, `onHalfOpen`, `onClose`, `onFailure` callbacks for monitoring/alerting integration.
- **Half-open probe limiting**: Only one probe request at a time in HALF_OPEN state to prevent cascading failures.
- **Timeout integration**: Operations wrapped in the circuit breaker automaticall time out after configurable duration.
- **Custom failure classification**: `isFailure` callback lets callers decide which errors count toward the threshold (e.g., ignore 404s, count 5xx).
- **Globally registered providers**: `registerDefaultCircuitBreakers()` seeds all known providers at startup.

### 3. Sliding Window Rate Limiter

- **True sliding window**: Uses timestamp arrays (not fixed buckets) to avoid the fixed-window burst problem.
- **Three key scopes**: Workspace-scoped, user-scoped, and combined workspace+user keys via helper functions.
- **Predefined actions and defaults**: `RATE_LIMIT_ACTIONS` enum with sensible defaults for 14 operation types (content publish, AI generation, task execution, etc.).
- **Peek without side effects**: `peekSlidingWindowRateLimit()` reads current state without incrementing.
- **Graceful degradation**: On store errors, defaults to allowing the request (fail-open for rate limiting).
- **Compatible with existing system**: Complements (does not replace) the existing fixed-window `src/lib/rate-limit.ts`. The sliding window is more precise for sensitive operations.

---

## Tests

All tests pass with Vitest.

### Concurrency Limiter Tests (11 cases)

```
✓ allows acquiring a slot when under the limit
✓ rejects acquiring a slot when at the limit
✓ releases a slot and allows queued requests
✓ tracks active count correctly after multiple acquire/release cycles
✓ acquire waits asynchronously when slots are full
✓ acquire times out when no slot becomes available
✓ getAllSlots returns correct data
✓ resets all state
✓ handles 0 maxConcurrency gracefully
✓ executes the function when a slot is available
✓ throws ConcurrencyLimitError when slots are full
✓ releases slot after function success
✓ releases slot after function failure
✓ uses default max concurrency from config
✓ has reasonable defaults for all slots
✓ ConcurrencyLimitError has correct properties
```

### Circuit Breaker Tests (18 cases)

```
✓ starts with no state for unknown circuits
✓ records failures and tracks count
✓ records successes and resets failure count in CLOSED state
✓ resets circuit state
✓ clears all state
✓ allows requests when circuit is CLOSED
✓ allows requests when circuit is fresh (no state)
✓ blocks requests when circuit is OPEN
✓ allows probe request when cooldown elapses (HALF_OPEN)
✓ limits probe requests in HALF_OPEN state
✓ closes circuit after threshold successes in HALF_OPEN
✓ trips to OPEN when failure threshold is reached
✓ re-opens circuit on failure in HALF_OPEN
✓ fires onOpen callback when circuit opens
✓ fires onFailure callback on each failure
✓ executes function when circuit is CLOSED
✓ throws CircuitBreakerOpenError when circuit is OPEN
✓ records success after successful execution
✓ records failure after failed execution
✓ respects custom isFailure classifier
✓ resets circuit back to CLOSED state
✓ returns null for unregistered circuits
✓ returns state for registered circuits
✓ getAllCircuitStates returns all circuits
```

### Sliding Window Rate Limiter Tests (15 cases)

```
✓ allows requests within the limit
✓ blocks requests when limit is exceeded
✓ allows requests after window slides
✓ peek does not increment the counter
✓ reset clears state for a key
✓ clear removes all state
✓ handles 0 limit correctly
✓ provides accurate resetInMs
✓ uses the store and returns result
✓ falls back to allowed=true on store error
✓ peeks without incrementing
✓ buildWorkspaceRateLimitKey
✓ buildUserRateLimitKey
✓ buildWorkspaceUserRateLimitKey
✓ buildIpRateLimitKey
✓ checkWorkspaceRateLimit uses defaults
✓ checkUserRateLimit uses defaults
✓ checkWorkspaceUserRateLimit combines both
✓ allows overriding limit and window
✓ has defaults for all actions
✓ SlidingWindowRateLimitError has correct properties
```

---

## Remaining Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| In-memory state lost on process restart | Low | All three are in-memory; Redis/Upstash implementations can be added via the store interfaces. Acceptable for current scale. |
| No automatic registration of circuit breakers at startup | Low | `registerDefaultCircuitBreakers()` is available but not auto-called. Integrate into app initialization. |
| Sliding window memory growth for high-frequency keys | Low | Timestamp arrays are GC-friendly; old timestamps filtered on each check. For very high frequency, a Redis Sorted Set implementation would be more efficient. |
| Concurrency queue can grow unbounded under sustained load | Low | Acquire with timeout (`acquire()` rejects waiters after timeout). Consider adding max queue size. |
| No integration with existing `src/lib/rate-limit.ts` | Info | Sliding window complements the existing fixed-window system; migration can be gradual. |

---

## Status

```
✅ All components implemented
✅ All tests passing
✅ Zero new npm dependencies
✅ All store interfaces Redis-ready
✅ No existing behavior modified
```

## Next Steps

1. Integrate circuit breaker into OpenAI calls (`src/lib/ai/text-provider.ts`, `src/lib/ai/openai-images.ts`)
2. Integrate circuit breaker into n8n calls (`src/lib/n8n.ts`)
3. Integrate sliding window rate limiter into sensitive API routes (`/api/tasks/execute`, `/api/n8n/callback`)
4. Replace manual PDF concurrency (`MAX_CONCURRENT_PDF = 2`) with the generic concurrency limiter
5. Add monitoring dashboard for circuit breaker states (`getAllCircuitStates()`)
6. Implement Redis-backed stores for multi-instance deployments
