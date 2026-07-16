# DATA PROCESSING AGREEMENT (Template)

**Important:** This is a template for review by qualified legal counsel. Replace all
`[BRACKETED]` placeholders before execution. It is provided to satisfy GDPR Art. 28 and
SOC 2 Privacy criteria readiness.

---

**Data Processing Agreement** entered into between:

- **Controller:** `[CUSTOMER LEGAL NAME]`, a `[JURISDICTION]` company, registered at
  `[ADDRESS]` ("**Controller**"); and
- **Processor:** AgentFlow AI, operated by `[PROVIDER LEGAL NAME]`, a company registered
  at `[ADDRESS]` ("**Processor**").

(each a "**Party**" and together the "**Parties**").

## 1. Subject matter and roles
1.1 The Processor provides the AgentFlow AI platform ("**Services**"), through which it
processes Personal Data on behalf of the Controller.
1.2 The Parties acknowledge their respective roles under GDPR (Regulation (EU) 2016/679)
and, where applicable, UK GDPR and Swiss FADP.

## 2. Details of processing
2.1 **Subject matter:** operation of the Controller's AI-agency workspace.
2.2 **Duration:** for the term of the Services agreement.
2.3 **Nature & purpose:** hosting, storing, and processing workspace content, user
accounts, task/agent metadata, and security audit logs.
2.4 **Categories of data subjects:** the Controller's employees, contractors, and
end-customers referenced in workspace content.
2.5 **Categories of Personal Data:** identity/contact data, authentication data,
workspace content, and system/security metadata (including IP hash and event logs).

## 3. Controller and Processor obligations
3.1 The Controller determines the purposes and means of processing and warrants a lawful
basis under Art. 6 GDPR.
3.2 The Processor shall:
(a) process Personal Data only on documented instructions from the Controller, including
this Agreement;
(b) ensure persons authorised to process are bound by confidentiality;
(c) implement technical and organisational measures described in **Annex 1**;
(d) assist the Controller via appropriate technical measures with Art. 15–22 obligations
(data-subject rights);
(e) assist the Controller with Art. 32–36 (breach notification, DPIA);
(f) at the Controller's choice, delete or return Personal Data on termination (Art. 28(3)(g));
(g) make available all information necessary to demonstrate compliance and allow audits.

## 4. Sub-processors
4.1 The Controller grants general written authorisation for the Processor to engage
sub-processors listed in **Annex 2**.
4.2 The Processor shall: inform the Controller of additions/replacements at least
`[30]` days in advance; impose data-protection obligations on sub-processors equivalent
to this Agreement; and remain fully liable for their performance.

## 5. Security measures
See **Annex 1** (maps to the implemented controls: encryption in transit (TLS/HSTS),
encryption at rest, RBAC + least privilege, scoped API keys, MFA, CSP/security headers,
audit logging with severity-based retention, secrets scanning, and rate limiting).

## 6. Personal data breaches
6.1 The Processor shall notify the Controller without undue delay and in any event within
`[24]` hours of becoming aware of a Personal Data Breach, providing the information
required under Art. 33.

## 7. International transfers
7.1 Where the Processor or a sub-processor transfers Personal Data outside the EEA/UK, it
shall rely on an appropriate safeguard (e.g. EU Standard Contractual Clauses, an
adequacy decision, or the sub-processor's certified programme).

## 8. Audit rights
8.1 The Processor shall allow the Controller (or an independent auditor) to audit
compliance on reasonable notice, no more than once per `12` months, subject to
confidentiality.

## 9. Term and termination
9.1 This Agreement terminates on expiry/termination of the Services agreement. Sections
3.2(f), 6, and 8 survive termination.

## 10. Governing law
10.1 This Agreement is governed by the laws of `[JURISDICTION]`.

---

### Annex 1 — Technical & Organisational Measures (summary)
- **Access control:** workspace-scoped authentication, RBAC least-privilege, MFA,
  scoped API keys, per-key/IP/workspace rate limiting.
- **Encryption:** TLS 1.2+ in transit (HSTS, `upgrade-insecure-requests`); encryption at
  rest (Supabase/Postgres); field-level encryption for credentials.
- **Integrity:** input validation (Zod), immutable append-only security audit log.
- **Availability:** backups, health checks, graceful shutdown.
- **Monitoring:** centralised logging, error tracking (Sentry), secrets scanning in CI and
  at runtime.
- **Retention:** severity-based audit-log retention (critical 365d / warning 180d /
  info 90d); data minimisation by design.

### Annex 2 — Sub-processors (non-exhaustive; confirm before signature)
| Sub-processor | Service | Location / Safeguard |
| --- | --- | --- |
| Supabase | Hosted Postgres + Auth + Storage | EU/US region; SCCs / DPA |
| Vercel | Hosting / edge delivery | SCCs / DPA |
| LLM providers (OpenAI / equivalent) | Task execution | Processor-to-sub-processor DPA |
| n8n (automation) | Workflow execution | Self-hosted or hosted DPA |
| Sentry | Error monitoring | SCCs / DPA |

*The Controller may request the current, version-controlled sub-processor list from the
Processor at any time.*
