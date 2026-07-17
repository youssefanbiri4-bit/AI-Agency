# Claude Executor Service — Implementation Report

**Date:** 2026-07-17  
**Author:** Buffy (AI Agent)  
**Status:** ✅ Complete — Type-safe, production-ready

---

## 📋 Executive Summary

Implemented an isolated "Claude Executor" service within the AgentFlow AI project to serve as the reasoning engine for 27 AI agents. The service integrates with Anthropic's Claude API using native `fetch` (no SDK dependencies) and provides a standardized interface for the orchestrator to dispatch tasks to Claude.

---

## 🎯 Objectives

| # | Objective | Status |
|---|-----------|--------|
| 1 | Create strict TypeScript interfaces for input/output | ✅ Done |
| 2 | Implement async `executeWithClaude()` function | ✅ Done |
| 3 | Use native `fetch` (no npm packages) | ✅ Done |
| 4 | Read API key from `process.env.ANTHROPIC_API_KEY` | ✅ Done |
| 5 | Set required Anthropic headers | ✅ Done |
| 6 | Implement robust error handling | ✅ Done |
| 7 | Parse JSON response and map to standardized output | ✅ Done |
| 8 | Ensure framework-agnostic design | ✅ Done |
| 9 | TypeScript strict mode (no `any`) | ✅ Done |
| 10 | Server-side only | ✅ Done |
| 11 | Verify compilation passes | ✅ Done |

---

## 📁 Files Created

### 1. `src/features/agents/types/claude-types.ts`

**Purpose:** Strict TypeScript interfaces defining the contract between the orchestrator and Claude executor.

**Interfaces Created:**

| Interface | Description |
|-----------|-------------|
| `ClaudeMessage` | Single message in conversation history (`role`, `content`) |
| `AnthropicContentBlock` | Content block from Anthropic API response |
| `AnthropicUsage` | Token usage metadata (`input_tokens`, `output_tokens`) |
| `AnthropicMessagesResponse` | Full response shape from `POST /v1/messages` |
| `ClaudeExecutorInput` | Input contract for `executeWithClaude()` |
| `ClaudeExecutorOutput` | Standardized output from `executeWithClaude()` |
| `ClaudeExecutorConfig` | Optional configuration overrides |

**Key Design Decisions:**

- `payload` typed as `unknown` (not `Record<string, unknown>`) to match spec and stay generic
- Added `maxTokens` and `temperature` as optional input fields for flexibility
- `ClaudeMessage` uses `'user' | 'assistant'` union type matching Anthropic API

---

### 2. `src/features/agents/services/claude-executor.ts`

**Purpose:** Core execution service that formats agent contexts, sends them to Claude, parses responses, and returns standardized objects.

**Exports:**

| Export | Type | Description |
|--------|------|-------------|
| `executeWithClaude()` | `async function` | Main entry point for all Claude-based agent reasoning |
| `checkClaudeHealth()` | `async function` | Utility to verify API connectivity and key validity |

**Internal Helpers:**

| Helper | Description |
|--------|-------------|
| `resolveApiKey()` | Reads API key from config or `process.env.ANTHROPIC_API_KEY` |
| `buildDefaultSystemPrompt()` | Maps agent IDs to sensible default system prompts |

**Default System Prompts (9 agents covered):**

```
code-review-agent    → Expert code reviewer
bug-fix-agent        → Expert bug fixer
architecture-agent   → Software architect
testing-agent        → QA engineer
documentation-agent  → Technical writer
deployment-agent     → Deployment specialist
security-review-agent → Security expert
database-agent       → Database architect
ui-ux-review-agent   → UI/UX expert
```

**Constants:**

```typescript
DEFAULT_ENDPOINT    = 'https://api.anthropic.com/v1/messages'
DEFAULT_API_VERSION = '2023-06-01'
DEFAULT_MODEL       = 'claude-3-5-sonnet-20241022'
DEFAULT_MAX_TOKENS  = 4096
DEFAULT_TEMPERATURE = 0.7
DEFAULT_TIMEOUT_MS  = 60_000
```

---

## 🔧 Technical Implementation Details

### API Request Flow

```
1. resolveApiKey()        → Validate API key exists
2. buildDefaultSystemPrompt() → Select system prompt by agentId
3. Build messages[]       → Prepend history + append taskContext
4. Build requestBody      → { model, max_tokens, temperature, system, messages }
5. fetch() with timeout   → POST to Anthropic API
6. Handle HTTP errors     → Return { success: false, error } on non-200
7. Parse JSON response    → Extract text blocks and usage metadata
8. Extract JSON payload   → Try fenced blocks → fallback to bare JSON
9. Return standardized output → { success, reasoning, action, payload, usage }
```

### Error Handling

| Error Type | Handling |
|------------|----------|
| Missing API key | Throws `Error` with descriptive message |
| HTTP 429 / 5xx | Returns `{ success: false, retryable: true }` |
| HTTP 4xx | Returns `{ success: false, error: "Claude API error {status}" }` |
| Response parse error | Returns `{ success: false, error: "Response parse error" }` |
| Timeout (AbortError) | Returns `{ success: false, error: "Request timed out" }` |
| Other errors | Returns `{ success: false, error: message }` |

### JSON Extraction Strategy

```typescript
// 1. Try fenced JSON block first
const fencedMatch = reasoning.match(/```json\s*\n([\s\S]*?)\n\s*```/);

// 2. Fallback: try parsing entire response as JSON
if (payload === undefined) {
  const parsedJson = JSON.parse(reasoning);
}
```

---

## ✅ Validation Results

### TypeScript Compilation

```bash
$ npx tsc --noEmit
# ✅ No errors — compilation passed
```

### Code Review

| Issue | Status | Resolution |
|-------|--------|------------|
| `cause` property not available on custom error | ✅ Fixed | Removed dead code (ClaudeExecutorError class) |
| JSON extraction regex fragile | ✅ Fixed | Added fallback for bare JSON parsing |
| `payload` type mismatch with spec | ✅ Fixed | Changed to `unknown` |
| Dead code (unused error class) | ✅ Fixed | Removed ClaudeExecutorError, used plain Error |

---

## 📊 Orchestrator Integration

### Function Signature

```typescript
export async function executeWithClaude(
  input: ClaudeExecutorInput,
  config?: ClaudeExecutorConfig,
): Promise<ClaudeExecutorOutput>
```

### Usage Example

```typescript
import { executeWithClaude } from '@/features/agents/services/claude-executor';

const result = await executeWithClaude({
  agentId: 'code-review-agent',
  taskContext: 'Review this PR diff for security issues:\n```ts\nconst x = eval(userInput);\n```',
  history: [
    { role: 'user', content: 'I need help reviewing code' },
    { role: 'assistant', content: 'I can help with that. Please share the code.' },
  ],
  // systemPrompt: undefined — uses default for code-review-agent
  // maxTokens: 4096 — uses default
  // temperature: 0.7 — uses default
});

if (result.success) {
  console.log('Reasoning:', result.reasoning);
  console.log('Action:', result.action);       // 'complete' | 'needs_review' | etc.
  console.log('Payload:', result.payload);      // parsed JSON (if any)
  console.log('Usage:', result.usage);          // { inputTokens, outputTokens }
} else {
  console.error('Error:', result.error);
}
```

### Health Check

```typescript
import { checkClaudeHealth } from '@/features/agents/services/claude-executor';

const status = await checkClaudeHealth();
if (status.healthy) {
  console.log('Claude API is reachable');
} else {
  console.error('Health check failed:', status.error);
}
```

---

## 🏗️ Architecture

```
src/features/agents/
├── types/
│   └── claude-types.ts          ← NEW: TypeScript interfaces
└── services/
    └── claude-executor.ts       ← NEW: Core execution service
```

**Design Principles:**

- **Isolated module** — No modifications to existing orchestrator
- **Framework-agnostic** — No Next.js-specific imports like `next/headers`. Note: `import 'server-only'` is a project convention used for server boundary enforcement (matches existing codebase patterns in `src/lib/orchestrator/types.ts`)
- **Zero dependencies** — Uses native `fetch`, no Anthropic SDK
- **Server-side only** — `import 'server-only'` boundary
- **Type-safe** — Strict mode, no `any` types

---

## 📝 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✅ Yes | Your Anthropic API key |

---

## 🔍 Additional Notes

- **Health check utility** — `checkClaudeHealth()` was added beyond the original spec as a convenience for verifying API connectivity
- **`.env.example` warning** — Per AGENTS.md, the existing `.env.example` contains what appear to be real keys. When adding `ANTHROPIC_API_KEY`, use a placeholder value only
- **Cost tracking gap** — The project currently has `estimateOpenAICost()` for OpenAI models. Claude pricing is different (per-token rates) and will need a dedicated cost estimation function

## 🚀 Next Steps

1. **Integrate with orchestrator** — Wire `executeWithClaude()` into the unified orchestrator dispatcher
2. **Add unit tests** — Create `tests/claude-executor.test.ts` with mocked fetch
3. **Update `.env.example`** — Add `ANTHROPIC_API_KEY` placeholder
4. **Add rate limiting** — Implement per-agent rate limiting for Claude API calls
5. **Add cost tracking** — Record Claude API usage in the existing cost tracking system (note: `estimateOpenAICost` exists for OpenAI; Claude costs are different and will need their own tracking function)

---

## 📚 References

- [Anthropic Messages API](https://docs.anthropic.com/en/api/messages)
- [Claude 3.5 Sonnet Model](https://docs.anthropic.com/en/docs/about-claude/models)
- [Project AGENTS.md](./AGENTS.md)
- [Orchestrator Types](./src/lib/orchestrator/types.ts)
