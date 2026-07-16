import 'server-only';

import { generateTextWithOpenAI } from '@/lib/ai/text-provider';
import { logger } from '@/lib/logger';
import { increment, timing } from '@/lib/monitoring/metrics';
import { storeMemory } from '@/lib/memory/long-term';
import type { ReasoningChain, ReasoningNode } from './types';

const reasoningLog = logger.child('planning:reasoning');

const REASONING_SYSTEM_PROMPT = `You are a structured multi-step reasoning engine. Given a question/goal and any available evidence, produce a reasoning chain.

Return ONLY valid JSON:
{
  "nodes": [
    { "type": "assumption" | "hypothesis" | "evidence" | "conclusion", "content": string, "confidence": number, "supports": string[] }
  ],
  "conclusion": string,
  "verified": boolean
}

Rules:
- "supports" lists the ids (0-based index into the nodes array) this node supports.
- Evidence nodes must reference real provided facts, not guesses.
- "verified" should be true only when the conclusion is fully supported by evidence nodes.
- No prose outside the JSON.`;

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface ReasonInput {
  runId: string;
  workspaceId: string;
  agentType: string;
  goal: string;
  evidence?: string[];
  /** Persist the verified conclusion to long-term semantic memory. */
  persist?: boolean;
}

function normalizeNodes(rawNodes: unknown[]): ReasoningNode[] {
  return rawNodes.map((n, i) => {
    const node = (n ?? {}) as Record<string, unknown>;
    const supports = Array.isArray(node.supports)
      ? (node.supports as unknown[]).map((s) => String(s))
      : [];
    return {
      id: String(i),
      type: (['assumption', 'hypothesis', 'evidence', 'conclusion'].includes(String(node.type))
        ? node.type
        : 'assumption') as ReasoningNode['type'],
      content: String(node.content ?? ''),
      supports,
      confidence: typeof node.confidence === 'number' ? node.confidence : 0.5,
    };
  });
}

export async function reason(input: ReasonInput): Promise<ReasoningChain> {
  const start = Date.now();
  const ts = new Date().toISOString();
  const evidenceBlock = (input.evidence ?? []).map((e, i) => `[E${i}] ${e}`).join('\n') || '(no evidence provided)';

  const llm = await generateTextWithOpenAI({
    kind: 'planning.reason',
    systemPrompt: REASONING_SYSTEM_PROMPT,
    userPrompt: `Goal/Question: ${input.goal}\n\nEvidence:\n${evidenceBlock}`,
    maxTokens: 1000,
    temperature: 0.2,
  });

  let nodes: ReasoningNode[] = [];
  let conclusion: string | null = null;
  let verified = false;

  if (llm.ok) {
    try {
      const jsonStart = llm.text.indexOf('{');
      const jsonEnd = llm.text.lastIndexOf('}');
      const parsed = JSON.parse(llm.text.slice(jsonStart, jsonEnd + 1)) as {
        nodes?: unknown[];
        conclusion?: string;
        verified?: boolean;
      };
      nodes = normalizeNodes(Array.isArray(parsed.nodes) ? parsed.nodes : []);
      conclusion = typeof parsed.conclusion === 'string' ? parsed.conclusion : null;
      verified = Boolean(parsed.verified);
    } catch (err) {
      reasoningLog.warn('Failed to parse reasoning output', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (nodes.length === 0) {
    nodes = [
      { id: '0', type: 'assumption', content: input.goal, supports: [], confidence: 0.5 },
    ];
    conclusion = null;
    verified = false;
  }

  const chain: ReasoningChain = {
    id: genId('reason'),
    runId: input.runId,
    workspaceId: input.workspaceId,
    agentType: input.agentType,
    goal: input.goal,
    nodes,
    conclusion,
    verified,
    createdAt: ts,
  };

  if (input.persist && verified && conclusion) {
    await storeMemory({
      workspaceId: input.workspaceId,
      agentType: input.agentType,
      memoryType: 'semantic',
      content: conclusion,
      category: 'reasoning',
      source: 'reasoning-engine',
      confidence: nodes.reduce((a, n) => a + n.confidence, 0) / Math.max(1, nodes.length),
      metadata: { chainId: chain.id, goal: input.goal },
    });
  }

  timing('planning_reason_ms', Date.now() - start);
  increment('planning_reason_runs_total', { verified: verified ? 1 : 0 });
  return chain;
}
