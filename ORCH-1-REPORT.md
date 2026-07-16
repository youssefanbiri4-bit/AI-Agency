# ORCH-1: Master Orchestrator Core + Tool System

**Status:** ✅ Complete  
**Timestamp:** 2026-07-16  

---

## Overview

Built the **AgentFlow Master Orchestrator Core** — a unified system for registering AI agents as tools, executing orchestration plans with DAG-based dependency resolution, and handling errors with retry logic. The system wraps the existing multi-agent orchestrator and Alex tool registry into a single, extensible core.

---

## 1. Core Implementation

### `src/lib/orchestrator/` — Package Structure

| File | Purpose |
|------|---------|
| `types.ts` | All TypeScript types: `ToolDefinition`, `ToolCall`, `OrchestrationPlan`, `OrchestrationResult`, `OrchestratorConfig`, `OrchestratorError`, etc. |
| `tool-registry.ts` | `ToolRegistry` class — registers all 31 agents as tools with categories, risk levels, parameters, validation, and search |
| `error-handler.ts` | Error classification, exponential backoff retry (`withRetry`), timeout guard (`withTimeout`), and error reporting |
| `orchestrator.ts` | `AgentFlowOrchestrator` class — plan creation, DAG resolution, step execution, tool calling via OpenAI, history tracking, stats |
| `index.ts` | Barrel re-export of all public types and classes |

### `AgentFlowOrchestrator` — Key Capabilities

- **Plan Creation** — Validates steps, detects cycles, resolves dependencies
- **DAG Execution** — Topological sort → level-by-level execution (parallel within level)
- **Step Parameter Resolution** — `{steps.step_id.output}` template syntax for inter-step data flow
- **Tool Calling** — Routes execution through OpenAI text provider with per-agent system prompts
- **Config Management** — Timeout, retry, concurrency, circuit breaker toggles
- **History & Stats** — Execution history, per-tool usage counters, aggregate statistics
- **Metrics** — Sentry spans, Prometheus counters/timings for plans and steps

---

## 2. Tool Registry

### Design: Every Agent = Tool

The `ToolRegistry` automatically registers all 31 agents from `src/lib/agents.ts` as tools.

### Categories

| Category | Agents |
|----------|--------|
| `research` | market_research, competitor_analysis, audience_persona, product_idea, seo_keyword, strategy_planner |
| `content` | social_media_content, copywriting, ads_script, email_marketing, blog_seo_article, visual_brief, offer_builder, content_creator |
| `sales` | lead_finder, lead_qualifier, outreach_message, crm_update, customer_support, outreach |
| `development` | code-review-agent, bug-fix-agent, architecture-agent, testing-agent, documentation-agent, deployment-agent, security-review-agent, database-agent, ui-ux-review-agent |
| `analytics` | analytics_report, report |

### Risk Levels

| Level | Meaning |
|-------|---------|
| `read_only` | Safe reads (research, code review, security review) |
| `draft_only` | Generates drafts without side effects (content, copy, plans) |
| `requires_confirmation` | Potentially impactful (lead finding, CRM, deployment) |

### Features

- **Lookup**: `get()`, `getAll()`, `getEnabled()`, `getByCategory()`, `getByDepartment()`, `search()`
- **Parameter Validation**: `validateParameters()` checks required fields, enum values, types
- **Lifecycle**: `enable()`, `disable()`, `unregister()`
- **Metrics**: `count()`, `getCategoryCounts()`

---

## 3. Tool Calling + Execution Engine

### Execution Flow

```
createPlan(steps)
  → validatePlan (cycle detection, dependency check, tool existence)
  → executePlan
    → resolveExecutionOrder (topological sort → levels)
    → for each level (parallel batch):
      → executeStep
        → check dependencies resolved
        → resolve parameter templates
        → validate parameters
        → circuit breaker check
        → withRetry:
          → withTimeout:
            → executeTool
              → callAgentTool (OpenAI text generation)
        → record success/failure
        → track metrics
  → aggregate results
  → record history
```

### Inter-Step Data Flow

Steps can reference outputs of previous steps using template syntax:

```
{steps.previous_step_id.output}
```

Parameters are resolved before execution, enabling chained agent pipelines.

---

## 4. Error Handling + Retry Logic

### Error Classification

All errors are classified with:
- **Code**: `TOOL_NOT_FOUND`, `TOOL_DISABLED`, `TOOL_TIMEOUT`, `TOOL_EXECUTION_FAILED`, `INVALID_PARAMETERS`, `DEPENDENCY_FAILED`, `CIRCUIT_OPEN`, `CONCURRENCY_LIMIT`, `PLAN_VALIDATION_FAILED`, `CYCLE_DETECTED`, `INTERNAL_ERROR`
- **Severity**: `low` / `medium` / `high` / `critical`
- **Retryable**: Flag indicating if retry is appropriate

### Retry with Exponential Backoff

The `withRetry()` function provides:
- Configurable `maxRetries` (default: 3)
- Exponential backoff: `baseDelay * 2^attempt` (clamped to `maxDelayMs`)
- Jitter (±30% random) to prevent thundering herd
- Per-attempt `onRetry` callback for logging
- Returns `RetryResult<T>` with attempt count and total duration

### Timeout Guard

`withTimeout()` wraps any async function with an `AbortController` timer, throwing `OrchestratorError.TOOL_TIMEOUT` if exceeded.

### Circuit Breaker Integration

Each tool call checks the existing circuit breaker before execution, recording success/failure after. This prevents cascading failures when an AI provider is degraded.

---

## 5. Integration Points

### Existing Systems Used

| System | Usage |
|--------|-------|
| `src/lib/agents.ts` | Agent definitions → tool registration |
| `src/lib/ai/text-provider.ts` | `generateTextWithOpenAI` for tool execution |
| `src/lib/logger.ts` | Structured logging |
| `src/lib/monitoring/metrics.ts` | Prometheus counters and timings |
| `src/lib/circuit-breaker.ts` | Circuit state checks and recording |
| `src/lib/usage/cost-tracking.ts` | AI usage cost recording |
| `@sentry/nextjs` | Performance tracing via `startSpan` |

### Extends

The existing `multi-agent-orchestrator.ts` DAG-based execution pattern is preserved and enhanced in `AgentFlowOrchestrator` with:
- Tool-based abstraction (agents are registered as tools)
- Parameter validation
- Retry logic with backoff
- Execution history
- Per-tool usage stats

---

## 6. Verification

### Type Checking

```bash
npx tsc --noEmit --pretty src/lib/orchestrator/*.ts
# Result: No errors from orchestrator files
```

### File Overview

```
src/lib/orchestrator/
├── types.ts           # 310 lines — all type definitions
├── tool-registry.ts   # 280 lines — tool registry with agent registration
├── error-handler.ts   # 240 lines — retry, timeout, error classification
├── orchestrator.ts    # 520 lines — AgentFlowOrchestrator core
└── index.ts           # 30 lines — barrel export
```

**Total: ~1,380 lines** of production orchestrator code.

---

## 7. Usage Example

```typescript
import { AgentFlowOrchestrator, globalToolRegistry } from '@/lib/orchestrator';

const orch = new AgentFlowOrchestrator();

const plan = orch.createPlan({
  name: 'Market Research Pipeline',
  description: 'Research competitors and generate content strategy',
  steps: [
    {
      id: 'step-1',
      toolId: 'competitor_analysis',
      name: 'Analyze Competitors',
      parameters: {
        competitors: 'Company A, Company B',
        industry: 'AI SaaS',
      },
      dependsOn: [],
    },
    {
      id: 'step-2',
      toolId: 'strategy_planner',
      name: 'Create Strategy',
      parameters: {
        objective: 'Market differentiation',
        timeline: '6_months',
      },
      dependsOn: ['step-1'],
    },
  ],
  workspaceId: 'ws_123',
  tags: ['research', 'strategy'],
});

const result = await orch.executePlan(plan);
console.log(result.status); // 'completed' | 'partial' | 'failed'
console.log(orch.getStats());
```

---

## Status: ✅ Complete

All four objectives achieved:

1. ✅ **Master Orchestrator Core** — `AgentFlowOrchestrator` with plan creation, DAG execution, history, stats
2. ✅ **Tool Registry System** — 31 agents registered as tools with categories, risk levels, parameter validation
3. ✅ **Tool Calling + Execution Engine** — Step execution with parameter resolution, dependency management, parallel batches
4. ✅ **Error Handling + Retry Logic** — Exponential backoff, timeout guard, circuit breaker integration, error classification
