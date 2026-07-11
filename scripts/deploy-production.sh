#!/usr/bin/env bash
# AgentFlow AI — production deploy orchestrator
# Usage:
#   ./scripts/deploy-production.sh              # preflight + deploy + smoke
#   ./scripts/deploy-production.sh --preflight  # checks only (no deploy)
#   ./scripts/deploy-production.sh --smoke-only # post-deploy smoke against APP_BASE_URL
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PREFLIGHT_ONLY=false
SMOKE_ONLY=false
SKIP_MIGRATION=false
SKIP_DEPLOY=false

for arg in "$@"; do
  case "$arg" in
    --preflight) PREFLIGHT_ONLY=true ;;
    --smoke-only) SMOKE_ONLY=true ;;
    --skip-migration) SKIP_MIGRATION=true ;;
    --skip-deploy) SKIP_DEPLOY=true ;;
    -h|--help)
      echo "Usage: $0 [--preflight] [--smoke-only] [--skip-migration] [--skip-deploy]"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

log() { printf '\n▶ %s\n' "$*"; }
fail() { echo "✗ $*" >&2; exit 1; }

GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
log "Release commit: $GIT_SHA"

if [[ "$SMOKE_ONLY" == true ]]; then
  log "Post-deploy smoke only"
  npm run smoke:prod
  exit $?
fi

log "Phase 1 — Preflight (local)"
npm run verify:env || fail "Core env vars missing — set in .env.local or export before deploy"
npm test || fail "Unit tests failed"
npm run test:smoke || fail "Smoke tests failed"
npm run security:audit || fail "Security audit failed"
npm run build || fail "Production build failed"

if [[ "$PREFLIGHT_ONLY" == true ]]; then
  log "Preflight complete — safe to deploy"
  echo "Next:"
  echo "  1. supabase login && supabase link --project-ref <PROD_REF> && supabase db push"
  echo "  2. vercel login && npx vercel --prod --yes"
  echo "  3. npm run smoke:prod"
  exit 0
fi

if [[ "$SKIP_MIGRATION" != true ]]; then
  log "Phase 2 — Supabase migrations (production)"
  if command -v supabase >/dev/null 2>&1 || npx supabase --version >/dev/null 2>&1; then
    if npx supabase projects list >/dev/null 2>&1; then
      npx supabase db push || fail "supabase db push failed — link project first"
      log "Migrations pushed"
    else
      echo "⚠ Supabase CLI not authenticated — run: supabase login"
      echo "  Then: supabase link --project-ref <PROD_REF> && supabase db push"
    fi
  else
    echo "⚠ Supabase CLI unavailable — install or use Dashboard SQL editor"
  fi
fi

if [[ "$SKIP_DEPLOY" != true ]]; then
  log "Phase 3 — Vercel production deploy"
  if npx vercel whoami >/dev/null 2>&1; then
    npx vercel --prod --yes || fail "Vercel deploy failed"
    log "Vercel deploy triggered"
  else
    fail "Vercel not authenticated — run: npx vercel login (or set VERCEL_TOKEN)"
  fi
fi

log "Phase 4 — Post-deploy smoke"
npm run smoke:prod || fail "Post-deploy smoke failed — check production URL and redeploy"

log "Deploy pipeline complete"