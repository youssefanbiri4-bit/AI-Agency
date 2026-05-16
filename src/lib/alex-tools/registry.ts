import 'server-only';

import {
  getAgentLibrarySummaryTool,
  getAiStudioSummaryTool,
  getAutomationBlueprintsSummaryTool,
  getContentStudioSummaryTool,
  getPromptLibrarySummaryTool,
  getProviderHealthSummaryTool,
  getQualityReviewSummaryTool,
  getRecentTasksTool,
  getReportsSummaryTool,
  getTaskSummaryTool,
  getWorkflowPlaybooksSummaryTool,
  searchKnowledgeBaseTool,
} from './read-tools';
import {
  prepareContentStudioDraftTool,
  prepareFollowUpMessageDraftTool,
  prepareN8nBlueprintDraftTool,
  preparePlaybookDraftTool,
  prepareQualityReviewDraftTool,
  prepareTaskDraftTool,
  prepareWorkflowPlanDraftTool,
} from './draft-tools';
import type { AlexToolContext, AlexToolDefinition, AlexToolResult, AlexToolRunSummary } from './types';

const blockedToolIds = [
  'run_n8n_workflow',
  'publish_content',
  'schedule_content',
  'create_live_ad',
  'spend_money',
  'delete_data',
  'send_email',
  'github_commit',
  'github_push',
  'open_pull_request',
  'change_provider_settings',
];

const readTools: AlexToolDefinition[] = [
  { id: 'get_task_summary', name: 'Get Task Summary', description: 'Read compact task counts and recent task labels.', category: 'read', riskLevel: 'read_only', allowed: true, handler: getTaskSummaryTool },
  { id: 'get_recent_tasks', name: 'Get Recent Tasks', description: 'Read recent safe task summaries.', category: 'read', riskLevel: 'read_only', allowed: true, handler: getRecentTasksTool },
  { id: 'get_content_studio_summary', name: 'Get Content Studio Summary', description: 'Read compact Content Studio readiness summaries.', category: 'read', riskLevel: 'read_only', allowed: true, handler: getContentStudioSummaryTool },
  { id: 'get_prompt_library_summary', name: 'Get Prompt Library Summary', description: 'Read compact Prompt Library categories and titles.', category: 'read', riskLevel: 'read_only', allowed: true, handler: getPromptLibrarySummaryTool },
  { id: 'get_agent_library_summary', name: 'Get Agent Library Summary', description: 'Read compact Agent Library category counts.', category: 'read', riskLevel: 'read_only', allowed: true, handler: getAgentLibrarySummaryTool },
  { id: 'get_workflow_playbooks_summary', name: 'Get Workflow Playbooks Summary', description: 'Read workflow preset and saved playbook summaries.', category: 'read', riskLevel: 'read_only', allowed: true, handler: getWorkflowPlaybooksSummaryTool },
  { id: 'get_automation_blueprints_summary', name: 'Get Automation Blueprints Summary', description: 'Read planning-only automation blueprint summaries.', category: 'read', riskLevel: 'read_only', allowed: true, handler: getAutomationBlueprintsSummaryTool },
  { id: 'get_quality_review_summary', name: 'Get Quality Review Summary', description: 'Read saved quality review summaries if available.', category: 'read', riskLevel: 'read_only', allowed: true, handler: getQualityReviewSummaryTool },
  { id: 'get_ai_studio_summary', name: 'Get AI Studio Summary', description: 'Read AI Studio and creative asset metadata summaries.', category: 'read', riskLevel: 'read_only', allowed: true, handler: getAiStudioSummaryTool },
  { id: 'get_provider_health_summary', name: 'Get Provider Health Summary', description: 'Read compact provider/system health summaries without secrets.', category: 'read', riskLevel: 'read_only', allowed: true, handler: getProviderHealthSummaryTool },
  { id: 'get_reports_summary', name: 'Get Reports Summary', description: 'Read compact report metrics from workspace tasks/reviews.', category: 'read', riskLevel: 'read_only', allowed: true, handler: getReportsSummaryTool },
  { id: 'search_knowledge_base', name: 'Search Knowledge Base', description: 'Search safe internal knowledge snippets.', category: 'read', riskLevel: 'read_only', allowed: true, handler: searchKnowledgeBaseTool },
];

const draftTools: AlexToolDefinition[] = [
  { id: 'prepare_task_draft', name: 'Prepare Task Draft', description: 'Prepare a draft task payload without saving it.', category: 'draft', riskLevel: 'draft_only', allowed: true, handler: prepareTaskDraftTool },
  { id: 'prepare_content_studio_draft', name: 'Prepare Content Studio Draft', description: 'Prepare a draft content brief without saving or publishing.', category: 'draft', riskLevel: 'draft_only', allowed: true, handler: prepareContentStudioDraftTool },
  { id: 'prepare_workflow_plan_draft', name: 'Prepare Workflow Plan Draft', description: 'Prepare a draft workflow plan without executing it.', category: 'draft', riskLevel: 'draft_only', allowed: true, handler: prepareWorkflowPlanDraftTool },
  { id: 'prepare_n8n_blueprint_draft', name: 'Prepare n8n Blueprint Draft', description: 'Prepare a planning-only n8n blueprint without touching n8n.', category: 'draft', riskLevel: 'draft_only', allowed: true, handler: prepareN8nBlueprintDraftTool },
  { id: 'prepare_quality_review_draft', name: 'Prepare Quality Review Draft', description: 'Prepare a draft quality review request.', category: 'draft', riskLevel: 'draft_only', allowed: true, handler: prepareQualityReviewDraftTool },
  { id: 'prepare_playbook_draft', name: 'Prepare Playbook Draft', description: 'Prepare a draft playbook idea without saving it.', category: 'draft', riskLevel: 'draft_only', allowed: true, handler: preparePlaybookDraftTool },
  { id: 'prepare_follow_up_message_draft', name: 'Prepare Follow-up Message Draft', description: 'Prepare a message draft without sending email or contacting clients.', category: 'draft', riskLevel: 'draft_only', allowed: true, handler: prepareFollowUpMessageDraftTool },
];

const blockedTools: AlexToolDefinition[] = blockedToolIds.map((id) => ({
  id,
  name: id.replaceAll('_', ' '),
  description: 'Blocked dangerous operation. Alex may explain the manual review requirement but cannot execute it.',
  category: 'blocked',
  riskLevel: 'blocked',
  allowed: false,
}));

export const alexToolRegistry: AlexToolDefinition[] = [
  ...readTools,
  ...draftTools,
  ...blockedTools,
];

export function getAlexToolDefinition(id: string) {
  return alexToolRegistry.find((tool) => tool.id === id) ?? null;
}

export function getBlockedToolIds() {
  return blockedToolIds;
}

export function blockedToolResult(toolId: string): AlexToolResult {
  const tool = getAlexToolDefinition(toolId);
  return {
    toolId,
    toolName: tool?.name ?? toolId,
    category: 'blocked',
    riskLevel: 'blocked',
    sourceLabel: 'Blocked Alex Tool',
    summary: 'This action requires manual approval and is blocked in Alex tools.',
    blocked: true,
  };
}

export async function runAlexTool(id: string, input: unknown, context: AlexToolContext): Promise<AlexToolResult> {
  const tool = getAlexToolDefinition(id);

  if (!tool || !tool.allowed || !tool.handler) {
    return blockedToolResult(id);
  }

  return tool.handler(input, context);
}

export async function runAlexTools(ids: string[], input: unknown, context: AlexToolContext): Promise<AlexToolRunSummary> {
  const uniqueIds = Array.from(new Set(ids)).slice(0, 8);
  const toolsUsed = await Promise.all(uniqueIds.map((id) => runAlexTool(id, input, context)));
  const draftAction = toolsUsed.find((tool) => tool.draft)?.draft ?? null;
  const blockedMessages = toolsUsed
    .filter((tool) => tool.blocked)
    .map((tool) => `${tool.toolName}: ${tool.summary}`);

  return { toolsUsed, draftAction, blockedMessages };
}

export function formatToolResultsForAlex(results: AlexToolResult[]) {
  if (results.length === 0) return 'No Alex tools were used.';

  return results.map((tool) => {
    const lines = [
      `Tool: ${tool.toolName}`,
      `Risk: ${tool.riskLevel}`,
      `Source: ${tool.sourceLabel}`,
      `Summary: ${tool.summary}`,
    ];

    if (tool.items?.length) {
      lines.push(
        'Items:',
        ...tool.items.slice(0, 6).map((item) => `- ${Object.entries(item).map(([key, value]) => `${key}: ${value}`).join('; ')}`)
      );
    }

    if (tool.draft) {
      lines.push(
        'Draft action:',
        `- Type: ${tool.draft.type}`,
        `- Title: ${tool.draft.title}`,
        `- Description: ${tool.draft.description}`,
        `- Safety: ${tool.draft.safetyNote}`
      );
    }

    return lines.join('\n');
  }).join('\n\n');
}
