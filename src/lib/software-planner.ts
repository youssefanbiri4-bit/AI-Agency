import 'server-only';

import { generateMarketingText } from '@/lib/ai/text-provider';
import type { ProjectDeploymentMetadata } from '@/lib/data/projects';
import type { ProjectRecord, ProjectType } from '@/types/database';

export type SoftwarePlannerPlatform =
  | 'saas'
  | 'dashboard'
  | 'website'
  | 'mobile_app'
  | 'automation_tool'
  | 'ai_tool'
  | 'internal_system'
  | 'marketplace'
  | 'other';

export type SoftwarePlannerScope =
  | 'mvp_only'
  | 'full_product_plan'
  | 'phased_roadmap'
  | 'existing_project_improvement'
  | 'rebuild_refactor_plan';

export type SoftwarePlannerLanguage = 'english' | 'arabic' | 'french';
export type SoftwarePlannerDetail = 'short' | 'medium' | 'detailed';

export interface SoftwarePlannerInput {
  projectId: string | null;
  projectName: string;
  shortIdea: string;
  problemToSolve: string;
  targetUsers: string;
  businessGoal: string;
  preferredTechStack: string;
  platformType: SoftwarePlannerPlatform;
  scope: SoftwarePlannerScope;
  frontendFramework: string;
  backendPreference: string;
  databasePreference: string;
  authRequirement: string;
  storageRequirement: string;
  aiRequirement: string;
  paymentRequirement: string;
  deploymentTarget: string;
  integrationsNeeded: string;
  constraints: string[];
  language: SoftwarePlannerLanguage;
  detailLevel: SoftwarePlannerDetail;
  includeDatabase: boolean;
  includeApi: boolean;
  includeUiPages: boolean;
  includeTesting: boolean;
  includeDeployment: boolean;
  includeTasks: boolean;
}

export interface SoftwarePlannerTableRow {
  cells: string[];
}

export interface SoftwarePlannerPhase {
  name: string;
  goal: string;
  tasks: string[];
  deliverables: string[];
  acceptanceChecklist: string[];
}

export interface SoftwarePlannerTaskDraft {
  title: string;
  description: string;
  priority: 'Low' | 'Normal' | 'High';
  phaseName: string;
  suggestedAgent: string;
}

export interface SoftwareProjectPlan {
  generatedAt: string;
  projectName: string;
  platformType: SoftwarePlannerPlatform;
  scope: SoftwarePlannerScope;
  language: SoftwarePlannerLanguage;
  aiProviderUsed: string;
  aiNarrative: string;
  executiveSummary: {
    overview: string;
    targetUser: string;
    businessValue: string;
    mvpGoal: string;
  };
  problemSolution: {
    problem: string;
    solution: string;
    whyItMatters: string;
  };
  targetUsers: string[];
  features: SoftwarePlannerTableRow[];
  routes: SoftwarePlannerTableRow[];
  databasePlan: SoftwarePlannerTableRow[];
  apiPlan: SoftwarePlannerTableRow[];
  techStack: SoftwarePlannerTableRow[];
  architectureNotes: string[];
  mvpScope: {
    mustHave: string[];
    shouldHave: string[];
    couldHave: string[];
    notNow: string[];
  };
  phases: SoftwarePlannerPhase[];
  testingChecklist: string[];
  deploymentChecklist: string[];
  securityChecklist: string[];
  risks: SoftwarePlannerTableRow[];
  nextActions: string[];
  taskDrafts: SoftwarePlannerTaskDraft[];
  releasePlanDraft: string;
}

function cleanText(value: string, fallback = '') {
  return value
    .replace(/(api[_-]?key|token|secret|password|authorization)\s*[:=]\s*["']?[^"'\s]+/gi, '$1=[redacted]')
    .trim() || fallback;
}

function splitList(value: string, fallback: string[]) {
  const items = value
    .split(/,|\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length ? items : fallback;
}

function platformLabel(platform: SoftwarePlannerPlatform) {
  const labels: Record<SoftwarePlannerPlatform, string> = {
    saas: 'SaaS',
    dashboard: 'Dashboard',
    website: 'Website',
    mobile_app: 'Mobile App',
    automation_tool: 'Automation Tool',
    ai_tool: 'AI Tool',
    internal_system: 'Internal System',
    marketplace: 'Marketplace',
    other: 'Software Product',
  };

  return labels[platform];
}

export function platformToProjectType(platform: SoftwarePlannerPlatform): ProjectType {
  const map: Record<SoftwarePlannerPlatform, ProjectType> = {
    saas: 'SaaS',
    dashboard: 'software',
    website: 'website',
    mobile_app: 'software',
    automation_tool: 'automation',
    ai_tool: 'AI_tool',
    internal_system: 'internal_system',
    marketplace: 'software',
    other: 'software',
  };

  return map[platform];
}

function buildBaseFeatures(input: SoftwarePlannerInput) {
  const projectNoun = platformLabel(input.platformType).toLowerCase();
  const features = [
    ['Authentication & Workspace', 'Secure login, active workspace, and manager-specific access.', 'High', 'MVP', 'Required for private dashboards.'],
    ['Core Dashboard', `Central operating view for the ${projectNoun}.`, 'High', 'MVP', 'Keep it scannable and action-focused.'],
    ['Project Records', 'Create, update, and review structured project/business records.', 'High', 'MVP', 'Use clear status and priority fields.'],
    ['Settings', 'Manage safe configuration and setup guidance.', 'Medium', 'MVP', 'Never expose secret values.'],
    ['Reports', 'Summarize activity, progress, and operational blockers.', 'Medium', 'Future', 'Use real data only.'],
  ];

  if (input.aiRequirement) {
    features.push(['AI Assistance', cleanText(input.aiRequirement), 'Medium', input.scope === 'mvp_only' ? 'Future' : 'MVP', 'Server-side provider calls only.']);
  }

  if (input.storageRequirement) {
    features.push(['File Storage', cleanText(input.storageRequirement), 'Medium', 'MVP', 'Validate uploads and store public/private URLs intentionally.']);
  }

  if (input.paymentRequirement) {
    features.push(['Payments', cleanText(input.paymentRequirement), 'Low', 'Future', 'Keep quota out of MVP unless essential.']);
  }

  return features.map((cells) => ({ cells }));
}

function buildRoutes(input: SoftwarePlannerInput) {
  const rows = [
    ['/', 'Public home', 'Explain the offer or redirect authenticated users.', 'No', 'Keep simple for MVP.'],
    ['/auth/login', 'Login', 'Authenticate users.', 'No', 'Use provider-safe auth flow.'],
    ['/dashboard', 'Dashboard', 'Main operating screen after login.', 'Yes', 'Workspace scoped.'],
    ['/dashboard/projects', 'Projects', 'Manage project records and plans.', 'Yes', 'Good first core route.'],
    ['/dashboard/settings', 'Settings', 'Manage setup and integrations.', 'Yes', 'Show env presence only.'],
  ];

  if (input.includeApi) {
    rows.push(['/api/health', 'Health endpoint', 'Safe readiness check.', 'Maybe', 'Do not leak env values.']);
  }

  if (input.aiRequirement) {
    rows.push(['/dashboard/ai', 'AI workspace', 'Generate or review AI-assisted outputs.', 'Yes', 'Server actions only.']);
  }

  return rows.map((cells) => ({ cells }));
}

function buildDatabasePlan(input: SoftwarePlannerInput) {
  if (!input.includeDatabase) return [];

  return [
    ['workspaces', 'Tenant boundary for manager/team data.', 'id, name, created_at', 'has many projects/users', 'Enable RLS.'],
    ['workspace_members', 'Membership and roles.', 'workspace_id, user_id, role', 'belongs to workspace/user', 'Validate membership server-side.'],
    ['projects', 'Core project/product records.', 'name, status, type, priority, metadata', 'belongs to workspace', 'Store flexible plans in metadata.'],
    ['tasks', 'Planning and execution task drafts.', 'title, description, status, priority, input_data', 'belongs to workspace/project via metadata', 'Created pending only until user runs them.'],
    ['activity_events', 'Audit trail for important actions.', 'event_type, actor_id, metadata', 'belongs to workspace', 'No secrets in metadata.'],
  ].map((cells) => ({ cells }));
}

function buildApiPlan(input: SoftwarePlannerInput) {
  if (!input.includeApi) return [];

  return [
    ['createProjectAction', 'Create project records.', 'Server Action', 'Yes', 'Validate workspace membership.'],
    ['updateProjectAction', 'Update project planning details.', 'Server Action', 'Yes', 'Preserve unrelated metadata.'],
    ['/api/health', 'Readiness/status check.', 'GET', 'Maybe', 'Return statuses, never secret values.'],
    ['generatePlanAction', 'Generate AI-assisted project plan.', 'Server Action', 'Yes', 'Server-side AI call only.'],
  ].map((cells) => ({ cells }));
}

function buildTechStack(input: SoftwarePlannerInput) {
  return [
    ['Frontend', cleanText(input.frontendFramework, input.preferredTechStack || 'Next.js + React'), 'Choose a stable app framework with strong routing.'],
    ['Backend/API', cleanText(input.backendPreference, 'Next.js Server Actions / Route Handlers'), 'Keep backend logic server-side.'],
    ['Database', cleanText(input.databasePreference, 'Supabase Postgres'), 'Use RLS and workspace scoping if multi-tenant.'],
    ['Auth', cleanText(input.authRequirement, 'Supabase Auth or equivalent'), 'Validate user and workspace on every protected action.'],
    ['Storage', cleanText(input.storageRequirement, 'Supabase Storage if uploads are needed'), 'Validate MIME/type/size.'],
    ['AI Providers', cleanText(input.aiRequirement, 'Optional OpenAI/NVIDIA via server-side abstraction'), 'Never expose keys in client.'],
    ['Deployment', cleanText(input.deploymentTarget, 'Vercel'), 'Run lint/typecheck/build before production.'],
    ['Styling/UI', 'Tailwind CSS with reusable dashboard components', 'Keep dashboard dense, readable, and responsive.'],
  ].map((cells) => ({ cells }));
}

function buildPhases(input: SoftwarePlannerInput): SoftwarePlannerPhase[] {
  const phaseNames = [
    ['Phase 1: Foundation', 'Set up repository, app shell, navigation, design system, and protected dashboard layout.'],
    ['Phase 2: Auth/Database', 'Create auth, workspace model, schema, RLS notes, and safe server data access.'],
    ['Phase 3: Core Dashboard', 'Build the primary dashboard, empty states, settings, and project records.'],
    ['Phase 4: Main Feature', `Implement the main ${platformLabel(input.platformType).toLowerCase()} workflow from idea to useful output.`],
    ['Phase 5: AI/Automation', 'Add AI-assisted planning/generation only where it creates real leverage.'],
    ['Phase 6: Reports/Analytics', 'Add real summaries, operational metrics, and copy-ready reports.'],
    ['Phase 7: Testing/Polish', 'Validate forms, permissions, responsive layouts, and edge cases.'],
    ['Phase 8: Deployment', 'Prepare env names, migrations, build checks, smoke tests, and rollback notes.'],
  ];

  return phaseNames.map(([name, goal], index) => ({
    name,
    goal,
    tasks: [
      `Define ${name.toLowerCase()} scope.`,
      'Implement the smallest complete workflow.',
      'Review auth, data, empty states, and errors.',
    ],
    deliverables: [
      `${name} implementation notes`,
      'Manager-readable checklist',
      index < 7 ? 'Ready for next phase' : 'Production deployment checklist',
    ],
    acceptanceChecklist: [
      'No secrets exposed.',
      'Workspace/user validation is clear.',
      'UI is responsive and readable.',
      'Manual smoke test is documented.',
    ],
  }));
}

function buildTaskDrafts(phases: SoftwarePlannerPhase[]): SoftwarePlannerTaskDraft[] {
  return phases.slice(0, 8).map((phase, index) => ({
    title: phase.name,
    phaseName: phase.name,
    priority: index < 3 ? 'High' : 'Normal',
    suggestedAgent:
      index === 0
        ? 'architecture-agent'
        : index === 1
          ? 'database-agent'
          : index === 4
            ? 'architecture-agent'
            : index === 6
              ? 'testing-agent'
              : index === 7
                ? 'deployment-agent'
                : 'documentation-agent',
    description: [
      phase.goal,
      '',
      'Tasks:',
      ...phase.tasks.map((task) => `- ${task}`),
      '',
      'Acceptance checklist:',
      ...phase.acceptanceChecklist.map((item) => `- ${item}`),
      '',
      'Planning only. Do not modify code automatically.',
    ].join('\n'),
  }));
}

export function buildFallbackSoftwarePlan(input: SoftwarePlannerInput, aiNarrative = '', aiProviderUsed = 'deterministic') {
  const cleanName = cleanText(input.projectName, 'New Software Project');
  const targetUsers = splitList(input.targetUsers, ['Primary manager/operator', 'Internal team member', 'End user who needs the workflow solved']);
  const features = buildBaseFeatures(input);
  const routes = input.includeUiPages ? buildRoutes(input) : [];
  const databasePlan = buildDatabasePlan(input);
  const apiPlan = buildApiPlan(input);
  const techStack = buildTechStack(input);
  const phases = buildPhases(input);
  const taskDrafts = input.includeTasks ? buildTaskDrafts(phases) : [];
  const nextActions = [
    'Create or select the project record in AgentFlow AI.',
    'Confirm MVP scope and remove non-essential future features.',
    'Prepare database schema and RLS notes before implementation.',
    'Design the main dashboard workflow and empty states.',
    'Run lint, typecheck, build, and smoke tests before deploy.',
  ];

  return {
    generatedAt: new Date().toISOString(),
    projectName: cleanName,
    platformType: input.platformType,
    scope: input.scope,
    language: input.language,
    aiProviderUsed,
    aiNarrative,
    executiveSummary: {
      overview: `${cleanName} is a ${platformLabel(input.platformType).toLowerCase()} that helps ${targetUsers[0]} solve: ${cleanText(input.problemToSolve, input.shortIdea)}.`,
      targetUser: targetUsers.join(', '),
      businessValue: cleanText(input.businessGoal, 'Create a focused product workflow that saves time and makes operations clearer.'),
      mvpGoal: `Ship the smallest useful version of ${cleanName} with auth, core records, primary workflow, and deployment safety checks.`,
    },
    problemSolution: {
      problem: cleanText(input.problemToSolve, 'The current workflow is scattered, manual, or hard to operate consistently.'),
      solution: cleanText(input.shortIdea, 'Build a structured dashboard that turns the workflow into clear records, actions, and reports.'),
      whyItMatters: 'A well-planned MVP reduces rework, clarifies technical boundaries, and gives the manager a concrete path from idea to deployable product.',
    },
    targetUsers,
    features,
    routes,
    databasePlan,
    apiPlan,
    techStack,
    architectureNotes: [
      'Keep protected dashboard routes server-rendered where possible.',
      'Use server actions or route handlers for writes and AI calls.',
      'Treat workspace ID as the tenant boundary if the product is multi-tenant.',
      'Keep provider tokens, API keys, and service-role access server-side only.',
      'Store generated planning documents as metadata or notes; do not generate repository files automatically.',
    ],
    mvpScope: {
      mustHave: ['Auth', 'Core dashboard', 'Project/data records', 'Primary workflow', 'Settings/setup guidance'],
      shouldHave: ['Reports', 'Saved plans', 'Task planning', 'Basic audit history'],
      couldHave: ['Advanced AI assistance', 'Integrations', 'Team roles', 'Notifications'],
      notNow: ['Live paid campaigns', 'Automatic repository modification', 'Complex quota automation', 'Large dependency-heavy modules'],
    },
    phases,
    testingChecklist: input.includeTesting
      ? [
          'Auth redirects and protected dashboard access work.',
          'Workspace-scoped reads/writes cannot cross workspaces.',
          'Forms validate required fields and show friendly errors.',
          'API routes/server actions validate auth and inputs.',
          'No secrets are visible in browser output, logs, plans, prompts, or notes.',
          'Mobile and desktop layouts are readable.',
          'Production build succeeds before deploy.',
          'Post-deploy smoke test covers login, dashboard, settings, and main workflow.',
        ]
      : [],
    deploymentChecklist: input.includeDeployment
      ? [
          'List required env var names without values.',
          'Apply Supabase migrations before production rollout if needed.',
          'Create required storage buckets and policies if uploads are used.',
          'Run npm run lint.',
          'Run npx tsc --noEmit.',
          'Run npm run build.',
          'Deploy to Vercel only after checks pass.',
          'Keep rollback notes and previous deploy URL.',
        ]
      : [],
    securityChecklist: [
      'No secrets in client code.',
      'No API keys in generated plans, prompts, notes, or release docs.',
      'RLS enabled where workspace data is stored.',
      'Auth validation on protected server actions and API routes.',
      'File upload validation for type, size, and public/private URL behavior.',
      'AI provider calls happen server-side only.',
      'No token logging.',
      'Rate limiting or abuse protection for public endpoints if relevant.',
    ],
    risks: [
      ['Scope creep', 'MVP takes too long to ship.', 'Lock must-have scope before development starts.'],
      ['Weak auth boundaries', 'Private data could be exposed.', 'Validate user/workspace on every protected read/write.'],
      ['Unclear deployment setup', 'Production deploys fail late.', 'Prepare env names, migrations, build scripts, and smoke tests early.'],
      ['AI overreach', 'Generated output may look certain without verification.', 'Keep AI as planning assistance and require human review.'],
    ].map((cells) => ({ cells })),
    nextActions,
    taskDrafts,
    releasePlanDraft: [
      `Release plan draft for ${cleanName}`,
      '',
      'Planned phases:',
      ...phases.map((phase) => `- ${phase.name}: ${phase.goal}`),
      '',
      'Safety notes:',
      '- This is a planning draft only.',
      '- No code was generated.',
      '- No deployment was triggered.',
      '- No GitHub writes were performed.',
    ].join('\n'),
  } satisfies SoftwareProjectPlan;
}

export function softwarePlanToMarkdown(plan: SoftwareProjectPlan) {
  const table = (headers: string[], rows: SoftwarePlannerTableRow[]) => [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.cells.map((cell) => cell.replace(/\|/g, '/')).join(' | ')} |`),
  ].join('\n');

  return [
    `# ${plan.projectName} Software Project Plan`,
    '',
    `Generated: ${plan.generatedAt}`,
    `Source: AgentFlow AI Software Planner`,
    '',
    '## Executive Summary',
    plan.executiveSummary.overview,
    `Target user: ${plan.executiveSummary.targetUser}`,
    `Business value: ${plan.executiveSummary.businessValue}`,
    `MVP goal: ${plan.executiveSummary.mvpGoal}`,
    '',
    '## Problem & Solution',
    `Problem: ${plan.problemSolution.problem}`,
    `Solution: ${plan.problemSolution.solution}`,
    `Why it matters: ${plan.problemSolution.whyItMatters}`,
    '',
    '## Target Users',
    ...plan.targetUsers.map((item) => `- ${item}`),
    '',
    '## Core Features',
    table(['Feature', 'Description', 'Priority', 'MVP/Future', 'Notes'], plan.features),
    '',
    '## Pages / Routes',
    table(['Route', 'Page name', 'Purpose', 'Auth required', 'Notes'], plan.routes),
    '',
    '## Data Model / Database Plan',
    table(['Table', 'Purpose', 'Important fields', 'Relationships', 'Notes'], plan.databasePlan),
    '',
    '## API Routes / Server Actions',
    table(['Endpoint/Action', 'Purpose', 'Method', 'Auth required', 'Notes'], plan.apiPlan),
    '',
    '## Tech Stack',
    table(['Area', 'Recommendation', 'Notes'], plan.techStack),
    '',
    '## Architecture Notes',
    ...plan.architectureNotes.map((item) => `- ${item}`),
    '',
    '## Development Phases',
    ...plan.phases.flatMap((phase) => [
      `### ${phase.name}`,
      phase.goal,
      'Tasks:',
      ...phase.tasks.map((item) => `- ${item}`),
      'Deliverables:',
      ...phase.deliverables.map((item) => `- ${item}`),
      'Acceptance checklist:',
      ...phase.acceptanceChecklist.map((item) => `- [ ] ${item}`),
      '',
    ]),
    '## Testing Checklist',
    ...plan.testingChecklist.map((item) => `- [ ] ${item}`),
    '',
    '## Deployment Checklist',
    ...plan.deploymentChecklist.map((item) => `- [ ] ${item}`),
    '',
    '## Security Checklist',
    ...plan.securityChecklist.map((item) => `- [ ] ${item}`),
    '',
    '## Risks & Blockers',
    table(['Risk', 'Impact', 'Mitigation'], plan.risks),
    '',
    '## Next Actions',
    ...plan.nextActions.map((item) => `- ${item}`),
    '',
    '## Safety Notes',
    '- Planning only.',
    '- No code files generated.',
    '- No GitHub writes, pushes, or pull requests.',
    '- No deployment triggered.',
    '- No secrets included.',
  ].join('\n');
}

export function softwarePlanForProjectMetadata(plan: SoftwareProjectPlan) {
  return {
    summary: plan.executiveSummary.overview,
    generated_at: plan.generatedAt,
    source: 'software_planner',
    project_name: plan.projectName,
    platform_type: plan.platformType,
    scope: plan.scope,
    tech_stack: plan.techStack.map((row) => row.cells[1]).slice(0, 12),
    phases: plan.phases.map((phase) => phase.name),
    next_actions: plan.nextActions,
    report_markdown: softwarePlanToMarkdown(plan).slice(0, 28_000),
  };
}

export function buildPlannerInputFromProject(project: ProjectRecord | null, input: SoftwarePlannerInput): SoftwarePlannerInput {
  if (!project) return input;

  const metadata = project.metadata as ProjectDeploymentMetadata | null;
  const analysis = metadata?.codebase_analysis?.summary ? ` Existing codebase analysis: ${metadata.codebase_analysis.summary}` : '';

  return {
    ...input,
    projectName: input.projectName || project.name,
    shortIdea: cleanText(input.shortIdea || project.description || `Improve ${project.name}.${analysis}`),
    preferredTechStack: cleanText(input.preferredTechStack || project.tech_stack || ''),
  };
}

export async function generateSoftwarePlan(input: SoftwarePlannerInput, project: ProjectRecord | null) {
  const hydrated = buildPlannerInputFromProject(project, input);
  const prompt = [
    'Create a software project plan. Return concise planning guidance. Do not include secrets, API keys, tokens, or code files.',
    `Project name: ${cleanText(hydrated.projectName)}`,
    `Idea: ${cleanText(hydrated.shortIdea)}`,
    `Problem: ${cleanText(hydrated.problemToSolve)}`,
    `Users: ${cleanText(hydrated.targetUsers)}`,
    `Business goal: ${cleanText(hydrated.businessGoal)}`,
    `Platform: ${platformLabel(hydrated.platformType)}`,
    `Scope: ${hydrated.scope}`,
    `Preferred stack: ${cleanText(hydrated.preferredTechStack)}`,
    `Constraints: ${hydrated.constraints.join(', ') || 'none'}`,
    `Language: ${hydrated.language}`,
    'Focus on architecture, MVP scope, risks, and next actions. Planning only.',
  ].join('\n');
  const result = await generateMarketingText({
    kind: 'software_project_plan',
    systemPrompt: 'You are a senior software product architect. You produce safe planning documents only. Never output secrets or suggest automatic repository writes.',
    userPrompt: prompt,
    maxTokens: hydrated.detailLevel === 'detailed' ? 1800 : hydrated.detailLevel === 'medium' ? 1200 : 700,
    temperature: 0.35,
  });

  if (result.status !== 'generated') {
    return {
      ok: false as const,
      error: result.status === 'setup_required' ? 'AI provider setup required to generate a project plan.' : result.error,
    };
  }

  return {
    ok: true as const,
    plan: buildFallbackSoftwarePlan(hydrated, cleanText(result.text), `${result.providerUsed}${result.fallbackUsed ? ' fallback' : ''}`),
  };
}
