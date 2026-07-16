# Compliance Documentation — AgentFlow AI

This folder consolidates the compliance artifacts produced for security & compliance
readiness (task W14-T2).

| Document | Purpose |
| --- | --- |
| [GDPR_READINESS_CHECKLIST.md](./GDPR_READINESS_CHECKLIST.md) | Maps GDPR articles to implemented technical/organisational measures; lists open gaps. |
| [SOC2_READINESS_CHECKLIST.md](./SOC2_READINESS_CHECKLIST.md) | Maps SOC 2 Trust Services Criteria (CC/A/PI/C/P) to implemented controls; lists open gaps. |
| [DATA_PROCESSING_AGREEMENT.md](./DATA_PROCESSING_AGREEMENT.md) | Fillable DPA template (GDPR Art. 28) with sub-processor annex. |

## Implemented security controls (evidence)
- **Rate limiting** per API key + IP + workspace/user: `src/lib/rate-limit.ts`,
  `src/lib/api/auth.ts`.
- **Audit logging** (immutable, workspace-scoped) + viewer + CSV/JSON export +
  severity-based retention: `src/lib/data/audit-logs.ts`,
  `src/app/(dashboard)/dashboard/audit-logs/*`, migration
  `20260715000000_add_audit_log_retention_policy.sql`.
- **Secrets scanning** in CI (`scripts/security-audit.mjs`, `ci-hardening.yml`) and at
  runtime boot (`src/lib/secrets-scanning.ts`, `instrumentation.ts`).
- **Strict CSP + security headers**: `next.config.ts`.

> Status of each checklist: ✅ Implemented · 🟡 Partial / procedural · 🔲 Planned.
> Remaining gaps (G1–G3, S1–S4) should be closed before a formal audit.
