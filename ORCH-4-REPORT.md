# ORCH-4-REPORT: Orchestrator Engine Parity + Claude Cost Extraction

**Date:** 2026-07-17  
**Status:** ✅ Complete  
**Scope:** Unified orchestrator engine routing + shared Claude cost utility  

---

## Executive Summary

Fixed an architectural parity gap where `unified-orchestrator.ts` did not inherit the `engine: 'claude'` mapping from the tool registry, causing development agents (code-review, bug-fix, etc.) to always route through OpenAI. Additionally, extracted a duplicated magic number for Claude cost estimation into a shared utility function.

---

## Problem Statement

### Issue 1: Engine Parity Gap
`unified-orchestrator.ts` builds `AgentOrchestrationNode` objects without consulting `globalToolRegistry`, so the `engine` field is never set. The `agentEngineMap` in `tool-registry.ts` maps 9 development agents to Claude, but this mapping was silently ignored by the unified orchestrator.

**Impact:** Development agents (code-review, bug-fix, architecture, testing, documentation, deployment, security-review, database, ui-ux-review) always executed via OpenAI instead of Claude when routed through the unified orchestrator.

### Issue 2: Duplicated Cost Calculation
Claude cost estimation used the magic number `claudeTokens * 0.000015` in two separate files:
- `src/lib/agents/multi-agent-orchestrator.ts`
- `src/lib/orchestrator/orchestrator.ts`

This combined input + output tokens and applied a flat rate, losing the distinction between Claude's $3/1M input vs $15/1M output pricing.

---

## Changes Made

### 1. `src/lib/usage/cost-tracking.ts` — Added `estimateClaudeCost()`

**New export function:**
```typescript
export function estimateClaudeCost(
  inputTokens: number = 0,
  outputTokens: number = 0,
): number
```

**Pricing constants (Claude 3.5 Sonnet):**
- Input: `$0.000003/token` → `$3.00 / 1M tokens`
- Output: `$0.000015/token` → `$15.00 / 1M tokens`

**Math verification:**
- 1M input tokens × 0.000003 = **$3.00** ✓
- 1M output tokens × 0.000015 = **$15.00** ✓

### 2. `src/lib/agents/multi-agent-orchestrator.ts` — Replaced Magic Number

**Before:**
```typescript
const claudeTokens = (claudeResult.usage?.inputTokens ?? 0) + (claudeResult.usage?.outputTokens ?? 0);
result.estimatedCostUsd = claudeTokens * 0.000015;
```

**After:**
```typescript
const inputTokens = claudeResult.usage?.inputTokens ?? 0;
const outputTokens = claudeResult.usage?.outputTokens ?? 0;
result.estimatedCostUsd = estimateClaudeCost(inputTokens, outputTokens);
```

**Improvement:** Now uses separate input/output token rates instead of a flat average.

### 3. `src/lib/orchestrator/orchestrator.ts` — Replaced Magic Number

**Before:**
```typescript
const claudeTokens = (claudeResult.usage?.inputTokens ?? 0) + (claudeResult.usage?.outputTokens ?? 0);
const cost = claudeTokens * 0.000015;
```

**After:**
```typescript
const inputTokens = claudeResult.usage?.inputTokens ?? 0;
const outputTokens = claudeResult.usage?.outputTokens ?? 0;
const cost = estimateClaudeCost(inputTokens, outputTokens);
```

### 4. `src/lib/orchestrator/unified-orchestrator.ts` — Fixed Engine Parity

**Added import:**
```typescript
import { globalToolRegistry } from '@/lib/orchestrator/tool-registry';
```

**Before (node construction):**
```typescript
const nodes: AgentOrchestrationNode[] = request.agentTypes.map((agentType, index) => ({
  id: `step-${index}`,
  name: `${agentType} step`,
  agentType,
  systemPrompt: `You are a ${agentType} agent. Execute the requested task.`,
  userPromptTemplate: index === 0
    ? JSON.stringify(request.inputData)
    : `{outputs.step-${index - 1}}`,
  dependsOn: index > 0 ? [`step-${index - 1}`] : [],
}));
```

**After (node construction):**
```typescript
const nodes: AgentOrchestrationNode[] = request.agentTypes.map((agentType, index) => {
  const toolDef = globalToolRegistry.get(agentType);
  return {
    id: `step-${index}`,
    name: `${agentType} step`,
    agentType,
    systemPrompt: `You are a ${agentType} agent. Execute the requested task.`,
    userPromptTemplate: index === 0
      ? JSON.stringify(request.inputData)
      : `{outputs.step-${index - 1}}`,
    dependsOn: index > 0 ? [`step-${index - 1}`] : [],
    engine: toolDef?.engine ?? 'openai',
  };
});
```

**Fallback behavior:** If an agent type is not found in the registry (e.g., ad-hoc agent strings), defaults to `'openai'`.

---

## Files Modified

| File | Change Type | Lines Changed |
|------|-------------|---------------|
| `src/lib/usage/cost-tracking.ts` | New function added | +15 |
| `src/lib/agents/multi-agent-orchestrator.ts` | Import + cost call | +3, -3 |
| `src/lib/orchestrator/orchestrator.ts` | Import + cost call | +3, -3 |
| `src/lib/orchestrator/unified-orchestrator.ts` | Import + node construction | +6, -1 |

**Total: 4 files modified, ~27 lines changed**

---

## Validation

### TypeScript Compilation
```
npx tsc --noEmit → 0 errors ✅
```

### Code Review
- **Code-reviewer-mimo** confirmed all changes are correct
- No `any` types introduced
- Pricing math verified against Claude 3.5 Sonnet rates
- Engine field correctly propagated from registry to nodes

### Test Suite
- 303/324 tests pass (pre-existing failures in `api/tasks/execute/route.test.ts` unrelated to this change)
- No regressions introduced by these changes

---

## Architecture Notes

### Engine Routing Flow (after fix)

```
Unified Orchestrator
  ↓ builds nodes with engine lookup
AgentOrchestrationNode[].engine = globalToolRegistry.get(agentType)?.engine
  ↓ routes to
multi-agent-orchestrator.ts executeNode()
  ↓ if engine === 'claude'
executeWithClaude() → estimateClaudeCost()
  ↓ if engine === 'openai' (default)
generateTextWithOpenAI() → estimateOpenAICost()
```

### Affected Agent Types (Claude-routed)

| Agent ID | Category |
|----------|----------|
| code-review-agent | Development |
| bug-fix-agent | Development |
| architecture-agent | Development |
| testing-agent | Development |
| documentation-agent | Development |
| deployment-agent | Development |
| security-review-agent | Development |
| database-agent | Development |
| ui-ux-review-agent | Development |

---

## Pricing Reference

### Claude 3.5 Sonnet
| Token Type | Rate | Per 1M Tokens |
|------------|------|---------------|
| Input | $0.000003 | $3.00 |
| Output | $0.000015 | $15.00 |

### OpenAI GPT-4o (existing)
| Token Type | Rate | Per 1M Tokens |
|------------|------|---------------|
| Input | $0.0000025 | $2.50 |
| Output | $0.00001 | $10.00 |

---

## Follow-up Recommendations

1. **Add unit tests** for `estimateClaudeCost()` to verify pricing math
2. **Enhance cost tracking metadata** to include `engine: 'claude'` vs `'openai'` in `recordCost()` calls for dashboard breakdowns
3. **Consider adding more agents** to the Claude engine mapping as the platform grows
