# src/core/ — Domain Logic

This directory contains the business logic and domain models for the platform.
Each subdirectory represents a bounded context / domain.

## Domains

| Directory | Responsibility | Current Source |
|-----------|---------------|----------------|
| `auth/` | Authentication, authorization, RBAC, sessions | `src/lib/auth/` |
| `billing/` | Billing plans, subscriptions, Stripe integration | `src/lib/billing/` |
| `agents/` | Agent definitions, analytics, recommendations | `src/lib/agents/` |
| `ai/` | AI provider integration (OpenAI text/image/video) | `src/lib/ai/` |
| `workflows/` | Workflow builder, review, templates, presets | `src/lib/agent-library/` |
| `usage/` | Usage tracking, quotas, cost tracking | `src/lib/usage/` |
| `marketing/` | Marketing domain, referrals, email campaigns | `src/lib/marketing/` |

## Migration Strategy

These barrel files re-export from current locations in `src/lib/`.
Over time, files should be moved into their core directories directly.
Always prefer importing from `src/core/*` over `src/lib/*` in new code.
