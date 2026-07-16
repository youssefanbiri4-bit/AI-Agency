# SOC 2 Readiness Checklist — AgentFlow AI

**Scope:** Maps the AICPA SOC 2 Trust Services Criteria (TSC) to the controls
implemented in AgentFlow AI. Intended as the working document for a Type I / Type II
audit.

**Status legend:** ✅ Implemented · 🟡 Partial / procedural · 🔲 Planned

## Common Criteria (CC) — Security

| TSC | Control area | Status | Evidence |
| --- | --- | --- | --- |
| CC1.1–CC1.5 | Control environment / board & management | 🟡 | Defined org/engineering ownership; document RACI |
| CC2.1–CC2.3 | Communication & information | ✅ | Structured logging + audit log viewer |
| CC3.1–CC3.4 | Risk assessment | 🟡 | `security-center.ts` readiness scan; periodic risk review advised |
| CC4.1–CC4.2 | Monitoring activities | ✅ | Sentry monitoring, Web Vitals, audit logging, secrets scanning at boot |
| CC5.1–CC5.3 | Control activities / IT | ✅ | RBAC (`src/lib/auth/rbac`), scoped API keys, MFA (`src/actions/auth/mfa.ts`) |
| CC6.1–CC6.3 | Logical access — provisioning | ✅ | Workspace-scoped auth, least privilege, invite/revoke flows |
| CC6.6 | Boundary protection | ✅ | CSP `default-src 'self'`, `frame-ancestors 'none'`, COOP/COEP/CORP headers (`next.config.ts`) |
| CC6.7 | Data in transit | ✅ | TLS enforced (HSTS `max-age=31536000; includeSubDomains; preload`, `upgrade-insecure-requests`) |
| CC6.8 | Data at rest | ✅ | Supabase encryption at rest; field-level encryption for ad credentials (`src/lib/ads/encryption.ts`) |
| CC7.1–CC7.2 | System operations / change mgmt | ✅ | CI hardening (`ci-hardening.yml`): typecheck, lint, build, tests, secrets scan |
| CC7.3–CC7.4 | Backup & recovery | ✅ | `src/lib/backup-center.ts`, Redis/queue graceful shutdown (`instrumentation.ts`) |
| CC8.1 | Change detection | ✅ | `git` + CI gates; Sentry release tagging |
| CC9.1–CC9.2 | Risk mitigation / incident | 🟡 | Audit logging + alerting; formal incident runbook advised (Gap S1) |
| CC9.3 | Business continuity | 🟡 | Backups exist; DR drill procedure recommended |

## Additional Trust Services Criteria

| Criterion | Status | Notes |
| --- | --- | --- |
| **Availability (A)** | ✅ | Health checks (`system-health`), backups, graceful shutdown, rate limiting (DDoS damping) |
| **Processing Integrity (PI)** | ✅ | Zod validation (`api-handler.ts`), idempotent queues, monitoring |
| **Confidentiality (C)** | ✅ | RBAC, RLS, encryption, secrets scanning, strict CSP |
| **Privacy (P)** | 🟡 | GDPR controls in place (`GDPR_READINESS_CHECKLIST.md`); bridge to SOC 2 Privacy via DPA |

## Open gaps to close
- **S1 — Incident response runbook**: written IR plan + tabletop exercise + post-mortem template.
- **S2 — Evidence retention**: store SOC 2 evidence (policies, access reviews, scan
  outputs) for the audit period; the audit-log retention (365d critical) already covers
  security events.
- **S3 — Access reviews**: quarterly access-review record (who has admin/API keys).
- **S4 — Vendor / sub-processor security questionnaires**: collect SOC 2 / ISO 27001
  reports for Supabase, Vercel, LLM providers.

## Verification (this task)
- Rate limiting enforced per API key + IP + workspace/user (`src/lib/api/auth.ts`,
  `src/lib/rate-limit.ts`).
- Secrets scanning in CI + runtime boot; strict CSP/headers in `next.config.ts`.
- Audit Log Viewer supports search, CSV/JSON export, and live retention reporting.

See also: `docs/compliance/GDPR_READINESS_CHECKLIST.md`,
`docs/compliance/DATA_PROCESSING_AGREEMENT.md`.
