import { getAgentTemplateById, type AgentTemplate } from './templates';
import { buildWorkflowDiagramFromDraft } from './workflow-diagram';
import {
  getWorkflowPresets,
  type AgentWorkflowPresetDefinition,
} from './workflow-presets';

export type AgentWorkflowPreset = AgentWorkflowPresetDefinition & { templateIds: string[] };

export interface AgentWorkflowStep {
  index: number;
  template: AgentTemplate;
  description: string;
  requiredInputs: string[];
  expectedOutputs: string[];
  reviewChecklist: string[];
}

export interface AgentWorkflowDraft {
  name: string;
  goal: string;
  notes: string;
  steps: AgentWorkflowStep[];
  requiredInputs: string[];
  expectedOutputs: string[];
  reviewChecklist: string[];
  safetyNotes: string[];
}

export const workflowPresets: AgentWorkflowPreset[] = getWorkflowPresets().map((workflow) => ({
  ...workflow,
  templateIds: workflow.steps,
}));

export function getValidWorkflowTemplates(templateIds: string[]) {
  const seen = new Set<string>();
  return templateIds
    .map((id) => getAgentTemplateById(id))
    .filter((template): template is AgentTemplate => Boolean(template))
    .filter((template) => {
      if (seen.has(template.id)) return false;
      seen.add(template.id);
      return true;
    });
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function buildStepDescription(template: AgentTemplate, index: number) {
  return `Step ${index}: Use ${template.name} to ${template.description.charAt(0).toLowerCase()}${template.description.slice(1)}`;
}

export function buildAgentWorkflowDraft(input: {
  name?: string;
  goal?: string;
  notes?: string;
  templateIds: string[];
}): AgentWorkflowDraft {
  const steps = getValidWorkflowTemplates(input.templateIds).map((template, stepIndex) => ({
    index: stepIndex + 1,
    template,
    description: buildStepDescription(template, stepIndex + 1),
    requiredInputs: template.inputs,
    expectedOutputs: template.outputs,
    reviewChecklist: template.review_checklist,
  }));

  const fallbackName = steps.length > 0
    ? `${steps[0].template.name} Workflow`
    : 'AgentFlow Template Workflow';

  return {
    name: input.name?.trim() || fallbackName,
    goal: input.goal?.trim() || 'Prepare a safe multi-agent draft workflow for manual review.',
    notes: input.notes?.trim().slice(0, 2000) || '',
    steps,
    requiredInputs: unique(steps.flatMap((step) => step.requiredInputs)),
    expectedOutputs: unique(steps.flatMap((step) => step.expectedOutputs)),
    reviewChecklist: unique(steps.flatMap((step) => step.reviewChecklist)),
    safetyNotes: [
      'This workflow is a draft plan only.',
      'Created tasks are pending only and do not run n8n automatically.',
      'Do not publish content, schedule posts, create ads, spend money, delete data, or change webhooks from this builder.',
      'Review every output before any external handoff or execution.',
      'Never paste secrets, API keys, tokens, webhook secrets, or private provider responses into workflow notes.',
    ],
  };
}

function list(values: string[]) {
  return values.length ? values.map((value) => `- ${value}`).join('\n') : '- None specified';
}

export function formatAgentWorkflowMarkdown(workflow: AgentWorkflowDraft) {
  const diagram = buildWorkflowDiagramFromDraft(workflow);

  return [
    `# ${workflow.name}`,
    '',
    '## Visual Diagram',
    diagram.markdownDiagram,
    '',
    '## Goal',
    workflow.goal,
    '',
    '## Selected Agent Templates',
    list(workflow.steps.map((step) => `${step.index}. ${step.template.name} (${step.template.category})`)),
    '',
    '## Step-by-Step Workflow',
    workflow.steps.length
      ? workflow.steps.map((step) => [
          `### Step ${step.index}: ${step.template.name}`,
          step.description,
          '',
          'Required inputs:',
          list(step.requiredInputs),
          '',
          'Expected outputs:',
          list(step.expectedOutputs),
        ].join('\n')).join('\n\n')
      : 'No templates selected yet.',
    '',
    '## Required Inputs',
    list(workflow.requiredInputs),
    '',
    '## Expected Outputs',
    list(workflow.expectedOutputs),
    '',
    '## Review Checklist',
    list(workflow.reviewChecklist),
    '',
    '## Safe Execution Rules',
    list(workflow.safetyNotes),
    '',
    '## Optional n8n Planning Notes',
    '- Export n8n workflow plans from relevant workflow steps only as reference blueprints.',
    '- Keep webhook URLs, callback secrets, and provider keys as placeholders until manually configured.',
    '- Test manually with sample non-secret data before activating anything in n8n.',
    '',
    '## Task Creation Notes',
    '- Optional task creation creates one pending draft task per selected step.',
    '- Pending tasks do not trigger n8n, publishing, scheduling, ads, spending, or provider changes.',
    workflow.notes ? `- Workflow notes: ${workflow.notes}` : '- No workflow notes provided.',
    '',
  ].join('\n');
}
