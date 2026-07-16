# ORCH-3 — n8n Migration + Integration + Testing

**Status:** ✅ Complete

## Summary
Built a unified orchestrator that bridges the existing n8n execution pipeline with the in-app DAG orchestrator, enabling multi-step workflow execution, playbook execution, cost control, and comprehensive monitoring.

## Migration Plan

### Current State (Pre-ORCH-3)
- **n8n Execution**: Production-grade webhook integration with BullMQ queue
- **In-App Orchestrator**: DAG-based multi-agent execution calling OpenAI directly
- **Two Separate Systems**: No bridge between n8n and orchestrator

### Target State (Post-ORCH-3)
- **Unified Orchestrator**: Single entry point for all workflow execution
- **Three Execution Modes**: `n8n` (single agent), `orchestrator` (multi-agent DAG), `hybrid` (mixed)
- **Playbook Execution**: DB-persisted playbooks are now executable
- **Cost Control**: Budget enforcement per workspace with plan-based limits
- **Monitoring**: Real-time health checks, metrics, and alerts

### Migration Path
1. **Existing n8n workflows** → Continue working unchanged via `mode: 'n8n'`
2. **New multi-agent workflows** → Use `mode: 'orchestrator'` for DAG execution
3. **Playbooks** → Load from DB, validate, execute via unified orchestrator
4. **Gradual migration** → No breaking changes; existing code works as-is

## Changes

### 1. Unified Orchestrator Engine

| File | Purpose |
|---|---|
| `src/lib/orchestrator/unified-orchestrator.ts` | Main orchestrator with mode routing |

**Features:**
- **Mode Router**: Automatically selects best execution mode based on agent count and n8n availability
- **n8n Mode**: Routes single-agent tasks through existing BullMQ queue
- **Orchestrator Mode**: Executes multi-agent DAGs via `multi-agent-orchestrator.ts`
- **Hybrid Mode**: Combines n8n for first agents + orchestrator for remaining
- **Budget Enforcement**: Checks cost budget before execution
- **Cost Recording**: Tracks costs per execution for analytics
- **Status Query**: Get workflow status by execution ID

**Execution Flow:**
```
Unified Workflow Request
  ↓
Resolve Execution Mode (n8n/orchestrator/hybrid)
  ↓
Check Cost Budget
  ↓
Execute via Selected Mode
  ↓
Record Costs
  ↓
Return Result
```

### 2. Cost Control System

| File | Purpose |
|---|---|
| `src/lib/orchestrator/cost-control.ts` | Budget management and cost tracking |

**Features:**
- **Plan-Based Limits**:
  - Free: $1/day, $10/month
  - Pro: $10/day, $100/month
  - Enterprise: $50/day, $500/month
- **Real-Time Budget Tracking**: Current day/month costs from usage_events
- **Hard Limit Enforcement**: Blocks execution when budget exceeded
- **Alert Thresholds**: Warning at 80%, critical at 95%, exceeded at 100%
- **Cost Summary**: Aggregated costs by agent type and model
- **Cost Recording**: Insert usage events for each workflow execution

**API:**
```typescript
// Check if workspace can afford an operation
const { allowed, reason, alert } = await canAfford(workspaceId, estimatedCost);

// Get current budget status
const budget = await getWorkspaceCostBudget(workspaceId);

// Get cost summary
const summary = await getCostSummary(workspaceId, 30);
```

### 3. Playbook Executor

| File | Purpose |
|---|---|
| `src/lib/orchestrator/playbook-executor.ts` | Execute DB-persisted workflow playbooks |

**Features:**
- **Playbook Loading**: Fetch playbook from `agent_workflow_playbooks` table
- **Step Validation**: Check for circular dependencies, missing deps, duplicate IDs
- **Dependency Resolution**: Convert playbook steps to DAG nodes
- **Execution**: Run via unified orchestrator
- **Usage Tracking**: Update playbook usage count and last_used_at
- **Cost Attribution**: Record costs per step with playbook metadata

**Validation Rules:**
- Reject empty playbooks
- Detect circular dependencies
- Detect unknown dependencies
- Detect duplicate step IDs
- Warn about short prompts (< 10 chars)
- Warn about many steps (> 10)

### 4. Monitoring & Health Checks

| File | Purpose |
|---|---|
| `src/lib/orchestrator/monitoring.ts` | Real-time monitoring and alerting |

**Features:**
- **Component Health Checks**: n8n, Redis, Database, Queue
- **Health Status**: `healthy`, `degraded`, `unhealthy`
- **Execution Metrics**: Success rate, duration, cost per workspace
- **Alert Evaluation**: Configurable thresholds for success rate, cost, duration, error rate
- **Performance Reports**: Comprehensive reports with recommendations

**Health Check Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-07-16T00:00:00.000Z",
  "components": {
    "n8n": { "status": "healthy", "latencyMs": 45 },
    "redis": { "status": "healthy", "latencyMs": 2 },
    "database": { "status": "healthy", "latencyMs": 12 },
    "queue": { "status": "healthy", "latencyMs": 2 }
  }
}
```

### 5. API Routes

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/orchestrator/execute` | POST | Execute a workflow |
| `/api/orchestrator/execute?executionId=xxx` | GET | Get workflow status |
| `/api/orchestrator/playbook` | POST | Execute a playbook |
| `/api/orchestrator/playbook?id=xxx` | GET | Get playbook details |
| `/api/orchestrator/health` | GET | System health check |
| `/api/orchestrator/health?workspaceId=xxx` | GET | Workspace metrics |
| `/api/orchestrator/health?workspaceId=xxx&report=true` | GET | Full performance report |

**Execute Workflow Request:**
```json
{
  "agentTypes": ["market_research", "content_writer"],
  "inputData": { "topic": "AI tools" },
  "mode": "orchestrator",
  "maxBudgetUsd": 5.0,
  "tags": ["research", "content"]
}
```

### 6. Integration Tests

| File | Purpose |
|---|---|
| `src/lib/orchestrator/__tests__/orchestrator.test.ts` | Test suite for orchestrator |

**Test Coverage:**
- Playbook validation (circular deps, unknown deps, duplicate IDs, short prompts)
- Cost control (budget enforcement, affordable operations)
- Alert evaluation (success rate, cost, duration thresholds)
- Type verification (exports exist and are functions)

## Verification
- ✅ All new files pass ESLint (0 errors, 0 warnings)
- ✅ TypeScript strict mode compatible
- ✅ Uses existing infrastructure (BullMQ, n8n, multi-agent-orchestrator)
- ✅ Backward compatible with existing n8n execution path
- ✅ No breaking changes to existing API

## Migration Checklist

| Step | Status | Notes |
|------|--------|-------|
| 1. Unified Orchestrator | ✅ | Bridges n8n + orchestrator |
| 2. Cost Control | ✅ | Plan-based budget limits |
| 3. Playbook Executor | ✅ | DB playbooks now executable |
| 4. Monitoring | ✅ | Health checks + metrics |
| 5. API Routes | ✅ | REST endpoints for all features |
| 6. Integration Tests | ✅ | Validation + cost control tests |
| 7. Backward Compatibility | ✅ | Existing n8n workflows unchanged |

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Unified Orchestrator                │
│  (src/lib/orchestrator/unified-orchestrator.ts) │
└─────────────────┬───────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
   ┌────▼────┐       ┌─────▼─────┐
   │  n8n    │       │ Orchestrator│
   │  Mode   │       │   Mode     │
   └────┬────┘       └─────┬─────┘
        │                   │
   ┌────▼────┐       ┌─────▼─────┐
   │ BullMQ  │       │  DAG      │
   │ Queue   │       │ Executor  │
   └────┬────┘       └─────┬─────┘
        │                   │
   ┌────▼────┐       ┌─────▼─────┐
   │  n8n    │       │  OpenAI   │
   │ Webhook │       │  API      │
   └─────────┘       └───────────┘
```
