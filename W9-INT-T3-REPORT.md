# W9-INT-T3 — Concurrency Limiter Integration

**Task:** Wire `src/lib/concurrency-limiter.ts` into heavy operations: PDF generation, AI generation (text + image), bulk operations, and long-running jobs. Use named slots (`AI_GENERATION`, `PDF_GENERATION`, `BULK_OPERATION`), choose fail-fast vs queue per context, add reasonable timeouts, and preserve the existing `MAX_CONCURRENT_PDF`.

**Date:** 2026-07-13
**Status:** ✅ Complete
**Library:** `src/lib/concurrency-limiter.ts` (`InMemoryConcurrencyStore` + `withConcurrencyLimit` helper + `CONCURRENCY_SLOTS` + `DEFAULT_MAX_CONCURRENCY`)

---

## Summary

The shared concurrency limiter is now applied at the provider level so every caller (server actions, API routes, cron) benefits uniformly. Three named slots are used:

| Slot | Default max | Strategy | Where |
|------|-------------|----------|-------|
| `PDF_GENERATION` | **2** (preserves legacy `MAX_CONCURRENT_PDF`) | **Fail-fast** — reject when busy (a slow browser launch should not be queued) | `generateServerPDF` |
| `AI_GENERATION` | 3 | **Queue** (timeout 20s) — a waiting user request waits briefly for a free slot instead of being rejected | `generateMarketingText` (text), `generateImageWithOpenAI` (image), `createVideoWithOpenAI` (video) |
| `BULK_OPERATION` | 1 | **Fail-fast** — reject overlapping runs so a second cron/scheduler execution can't double-process items | `runContentStudioScheduler` |

`ConcurrencyLimitError` thrown by the limiter is caught at each boundary and converted into the function's existing failure/result shape (or a skipped summary for the scheduler), so **no caller contract changes** and the limiter can never crash a request path.

---

## Files Modified

| # | File | Change |
|---|------|--------|
| 1 | `src/lib/reports/generate-server-pdf.ts` | Replaced the bespoke `activePdfCount`/`acquirePdfSlot`/`releasePdfSlot`/`PdfConcurrencyError` with `withConcurrencyLimit(CONCURRENCY_SLOTS.PDF_GENERATION, …, { maxConcurrency: MAX_CONCURRENT_PDF, failOnQueue: true })`. `MAX_CONCURRENT_PDF = 2` retained. |
| 2 | `src/lib/ai/text-provider.ts` | `generateMarketingText` wrapped in `withConcurrencyLimit(AI_GENERATION, …, { failOnQueue: false, timeoutMs: 20_000 })`; `ConcurrencyLimitError` → friendly "busy" `failed` result. |
| 3 | `src/lib/ai/openai-images.ts` | `generateImageWithOpenAI` network call wrapped in `withConcurrencyLimit(AI_GENERATION, …, { failOnQueue: false, timeoutMs: 20_000 })` (keeps the existing circuit breaker); busy → `failed` result. |
| 4 | `src/lib/ai/openai-video.ts` | `createVideoWithOpenAI` wrapped in `withConcurrencyLimit(AI_GENERATION, …, { failOnQueue: false, timeoutMs: 20_000 })`; busy → `failed` result. |
| 5 | `src/lib/content-studio/scheduler.ts` | `runContentStudioScheduler` wrapped in `withConcurrencyLimit(BULK_OPERATION, …, { failOnQueue: true })` (extracted `runSchedulerInternal`); overlap → returns empty summary + `content_studio_scheduler_skipped_busy` event. |

## Design notes

- **Fail-fast vs queue:**
  - *PDF* and *Bulk scheduler* fail-fast because they are either very heavy (browser launch) or must not overlap (idempotency). Rejecting is safer than queuing.
  - *AI generation* queues with a 20s timeout — users expect to wait for generation; failing fast would be poor UX. The timeout bounds the wait so a stuck slot can't block forever.
- **`MAX_CONCURRENT_PDF` preserved:** the legacy constant still drives `maxConcurrency`, so behaviour is identical to before (2 concurrent PDFs) but is now observable/overrideable through the shared limiter and `getAllSlots()`.
- **No new dependencies / no secrets** — uses the existing in-memory store. The interface is Redis-ready (`setConcurrencyStore`) for distributed deployments later.
- **Error isolation:** every boundary catches `ConcurrencyLimitError` and returns the same result type the caller already handles; the limiter's `release()` always runs via `finally`.

## Callers unaffected (verified)

- `src/actions/reports/actions.ts` already catches `generateServerPDF` errors generically → now surfaces the limiter's "busy" message.
- `src/app/api/cron/content-studio-scheduler/route.ts` already catches errors → overlapping scheduler runs now return a clean 200 with an empty summary instead of a 500.
- AI consumers (`content-generation.ts`, `ai-image.ts`, `ai-studio`) consume the existing result shapes unchanged.

## Verification

- `tsc --noEmit` — no errors in changed files (only 2 pre-existing unrelated errors: `signup/page.tsx`, `content-studio.ts:373`).
- `eslint` (`npm run lint`) — **0 errors**. (Pre-existing unused-`logger` import warnings in `text-provider.ts`/`openai-images.ts` are untouched and unrelated.)

## Notes / follow-ups

- Task execution (`n8n.worker.ts` / `task-worker.ts`) is managed by the queue worker and was intentionally left out; it is the natural next candidate for a dedicated slot if needed.
- `src/lib/ads/instagram-publishing.ts` (batch social publishing) is another candidate for `BULK_OPERATION`.
- For multi-instance (serverless) deployments, swap the in-memory store for a Redis-backed `ConcurrencyStore` via `setConcurrencyStore` so limits are enforced across instances.
