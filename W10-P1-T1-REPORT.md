# W10-P1-T1: Redis / Upstash Integration for Production

**Date:** 2026-07-15  
**Status:** ✅ Complete  
**Task:** Connect Upstash Redis (or generic Redis) for Rate Limiting, Concurrency Limiter, BullMQ Queue

---

## Changes

### 1. `src/lib/redis.ts` — Unified Redis Client Manager (NEW)
- Lazy ioredis connection via `getRedisClient()` — connects only on first use
- Auto-detects `REDIS_HOST`/`REDIS_PORT` env vars to decide between Redis and in-memory
- `isRedisAvailable()` — quick readiness check for monitoring/production-gate
- `connectRedis()` — explicit connect for BullMQ/workers
- Graceful shutdown integration via `registerShutdownable(asShutdownable('redis', ...))`
- Falls back to `null` (caller handles in-memory fallback) when Redis is unreachable

### 2. `src/lib/sliding-window-rate-limit.ts` — `RedisSlidingWindowStore`
- Redis-backed sliding window using **sorted sets** (ZADD/ZREMRANGEBYSCORE/ZCOUNT)
- Accurate sliding window semantics across distributed instances
- Efficient pipeline: one round-trip for zremrangebyscore + zadd + zcount + pexpire
- Handles over-limit gracefully by removing the current entry and rechecking
- `Peek()` uses zremrangebyscore/zcount without mutation
- `Clear()` uses SCAN to delete all `agentflow:sw:*` keys
- Falls back to `InMemorySlidingWindowStore` when Redis is unavailable

### 3. `src/lib/concurrency-limiter.ts` — `RedisConcurrencyStore`
- Sync-in-memory for `tryAcquire()` (Redis ops are async, so sync falls back to memory)
- Async `acquire()` uses Redis **INCR/DECR** with polling loop for cross-instance coordination
- TTL on first acquire (100s) prevents stale counter leaks
- Release function decrements Redis (fire-and-forget)
- `getActiveCount()`/`getAllSlots()` return from in-memory for speed
- Falls back to `InMemoryConcurrencyStore` when Redis is unavailable

### 4. `src/lib/circuit-breaker.ts` — `RedisCircuitBreakerStore`
- Uses **sync-in-memory + async Redis side-effect** pattern (preserves existing sync interface)
- All operations update in-memory store synchronously, then fire async Redis HASH sync
- State stored in Redis HASH with key `agentflow:cb:{name}`
- `recordFailure()`/`recordSuccess()` handle state transitions (CLOSED → OPEN → HALF_OPEN)
- `Reset()`/`Clear()` delete Redis keys asynchronously
- Falls back to `InMemoryCircuitBreakerStore` when Redis is unavailable

### 5. `src/lib/rate-limit.ts` — `RedisRateLimitStore`
- New `RedisRateLimitStore` using ioredis `INCR`/`PEXPIRE` pattern (complements existing Upstash REST store)
- Store selection priority: Upstash REST (env vars) → ioredis Redis (REDIS_HOST) → In-memory
- `RateLimitStoreMode` now includes `'redis'`
- Fixed `clearRateLimitKey()` — removed unnecessary dynamic import, uses direct `getRedisClient()` call
- Updated `peekRateLimit()` with Redis GET+PTTL support

### 6. `src/lib/production-readiness.ts` — Updated Checks
- Added `rate-limit:redis-connection` check — reports Redis connection status
- Updated `rate-limit:persistent` check to recognize both `upstash` and `redis` modes
- Persistent rate limit message now includes both configuration options

### 7. Standalone Store Initialization
Each store auto-detects Redis availability at module init time:
- `getSlidingWindowStore()` — creates `RedisSlidingWindowStore` if REDIS_HOST is set
- `getConcurrencyStore()` — creates `RedisConcurrencyStore` if REDIS_HOST is set
- `getCircuitBreakerStore()` — creates `RedisCircuitBreakerStore` if REDIS_HOST is set
- `getRateLimitStore()` — checks env vars in priority order

### 8. BullMQ Queue Integration (unchanged)
- `src/lib/queue/redis.ts` already configured ioredis with `lazyConnect: true`
- `src/lib/queue/queues.ts` already uses `redisConnection` for BullMQ
- `src/lib/queue/workers/task-worker.ts` already uses the Redis connection

---

## Verification

### Test Results
```
Test Files  1 failed | 35 passed (36)
     Tests  4 failed | 282 passed (286)
```

**All 4 failures are pre-existing** in `tests/smoke/task-lifecycle.test.ts` (quota mock assertion issues — unrelated to Redis changes).

### Key Tests Passed
| Test File | Status |
|-----------|--------|
| `src/lib/circuit-breaker.test.ts` | ✅ 20/20 |
| `src/lib/concurrency-limiter.test.ts` | ✅ 15/15 |
| `src/lib/sliding-window-rate-limit.test.ts` | ✅ 18/18 |
| `src/lib/rate-limit.test.ts` | ✅ 6/6 |
| `tests/verification/rate-limiter.verification.test.ts` | ✅ 5/5 |
| `tests/verification/circuit-breaker.verification.test.ts` | ✅ 9/9 |
| `tests/queue/*` | ✅ All passing |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    src/lib/redis.ts                         │
│    getRedisClient() — lazy ioredis connection               │
│    isRedisAvailable() — readiness check                     │
│    connectRedis() — explicit connect for BullMQ             │
│    Fallback: returns null → stores use in-memory            │
└──────────────┬──────────────────────────────────────────────┘
               │
     ┌─────────┼──────────┬──────────────────┐
     ▼         ▼          ▼                  ▼
┌─────────┐ ┌──────┐ ┌────────┐ ┌──────────────────┐
│Rate     │ │Sliding│ │Concur- │ │Circuit Breaker   │
│Limiter  │ │Window │ │rency   │ │                  │
│RateLimit│ │Sliding│ │Concurr-│ │CircuitBreaker    │
│Store    │ │Window │ │ency    │ │Store             │
│         │ │Store  │ │Store   │ │                  │
│INCR/    │ │ZADD/  │ │INCR/   │ │HASH (HSET/HGET)  │
│PEXPIRE  │ │ZCOUNT │ │DECR    │ │+ mem fallback    │
└─────────┘ └──────┘ └────────┘ └──────────────────┘
     │           │         │              │
     └───────────┴─────────┴──────────────┘
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
   ioredis (Redis)      Upstash REST API
   REDIS_HOST:6379      UPSTASH_REDIS_REST_URL
                        UPSTASH_REDIS_REST_TOKEN
```

---

## Configuration

### Option 1: Direct Redis (ioredis)
```env
REDIS_HOST=your-redis-host.com
REDIS_PORT=6379
```

### Option 2: Upstash (REST API — rate limiter only)
```env
RATE_LIMIT_STORE=upstash
UPSTASH_REDIS_REST_URL=https://your-upstash-host.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
```

### Option 3: Both (recommended for production)
```env
RATE_LIMIT_STORE=upstash
UPSTASH_REDIS_REST_URL=https://your-upstash-host.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
REDIS_HOST=your-redis-host.com
REDIS_PORT=6379
```

---

## Key Design Decisions

1. **Sync interface preserved**: All three store interfaces remain synchronous. Redis stores use an in-memory fallback for sync operations and sync to Redis asynchronously. This avoids changing hundreds of existing callers.

2. **Fire-and-forget Redis sync**: The circuit breaker and concurrency limiter use fire-and-forget async Redis writes. This means a brief window exists where in-memory state differs from Redis, but this is acceptable because:
   - In-memory is the source of truth for the local process
   - Redis provides cross-instance coordination on the next operation
   - The BullMQ queue handles distributed task processing separately

3. **Sliding window uses sorted sets**: ZADD with timestamps provides true sliding window semantics (unlike INCR+TTL which is fixed-window).

4. **No Upstash dependency for BullMQ**: BullMQ requires ioredis (not Upstash REST). The existing `queue/redis.ts` configuration is untouched.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/redis.ts` | **NEW** — Unified Redis client manager |
| `src/lib/sliding-window-rate-limit.ts` | Added `RedisSlidingWindowStore`, auto-detect Redis |
| `src/lib/concurrency-limiter.ts` | Added `RedisConcurrencyStore`, auto-detect Redis |
| `src/lib/circuit-breaker.ts` | Added `RedisCircuitBreakerStore`, auto-detect Redis |
| `src/lib/rate-limit.ts` | Added `RedisRateLimitStore`, updated store selection logic |
| `src/lib/production-readiness.ts` | Added Redis connection check, updated persistent rate limit check |

---

## Status: ✅ Complete

All stores now support Redis with automatic in-memory fallback. Production can run with either direct Redis, Upstash REST, or without Redis (in-memory only for development).
