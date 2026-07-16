import 'server-only';

import { generateTextWithOpenAI } from '@/lib/ai/text-provider';
import { logger } from '@/lib/logger';
import { increment, timing } from '@/lib/monitoring/metrics';
import { getShortTermMemory } from '@/lib/memory/short-term';
import type { Plan, PlanStep, StepKind } from './types';

const plannerLog = logger.child('planning:cot');

const PLANNER_SYSTEM_PROMPT = `You are a planning engine for an AI agency platform. Given a high-level goal, decompose it into a minimal, ordered list of concrete executable steps.

Return ONLY valid JSON of shape:
{
  "steps": [
    { "title": string, "description": string, "rationale": string, "kind": "action" | "reasoning" | "human_review", "requiresApproval": boolean }
  ]
}

Rules:
- Keep steps small and verifiable. Prefer 3-7 steps.
- Use kind "reasoning" for analysis/thinking steps and "action" for tool-executing steps.
- Use kind "human_review" + requiresApproval:true ONLY for steps that publish, spend money, delete data, or send messages to real users.
- Do not include dependencies; steps run in listed order.
- No prose outside the JSON.`;

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseSteps(raw: string): Array<{
  title: string;
  description: string;
  rationale: string;
  kind: StepKind;
  requiresApproval?: boolean;
}> {
  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('planner returned no JSON');
  }
  const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as {
    steps?: Array<{
      title?: string;
      description?: string;
      rationale?: string;
      kind?: string;
      requiresApproval?: boolean;
    }>;
  };
  if (!Array.isArray(parsed.steps)) {
    throw new Error('planner output missing steps[]');
  }
  return parsed.steps.map((s) => ({
    title: String(s.title ?? 'Untitled step'),
    description: String(s.description ?? ''),
    rationale: String(s.rationale ?? ''),
    kind: (s.kind === 'reasoning' || s.kind === 'human_review' ? s.kind : 'action') as StepKind,
    requiresApproval: Boolean(s.requiresApproval),
  }));
}

export interface PlanGoalInput {
  runId: string;
  workspaceId: string;
  agentType: string;
  goal: string;
  context?: Record<string, unknown>;
  /** When false, approval-gated steps are still created but not auto-approved. */
  maxSteps?: number;
}

export async function createPlan(input: PlanGoalInput): Promise<Plan> {
  const start = Date.now();
  const ts = new Date().toISOString();
  const planId = genId('plan');

  await getShortTermMemory(input.runId, input.workspaceId, input.agentType);

  const llm = await generateTextWithOpenAI({
    kind: 'planning.create',
    systemPrompt: PLANNER_SYSTEM_PROMPT,
    userPrompt: `Goal: ${input.goal}\n\nContext (JSON): ${JSON.stringify(input.context ?? {})}`,
    maxTokens: 1200,
    temperature: 0.3,
  });

  let steps: PlanStep[] = [];
  if (llm.ok) {
    try {
      const parsed = parseSteps(llm.text);
      steps = parsed.slice(0, input.maxSteps ?? 12).map((s, i) => ({
        id: genId('step'),
        kind: s.kind,
        title: s.title,
        description: s.description,
        rationale: s.rationale,
        dependsOn: i > 0 ? [genId('prev')] : [],
        status: 'pending' as const,
        requiresApproval: s.requiresApproval,
        attempts: 0,
        startedAt: null,
        finishedAt: null,
      }));
      // Fix dependsOn to reference real previous step ids.
      steps.forEach((step, i) => {
        step.dependsOn = i > 0 ? [steps[i - 1].id] : [];
      });
    } catch (err) {
      plannerLog.warn('Failed to parse planner output, falling back to single step', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (steps.length === 0) {
    // Deterministic fallback so the engine always produces a runnable plan.
    steps = [
      {
        id: genId('step'),
        kind: 'reasoning',
        title: 'Analyze goal',
        description: `Reflect on: ${input.goal}`,
        rationale: 'Establish understanding before acting.',
        dependsOn: [],
        status: 'pending',
        attempts: 0,
        startedAt: null,
        finishedAt: null,
      },
      {
        id: genId('step'),
        kind: 'action',
        title: 'Execute goal',
        description: input.goal,
        rationale: 'Carry out the primary objective.',
        dependsOn: [],
        status: 'pending',
        attempts: 0,
        startedAt: null,
        finishedAt: null,
      },
    ];
    if (steps[0].id) steps[1].dependsOn = [steps[0].id];
  }

  const plan: Plan = {
    id: planId,
    runId: input.runId,
    workspaceId: input.workspaceId,
    agentType: input.agentType,
    goal: input.goal,
    strategy: 'cot',
    steps,
    status: 'draft',
    createdAt: ts,
    updatedAt: ts,
    context: input.context ?? {},
  };

  timing('planning_create_ms', Date.now() - start);
  increment('planning_created_total', { strategy: 'cot', steps: steps.length });
  return plan;
}
