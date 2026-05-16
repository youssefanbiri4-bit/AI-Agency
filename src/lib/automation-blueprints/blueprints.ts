export type AutomationBlueprintExecutionMode = 'planning_only';

export interface AutomationBlueprint {
  id: string;
  name: string;
  category: string;
  description: string;
  recommended_for: string[];
  trigger: string;
  required_inputs: string[];
  workflow_steps: string[];
  suggested_n8n_nodes: string[];
  callback_payload_example: Record<string, unknown>;
  error_handling: string[];
  testing_checklist: string[];
  safety_rules: string[];
  visual_diagram_mermaid: string;
  execution_mode: AutomationBlueprintExecutionMode;
}

const globalSafetyRules = [
  'Planning only: do not run n8n or execute live workflows.',
  'Do not create or edit live n8n workflows.',
  'Do not change existing webhook URLs, callback URLs, task execution, scheduler, or provider publishing logic.',
  'Do not publish content, schedule content, create live ads, spend money, delete data, or perform GitHub writes.',
  'Use placeholders only: {{N8N_WEBHOOK_URL}}, {{AGENTFLOW_CALLBACK_URL}}, {{TASK_ID}}, {{WORKSPACE_ID}}.',
  'Do not expose secrets, environment values, tokens, webhook secrets, or provider credentials.',
  'Every output must remain pending review until manually approved inside AgentFlow AI.',
];

function mermaidNodeId(index: number) {
  return `S${index + 1}`;
}

function escapeMermaidLabel(value: string) {
  return value.replace(/"/g, "'");
}

function buildMermaid(steps: string[]) {
  const nodeLines = steps.map((step, index) => `  ${mermaidNodeId(index)}["${escapeMermaidLabel(step)}"]`);
  const edgeLines = steps.slice(0, -1).map((_, index) => `  ${mermaidNodeId(index)} --> ${mermaidNodeId(index + 1)}`);
  return ['flowchart LR', ...nodeLines, ...edgeLines].join('\n');
}

function callbackPayloadExample(blueprintId: string, resultType: string) {
  return {
    task_id: '{{TASK_ID}}',
    workspace_id: '{{WORKSPACE_ID}}',
    blueprint_id: blueprintId,
    status: 'ready_for_review',
    result_type: resultType,
    callback_url: '{{AGENTFLOW_CALLBACK_URL}}',
    summary: 'Placeholder summary for manual review.',
    artifacts: [],
    errors: [],
  };
}

function blueprint(input: Omit<AutomationBlueprint, 'execution_mode' | 'visual_diagram_mermaid' | 'safety_rules'> & {
  safety_rules?: string[];
}): AutomationBlueprint {
  return {
    ...input,
    execution_mode: 'planning_only',
    visual_diagram_mermaid: buildMermaid(input.workflow_steps),
    safety_rules: [...globalSafetyRules, ...(input.safety_rules ?? [])],
  };
}

const defaultErrorHandling = [
  'Validate all required inputs before any handoff is planned.',
  'Return missing input notes instead of guessing or executing.',
  'Mark ambiguous, failed, or low-confidence outputs as needs_review.',
  'Keep retry decisions manual and document what should be retried.',
];

const defaultTestingChecklist = [
  'Confirm every placeholder remains a placeholder and no secret values are included.',
  'Review required inputs against a sample internal task.',
  'Check that each step produces a reviewable draft artifact.',
  'Confirm no publishing, scheduling, ad spend, deletion, or live execution is triggered.',
  'Copy the Mermaid diagram into a Mermaid previewer and verify the flow renders.',
];

export const automationBlueprints = [
  blueprint({
    id: 'content-approval-workflow',
    name: 'Content Approval Workflow',
    category: 'Content Operations',
    description: 'Generate content, send it to review, approve it, or request changes before manual publishing.',
    recommended_for: ['Prompt Library', 'Content Studio', 'Review queue', 'Manual publishing'],
    trigger: 'A saved prompt or content request is ready to become a reviewed content draft.',
    required_inputs: ['Prompt Library item or content brief', 'Target channel', 'Audience', 'Brand voice', 'Reviewer name'],
    workflow_steps: ['Prompt Library', 'Content Studio', 'Review', 'Approval', 'Ready for manual publish'],
    suggested_n8n_nodes: ['Webhook (placeholder only)', 'Set', 'IF', 'NoOp review handoff', 'HTTP Request callback placeholder'],
    callback_payload_example: callbackPayloadExample('content-approval-workflow', 'content_draft'),
    error_handling: defaultErrorHandling,
    testing_checklist: defaultTestingChecklist,
  }),
  blueprint({
    id: 'ai-studio-creative-workflow',
    name: 'AI Studio Creative Workflow',
    category: 'Creative Production',
    description: 'Generate ad images or videos safely from prompts and save them as creative assets for review.',
    recommended_for: ['AI Studio', 'Creative Assets', 'Ad creative planning', 'Prompt Library'],
    trigger: 'A reviewed creative prompt is approved for AI Studio generation.',
    required_inputs: ['Creative prompt', 'Format', 'Brand constraints', 'Asset title', 'Review criteria'],
    workflow_steps: ['Prompt Library', 'AI Studio', 'Generated Asset', 'Creative Assets', 'Review'],
    suggested_n8n_nodes: ['Webhook (placeholder only)', 'Set', 'AI provider placeholder', 'Normalize Asset Metadata', 'HTTP Request callback placeholder'],
    callback_payload_example: callbackPayloadExample('ai-studio-creative-workflow', 'creative_asset'),
    error_handling: defaultErrorHandling,
    testing_checklist: defaultTestingChecklist,
    safety_rules: ['Generated visuals must remain drafts until manually reviewed.'],
  }),
  blueprint({
    id: 'campaign-launch-planning-workflow',
    name: 'Campaign Launch Planning Workflow',
    category: 'Campaign Planning',
    description: 'Plan a campaign from research to content and ad creative without publishing or launching automatically.',
    recommended_for: ['Campaigns', 'Content Studio', 'Creative Assets', 'Workflow review'],
    trigger: 'A campaign idea needs a complete launch plan before any manual execution.',
    required_inputs: ['Campaign goal', 'Market research notes', 'Audience', 'Offer', 'Budget notes without payment authorization'],
    workflow_steps: ['Market Research', 'Strategy', 'Content', 'Ad Copy', 'Creative Brief', 'Workflow Review'],
    suggested_n8n_nodes: ['Manual Trigger placeholder', 'Set', 'AI Provider placeholder', 'Merge', 'HTTP Request callback placeholder'],
    callback_payload_example: callbackPayloadExample('campaign-launch-planning-workflow', 'campaign_plan'),
    error_handling: defaultErrorHandling,
    testing_checklist: defaultTestingChecklist,
    safety_rules: ['Do not launch campaigns, create live ads, or change provider campaign state.'],
  }),
  blueprint({
    id: 'n8n-task-execution-blueprint',
    name: 'n8n Task Execution Blueprint',
    category: 'n8n Planning',
    description: 'Show how a pending AgentFlow task could be executed by n8n and returned to AgentFlow for review.',
    recommended_for: ['Tasks', 'n8n workflow planning', 'Callback payload review', 'System Health'],
    trigger: 'A pending AgentFlow task is selected for a planning-only n8n execution design.',
    required_inputs: ['{{TASK_ID}}', '{{WORKSPACE_ID}}', 'Task type', 'Task input payload', '{{AGENTFLOW_CALLBACK_URL}}'],
    workflow_steps: ['AgentFlow Task', 'n8n Webhook', 'Validate Payload', 'AI Provider', 'Normalize Result', 'Callback', 'Review'],
    suggested_n8n_nodes: ['Webhook', 'IF', 'Code', 'AI Provider placeholder', 'Set', 'HTTP Request callback placeholder'],
    callback_payload_example: callbackPayloadExample('n8n-task-execution-blueprint', 'task_result'),
    error_handling: [
      ...defaultErrorHandling,
      'If validation fails, return a needs_review payload with missing fields and no provider call.',
      'If provider output is malformed, normalize to a failed review item instead of retrying automatically.',
    ],
    testing_checklist: defaultTestingChecklist,
    safety_rules: ['This blueprint documents n8n shape only; it must not create, edit, activate, or call n8n workflows.'],
  }),
  blueprint({
    id: 'lead-scoring-blueprint',
    name: 'Lead Scoring Blueprint',
    category: 'Sales Operations',
    description: 'Score potential leads and prepare follow-up drafts safely for manual review and sending.',
    recommended_for: ['Lead research', 'Sales tasks', 'Manual outreach', 'Review queue'],
    trigger: 'A new lead record or lead notes are ready for scoring.',
    required_inputs: ['Lead name', 'Company', 'Source', 'Need or intent signal', 'Scoring criteria'],
    workflow_steps: ['Lead Input', 'Score Lead', 'Draft Follow-up', 'Review', 'Manual Send'],
    suggested_n8n_nodes: ['Manual Trigger placeholder', 'Set', 'AI Provider placeholder', 'IF', 'HTTP Request callback placeholder'],
    callback_payload_example: callbackPayloadExample('lead-scoring-blueprint', 'lead_score_and_followup_draft'),
    error_handling: defaultErrorHandling,
    testing_checklist: defaultTestingChecklist,
    safety_rules: ['Do not send emails, messages, or CRM updates automatically.'],
  }),
  blueprint({
    id: 'client-onboarding-blueprint',
    name: 'Client Onboarding Blueprint',
    category: 'Client Operations',
    description: 'Turn new client info into tasks, prompts, a content plan, and a review checklist.',
    recommended_for: ['Client onboarding', 'Project setup', 'Prompt Library', 'Task planning'],
    trigger: 'New client intake information is ready to organize into an internal action plan.',
    required_inputs: ['Client profile', 'Business goals', 'Offer details', 'Channels', 'Known constraints'],
    workflow_steps: ['Client Info', 'Research', 'Strategy', 'Task Plan', 'Content Plan', 'Review'],
    suggested_n8n_nodes: ['Form Trigger placeholder', 'Set', 'AI Provider placeholder', 'Split Out', 'HTTP Request callback placeholder'],
    callback_payload_example: callbackPayloadExample('client-onboarding-blueprint', 'onboarding_plan'),
    error_handling: defaultErrorHandling,
    testing_checklist: defaultTestingChecklist,
  }),
  blueprint({
    id: 'meeting-summary-blueprint',
    name: 'Meeting Summary Blueprint',
    category: 'Operations',
    description: 'Convert meeting notes into a summary, decisions, and draft action items.',
    recommended_for: ['Meetings', 'Tasks', 'Reviews', 'Internal follow-up'],
    trigger: 'Meeting notes or transcript excerpts are added for summarization.',
    required_inputs: ['Meeting notes', 'Meeting date', 'Participants', 'Project or client', 'Action item owner rules'],
    workflow_steps: ['Meeting Notes', 'Summary', 'Action Items', 'Tasks Draft', 'Review'],
    suggested_n8n_nodes: ['Manual Trigger placeholder', 'Set', 'AI Provider placeholder', 'Item Lists', 'HTTP Request callback placeholder'],
    callback_payload_example: callbackPayloadExample('meeting-summary-blueprint', 'meeting_summary'),
    error_handling: defaultErrorHandling,
    testing_checklist: defaultTestingChecklist,
    safety_rules: ['Do not create live assigned tasks unless a separate reviewed task creation flow explicitly supports it.'],
  }),
  blueprint({
    id: 'prompt-to-task-blueprint',
    name: 'Prompt-to-Task Blueprint',
    category: 'Task Planning',
    description: 'Turn a Prompt Library item into a safe pending task draft.',
    recommended_for: ['Prompt Library', 'Task drafting', 'Review-first workflows'],
    trigger: 'A reusable prompt template should become a pending task plan.',
    required_inputs: ['Prompt template', 'Filled input values', 'Task title', 'Priority suggestion', 'Review criteria'],
    workflow_steps: ['Prompt Template', 'Fill Inputs', 'Create Pending Task', 'Review'],
    suggested_n8n_nodes: ['Manual Trigger placeholder', 'Set', 'AI Provider placeholder', 'HTTP Request callback placeholder'],
    callback_payload_example: callbackPayloadExample('prompt-to-task-blueprint', 'pending_task_draft'),
    error_handling: defaultErrorHandling,
    testing_checklist: defaultTestingChecklist,
    safety_rules: ['Create only draft task instructions unless existing safe pending-task logic is explicitly wired.'],
  }),
  blueprint({
    id: 'creative-brief-to-image-blueprint',
    name: 'Creative Brief to Image Blueprint',
    category: 'Creative Production',
    description: 'Use a creative brief to generate image prompts and then AI Studio visuals for review.',
    recommended_for: ['Creative briefs', 'AI Studio', 'Creative Assets', 'Ad creative review'],
    trigger: 'A creative brief has enough detail to draft image prompts.',
    required_inputs: ['Creative brief', 'Brand style', 'Image size or format', 'Negative constraints', 'Reviewer notes'],
    workflow_steps: ['Creative Brief', 'Image Prompt', 'AI Studio', 'Creative Asset', 'Review'],
    suggested_n8n_nodes: ['Manual Trigger placeholder', 'Set', 'AI Provider placeholder', 'Normalize Asset Metadata', 'HTTP Request callback placeholder'],
    callback_payload_example: callbackPayloadExample('creative-brief-to-image-blueprint', 'image_prompt_and_asset_plan'),
    error_handling: defaultErrorHandling,
    testing_checklist: defaultTestingChecklist,
    safety_rules: ['Do not create live ads or publish generated images automatically.'],
  }),
  blueprint({
    id: 'workflow-review-blueprint',
    name: 'Workflow Review Blueprint',
    category: 'Governance',
    description: 'Review any automation before tasks, n8n plans, or content handoff.',
    recommended_for: ['Workflow Builder', 'n8n planning', 'Task handoffs', 'Safety review'],
    trigger: 'A workflow draft needs readiness, missing-input, and safety review before any next action.',
    required_inputs: ['Workflow draft', 'Known inputs', 'Target output', 'Risk notes', 'Manual approval owner'],
    workflow_steps: ['Workflow Draft', 'Readiness Check', 'Missing Inputs', 'Safety Review', 'Safe Next Actions'],
    suggested_n8n_nodes: ['Manual Trigger placeholder', 'Set', 'IF', 'NoOp safety gate', 'HTTP Request callback placeholder'],
    callback_payload_example: callbackPayloadExample('workflow-review-blueprint', 'workflow_review'),
    error_handling: [
      ...defaultErrorHandling,
      'If a safety rule is violated, stop at safe_next_actions and require manual revision.',
    ],
    testing_checklist: defaultTestingChecklist,
  }),
] satisfies AutomationBlueprint[];

export const automationBlueprintCategories = Array.from(new Set(automationBlueprints.map((blueprint) => blueprint.category)));

function listMarkdown(title: string, values: string[]) {
  return [`## ${title}`, ...values.map((value) => `- ${value}`)].join('\n');
}

export function formatAutomationBlueprintMarkdown(blueprint: AutomationBlueprint) {
  return [
    `# ${blueprint.name}`,
    '',
    `- ID: ${blueprint.id}`,
    `- Category: ${blueprint.category}`,
    `- Execution mode: ${blueprint.execution_mode}`,
    '',
    '## Description',
    blueprint.description,
    '',
    '## Trigger',
    blueprint.trigger,
    '',
    listMarkdown('Recommended for', blueprint.recommended_for),
    '',
    listMarkdown('Required inputs', blueprint.required_inputs),
    '',
    listMarkdown('Workflow steps', blueprint.workflow_steps),
    '',
    listMarkdown('Suggested n8n nodes', blueprint.suggested_n8n_nodes),
    '',
    '## Callback payload example',
    '```json',
    JSON.stringify(blueprint.callback_payload_example, null, 2),
    '```',
    '',
    listMarkdown('Error handling', blueprint.error_handling),
    '',
    listMarkdown('Testing checklist', blueprint.testing_checklist),
    '',
    listMarkdown('Safety rules', blueprint.safety_rules),
    '',
    '## Mermaid diagram',
    '```mermaid',
    blueprint.visual_diagram_mermaid,
    '```',
  ].join('\n').trim() + '\n';
}
