# Production Operations Launch Gate

Phase 5 adds a hard production readiness layer. The dashboard page is:

- `/dashboard/production`

The page does not display secret values. It only reports whether required
server-side configuration and operational controls are present.

## Spend-Control Settings

Paid ads stay blocked by default. The launch gate reads this structure from
`integration_settings.settings.production_operations`:

```json
{
  "paid_ads_enabled": false,
  "max_daily_ad_spend": null,
  "require_manual_confirmation": true,
  "allowed_providers": [],
  "launch_mode": "blocked"
}
```

Production values must be deliberately set by an owner/admin operational process:

```json
{
  "paid_ads_enabled": true,
  "max_daily_ad_spend": 250,
  "require_manual_confirmation": true,
  "allowed_providers": ["meta", "google_ads"],
  "launch_mode": "production"
}
```

Do not store provider tokens, webhook secrets, service-role keys, or API keys in
this JSON.

## Persistent Rate Limits

In-memory limits remain active for local/internal use. Full production readiness
requires persistent rate limits:

```text
RATE_LIMIT_STORE=upstash
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

The current adapter is ready for a Redis/Upstash store, but no external
dependency is required until those env vars are provisioned.

## Audit Marker

The launch gate treats runtime npm audit proof as a warning unless CI/release
sets:

```text
PRODUCTION_AUDIT_PASSED=true
PRODUCTION_AUDIT_DATE
PRODUCTION_AUDIT_COMMIT_SHA
```

This marker should only be set by the deployment pipeline after:

```bash
npm audit --audit-level=moderate
```

passes for the exact build being deployed.

## Monitoring Marker

Full production unlock also requires:

```text
OPERATIONAL_LOG_VISIBILITY_CONFIRMED=true
```

Set it only after confirming the Vercel project has deployment visibility,
runtime logs, build logs, and incident review access for the operator.
