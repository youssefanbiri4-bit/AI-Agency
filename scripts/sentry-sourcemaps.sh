#!/usr/bin/env bash
set -euo pipefail

# Manual Sentry source map upload for the AgentFlow-AI Next.js build.
#
# The primary upload path is `withSentryConfig` in next.config.ts, which runs
# automatically during `next build` when Sentry credentials are present.
# This script is for re-uploading maps after a build, or for environments where
# the build-time upload was disabled (SENTRY_UPLOAD_SOURCEMAPS=false).

if [ -z "${SENTRY_AUTH_TOKEN:-}" ]; then
  echo "[sentry-sourcemaps] SENTRY_AUTH_TOKEN is not set. Skipping upload." >&2
  exit 0
fi

: "${SENTRY_ORG:?SENTRY_ORG must be set}"
: "${SENTRY_PROJECT:?SENTRY_PROJECT must be set}"

RELEASE="${VERCEL_GIT_COMMIT_SHA:-${SENTRY_RELEASE:-agentflow-ai@${npm_package_version:-dev}}}"

echo "[sentry-sourcemaps] Uploading source maps for release ${RELEASE}"

npx -y @sentry/cli sourcemaps inject .next/static .next/server
npx -y @sentry/cli sourcemaps upload --release "$RELEASE" .next/static .next/server

echo "[sentry-sourcemaps] Done."
