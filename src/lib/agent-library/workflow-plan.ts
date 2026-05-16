import type { AgentTemplate } from './templates';
import { buildWorkflowDiagramFromLabels } from './workflow-diagram';

export interface N8nWorkflowPlan {
  workflow_title: string;
  template_id: string;
  template_name: string;
  category: AgentTemplate['category'];
  purpose: string;
  recommended_trigger: string;
  required_inputs: string[];
  expected_outputs: string[];
  suggested_n8n_nodes: string[];
  step_by_step_flow: string[];
  data_mapping: string[];
  callback_payload_example: {
    task_id: string;
    status: 'needs_review';
    result: {
      summary: string;
      output: string;
      template_id: string;
      template_name: string;
    };
    metadata: {
      source: 'agent_library';
      execution_mode: 'draft_only';
    };
  };
  error_handling_plan: string[];
  safety_rules: string[];
  testing_checklist: string[];
  deployment_notes: string[];
  manual_build_instructions: string[];
}

const baseSuggestedNodes = [
  'Webhook Trigger',
  'Validate Input Code Node',
  'Prepare Prompt Code Node',
  'AI Provider Node or HTTP Request Node',
  'Normalize Result Code Node',
  'Send Callback HTTP Request Node',
  'Error Handler Node',
  'Optional Review Notes Node',
];

const baseSafetyRules = [
  'Planning/export only: do not run this workflow automatically from AgentFlow.',
  'Use n8n credentials for API keys; never paste secrets into nodes or exported files.',
  'Return results with status "needs_review" so AgentFlow keeps a human review step.',
  'Do not publish content, schedule posts, create ads, spend money, delete data, or change provider settings.',
  'Keep webhook and callback URLs as placeholders until you manually configure them in n8n.',
];

function recommendedTriggerFor(template: AgentTemplate) {
  if (template.category === 'n8n Workflow Ideas') {
    return 'Manual n8n test run or Webhook Trigger using {{N8N_WEBHOOK_PATH}} after human approval.';
  }

  if (template.category === 'Developer/Code Agents') {
    return 'Manual trigger or Webhook Trigger from a pending AgentFlow task after code context has been reviewed.';
  }

  return 'Webhook Trigger from a pending AgentFlow task after you explicitly choose to run the workflow.';
}

function nodePlanFor(template: AgentTemplate) {
  if (template.category === 'Content & Growth') {
    return [...baseSuggestedNodes, 'Optional Content Review Notes Node'];
  }

  if (template.category === 'Sales & Operations') {
    return [...baseSuggestedNodes, 'Optional Compliance Review Notes Node'];
  }

  if (template.category === 'Developer/Code Agents') {
    return [...baseSuggestedNodes, 'Optional Patch Summary Node'];
  }

  return baseSuggestedNodes;
}

export function generateN8nWorkflowPlan(template: AgentTemplate): N8nWorkflowPlan {
  return {
    workflow_title: `${template.name} - AgentFlow n8n Workflow Plan`,
    template_id: template.id,
    template_name: template.name,
    category: template.category,
    purpose: template.description,
    recommended_trigger: recommendedTriggerFor(template),
    required_inputs: template.inputs,
    expected_outputs: template.outputs,
    suggested_n8n_nodes: nodePlanFor(template),
    step_by_step_flow: [
      'Receive a draft/pending AgentFlow task payload through the webhook trigger.',
      'Validate that required inputs are present and reject missing or oversized values with a clear error.',
      'Prepare a concise prompt from the task context and the internal Agent Library template.',
      'Call the AI provider using credentials stored inside n8n, not inside the exported plan.',
      'Normalize the AI result into a structured summary, output, and review notes.',
      'Send a callback payload to {{AGENTFLOW_CALLBACK_URL}} with status "needs_review".',
      'Stop after callback. Do not publish, schedule, spend, delete, or execute provider actions.',
    ],
    data_mapping: [
      `template.id -> result.template_id (${template.id})`,
      `template.name -> result.template_name (${template.name})`,
      'task.id -> callback_payload.task_id',
      'validated user context -> prompt context',
      'AI summary -> callback_payload.result.summary',
      'AI draft/output -> callback_payload.result.output',
      'review checklist -> callback_payload.result.review_notes',
    ],
    callback_payload_example: {
      task_id: '{{task_id}}',
      status: 'needs_review',
      result: {
        summary: `Draft output prepared for ${template.name}.`,
        output: 'Replace this with the normalized draft result from the workflow.',
        template_id: template.id,
        template_name: template.name,
      },
      metadata: {
        source: 'agent_library',
        execution_mode: 'draft_only',
      },
    },
    error_handling_plan: [
      'If required inputs are missing, return a failed validation message and do not call the AI provider.',
      'If the AI provider fails, capture a short safe error summary without credentials or raw stack traces.',
      'If the callback fails, retry according to n8n retry settings and alert manually after repeated failure.',
      'Never include API keys, callback secrets, provider tokens, or private environment values in logs or outputs.',
    ],
    safety_rules: baseSafetyRules,
    testing_checklist: [
      'Run the workflow manually in n8n with sample non-secret data.',
      'Confirm missing-input validation works before the AI node runs.',
      'Confirm callback payload uses status "needs_review".',
      'Confirm no publishing, scheduling, deletion, spending, or provider-setting node is present.',
      'Inspect n8n execution logs to ensure no secrets are printed.',
    ],
    deployment_notes: [
      'Build this manually in n8n from the plan; AgentFlow does not create or edit live workflows.',
      'Use {{N8N_WEBHOOK_PATH}} for the trigger path placeholder.',
      'Use {{AGENTFLOW_CALLBACK_URL}} for the callback URL placeholder.',
      'Use {{OPENAI_API_KEY_FROM_N8N_CREDENTIALS}} or another n8n credential reference for provider auth.',
      'Keep the workflow inactive until you complete a manual test and review.',
    ],
    manual_build_instructions: [
      'Create a new workflow in n8n manually.',
      'Add the suggested nodes in order and copy only the safe prompt/context fields you need.',
      'Configure credentials through n8n credential storage, not hardcoded node fields.',
      'Paste the callback payload example into the callback HTTP Request node and map task_id dynamically.',
      'Run a manual test with fake data, review the AgentFlow task result, then decide whether to activate.',
    ],
  };
}

function list(values: string[]) {
  return values.map((value) => `- ${value}`).join('\n');
}

function numberedList(values: string[]) {
  return values.map((value, index) => `${index + 1}. ${value}`).join('\n');
}

export function formatWorkflowPlanMarkdown(plan: N8nWorkflowPlan) {
  const diagram = buildWorkflowDiagramFromLabels(plan.suggested_n8n_nodes, 'n8n plan');

  return [
    `# ${plan.workflow_title}`,
    '',
    `Template: ${plan.template_name}`,
    `Category: ${plan.category}`,
    `Template ID: ${plan.template_id}`,
    '',
    '## Visual Diagram',
    diagram.markdownDiagram,
    '',
    '## Purpose',
    plan.purpose,
    '',
    '## Trigger',
    plan.recommended_trigger,
    '',
    '## Required Inputs',
    list(plan.required_inputs),
    '',
    '## Expected Outputs',
    list(plan.expected_outputs),
    '',
    '## Suggested n8n Nodes',
    list(plan.suggested_n8n_nodes),
    '',
    '## Step-by-Step Flow',
    numberedList(plan.step_by_step_flow),
    '',
    '## Data Mapping',
    list(plan.data_mapping),
    '',
    '## Callback Payload Example',
    '```json',
    JSON.stringify(plan.callback_payload_example, null, 2),
    '```',
    '',
    '## Error Handling',
    list(plan.error_handling_plan),
    '',
    '## Safety Rules',
    list(plan.safety_rules),
    '',
    '## Testing Checklist',
    list(plan.testing_checklist),
    '',
    '## Deployment Notes',
    list(plan.deployment_notes),
    '',
    '## Manual Build Instructions',
    numberedList(plan.manual_build_instructions),
    '',
  ].join('\n');
}

export function formatWorkflowPlanJson(plan: N8nWorkflowPlan) {
  return JSON.stringify(
    {
      reference_only: true,
      warning:
        'This is a reference blueprint only. It does not contain credentials and must not be treated as a live n8n workflow export.',
      placeholders: {
        agentflow_callback_url: '{{AGENTFLOW_CALLBACK_URL}}',
        n8n_webhook_path: '{{N8N_WEBHOOK_PATH}}',
        ai_provider_credential: '{{OPENAI_API_KEY_FROM_N8N_CREDENTIALS}}',
      },
      plan,
    },
    null,
    2
  );
}
