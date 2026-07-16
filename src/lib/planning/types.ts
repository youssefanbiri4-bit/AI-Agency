/**
 * Planning & Reasoning Engine — shared types.
 *
 * Supports two complementary strategies:
 *  - Chain-of-Thought (CoT) planning: decompose a goal into an ordered list of
 *    steps with explicit rationale, executed sequentially.
 *  - ReAct: interleave Reasoning + Acting — the agent thinks, picks a tool,
 *    observes the result, and repeats until the goal is satisfied or a step is
 *    gated for human approval.
 *  - Multi-step reasoning: structured hypothesis -> evidence -> conclusion
 *    chains that can be verified and stored to long-term memory.
 */

export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked' | 'approved' | 'rejected';

export type StepKind = 'action' | 'reasoning' | 'human_review' | 'observation';

export interface PlanStep {
  id: string;
  kind: StepKind;
  title: string;
  description: string;
  rationale: string;
  dependsOn: string[];
  status: StepStatus;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  /** When true the step must be approved by a human before execution (HITL). */
  requiresApproval?: boolean;
  approvalRequestId?: string;
  attempts: number;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface Plan {
  id: string;
  runId: string;
  workspaceId: string;
  agentType: string;
  goal: string;
  strategy: 'cot' | 'react';
  steps: PlanStep[];
  status: 'draft' | 'approved' | 'running' | 'completed' | 'failed' | 'blocked';
  createdAt: string;
  updatedAt: string;
  context: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  /** Execute the tool. Must be deterministic and side-effect aware. */
  run: (input: unknown, ctx: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
  runId: string;
  workspaceId: string;
  agentType: string;
  memory: import('@/lib/memory').ShortTermMemory;
  recall: (query: import('@/lib/memory').RecallQuery) => Promise<import('@/lib/memory').MemoryEntry[]>;
}

export interface ToolResult {
  ok: boolean;
  observation: string;
  data?: unknown;
  requiresApproval?: boolean;
  approvalReason?: string;
}

export interface ReasoningNode {
  id: string;
  type: 'hypothesis' | 'evidence' | 'conclusion' | 'assumption';
  content: string;
  supports?: string[];
  confidence: number;
  sourceStepId?: string;
}

export interface ReasoningChain {
  id: string;
  runId: string;
  workspaceId: string;
  agentType: string;
  goal: string;
  nodes: ReasoningNode[];
  conclusion: string | null;
  verified: boolean;
  createdAt: string;
}
