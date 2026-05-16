# Final Go-Live Checklist

## Environment

- Confirm all secrets are configured only in Vercel/Supabase environments.
- Confirm no `.env` files are tracked in git.
- Confirm `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `N8N_CALLBACK_SECRET`,
  `CRON_SECRET`, and provider tokens are never exposed to the browser.
- Configure production `APP_BASE_URL`.

## Database

- Apply all Supabase migrations in order.
- Confirm RLS is enabled for workspace tables.
- Confirm `ad_connections` and callback idempotency tables remain service-role only.
- Run a smoke test with at least two workspaces to verify isolation.

## Security

- Verify production CSP contains no `unsafe-eval` and no script `unsafe-inline`.
- Keep style `unsafe-inline` as a known follow-up until nonce/hash styling is implemented.
- Verify Alex requires auth and workspace access before OpenAI.
- Verify n8n callbacks ignore duplicates and stale callbacks.
- Verify role checks for tasks, content, assets, releases, providers, scheduler, and backups.

## Operations

- Run `npm run lint`.
- Run `npx tsc --noEmit`.
- Run `npm run build`.
- Run `npm audit --audit-level=moderate`.
- Trigger a test task through n8n in staging.
- Confirm pending → processing → needs_review → completed still works.
- Confirm request changes returns a task to pending.
- Confirm manual scheduler can only run by allowed roles.

## Future Hardening

- Add Upstash Redis or Vercel KV-backed rate limiting.
- Replace remaining style `unsafe-inline` with nonce/hash-compatible styling.
- Add role-aware RLS helper functions and tighten write policies gradually.
- Review Turbopack NFT tracing warning after upgrading Next/Turbopack.
