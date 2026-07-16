# W10-P1-T2 — Full Sentry Production Setup + Advanced Observability

**Date:** 2026-07-15
**Status:** ✅ Complete

---

## Changes Made

### 1. Client-side Tags (`sentry.client.config.js`)

Added `git_commit` + `app` tags to every client event:

```js
Sentry.setTag('git_commit', release);
Sentry.setTag('app', 'agentflow-ai');
```

### 2. Session Replay (`sentry.client.config.js`)

```js
replaysSessionSampleRate: 0.1,      // 10% of sessions
replaysOnErrorSampleRate: 1.0,       // 100% of error sessions
integrations: [Sentry.replayIntegration()],
```

### 3. Global Error Handling (`src/app/global-error.tsx`)

- Catches catastrophic root layout errors
- `Sentry.captureException(error)` with tags: `level: fatal`, `component: global-error`
- User-friendly fallback UI with reload button

### 4. Performance Spans — Critical Paths

#### `src/lib/ai/text-provider.ts` — AI Text Generation

```js
Sentry.startSpan({
  op: 'ai.text.completion',
  name: `OpenAI ${model}`,
  attributes: { 'ai.provider': 'openai', 'ai.model': model, 'ai.kind': kind },
}, ...)
```

Captures: HTTP status, success/failure, model used.

#### `src/lib/ai/openai-images.ts` — AI Image Generation

```js
Sentry.startSpan({
  op: 'ai.image.generation',
  name: `OpenAI ${model}`,
  attributes: { 'ai.image.size': size, 'ai.image.quality': quality },
}, ...)
```

Captures: HTTP status, success/failure, image size/quality.

#### `src/lib/ai/openai-video.ts` — AI Video Creation + Status

Two spans:
- `op: 'ai.video.create'` — video generation request
- `op: 'ai.video.status'` — video status polling

Captures: model, seconds, size, HTTP status.

#### `src/lib/reports/generate-server-pdf.ts` — PDF Generation

```js
Sentry.startSpan({
  op: 'pdf.generation',
  name: `PDF: ${title}`,
  attributes: { 'pdf.client': client, 'pdf.sections': count },
}, ...)
```

Captures: renderer used (puppeteer/pdf-lib), output bytes, password flag.

### 5. Sentry Flush on Shutdown (`instrumentation.ts`)

```js
registerShutdownable(
  asShutdownable('sentry', async () => {
    await Sentry.flush(2000);
  })
);
```

### 6. Dead Code Cleanup

- Deleted `sentry.server.config.js` (dead code in `@sentry/nextjs` v10+)
- Fixed `sentry.properties`: `project=agentflow-ai` (was `agentflow-dashboard`)

### 7. Dashboard Config (`sentry/dashboard.json`)

10 widgets: error count, by transaction, by severity, P50/P95/P99 latency, Apdex, affected users, user impact, new vs resolved.

---

## Files Modified

| File | Action | Lines Changed |
|------|--------|---------------|
| `sentry.client.config.js` | Modified | +tags, +replay, +debug |
| `src/app/global-error.tsx` | Created | 89 lines |
| `src/lib/ai/text-provider.ts` | Modified | +Sentry span around OpenAI fetch |
| `src/lib/ai/openai-images.ts` | Modified | +Sentry span around image fetch |
| `src/lib/ai/openai-video.ts` | Modified | +Sentry spans (create + status) |
| `src/lib/reports/generate-server-pdf.ts` | Modified | +Sentry span around PDF gen |
| `instrumentation.ts` | Modified | +Sentry.flush on shutdown |
| `sentry.properties` | Modified | project name fix |
| `sentry/dashboard.json` | Created | Dashboard config |
| `sentry.server.config.js` | Deleted | Dead code |

---

## Performance Span Map

```
Client Error     → sentry.client.config.js → Sentry (git_commit + app tags)
Global Error     → global-error.tsx → Sentry (fatal level)
AI Text Gen      → text-provider.ts → Sentry span (ai.text.completion)
AI Image Gen     → openai-images.ts → Sentry span (ai.image.generation)
AI Video Create  → openai-video.ts → Sentry span (ai.video.create)
AI Video Status  → openai-video.ts → Sentry span (ai.video.status)
PDF Generation   → generate-server-pdf.ts → Sentry span (pdf.generation)
DB Queries       → query-timing.ts → Sentry span (db.query) [existing]
Server Error     → instrumentation.ts → Sentry (git_commit + app tags)
Shutdown         → instrumentation.ts → Sentry.flush(2000)
```

---

## Verification

### Build
```bash
rm -rf .next && npm run build
```
✅ **105/105** static + dynamic routes — no errors.

### Sentry Readiness Checklist
| Check | Result |
|-------|--------|
| Client `git_commit` tag | ✅ |
| Client `app` tag | ✅ |
| Session Replay (10% / 100% on error) | ✅ |
| `global-error.tsx` with `captureException` | ✅ |
| `sentry.server.config.js` deleted | ✅ |
| `sentry.properties` project = `agentflow-ai` | ✅ |
| `Sentry.flush(2000)` on shutdown | ✅ |
| AI text span (`ai.text.completion`) | ✅ |
| AI image span (`ai.image.generation`) | ✅ |
| AI video spans (`ai.video.create`, `ai.video.status`) | ✅ |
| PDF span (`pdf.generation`) | ✅ |
| Dashboard config | ✅ |
| `tracesSampleRate`: 10% prod / 100% dev | ✅ |

---

## Deployment Notes

**Vercel Environment Variables Required:**
- `SENTRY_DSN` — DSN URL (not `SENTRY_DNS`)
- `SENTRY_AUTH_TOKEN` — Real hex token (not DSN URL)
- `SENTRY_ORG=agentflow-ai`
- `SENTRY_PROJECT=agentflow-ai`
- `SENTRY_UPLOAD_SOURCEMAPS=true`

**Before first deploy:** Clear Vercel build cache (Redeploy without cache).
