# W9-VER-T1 — Sentry Source Maps + Release Tracking Verification

**Task:** Verify Sentry source map upload, release tagging, and instrumentation setup.
**Date:** 2026-07-13
**Status:** ✅ Verified (config is correct; live upload requires credentials in CI/Vercel)

---

## Summary

Reviewed the full Sentry integration across `next.config.ts`, `instrumentation.ts`,
`sentry.client.config.js`, `sentry.server.config.js`, `src/lib/sentry-client.tsx`,
`sentry.properties`, and the `sentry:sourcemaps` script. Cross-checked behavior against
the installed SDK source (`@sentry/nextjs@10.54.0`, `@sentry/webpack-plugin@5.3.0`,
`@sentry/bundler-plugin-core`) to confirm release matching and graceful-skip behavior.

**Conclusion:** The configuration is structurally correct and will upload source maps +
create releases on Vercel **once `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` are
set as environment variables**. Without credentials the build skips Sentry cleanly and
does not fail. Some minor inconsistencies/gaps remain (see *Remaining Gaps*).

---

## What Was Verified

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | `withSentryConfig` applied in `next.config.ts` | ✅ | `next.config.ts:101` — `export default withSentryConfig(nextConfig, sentryOptions)` |
| 2 | `sentryOptions` wires org/project/authToken from env | ✅ | `next.config.ts:90-99` — `org: process.env.SENTRY_ORG`, `authToken: process.env.SENTRY_AUTH_TOKEN`, `sourcemaps.disable: SENTRY_UPLOAD_SOURCEMAPS==="false"` |
| 3 | Release name matches between build-time and runtime on Vercel | ✅ | Build-time `resolveReleaseName()` → `node.getSentryRelease()` which detects `VERCEL_GIT_COMMIT_SHA`; runtime `instrumentation.ts:6-9` uses `VERCEL_GIT_COMMIT_SHA \|\| SENTRY_RELEASE`. Both resolve to the same value on Vercel. |
| 4 | `VERCEL_GIT_COMMIT_SHA` is a recognized release source by the upload plugin | ✅ | Present in `@sentry/webpack-plugin` release-provider code (`VERCEL_GIT_COMMIT_SHA` found in `node_modules/@sentry/webpack-plugin`). |
| 5 | `instrumentation.ts` tags events with commit + app | ✅ | `instrumentation.ts:25-28` (nodejs) and `:33-36` (edge) set `git_commit` + `app=agentflow-ai` when `VERCEL_GIT_COMMIT_SHA` is present. |
| 6 | Build does NOT fail when credentials are absent | ✅ | `@sentry/bundler-plugin-core/dist/cjs/index.js:5991` — `if (!options.authToken) { logger.warn("No auth token provided. Will not upload source maps...") }` → upload skipped, build continues. |
| 7 | Production CSP permits Sentry ingest | ✅ | `next.config.ts:32` production `connect-src 'self' https:` allows `https://*.ingest.sentry.io`; `content-security-policy.ts:23` also lists it explicitly. |
| 8 | Manual re-upload fallback exists | ✅ | `scripts/sentry-sourcemaps.sh` + `npm run sentry:sourcemaps` (uses `@sentry/cli`). |
| 9 | Server vs client init split is correct (no double-init) | ✅ | SDK v10 only auto-loads `sentry.client.config.js` (client entry banner); server/edge init is via `instrumentation.ts` `register()`. No server-side double `Sentry.init`. |
| 10 | Sentry files typecheck | ✅ | No new TS errors from these files (`tsc --noEmit` only reports the unrelated pre-existing `signup/page.tsx:3`). |

---

## What Works

- **Source map upload pipeline is correctly wired** via `withSentryConfig`. On a build
  with `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` present, maps from
  `static/chunks/{pages,app}/**` and `server/**` are uploaded and deleted after upload.
- **Release tagging is consistent**: both build-time (`withSentryConfig` →
  `VERCEL_GIT_COMMIT_SHA`) and runtime (`instrumentation.ts` → `VERCEL_GIT_COMMIT_SHA`)
  use the commit SHA on Vercel, so uploaded maps resolve to the correct release.
- **Graceful degradation**: with no token, upload + release creation are skipped with a
  warning and the build succeeds (confirmed in SDK source, not just docs).
- **Tracing + errors** are initialized for nodejs and edge runtimes via `instrumentation.ts`,
  with `tracesSampleRate` 0.1 (prod) / 1.0 (non-prod).
- **CSP is compatible** with Sentry event delivery (`connect-src https:` covers ingest).
- **Manual upload script** (`sentry:sourcemaps`) provides an escape hatch if build-time
  upload is disabled.

---

## What Needs Config (to enable live upload)

These are **environment / CI settings**, not code changes. The code already reads them.

1. **`SENTRY_AUTH_TOKEN`** — required for upload. Generate in Sentry
   (Settings → Developer Settings → Auth Tokens). Not present in this environment.
2. **`SENTRY_ORG`** and **`SENTRY_PROJECT`** — required for upload. Currently only
   defined in `sentry.properties` (`org=agentflow-ai`, `project=agentflow-dashboard`),
   which `withSentryConfig` does **not** read; they must be set as env vars
   (or hardcoded into `sentryOptions`). `.env.example:40-41` documents them but commented out.
3. **`SENTRY_DSN`** — required for the SDK to actually send events at runtime. Only
   `SENTRY_DEBUG` is set in `.env.local`; `SENTRY_DSN` is absent, so local runtime is inert
   (expected for dev). Set in Vercel project env for production.
4. **`VERCEL_GIT_COMMIT_SHA`** — automatically provided by Vercel at build time; used for
   both release name and the `git_commit` tag. Confirmed available on Vercel.
5. **`SENTRY_UPLOAD_SOURCEMAPS`** — optional; defaults to enabled. Set `"false"` to disable.

> Note: `sentry.properties` is consumed by `@sentry/cli` for the manual
> `sentry:sourcemaps` script, but the `withSentryConfig` build path relies on the env vars
> above. Keep both in sync.

---

## Remaining Gaps

1. **Browser client events lack `git_commit` / `app` tags.**
   `sentry.client.config.js` initializes the browser SDK but does **not** call
   `Sentry.setTag('git_commit'|'app')`. Only server/edge events (via `instrumentation.ts`)
   carry these tags. → Client-side errors won't be filterable by commit/app in Sentry.
   *Fix:* add the two `Sentry.setTag(...)` calls to `sentry.client.config.js` (guarded by
   `VERCEL_GIT_COMMIT_SHA`).

2. **`sentry.server.config.js` is orphaned dead code.**
   In `@sentry/nextjs@10`, the SDK only auto-loads `sentry.client.config.js`; server/edge
   init is exclusively via `instrumentation.ts`. `sentry.server.config.js` is never
   executed (no server-config loader exists in the v10 webpack plugin). It is harmless but
   misleading and duplicates the init config. *Fix:* delete it, or fold its (identical)
   content into `instrumentation.ts` and document the removal.

3. **Inconsistent `debug` flag between the two init paths.**
   `instrumentation.ts:17` uses `debug: NODE_ENV !== 'production'`; `sentry.client.config.js:20`
   uses `debug: SENTRY_DEBUG === 'true'`. This means client debug logging is off by default
   while server debug logging is on outside prod. *Fix:* unify the expression.

4. **`release.name` not explicitly pinned in `sentryOptions`.**
   `withSentryConfig` auto-detects the release (`VERCEL_GIT_COMMIT_SHA` on Vercel, else git
   HEAD). This works today, but an explicit `release: { name: process.env.VERCEL_GIT_COMMIT_SHA
   || process.env.SENTRY_RELEASE }` would guarantee build-time and runtime releases always
   match even in non-Vercel CI. *Recommended hardening, not a defect.*

5. **Live upload not executed in this environment.**
   The actual `next build` upload could not be run here because (a) no `SENTRY_AUTH_TOKEN`
   is available, and (b) a full `next build` exceeds the 300s tool timeout on this machine.
   The skip-without-token behavior was instead verified directly in SDK source
   (`bundler-plugin-core:5991`). A real upload verification must be done on Vercel/CI with
   credentials.

6. **No `tunnelRoute` configured.**
   Events go directly to `*.ingest.sentry.io`. Ad-blockers may drop some client events.
   Optional: add `tunnelRoute` to proxy through the Next.js server (note: requires COOP/COEP
   review — `next.config.ts` sets `Cross-Origin-Embedder-Policy: require-corp`, which can
   affect cross-origin subresource loading).

---

## Verification Evidence (key references)

- `next.config.ts:90-101` — `sentryOptions` + `withSentryConfig` export.
- `instrumentation.ts:6-37` — release derivation + `Sentry.init` + tags for nodejs/edge.
- `sentry.client.config.js:10-21` — client init (no tags set).
- `node_modules/@sentry/nextjs/.../getFinalConfigObjectUtils.js:14` —
  `resolveReleaseName()` → `node.getSentryRelease()` (reads `VERCEL_GIT_COMMIT_SHA`).
- `node_modules/@sentry/bundler-plugin-core/dist/cjs/index.js:5991-5992` —
  missing `authToken` → warn + skip upload (build does not fail).
- `node_modules/@sentry/nextjs/build/cjs/config/webpack.js:331` —
  only `getClientSentryConfigFile` exists (server config file not auto-loaded in v10).

---

## Status

**W9-VER-T1: ✅ VERIFIED**

The Sentry source-map + release-tracking setup is correctly implemented and will function
in production once `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_DSN` are
set in the Vercel/CI environment. No code-breaking issues were found. Five minor gaps
(items 1–4 above) are recommended cleanups; item 5 (live upload) requires credentials and
a CI build to confirm end-to-end.
