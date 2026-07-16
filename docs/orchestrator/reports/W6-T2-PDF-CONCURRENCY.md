# W6-T2-PDF-CONCURRENCY — Safe PDF Generation Concurrency Limit

## Summary

Added a global semaphore to cap concurrent PDF generation at **2** simultaneous jobs. When the limit is hit, callers receive a clear error message ("PDF generation is busy, please try again later") instead of silently queueing or crashing.

## Where the limit is applied

The semaphore is at the single entry point — `generateServerPDF()` in `src/lib/reports/generate-server-pdf.ts`. This means **all** PDF generation paths are automatically protected:

| Trigger | Calls `generateServerPDF`? | Protected? |
|---|---|---|
| Dashboard "Download Client PDF" button | Yes (via `downloadClientReportPdfAction`) | ✅ |
| Dashboard "Save New Report" button | Yes (via `saveClientReport`) | ✅ |
| `POST /api/reports/client-pdf` (API route) | Yes (calls `downloadClientReportPdfAction`) | ✅ |
| `POST /api/reports/save` (API route) | Yes (calls `saveClientReport`) | ✅ |
| `GET /api/reports/share/[token]` (shared reports) | No — returns signed URL of saved PDF | ✅ (no regen) |

No changes were needed in the API routes, server actions, or client components — the error propagates naturally through existing `try/catch` blocks and is returned as a human-readable `error` field.

## Implementation

**File changed:** `src/lib/reports/generate-server-pdf.ts`

```typescript
const MAX_CONCURRENT_PDF = 2;
let activePdfCount = 0;

export class PdfConcurrencyError extends Error {
  constructor() {
    super(
      `PDF generation is busy (${activePdfCount} of ${MAX_CONCURRENT_PDF} slots in use). Please try again in a moment.`
    );
    this.name = 'PdfConcurrencyError';
  }
}

function acquirePdfSlot(): void {
  if (activePdfCount >= MAX_CONCURRENT_PDF) {
    throw new PdfConcurrencyError();
  }
  activePdfCount++;
}

function releasePdfSlot(): void {
  activePdfCount = Math.max(0, activePdfCount - 1);
}
```

`generateServerPDF` now wraps its body in `acquirePdfSlot()` / `try` / `finally` / `releasePdfSlot()`.

## Max concurrency chosen: **2**

- Puppeteer/Chromium is memory-heavy (each instance uses ~150–300 MB RSS)
- With 2 concurrent jobs, the process stays under 1 GB RSS even in the Puppeteer path
- The `pdf-lib` fallback path is lightweight and unlikely to be the bottleneck, but sharing the same slot keeps the design simple
- `MAX_CONCURRENT_PDF` is a module-level constant — trivially adjustable if needed

## Behavior when the limit is hit

1. `generateServerPDF()` synchronously throws a `PdfConcurrencyError`
2. In server actions (`downloadClientReportPdfAction`, `saveClientReport`), the error is caught by the existing `try/catch` and returned as `{ ok: false, error: "PDF generation is busy…" }`
3. In API routes, `{ ok: false }` is translated to HTTP 500 with the error message
4. In the client (`ClientReportButton.tsx`), the error is surfaced via the existing error handling (toast or alert)
5. The user sees: *"PDF generation is busy. Please try again in a moment."*

The limit is **reject**, not queue — no hidden backlog. The user retries manually, which is the clearest UX for an edge case that should be rare in practice.

## Verification

- `npm run typecheck` — 0 errors
- `npx vitest run` — 30 files, 203 tests, all passed
- Existing `generate-server-pdf.test.ts` continues to pass (sequential test never hits concurrency limit)
- Puppeteer path and pdf-lib fallback path are both covered by the same semaphore
- No changes to function signatures, no changes to callers
