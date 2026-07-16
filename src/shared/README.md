# src/shared/ — Shared Utilities & Types

This directory contains code shared across features and domains.
Unlike `src/core/`, these modules have no business logic —
they are utilities, types, UI components, hooks, and infrastructure.

## Structure

| Directory | Contents | Current Source |
|-----------|----------|----------------|
| `types/` | TypeScript type definitions | `src/types/` |
| `lib/` | Core utilities (logger, network, security, etc.) | `src/lib/` (selected) |
| `ui/` | Reusable UI components | `src/components/ui/` |
| `hooks/` | Custom React hooks | `src/hooks/` |
| `i18n/` | Internationalization | `src/i18n/` |
| `data/` | Data access layer | `src/lib/data/` |
| `api/` | API utilities | `src/lib/api/` |
| `alerts/` | Alerting channels (email, slack) | `src/lib/alerts/` |
| `monitoring/` | Monitoring & metrics | `src/lib/monitoring/` |
| `security/` | Security utilities (CSP, headers) | `src/lib/security/` |
| `queue/` | Queue system (BullMQ, Redis) | `src/lib/queue/` |
| `storage/` | Storage utilities | `src/lib/storage/` |
| `notifications/` | Notification infrastructure | `src/lib/notifications/` |

## Migration Pattern

```
// Before (current)
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/Button';

// After (clean architecture)
import { logger } from '@/shared/lib';
import { Button } from '@/shared/ui';
```
