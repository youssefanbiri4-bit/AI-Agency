import 'server-only';

import { logger } from '@/lib/logger';
import { increment, timing } from '@/lib/monitoring/metrics';
import { generateTextWithOpenAI } from '@/lib/ai/text-provider';
import { storeMemory } from '@/lib/memory/long-term';
import { addMessage, getShortTermMemory } from '@/lib/memory/short-term';
import { requestHumanReview } from '@/lib/human-review';
import type { Plan, PlanStep, ToolContext, ToolDefinition, ToolResult } from './types';

const reactLog = logger.child('planning:react');

const REACT_SYSTEM_PROMPT = `You are operating in a ReAct loop (Reason + Act). At each step you receive the current goal and the conversation so far (thoughts, tool calls, observations).

Respond with ONLY valid JSON:
{
  "thought": string,              // your reasoning for this step
  "action": string | null,        // tool name to call, or null to finish
  "actionInput": object,          // input for the tool
  "finish": boolean,              // true when the goal is satisfied
  "answer": string                // final answer when finish is true
}

Available tools will be listed by name. Never invent a tool. If no tool can make progress, set finish:true with an explanation in "answer".`;

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface ReactOptions {
  runId: string;
  workspaceId: string;
  agentType: string;
  goal: string;
  tools: ToolDefinition[];
  maxIterations?: number;
  /** When true, steps requiring approval block until a human decides. */
  enableHumanReview?: boolean;
}

interface ReactOutcome {
  plan: Plan;
  answer: string | null;
  iterations: number;
  blockedOnApproval: boolean;
}

function buildToolCatalog(tools: ToolDefinition[]): string {
  return tools.map((t) => `- ${t.name}: ${t.description}`).join('\n') || '(no tools available)';
}

function mapToolResultToStep(
  step: PlanStep,
  result: ToolResult,
  approvalRequestId?: string
): void {
  step.output = result.data ?? result.observation;
  step.status = result.ok ? 'completed' : 'failed';
  step.error = result.ok ? undefined : result.observation;
  if (result.requiresApproval) {
    step.requiresApproval = true;
    step.approvalRequestId = approvalRequestId;
    step.status = 'blocked';
  }
  step.finishedAt = new Date().toISOString();
}

export async function runReact(options: ReactOptions): Promise<ReactOutcome> {
  const start = Date.now();
  const maxIter = options.maxIterations ?? 8;
  const ts = new Date().toISOString();
  const plan: Plan = {
    id: genId('plan'),
    runId: options.runId,
    workspaceId: options.workspaceId,
    agentType: options.agentType,
    goal: options.goal,
    strategy: 'react',
    steps: [],
    status: 'running',
    createdAt: ts,
    updatedAt: ts,
    context: { tools: options.tools.map((t) => t.name) },
  };

  const memory = await getShortTermMemory(options.runId, options.workspaceId, options.agentType);
  const toolMap = new Map(options.tools.map((t) => [t.name, t]));
  const recall = async (q: Parameters<typeof import('@/lib/memory').recallMemories>[0]) => {
    const res = await import('@/lib/memory').then((m) => m.recallMemories(q));
    return res.data;
  };

  let answer: string | null = null;
  let blockedOnApproval = false;
  let iterations = 0;

  for (let i = 0; i < maxIter; i++) {
    iterations = i + 1;
    const history = memory.messages
      .map((m) => `[${m.role}] ${m.content}`)
      .join('\n');

    const llm = await generateTextWithOpenAI({
      kind: 'planning.react',
      systemPrompt: `${REACT_SYSTEM_PROMPT}\n\nAvailable tools:\n${buildToolCatalog(options.tools)}`,
      userPrompt: `Goal: ${options.goal}\n\nConversation so far:\n${history}`,
      maxTokens: 800,
      temperature: 0.4,
    });

    if (!llm.ok) {
      plan.status = 'failed';
      await addMessage(options.runId, options.workspaceId, options.agentType, {
        role: 'system',
        content: `LLM unavailable: ${llm.error}`,
      });
      break;
    }

    let decision: {
      thought: string;
      action: string | null;
      actionInput: unknown;
      finish: boolean;
      answer: string;
    };
    try {
      const jsonStart = llm.text.indexOf('{');
      const jsonEnd = llm.text.lastIndexOf('}');
      decision = JSON.parse(llm.text.slice(jsonStart, jsonEnd + 1));
    } catch {
      reactLog.warn('ReAct loop produced unparseable output', { iteration: i });
      plan.status = 'failed';
      break;
    }

    await addMessage(options.runId, options.workspaceId, options.agentType, {
      role: 'assistant',
      content: decision.thought,
    });

    if (decision.finish || !decision.action) {
      answer = decision.answer ?? null;
      plan.status = 'completed';
      break;
    }

    const tool = toolMap.get(decision.action);
    const stepId = genId('step');
    const step: PlanStep = {
      id: stepId,
      kind: 'action',
      title: decision.action,
      description: JSON.stringify(decision.actionInput ?? {}),
      rationale: decision.thought,
      dependsOn: plan.steps.length ? [plan.steps[plan.steps.length - 1].id] : [],
      status: 'in_progress',
      toolName: decision.action,
      input: decision.actionInput,
      attempts: 1,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    };
    plan.steps.push(step);

    if (!tool) {
      const obs = `Unknown tool: ${decision.action}`;
      await addMessage(options.runId, options.workspaceId, options.agentType, {
        role: 'tool',
        toolName: decision.action,
        content: obs,
      });
      step.status = 'failed';
      step.error = obs;
      step.finishedAt = new Date().toISOString();
      continue;
    }

    const ctx: ToolContext = {
      runId: options.runId,
      workspaceId: options.workspaceId,
      agentType: options.agentType,
      memory,
      recall,
    };

    let result: ToolResult;
    try {
      result = await tool.run(decision.actionInput, ctx);
    } catch (err) {
      result = {
        ok: false,
        observation: err instanceof Error ? err.message : 'tool threw',
      };
    }

    // Human-in-the-loop gating: if a tool or the result requests approval.
    if (options.enableHumanReview && (step.requiresApproval || result.requiresApproval)) {
      const req = await requestHumanReview({
        runId: options.runId,
        workspaceId: options.workspaceId,
        agentType: options.agentType,
        stepId,
        reason: result.approvalReason ?? step.rationale ?? 'Action requires human approval',
        context: { input: decision.actionInput, observation: result.observation },
        requestedAction: decision.action,
      });
      if (req.data) {
        step.requiresApproval = true;
        step.approvalRequestId = req.data.id;
        step.status = 'blocked';
        blockedOnApproval = true;
        plan.status = 'blocked';
        await addMessage(options.runId, options.workspaceId, options.agentType, {
          role: 'system',
          content: `Step ${stepId} blocked pending human approval (request ${req.data?.id}).`,
        });
        break;
      }
    }

    mapToolResultToStep(step, result);
    await addMessage(options.runId, options.workspaceId, options.agentType, {
      role: 'tool',
      toolName: decision.action,
      content: result.observation,
    });

    // Persist notable observations to long-term episodic memory.
    if (result.ok) {
      await storeMemory({
        workspaceId: options.workspaceId,
        agentType: options.agentType,
        memoryType: 'episodic',
        content: `${decision.action}: ${result.observation}`,
        category: 'react_trace',
        source: 'react',
        metadata: { stepId, runId: options.runId },
      });
    }

    if (step.status === 'failed') {
      plan.status = 'failed';
      break;
    }
  }

  plan.updatedAt = new Date().toISOString();
  timing('planning_react_ms', Date.now() - start, { iterations });
  increment('planning_react_runs_total', {
    strategy: 'react',
    completed: plan.status === 'completed' ? 1 : 0,
    blocked: blockedOnApproval ? 1 : 0,
  });
  return { plan, answer, iterations, blockedOnApproval };
}
