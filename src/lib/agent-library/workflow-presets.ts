import { getAgentTemplateById, type AgentTemplate, type SafetyLevel, type ExecutionMode } from './templates';

export type WorkflowPresetCategory =
  | 'Campaigns'
  | 'Content Studio'
  | 'Research & Strategy'
  | 'Sales & Operations'
  | 'Reports & Analytics'
  | 'Daily Operations'
  | 'Industry Packs'
  | 'n8n Workflow Ideas'
  | 'Developer/Code Agents';

export interface AgentWorkflowPresetDefinition {
  id: string;
  name: string;
  description: string;
  category: WorkflowPresetCategory;
  recommended_for: string[];
  goal: string;
  steps: string[];
  expected_outputs: string[];
  safety_level: SafetyLevel;
  execution_mode: ExecutionMode;
  review_required: true;
  visual_diagram_enabled: true;
}

export interface WorkflowPresetValidationResult {
  valid: boolean;
  missingTemplateIds: string[];
  duplicateStepIds: string[];
}

const workflowPresetDefinitions: AgentWorkflowPresetDefinition[] = [
  {
    id: 'lead-follow-up-workflow',
    name: 'Lead Follow-up Workflow',
    description: 'Score a lead, draft a manual follow-up, and review the workflow before any action.',
    category: 'Sales & Operations',
    recommended_for: ['Alex', 'Agent Library', 'Tasks', 'Workflow Builder', 'Playbooks', 'Knowledge Base', 'Reports'],
    goal: 'Prepare a safe lead qualification and follow-up draft for manual review.',
    steps: [
      'lead-score-agent',
      'follow-up-email-agent',
      'workflow-review-agent',
    ],
    expected_outputs: [
      'Lead score and priority',
      'Follow-up drafts',
      'Workflow readiness review',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    review_required: true,
    visual_diagram_enabled: true,
  },
  {
    id: 'client-proposal-workflow',
    name: 'Client Proposal Workflow',
    description: 'Score the opportunity, draft a client proposal, and review readiness before sending anything manually.',
    category: 'Sales & Operations',
    recommended_for: ['Alex', 'Agent Library', 'Tasks', 'Workflow Builder', 'Playbooks', 'Knowledge Base', 'Reports'],
    goal: 'Prepare a review-first client proposal package.',
    steps: [
      'lead-score-agent',
      'client-proposal-agent',
      'workflow-review-agent',
    ],
    expected_outputs: [
      'Lead fit summary',
      'Proposal draft',
      'Workflow readiness review',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    review_required: true,
    visual_diagram_enabled: true,
  },
  {
    id: 'client-onboarding-workflow',
    name: 'Client Onboarding Workflow',
    description: 'Turn a new client into an onboarding plan, meeting prep, and final readiness review.',
    category: 'Sales & Operations',
    recommended_for: ['Alex', 'Agent Library', 'Tasks', 'Workflow Builder', 'Playbooks', 'Knowledge Base', 'Reports'],
    goal: 'Prepare client onboarding steps and kickoff readiness without contacting the client automatically.',
    steps: [
      'client-onboarding-agent',
      'meeting-prep-agent',
      'workflow-review-agent',
    ],
    expected_outputs: [
      'Onboarding checklist',
      'Meeting preparation',
      'Workflow readiness review',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    review_required: true,
    visual_diagram_enabled: true,
  },
  {
    id: 'meeting-preparation-workflow',
    name: 'Meeting Preparation Workflow',
    description: 'Prepare a client or lead meeting and draft manual follow-up options for review.',
    category: 'Sales & Operations',
    recommended_for: ['Alex', 'Agent Library', 'Tasks', 'Workflow Builder', 'Playbooks', 'Knowledge Base', 'Reports'],
    goal: 'Prepare agenda, talking points, follow-up drafts, and safe next actions.',
    steps: [
      'meeting-prep-agent',
      'follow-up-email-agent',
      'workflow-review-agent',
    ],
    expected_outputs: [
      'Meeting agenda and questions',
      'Follow-up drafts',
      'Workflow readiness review',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    review_required: true,
    visual_diagram_enabled: true,
  },
  {
    id: 'weekly-agency-report-workflow',
    name: 'Weekly Agency Report Workflow',
    description: 'Summarize tasks, campaigns, content, provider health, and workflow readiness for a weekly internal review.',
    category: 'Reports & Analytics',
    recommended_for: ['Alex', 'Reports', 'Dashboard', 'Agent Library', 'Tasks', 'Campaigns', 'Content Studio', 'System Health', 'Workflow Builder', 'Playbooks', 'Knowledge Base'],
    goal: 'Prepare a compact, read-only weekly report with safe next actions.',
    steps: [
      'task-performance-agent',
      'campaign-report-agent',
      'content-performance-agent',
      'provider-health-report-agent',
      'workflow-review-agent',
    ],
    expected_outputs: [
      'Task performance summary',
      'Campaign readiness summary',
      'Content quality and readiness notes',
      'Provider health blockers',
      'Workflow readiness review',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    review_required: true,
    visual_diagram_enabled: true,
  },
  {
    id: 'provider-health-review-workflow',
    name: 'Provider Health Review Workflow',
    description: 'Summarize provider readiness and pass the plan through a final workflow safety review.',
    category: 'Reports & Analytics',
    recommended_for: ['Alex', 'Reports', 'Dashboard', 'System Health', 'Workflow Builder', 'Playbooks', 'Knowledge Base'],
    goal: 'Prepare safe provider blocker notes without changing provider settings.',
    steps: [
      'provider-health-report-agent',
      'workflow-review-agent',
    ],
    expected_outputs: [
      'Provider health summary',
      'Blocked/setup-required provider notes',
      'Safe fix checklist',
      'Workflow readiness review',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    review_required: true,
    visual_diagram_enabled: true,
  },
  {
    id: 'content-review-report-workflow',
    name: 'Content Review Report Workflow',
    description: 'Review content quality, platform fit, and readiness before any manual publishing decision.',
    category: 'Reports & Analytics',
    recommended_for: ['Alex', 'Reports', 'Dashboard', 'Content Studio', 'Tasks', 'Workflow Builder', 'Playbooks', 'Knowledge Base'],
    goal: 'Prepare a content performance and readiness report for review.',
    steps: [
      'content-performance-agent',
      'workflow-review-agent',
    ],
    expected_outputs: [
      'Content quality observations',
      'Platform fit notes',
      'Missing elements',
      'Safe improvement actions',
      'Workflow readiness review',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    review_required: true,
    visual_diagram_enabled: true,
  },
  {
    id: 'workflow-analytics-report-workflow',
    name: 'Workflow Analytics Report Workflow',
    description: 'Analyze workflow, playbook, blueprint, and template usage to identify safe improvements.',
    category: 'Reports & Analytics',
    recommended_for: ['Alex', 'Reports', 'Dashboard', 'Agent Library', 'Workflow Builder', 'Playbooks', 'Knowledge Base'],
    goal: 'Prepare a read-only workflow usage report and recommended next playbooks.',
    steps: [
      'workflow-usage-report-agent',
      'workflow-review-agent',
    ],
    expected_outputs: [
      'Workflow usage summary',
      'Most used templates/playbooks',
      'Underused workflows',
      'Safe improvement opportunities',
      'Workflow readiness review',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    review_required: true,
    visual_diagram_enabled: true,
  },
  {
    id: 'bug-fix-workflow',
    name: 'Bug Fix Workflow',
    description: 'Diagnose a bug, plan the patch, review code risk, and run a final workflow safety review before implementation.',
    category: 'Developer/Code Agents',
    recommended_for: ['Alex', 'Agent Library', 'Safe Patch Planner', 'Code Fix Proposals', 'Reports', 'Tasks', 'Workflow Builder', 'Playbooks', 'Knowledge Base', 'Releases'],
    goal: 'Prepare a safe, review-first bug fix plan without editing files or writing to GitHub.',
    steps: [
      'bug-diagnosis-agent',
      'patch-planner-agent',
      'code-review-agent',
      'workflow-review-agent',
    ],
    expected_outputs: [
      'Bug diagnosis',
      'Patch implementation plan',
      'Code risk review',
      'Workflow readiness review',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    review_required: true,
    visual_diagram_enabled: true,
  },
  {
    id: 'safe-deployment-workflow',
    name: 'Safe Deployment Workflow',
    description: 'Review code, Supabase migrations, deployment readiness, and release notes before a manual deploy decision.',
    category: 'Developer/Code Agents',
    recommended_for: ['Alex', 'Agent Library', 'Safe Patch Planner', 'Code Fix Proposals', 'Reports', 'Tasks', 'Workflow Builder', 'Playbooks', 'Knowledge Base', 'Releases'],
    goal: 'Prepare a deployment readiness package without running deployment commands.',
    steps: [
      'code-review-agent',
      'supabase-migration-review-agent',
      'deployment-review-agent',
      'release-notes-agent',
      'workflow-review-agent',
    ],
    expected_outputs: [
      'Code review notes',
      'Migration safety review',
      'Deployment readiness summary',
      'Release notes draft',
      'Workflow readiness review',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    review_required: true,
    visual_diagram_enabled: true,
  },
  {
    id: 'migration-review-workflow',
    name: 'Migration Review Workflow',
    description: 'Review Supabase migration safety and deployment readiness before applying anything manually.',
    category: 'Developer/Code Agents',
    recommended_for: ['Alex', 'Agent Library', 'Safe Patch Planner', 'Code Fix Proposals', 'Reports', 'Tasks', 'Workflow Builder', 'Playbooks', 'Knowledge Base', 'Releases'],
    goal: 'Prepare a Supabase migration review with RLS, index, rollback, and deploy-readiness notes.',
    steps: [
      'supabase-migration-review-agent',
      'deployment-review-agent',
      'workflow-review-agent',
    ],
    expected_outputs: [
      'Migration safety review',
      'Deployment readiness notes',
      'Workflow readiness review',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    review_required: true,
    visual_diagram_enabled: true,
  },
  {
    id: 'release-preparation-workflow',
    name: 'Release Preparation Workflow',
    description: 'Review code, draft release notes, check deployment readiness, and confirm final approval items.',
    category: 'Developer/Code Agents',
    recommended_for: ['Alex', 'Agent Library', 'Safe Patch Planner', 'Code Fix Proposals', 'Reports', 'Tasks', 'Workflow Builder', 'Playbooks', 'Knowledge Base', 'Releases'],
    goal: 'Prepare a release package for manual review before deployment.',
    steps: [
      'code-review-agent',
      'release-notes-agent',
      'deployment-review-agent',
      'workflow-review-agent',
    ],
    expected_outputs: [
      'Code review summary',
      'Release notes draft',
      'Deployment readiness review',
      'Workflow readiness review',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    review_required: true,
    visual_diagram_enabled: true,
  },
  {
    id: 'industry-ecommerce-workflow',
    name: 'E-commerce Industry Pack Workflow',
    description: 'Plan an e-commerce product campaign from research through content, ad copy, creative brief, and review.',
    category: 'Industry Packs',
    recommended_for: ['Industry Packs', 'Alex', 'Campaigns', 'Content Studio', 'AI Studio', 'Workflow Builder', 'Playbooks'],
    goal: 'Prepare a product campaign package for manual review.',
    steps: ['market-research-agent', 'competitor-analysis-agent', 'marketing-strategy-agent', 'instagram-content-agent', 'ad-copy-agent', 'creative-brief-agent', 'workflow-review-agent'],
    expected_outputs: ['Market research', 'Competitor notes', 'Campaign strategy', 'Instagram content draft', 'Ad copy draft', 'Creative brief', 'Workflow review'],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    review_required: true,
    visual_diagram_enabled: true,
  },
  {
    id: 'industry-ai-agency-workflow',
    name: 'AI Agency Industry Pack Workflow',
    description: 'Plan lead qualification, proposal, meeting prep, onboarding, and workflow review for AI agency services.',
    category: 'Industry Packs',
    recommended_for: ['Industry Packs', 'Alex', 'Sales', 'Reports', 'Workflow Builder', 'Playbooks'],
    goal: 'Prepare a safe AI agency client workflow draft.',
    steps: ['lead-score-agent', 'client-proposal-agent', 'meeting-prep-agent', 'client-onboarding-agent', 'workflow-review-agent'],
    expected_outputs: ['Lead score', 'Proposal draft', 'Meeting prep', 'Onboarding checklist', 'Workflow review'],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    review_required: true,
    visual_diagram_enabled: true,
  },
  {
    id: 'industry-real-estate-workflow',
    name: 'Real Estate Industry Pack Workflow',
    description: 'Plan property marketing from market research through listing content, ad copy, lead scoring, and review.',
    category: 'Industry Packs',
    recommended_for: ['Industry Packs', 'Alex', 'Campaigns', 'Sales', 'Content Studio', 'Workflow Builder', 'Playbooks'],
    goal: 'Prepare a property listing or real estate campaign draft.',
    steps: ['market-research-agent', 'marketing-strategy-agent', 'instagram-content-agent', 'ad-copy-agent', 'creative-brief-agent', 'lead-score-agent', 'workflow-review-agent'],
    expected_outputs: ['Market context', 'Campaign strategy', 'Listing content', 'Ad copy', 'Creative brief', 'Lead score', 'Workflow review'],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    review_required: true,
    visual_diagram_enabled: true,
  },
  {
    id: 'industry-restaurant-workflow',
    name: 'Restaurant Marketing Industry Pack Workflow',
    description: 'Plan restaurant or cafe campaigns, menu offers, ad copy, visuals, and review.',
    category: 'Industry Packs',
    recommended_for: ['Industry Packs', 'Alex', 'Campaigns', 'Content Studio', 'AI Studio', 'Workflow Builder', 'Playbooks'],
    goal: 'Prepare a local restaurant marketing campaign draft.',
    steps: ['market-research-agent', 'marketing-strategy-agent', 'instagram-content-agent', 'ad-copy-agent', 'creative-brief-agent', 'workflow-review-agent'],
    expected_outputs: ['Market research', 'Campaign strategy', 'Social content', 'Local ad copy', 'Creative brief', 'Workflow review'],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    review_required: true,
    visual_diagram_enabled: true,
  },
  {
    id: 'industry-education-workflow',
    name: 'Education Industry Pack Workflow',
    description: 'Plan education or course campaigns from research through calendar, content, ad copy, and review.',
    category: 'Industry Packs',
    recommended_for: ['Industry Packs', 'Alex', 'Campaigns', 'Content Studio', 'Workflow Builder', 'Playbooks'],
    goal: 'Prepare a course or education campaign draft.',
    steps: ['market-research-agent', 'marketing-strategy-agent', 'social-media-content-calendar', 'instagram-content-agent', 'ad-copy-agent', 'workflow-review-agent'],
    expected_outputs: ['Market research', 'Campaign strategy', 'Content calendar', 'Social content', 'Ad copy', 'Workflow review'],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    review_required: true,
    visual_diagram_enabled: true,
  },
  {
    id: 'industry-personal-brand-workflow',
    name: 'Personal Brand Industry Pack Workflow',
    description: 'Plan personal positioning, competitor context, social content, creative direction, and review.',
    category: 'Industry Packs',
    recommended_for: ['Industry Packs', 'Alex', 'Content Studio', 'AI Studio', 'Workflow Builder', 'Playbooks'],
    goal: 'Prepare a personal brand content system draft.',
    steps: ['market-research-agent', 'competitor-analysis-agent', 'marketing-strategy-agent', 'instagram-content-agent', 'creative-brief-agent', 'workflow-review-agent'],
    expected_outputs: ['Market research', 'Competitor notes', 'Positioning strategy', 'Social content', 'Creative brief', 'Workflow review'],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    review_required: true,
    visual_diagram_enabled: true,
  },
  {
    id: 'campaign-launch-workflow',
    name: 'Campaign Launch Workflow',
    description: 'Plan a campaign from market research through creative direction, then review readiness before any handoff.',
    category: 'Campaigns',
    recommended_for: ['Alex', 'Workflow Builder', 'Campaigns', 'Content Studio', 'Tasks', 'Playbooks'],
    goal: 'Create a safe campaign launch plan from research through launch-ready draft assets.',
    steps: [
      'market-research-agent',
      'competitor-analysis-agent',
      'marketing-strategy-agent',
      'instagram-content-agent',
      'ad-copy-agent',
      'creative-brief-agent',
      'workflow-review-agent',
    ],
    expected_outputs: [
      'Research foundation',
      'Competitor positioning notes',
      'Campaign strategy',
      'Instagram content package',
      'Ad copy directions',
      'Creative brief',
      'Workflow readiness review',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    review_required: true,
    visual_diagram_enabled: true,
  },
  {
    id: 'instagram-content-workflow',
    name: 'Instagram Content Workflow',
    description: 'Turn strategy into Instagram content, ad copy, creative direction, and a final workflow review.',
    category: 'Content Studio',
    recommended_for: ['Alex', 'Content Studio', 'Creative Assets', 'Workflow Builder', 'Tasks', 'Playbooks'],
    goal: 'Prepare a safe Instagram content workflow with editable drafts and review gates.',
    steps: [
      'marketing-strategy-agent',
      'instagram-content-agent',
      'ad-copy-agent',
      'creative-brief-agent',
      'workflow-review-agent',
    ],
    expected_outputs: [
      'Marketing strategy',
      'Instagram content ideas and scripts',
      'Ad copy options',
      'Creative brief',
      'Workflow readiness review',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    review_required: true,
    visual_diagram_enabled: true,
  },
  {
    id: 'research-strategy-workflow',
    name: 'Research & Strategy Workflow',
    description: 'Build market and competitor context before turning it into a reviewed marketing strategy.',
    category: 'Research & Strategy',
    recommended_for: ['Alex', 'Reports', 'Campaigns', 'Workflow Builder', 'Tasks', 'Playbooks'],
    goal: 'Prepare a reviewed research and strategy foundation before content or ads work.',
    steps: [
      'market-research-agent',
      'competitor-analysis-agent',
      'marketing-strategy-agent',
      'workflow-review-agent',
    ],
    expected_outputs: [
      'Market research summary',
      'Competitor analysis',
      'Marketing strategy',
      'Workflow readiness review',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    review_required: true,
    visual_diagram_enabled: true,
  },
  {
    id: 'daily-operator-workflow',
    name: 'Daily Operator Workflow',
    description: 'Create a daily operator plan and review it before creating pending tasks or saving a playbook.',
    category: 'Daily Operations',
    recommended_for: ['Alex', 'Dashboard', 'Tasks', 'Calendar', 'Workflow Builder', 'Playbooks', 'System Health'],
    goal: 'Prepare a safe daily operating plan for manual review.',
    steps: [
      'daily-planning-agent',
      'workflow-review-agent',
    ],
    expected_outputs: [
      'Daily action plan',
      'Workflow readiness review',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    review_required: true,
    visual_diagram_enabled: true,
  },
  {
    id: 'n8n-planning-workflow',
    name: 'n8n Planning Workflow',
    description: 'Create a draft-only n8n workflow blueprint and review it before export or playbook saving.',
    category: 'n8n Workflow Ideas',
    recommended_for: ['Alex', 'Workflow Builder', 'n8n Workflow Plans', 'Tasks', 'Playbooks', 'System Health'],
    goal: 'Prepare a safe n8n blueprint for manual implementation only.',
    steps: [
      'n8n-workflow-planner-agent',
      'workflow-review-agent',
    ],
    expected_outputs: [
      'n8n workflow blueprint',
      'Workflow readiness review',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    review_required: true,
    visual_diagram_enabled: true,
  },
  {
    id: 'code-review-workflow',
    name: 'Code Review Workflow',
    description: 'Review code or implementation plans and confirm workflow readiness before pending task creation.',
    category: 'Developer/Code Agents',
    recommended_for: ['Alex', 'Safe Patch Planner', 'Code Fix Proposals', 'Workflow Builder', 'Tasks', 'Playbooks'],
    goal: 'Prepare a safe code review and readiness plan without modifying files automatically.',
    steps: [
      'code-review-agent',
      'workflow-review-agent',
    ],
    expected_outputs: [
      'Code review summary',
      'Workflow readiness review',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    review_required: true,
    visual_diagram_enabled: true,
  },
];

export function validateWorkflowPreset(workflow: AgentWorkflowPresetDefinition): WorkflowPresetValidationResult {
  const seen = new Set<string>();
  const duplicateStepIds: string[] = [];
  const missingTemplateIds: string[] = [];

  for (const templateId of workflow.steps) {
    if (seen.has(templateId)) {
      duplicateStepIds.push(templateId);
      continue;
    }
    seen.add(templateId);

    if (!getAgentTemplateById(templateId)) {
      missingTemplateIds.push(templateId);
    }
  }

  return {
    valid: missingTemplateIds.length === 0 && duplicateStepIds.length === 0,
    missingTemplateIds,
    duplicateStepIds,
  };
}

export function getWorkflowPresets() {
  return workflowPresetDefinitions.map((workflow) => ({ ...workflow, steps: [...workflow.steps], expected_outputs: [...workflow.expected_outputs], recommended_for: [...workflow.recommended_for] }));
}

export function getWorkflowPresetById(id: string | null | undefined) {
  if (!id) return null;
  return getWorkflowPresets().find((workflow) => workflow.id === id) ?? null;
}

export function getWorkflowStepsWithTemplates(workflowId: string): Array<{ stepId: string; template: AgentTemplate }> {
  const workflow = getWorkflowPresetById(workflowId);
  if (!workflow) return [];

  return workflow.steps
    .map((stepId) => {
      const template = getAgentTemplateById(stepId);
      return template ? { stepId, template } : null;
    })
    .filter((step): step is { stepId: string; template: AgentTemplate } => Boolean(step));
}
