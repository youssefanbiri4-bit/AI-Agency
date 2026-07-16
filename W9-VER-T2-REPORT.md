# W9-VER-T2 — Alerts + Circuit Breaker + Rate Limiter Live Test

**Date:** 2026-07-13
**Engineer:** Agent (Verification Engineer)
**Task:** Live verification of alerts module (email + Slack), circuit breaker states/logging, and rate limiter 429 + headers + fail-open.

---

## Scope

Three resilience subsystems were verified with executable Vitest tests (no real network/DB —
`safeFetch` and `getSupabaseAdmin` are mocked, logger is mocked for log-line assertions).

| Subsystem | Module(s) | Test file |
|-----------|-----------|-----------|
| Alerts | `src/lib/alerts/*`, `src/lib/usage/quota-alerts.ts` | `tests/verification/alerts.verification.test.ts` |
| Circuit Breaker | `src/lib/circuit-breaker.ts` | `tests/verification/circuit-breaker.verification.test.ts` |
| Rate Limiter | `src/lib/rate-limit.ts`, `src/lib/sliding-window-rate-limit.ts` | `tests/verification/rate-limiter.verification.test.ts` |

**Result: 22/22 new verification tests pass**, plus the existing route test
`src/app/api/tasks/execute/route.test.ts` (5/5) confirms a real 429 end-to-end.

---

## 1. Alerts module (email + Slack)

Files: `src/lib/alerts/{index,channels,config,email,slack}.ts`, `src/lib/usage/quota-alerts.ts`.

| Check | Result |
|-------|--------|
| `dispatchAlert` routes to **both** email (Resend) and Slack channels | ✅ `safeFetch` called twice; Resend URL + Slack webhook URL present; Slack `text` === title; email `subject` contains `[CRITICAL]`; `to` contains recipient. |
| Email channel self-gates on `EMAIL_ALERTS_ENABLED !== 'true'` | ✅ No network call when disabled. |
| Slack channel self-gates on `SLACK_WEBHOOK_ENABLED !== 'true'` | ✅ No network call when disabled. |
| Global `ALERTS_ENABLED=false` short-circuits `dispatchAlert` | ✅ No channel invoked. |
| `alertHealthDegradation` → warning alert, source `health` | ✅ Dispatched; payload carries workspaceId. |
| `alertHighErrorRate` below threshold (`0.01 < 0.05`) | ✅ Not dispatched. |
| `alertHighErrorRate` above threshold (`0.5`) → critical alert | ✅ Dispatched; source `error-rate`. |
| `checkAndSendQuotaAlert` at 95% critical threshold | ✅ External alert dispatched with source `quota` (in-app notification path mocked to succeed). |
| Quota-alert debounce (1h window) | ✅ Second call within window → only **one** external dispatch (2 network calls, not 4). |

**Notes / observations**
- `dispatchAlert` wraps every channel in try/catch and never throws — alerting cannot crash the
  caller. Confirmed: a throwing channel is swallowed (logged warn), others still run.
- Channels read their env at `send()` time (not at construction), so enable/disable is dynamic.
- Quota alerts only dispatch externally **after** the in-app notification row is created; with no
  Supabase client the function logs a warn and returns early (graceful, no throw). Verified both paths.

---

## 2. Circuit Breaker (OPEN / HALF_OPEN logging)

File: `src/lib/circuit-breaker.ts`. Logger mocked so `Circuit OPEN` / `Circuit HALF_OPEN` log
lines are asserted directly.

| Check | Result |
|-------|--------|
| CLOSED circuit allows requests | ✅ |
| Trips to **OPEN** after `failureThreshold` (2) failures | ✅ State === `OPEN`. |
| `onOpen` callback fires + logs `Circuit OPEN` | ✅ Confirmed on a custom provider **and** on a real default provider (`openai-image`, threshold 3). |
| Blocks while OPEN, reports `cooldownRemainingMs > 0` | ✅ |
| Transitions to **HALF_OPEN** after cooldown, `onHalfOpen` fires + logs `Circuit HALF_OPEN` | ✅ |
| Recovers to **CLOSED** after `successThreshold` successes in HALF_OPEN; logs `Circuit CLOSED` | ✅ |
| `withCircuitBreaker` throws `CircuitBreakerOpenError` while OPEN | ✅ |
| `withCircuitBreaker` executes + records success while CLOSED | ✅ `totalSuccesses === 1`. |
| `getAllCircuitStates()` exposes state | ✅ |
| Half-open probe limiting (`halfOpenMaxRequests`) | ✅ Covered by existing unit suite (`src/lib/circuit-breaker.test.ts`, 18 cases). |

**Notes / observations**
- Default provider configs already wire `onOpen` → `circuitLogger.warn('Circuit OPEN', …)` and
  `onHalfOpen` → `circuitLogger.info('Circuit HALF_OPEN', …)`. The live test confirms these lines
  actually fire on state transition.
- `registerDefaultCircuitBreakers()` is available but **not auto-invoked at app startup** (pre-existing
  noted gap from W9-PERF-T2). The breaker still works on-demand via `getConfig` fallback, but the
  default logging configs only attach once a provider is first touched or the function is called.

---

## 3. Rate Limiter (429 + headers + fail-open)

Files: `src/lib/rate-limit.ts` (fixed window), `src/lib/sliding-window-rate-limit.ts` (sliding window).

| Check | Result |
|-------|--------|
| Fixed window allows up to `limit`, then blocks (`allowed:false`, `remaining:0`) | ✅ |
| `buildRateLimitExceededHeaders` yields 429 headers | ✅ `Retry-After` (integer seconds), `X-RateLimit-Remaining: 0`, `X-RateLimit-Reset` (epoch), `X-RateLimit-Allowed: false`. |
| Sliding window blocks at limit; `current` accurate | ✅ |
| `peek` does not increment the counter | ✅ `current` stays 0 after peek. |
| **Fail-open**: a throwing sliding-window store still `allowed:true` | ✅ Request permitted, never crashes. |
| End-to-end 429 from a real API route | ✅ `src/app/api/tasks/execute/route.test.ts` → "should return 429 when rate limited" passes (5/5). |

**Notes / observations**
- Fixed-window `checkRateLimit` re-throws on memory-store errors but degrades to `allowed:false` on
  upstash errors; the **sliding window** is the one with explicit fail-open (`allowed:true` on store
  error). Verified the fail-open path.
- Stores are injected via `setRateLimitStore` / `setSlidingWindowStore` (Redis-ready interfaces). The
  verification used the in-memory implementations; no external dependency required.

---

## Verification artifacts

- `tests/verification/alerts.verification.test.ts` — 8 tests
- `tests/verification/circuit-breaker.verification.test.ts` — 10 tests
- `tests/verification/rate-limiter.verification.test.ts` — 4 tests
- Reused: `src/lib/circuit-breaker.test.ts` (18), `src/lib/sliding-window-rate-limit.test.ts` (15),
  `src/app/api/tasks/execute/route.test.ts` (429).

**Run command:** `npx vitest run tests/verification`

**Result:** ✅ 22/22 verification tests pass. No regressions introduced.

---

## Findings / recommendations

| # | Finding | Severity | Recommendation |
|---|---------|----------|----------------|
| 1 | Default circuit breakers are not auto-registered at startup (`registerDefaultCircuitBreakers()` not called) | Low | Call it in app bootstrap so default OPEN/HALF_OPEN logging is active from first failure. |
| 2 | Quota external alerts only fire after the in-app notification insert succeeds | Info | Acceptable (notification is the primary signal); consider dispatching external alert even when Supabase is unavailable. |
| 3 | In-memory state for all three subsystems is lost on process restart | Low | Acceptable at current scale; Redis/Upstash stores are interface-ready. |
