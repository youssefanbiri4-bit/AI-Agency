# Claude Executor — Orchestrator Integration Report

**Date:** 2026-07-17  
**Status:** ✅ Complete — TypeScript compilation clean, code reviewed  
**Scope:** Wire `executeWithClaude()` into the orchestrator dispatcher + register Claude-backed tools

---

## Executive Summary

Integrated the isolated `Claude Executor` service (`src/features/agents/services/claude-executor.ts`) into the existing AgentFlow orchestrator system. The orchestrator can now route tasks to Anthropic's Claude API when an agent or tool is configured with `engine: 'claude'`, while preserving full backward compatibility with the existing OpenAI execution path.

**Key outcomes:**
- 6 files modified, 218 total changes (177 insertions, 41 deletions)
- Zero TypeScript compilation errors
- Graceful error handling — Claude failures don't crash the server
- Cost tracking consistent across both engine paths
- 9 Development & Engineering agents auto-registered with `engine: 'claude'`

---

## Files Modified

| # | File | Changes | Purpose |
|---|------|---------|---------|
| 1 | `src/features/agents/services/claude-executor.ts` | +6 lines | Re-export `ClaudeExecutorInput`, `ClaudeExecutorOutput`, `ClaudeExecutorConfig` types |
| 2 | `src/lib/orchestrator/types.ts` | +2 lines | Add `engine` field to `ToolDefinition` |
| 3 | `src/lib/agents/multi-agent-orchestrator.ts` | +135 / -41 lines | Add `engine` field to `AgentOrchestrationNode` + Claude routing in `executeNode()` |
| 4 | `src/lib/orchestrator/orchestrator.ts` | +64 lines | Claude routing in `callAgentTool()` + fix `durationMs` bug |
| 5 | `src/lib/orchestrator/tool-registry.ts` | +14 lines | Register 9 dev agents with `engine: 'claude'` |
| 6 | `.env.example` | +3 lines | Add `ANTHROPIC_API_KEY` environment variable |

---

## Detailed Changes

### 1. `src/features/agents/services/claude-executor.ts` — Type Re-exports

Added re-exports so consumers can import types directly from the executor module:

```typescript
export type {
  ClaudeExecutorInput,
  ClaudeExecutorOutput,
  ClaudeExecutorConfig,
} from '../types/claude-types';
```

**Impact:** Enables `import { ClaudeExecutorInput } from '@/features/agents/services/claude-executor'` in orchestrator files.

---

### 2. `src/lib/orchestrator/types.ts` — ToolDefinition Extension

Added optional `engine` field to `ToolDefinition`:

```typescript
export interface ToolDefinition {
  // ... existing fields ...
  /** AI engine to use for this tool. Defaults to 'openai'. */
  engine?: 'openai' | 'claude';
}
```

**Impact:** Minimal — optional field, defaults to `'openai'` via nullish coalescing. No existing registrations break.

---

### 3. `src/lib/agents/multi-agent-orchestrator.ts` — DAG Agent Routing

This file is the primary execution engine for multi-agent DAG workflows.

**Changes:**

1. **Interface extension** — Added `engine?: 'openai' | 'claude'` to `AgentOrchestrationNode`
2. **Import** — Added `executeWithClaude` and `ClaudeExecutorInput` from `@/features/agents/services/claude-executor`
3. **Routing in `executeNode()`** — When `node.engine === 'claude'`:
   - Builds a `ClaudeExecutorInput` from the node's `agentType`, `systemPrompt`, and rendered prompt
   - Calls `executeWithClaude()` instead of `generateTextWithOpenAI()`
   - Maps `ClaudeExecutorOutput` back to `AgentNodeResult` (output → reasoning, usage → cost)
   - Records cost with `engine: 'claude'` in metadata
   - On failure: sets `result.status = 'failed'` (graceful, no crash)

4. **When `node.engine !== 'claude'`** — Existing OpenAI path unchanged.

**Error handling:** Claude failures set `result.status = 'failed'` and `result.error` with the error message. The DAG continues executing remaining independent nodes. No server crash.

---

### 4. `src/lib/orchestrator/orchestrator.ts` — Tool-Based Orchestrator Routing

This file contains the `AgentFlowOrchestrator` class used for plan-based tool execution.

**Changes:**

1. **Import** — Added `executeWithClaude` and `ClaudeExecutorInput`
2. **Routing in `callAgentTool()`** — When `toolDef.engine === 'claude'`:
   - Builds `ClaudeExecutorInput` from tool definition and rendered parameters
   - Wraps with `withTimeout()` for orchestrator timeout management
   - On `success: true` — maps reasoning back to `ToolResult.output`, records cost
   - On `success: false` — throws `OrchestratorError` with `retryable: true` (caught by retry/circuit-breaker)

3. **Bug fix** — Fixed pre-existing `durationMs` bug:
   ```diff
   - durationMs: Date.now() - Date.now(),  // always 0
   + durationMs: Date.now() - startTime,    // correct elapsed time
   ```
   Applied to both Claude and OpenAI return paths.

**Design note — dual timeout:** `callAgentTool()` wraps `executeWithClaude()` with the orchestrator's `withTimeout()` (default 30s). `executeWithClaude` also has its own internal `AbortController` timeout (60s default). The outer orchestrator timeout fires first, making the inner one effectively dead code. For future cleanup, pass `ctx.timeoutMs` into `ClaudeExecutorConfig.timeoutMs` to keep a single timeout mechanism.

**Graceful fallback:** Claude errors become `OrchestratorError(TOOL_EXECUTION_FAILED)` with `retryable: true`. The existing `withRetry()` mechanism handles retries. If retries exhausted, circuit breaker records the failure. Server never crashes.

---

### 5. `src/lib/orchestrator/tool-registry.ts` — Auto-Registration

Added engine mapping for the 9 Development & Engineering agents that have built-in Claude system prompts in `claude-executor.ts`:

```typescript
const agentEngineMap: Record<string, 'openai' | 'claude'> = {
  'code-review-agent': 'claude',
  'bug-fix-agent': 'claude',
  'architecture-agent': 'claude',
  'testing-agent': 'claude',
  'documentation-agent': 'claude',
  'deployment-agent': 'claude',
  'security-review-agent': 'claude',
  'database-agent': 'claude',
  'ui-ux-review-agent': 'claude',
};
```

In `registerAllAgents()`:
```typescript
engine: agentEngineMap[agentId] ?? 'openai',
```

**Result:** Any orchestrator plan that includes these 9 agent types will automatically route through Claude — no manual `engine` setting needed.

---

### 6. `.env.example` — Environment Configuration

Added under a new "Anthropic (Claude)" section:

```bash
# Anthropic (Claude)
ANTHROPIC_API_KEY=your-anthropic-api-key-here
```

---

## Architecture — Execution Flow

```
┌─────────────────────────────────────────────────────┐
│                  Orchestrator Entry                  │
│  (Unified Orchestrator / AgentFlowOrchestrator)     │
└──────────┬──────────────────────┬───────────────────┘
           │                      │
           ▼                      ▼
┌──────────────────┐   ┌─────────────────────────────┐
│  DAG Execution   │   │  Plan/Tool Execution        │
│  (multi-agent-   │   │  (orchestrator.ts)          │
│   orchestrator)  │   │                             │
└────────┬─────────┘   └──────────┬──────────────────┘
         │                         │
         ▼                         ▼
┌──────────────────┐   ┌─────────────────────────────┐
│ Check node.engine│   │ Check toolDef.engine        │
│                  │   │                             │
│ 'claude' ────────┼───┼──► executeWithClaude()     │
│ 'openai'/undef ──┼───┼──► generateTextWithOpenAI() │
└──────────────────┘   └─────────────────────────────┘
         │                         │
         ▼                         ▼
┌─────────────────────────────────────────────────────┐
│           ClaudeExecutorOutput / ToolResult         │
│  - success: boolean                                 │
│  - reasoning: string                                │
│  - action: string                                   │
│  - payload?: unknown                                │
│  - usage?: { inputTokens, outputTokens }            │
└─────────────────────────────────────────────────────┘
```

---

## Verification

| Check | Status |
|-------|--------|
| `npx tsc --noEmit` | ✅ Zero errors |
| Code review (code-reviewer-mimo) | ✅ Approved with minor notes |
| Backward compatibility | ✅ All existing agents default to `engine: 'openai'` |
| Error handling | ✅ Graceful — no server crashes on Claude failure |
| Cost tracking | ✅ Both engines record costs with `engine` metadata |

---

## Known Gaps / Future Work

| Item | Priority | Description |
|------|----------|-------------|
| Multi-agent path parity | Medium | `unified-orchestrator.ts`'s `executeViaOrchestrator()` builds `AgentOrchestrationNode`s without looking up `globalToolRegistry`, so those nodes don't auto-inherit `engine: 'claude'`. |
| Env validation | Low | No startup check warns if `ANTHROPIC_API_KEY` is missing when Claude tools are registered. |
| Claude cost helper | Low | `claudeTokens * 0.000015` is a magic number in two files. Should extract to a shared `estimateClaudeCost()` helper. |
| Unit tests | Medium | No tests yet for the Claude routing logic in either orchestrator path. |

---

*Report generated by Buffy (AI Agent) — 2026-07-17*
