# GDPR Readiness Checklist — AgentFlow AI

**Scope:** This checklist maps the EU General Data Protection Regulation (Regulation
(EU) 2016/679) to the technical and organisational measures already implemented in
AgentFlow AI, and flags any remaining gaps to close before a formal assessment.

**Status legend:** ✅ Implemented · 🟡 Partial / procedural · 🔲 Planned

| GDPR Article | Requirement | Status | Evidence / Control |
| --- | --- | --- | --- |
| Art. 5(1)(c) | Data minimisation | ✅ | RBAC + scoped API keys (`src/lib/auth/rbac`, `src/lib/data/api-keys.ts`) |
| Art. 5(1)(e) | **Storage limitation** | ✅ | Severity-based audit-log retention (critical 365d / warning 180d / info 90d) — `src/lib/data/audit-logs.ts`, `supabase/migrations/20260715000000_add_audit_log_retention_policy.sql`, `clean_old_audit_logs()` cron |
| Art. 5(2) | Accountability | ✅ | Immutable, workspace-scoped security audit log (`security_audit_logs`) + viewer at `/dashboard/audit-logs` |
| Art. 6 | Lawful basis | 🟡 | Consent + ToS + workspace agreements required at signup; lawful-basis selection is a product/legal responsibility |
| Art. 9 | Special-category data | ✅ | No special-category data collected by design; inputs are agency/ops metadata |
| Art. 15–20 | Data-subject rights (access, rectification, erasure, portability) | 🟡 | Supabase row-level security enables per-workspace access; a self-service export/erasure workflow is recommended (see Gap G1) |
| Art. 25 | Data protection by design & by default | ✅ | Least-privilege RBAC, per-key scopes, `default-src 'self'` CSP, `upgrade-insecure-requests` |
| Art. 30 | Records of processing | ✅ | Security audit log records actor, event, entity, IP hash, and metadata |
| Art. 32 | **Security of processing** | ✅ | Encryption at rest (Supabase/Postgres), TLS (HSTS + `upgrade-insecure-requests`), field-level encryption for ad credentials (`src/lib/ads/encryption.ts`), CSP, rate limiting (`src/lib/rate-limit.ts`), secrets scanning (`scripts/security-audit.mjs`, `src/lib/secrets-scanning.ts`) |
| Art. 33–34 | Breach notification (72h) | 🟡 | Audit logging + alerting exists; a formal breach-runbook + supervisory-authority notification template is recommended (Gap G2) |
| Art. 35 | DPIA | 🔲 | Conduct a DPIA before processing high-risk deployments |
| Art. 28 | Processor agreements | 🟡 | Data Processing Agreement template provided (`docs/compliance/DATA_PROCESSING_AGREEMENT.md`); sub-processor register maintained (see DPA §Sub-processors) |
| Art. 44–49 | International transfers | 🟡 | Sub-processors (Supabase, Vercel, LLM providers) are documented; SCCs assumed via provider terms |

## Open gaps to close
- **G1 — Data-subject export/erasure self-service**: add an admin "Export workspace
  data" and "Delete workspace" flow (Supabase `delete` with cascade) gated by MFA.
- **G2 — Breach response runbook**: document detection → containment → 72h authority
  notification → data-subject notification steps; wire to the audit-log alerting.
- **G3 — Consent records**: store per-workspace consent/ToS acceptance timestamp.

## Verification (this task)
- Retention policy surfaces in the Audit Log Viewer with live "eligible for deletion"
  counts (W14-T2 enhancement).
- Secrets scanning runs in CI (`ci-hardening.yml`) and at runtime boot
  (`instrumentation.ts`).
- Strict CSP + security headers applied (`next.config.ts`).

See also: `docs/compliance/SOC2_READINESS_CHECKLIST.md`,
`docs/compliance/DATA_PROCESSING_AGREEMENT.md`.
