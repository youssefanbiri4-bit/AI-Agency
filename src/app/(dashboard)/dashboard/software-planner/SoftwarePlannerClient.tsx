'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Clipboard,
  Database,
  FileText,
  FolderKanban,
  GitBranch,
  Layers3,
  ListChecks,
  Rocket,
  Route,
  Save,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input, Label, Select, Textarea } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';
import { useActionToast } from '@/components/ui/useActionToast';
import { cn } from '@/lib/utils';
import type { SoftwareProjectPlan } from '@/lib/software-planner';
import type { ProjectRecord } from '@/types/database';
import {
  createProjectFromPlanAction,
  createTasksFromPlanAction,
  generateSoftwarePlanAction,
  saveSoftwarePlanToProjectAction,
  type SoftwarePlannerState,
} from './actions';

interface SoftwarePlannerClientProps {
  projects: ProjectRecord[];
  selectedProjectId: string | null;
}

type PlanTab = 'overview' | 'features' | 'routes' | 'database' | 'api' | 'phases' | 'testing' | 'deployment' | 'risks' | 'tasks';

const initialState: SoftwarePlannerState = {
  error: null,
  message: null,
  plan: null,
  projectId: null,
};

const constraints = [
  ['simple/lightweight', 'simple/lightweight'],
  ['production-ready', 'production-ready'],
  ['no heavy dependencies', 'no heavy dependencies'],
  ['budget-sensitive', 'budget-sensitive'],
  ['solo developer friendly', 'solo developer friendly'],
  ['scalable architecture', 'scalable architecture'],
  ['security-focused', 'security-focused'],
  ['mobile responsive', 'mobile responsive'],
];

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

function softwarePlanToClientMarkdown(plan: SoftwareProjectPlan) {
  const table = (headers: string[], rows: Array<{ cells: string[] }>) => [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.cells.map((cell) => cell.replace(/\|/g, '/')).join(' | ')} |`),
  ].join('\n');

  return [
    `# ${plan.projectName} Software Project Plan`,
    '',
    `Generated: ${plan.generatedAt}`,
    '',
    '## Executive Summary',
    plan.executiveSummary.overview,
    `Target user: ${plan.executiveSummary.targetUser}`,
    `Business value: ${plan.executiveSummary.businessValue}`,
    `MVP goal: ${plan.executiveSummary.mvpGoal}`,
    '',
    '## Core Features',
    table(['Feature', 'Description', 'Priority', 'MVP/Future', 'Notes'], plan.features),
    '',
    '## Pages / Routes',
    table(['Route', 'Page name', 'Purpose', 'Auth required', 'Notes'], plan.routes),
    '',
    '## Database Plan',
    table(['Table', 'Purpose', 'Important fields', 'Relationships', 'Notes'], plan.databasePlan),
    '',
    '## API Plan',
    table(['Endpoint/Action', 'Purpose', 'Method', 'Auth required', 'Notes'], plan.apiPlan),
    '',
    '## Development Phases',
    ...plan.phases.flatMap((phase) => [`### ${phase.name}`, phase.goal, ...phase.tasks.map((task) => `- ${task}`), '']),
    '## Testing Checklist',
    ...plan.testingChecklist.map((item) => `- [ ] ${item}`),
    '',
    '## Deployment Checklist',
    ...plan.deploymentChecklist.map((item) => `- [ ] ${item}`),
    '',
    '## Security Checklist',
    ...plan.securityChecklist.map((item) => `- [ ] ${item}`),
    '',
    '## Risks',
    table(['Risk', 'Impact', 'Mitigation'], plan.risks),
    '',
    '## Next Actions',
    ...plan.nextActions.map((item) => `- ${item}`),
    '',
    'Safety notes: planning only, no code files generated, no GitHub writes, no deploys, no secrets.',
  ].join('\n');
}

export function SoftwarePlannerClient({ projects, selectedProjectId }: SoftwarePlannerClientProps) {
  const [selectedProject, setSelectedProject] = useState(selectedProjectId ?? '');
  const [activeTab, setActiveTab] = useState<PlanTab>('overview');
  const [generateState, generateAction, isGenerating] = useActionState(generateSoftwarePlanAction, initialState);
  const [saveState, saveAction, isSaving] = useActionState(saveSoftwarePlanToProjectAction, initialState);
  const [createProjectState, createProjectAction, isCreatingProject] = useActionState(createProjectFromPlanAction, initialState);
  const [tasksState, tasksAction, isCreatingTasks] = useActionState(createTasksFromPlanAction, initialState);
  const plan = tasksState.plan ?? createProjectState.plan ?? saveState.plan ?? generateState.plan;
  const effectiveProjectId = createProjectState.projectId ?? saveState.projectId ?? generateState.projectId ?? selectedProject;
  const planMarkdown = useMemo(() => (plan ? softwarePlanToClientMarkdown(plan) : ''), [plan]);

  useActionToast({
    isPending: isGenerating,
    state: generateState,
    loadingMessage: 'Generating project plan...',
    successMessage: (state) => state.message ?? 'Project plan generated.',
    errorMessage: (state) => state.error ?? 'Could not generate project plan.',
  });

  useActionToast({
    isPending: isSaving,
    state: saveState,
    loadingMessage: 'Saving project plan...',
    successMessage: (state) => state.message ?? 'Project plan saved.',
    errorMessage: (state) => state.error ?? 'Could not save project plan.',
  });

  useActionToast({
    isPending: isCreatingProject,
    state: createProjectState,
    loadingMessage: 'Creating project record...',
    successMessage: (state) => state.message ?? 'Project created from plan.',
    errorMessage: (state) => state.error ?? 'Could not create project from plan.',
  });

  useActionToast({
    isPending: isCreatingTasks,
    state: tasksState,
    loadingMessage: 'Creating pending planning tasks...',
    successMessage: (state) => state.message ?? 'Planning tasks created.',
    errorMessage: (state) => state.error ?? 'Could not create planning tasks.',
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(340px,0.82fr)_minmax(0,1.18fr)]">
      <form action={generateAction} className="space-y-6">
        <Card>
          <CardHeader
            title="Project Idea"
            description="Turn a raw software idea into a structured technical plan. Nothing is generated into the repository."
          />
          <div className="grid gap-5">
            <div>
              <Label htmlFor="projectId">Use existing project context</Label>
              <Select id="projectId" name="projectId" value={selectedProject} onChange={(event) => setSelectedProject(event.target.value)} disabled={isGenerating}>
                <option value="">No project selected</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="projectName">Project name</Label>
              <Input id="projectName" name="projectName" placeholder="AI Agency Campaign OS" disabled={isGenerating} />
            </div>
            <div>
              <Label htmlFor="shortIdea">Short idea</Label>
              <Textarea id="shortIdea" name="shortIdea" rows={4} placeholder="Build a SaaS dashboard for managing AI agency campaigns." disabled={isGenerating} />
            </div>
            <div>
              <Label htmlFor="problemToSolve">Problem to solve</Label>
              <Textarea id="problemToSolve" name="problemToSolve" rows={3} disabled={isGenerating} />
            </div>
            <div>
              <Label htmlFor="targetUsers">Target users</Label>
              <Input id="targetUsers" name="targetUsers" placeholder="Manager, operator, agency strategist" disabled={isGenerating} />
            </div>
            <div>
              <Label htmlFor="businessGoal">Business goal</Label>
              <Input id="businessGoal" name="businessGoal" placeholder="Reduce campaign operations time and mistakes" disabled={isGenerating} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="platformType">Platform type</Label>
                <Select id="platformType" name="platformType" defaultValue="saas" disabled={isGenerating}>
                  <option value="saas">SaaS</option>
                  <option value="dashboard">Dashboard</option>
                  <option value="website">Website</option>
                  <option value="mobile_app">Mobile app</option>
                  <option value="automation_tool">Automation tool</option>
                  <option value="ai_tool">AI tool</option>
                  <option value="internal_system">Internal system</option>
                  <option value="marketplace">Marketplace</option>
                  <option value="other">Other</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="scope">Scope</Label>
                <Select id="scope" name="scope" defaultValue="mvp_only" disabled={isGenerating}>
                  <option value="mvp_only">MVP only</option>
                  <option value="full_product_plan">Full product plan</option>
                  <option value="phased_roadmap">Phased roadmap</option>
                  <option value="existing_project_improvement">Existing project improvement</option>
                  <option value="rebuild_refactor_plan">Rebuild/refactor plan</option>
                </Select>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Technical Preferences" description="Optional architecture direction for the generated plan." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="preferredTechStack" label="Preferred tech stack" placeholder="Next.js, Supabase, Vercel" />
            <Field name="frontendFramework" label="Frontend framework" placeholder="Next.js" />
            <Field name="backendPreference" label="Backend/API" placeholder="Server Actions / API routes" />
            <Field name="databasePreference" label="Database" placeholder="Supabase Postgres" />
            <Field name="authRequirement" label="Auth" placeholder="Supabase Auth" />
            <Field name="storageRequirement" label="File upload/storage" placeholder="Supabase Storage" />
            <Field name="aiRequirement" label="AI integration" placeholder="OpenAI/NVIDIA server-side" />
            <Field name="paymentRequirement" label="Payments" placeholder="Stripe later" />
            <Field name="deploymentTarget" label="Deployment target" placeholder="Vercel" />
            <Field name="integrationsNeeded" label="Integrations" placeholder="GitHub, Slack, email..." />
          </div>
        </Card>

        <Card>
          <CardHeader title="Output Preferences" description="Choose what the plan should include." />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="language">Language</Label>
              <Select id="language" name="language" defaultValue="english" disabled={isGenerating}>
                <option value="english">English</option>
                <option value="arabic">Arabic</option>
                <option value="french">French</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="detailLevel">Detail level</Label>
              <Select id="detailLevel" name="detailLevel" defaultValue="medium" disabled={isGenerating}>
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="detailed">Detailed</option>
              </Select>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {constraints.map(([value, label]) => (
              <label key={value} className="flex items-center gap-3 rounded-lg border border-black/7 bg-[#F1F7F7]/70 p-3 text-sm font-bold text-black/68">
                <input type="checkbox" name="constraints" value={value} className="h-4 w-4 accent-[#F7CBCA]" disabled={isGenerating} />
                {label}
              </label>
            ))}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ['includeDatabase', 'Include database schema', true],
              ['includeApi', 'Include API routes', true],
              ['includeUiPages', 'Include UI pages/routes', true],
              ['includeTesting', 'Include testing checklist', true],
              ['includeDeployment', 'Include deployment checklist', true],
              ['includeTasks', 'Include task drafts', true],
            ].map(([name, label, checked]) => (
              <label key={name as string} className="flex items-center gap-3 rounded-lg border border-black/7 bg-white/80 p-3 text-sm font-bold text-black/68">
                <input type="checkbox" name={name as string} defaultChecked={Boolean(checked)} className="h-4 w-4 accent-[#F7CBCA]" disabled={isGenerating} />
                {label as string}
              </label>
            ))}
          </div>

          {generateState.error ? (
            <Notice tone="danger" title={generateState.error.includes('AI provider setup') ? 'AI provider setup required' : 'Could not generate project plan'}>
              {generateState.error}
            </Notice>
          ) : null}

          <Button type="submit" className="mt-5" disabled={isGenerating}>
            <Sparkles className="h-4 w-4" />
            {isGenerating ? 'Generating project plan...' : 'Generate Software Project Plan'}
          </Button>
        </Card>
      </form>

      <section className="space-y-6">
        {plan ? (
          <PlanPreview
            plan={plan}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            planMarkdown={planMarkdown}
            selectedProjectId={effectiveProjectId || ''}
            saveAction={saveAction}
            createProjectAction={createProjectAction}
            tasksAction={tasksAction}
            isSaving={isSaving}
            isCreatingProject={isCreatingProject}
            isCreatingTasks={isCreatingTasks}
          />
        ) : (
          <Card>
            <CardHeader title="Generated Plan Preview" description="Your project plan will appear here after generation." />
            <div className="rounded-lg border border-dashed border-[#F7CBCA]/20 bg-[#F1F7F7]/70 p-6 text-sm leading-6 text-black/60">
              <Sparkles className="mb-3 h-5 w-5 text-[#F7CBCA]" />
              Enter an idea, choose scope and preferences, then generate a planning document. The planner creates documentation only.
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}

function Field({ name, label, placeholder }: { name: string; label: string; placeholder?: string }) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} placeholder={placeholder} />
    </div>
  );
}

function PlanPreview({
  plan,
  activeTab,
  setActiveTab,
  planMarkdown,
  selectedProjectId,
  saveAction,
  createProjectAction,
  tasksAction,
  isSaving,
  isCreatingProject,
  isCreatingTasks,
}: {
  plan: SoftwareProjectPlan;
  activeTab: PlanTab;
  setActiveTab: (tab: PlanTab) => void;
  planMarkdown: string;
  selectedProjectId: string;
  saveAction: (payload: FormData) => void;
  createProjectAction: (payload: FormData) => void;
  tasksAction: (payload: FormData) => void;
  isSaving: boolean;
  isCreatingProject: boolean;
  isCreatingTasks: boolean;
}) {
  const planJson = JSON.stringify(plan);
  const tabs: Array<[PlanTab, string, typeof Sparkles]> = [
    ['overview', 'Overview', Sparkles],
    ['features', 'Features', Layers3],
    ['routes', 'Routes', Route],
    ['database', 'Database', Database],
    ['api', 'API', GitBranch],
    ['phases', 'Phases', ListChecks],
    ['testing', 'Testing', ShieldCheck],
    ['deployment', 'Deployment', Rocket],
    ['risks', 'Risks', FileText],
    ['tasks', 'Tasks', FolderKanban],
  ];

  return (
    <Card>
      <CardHeader
        title={plan.projectName}
        description={`Generated with ${plan.aiProviderUsed}. Planning only: no files, GitHub writes, or deploys.`}
        action={<span className="rounded-lg bg-[#D5E5E5]/70 px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#F7CBCA]">{plan.scope.replace(/_/g, ' ')}</span>}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <button type="button" className={buttonStyles({ variant: 'outline', size: 'sm' })} onClick={() => copyText(planMarkdown)}>
          <Clipboard className="h-4 w-4" />
          Copy Full Plan
        </button>
        <button type="button" className={buttonStyles({ variant: 'outline', size: 'sm' })} onClick={() => copyText(plan.phases.map((phase) => `${phase.name}\n${phase.goal}`).join('\n\n'))}>
          <ListChecks className="h-4 w-4" />
          Copy Development Phases
        </button>
        <button type="button" className={buttonStyles({ variant: 'outline', size: 'sm' })} onClick={() => copyText(plan.databasePlan.map((row) => row.cells.join(' | ')).join('\n'))}>
          <Database className="h-4 w-4" />
          Copy Database Plan
        </button>
        <button type="button" className={buttonStyles({ variant: 'outline', size: 'sm' })} onClick={() => copyText(plan.apiPlan.map((row) => row.cells.join(' | ')).join('\n'))}>
          <Route className="h-4 w-4" />
          Copy API Plan
        </button>
        <button type="button" className={buttonStyles({ variant: 'outline', size: 'sm' })} onClick={() => copyText(plan.testingChecklist.map((item) => `- [ ] ${item}`).join('\n'))}>
          <ShieldCheck className="h-4 w-4" />
          Copy Testing Checklist
        </button>
        <button type="button" className={buttonStyles({ variant: 'outline', size: 'sm' })} onClick={() => copyText(plan.releasePlanDraft)}>
          <Rocket className="h-4 w-4" />
          Copy Release Plan Draft
        </button>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <form action={saveAction}>
          <input type="hidden" name="projectId" value={selectedProjectId} />
          <input type="hidden" name="planJson" value={planJson} />
          <Button type="submit" variant="secondary" size="sm" disabled={!selectedProjectId || isSaving}>
            <Save className="h-4 w-4" />
            Save Plan to Project
          </Button>
        </form>
        <form
          action={createProjectAction}
          onSubmit={(event) => {
            if (!window.confirm('This will create a new project record from this plan. It will not generate code or deploy anything.')) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="planJson" value={planJson} />
          <Button type="submit" variant="outline" size="sm" disabled={isCreatingProject}>
            <FolderKanban className="h-4 w-4" />
            Create Project from Plan
          </Button>
        </form>
        <form
          action={tasksAction}
          onSubmit={(event) => {
            if (!window.confirm('This will create planning tasks from the generated phases. It will not run agents automatically.')) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="projectId" value={selectedProjectId} />
          <input type="hidden" name="planJson" value={planJson} />
          <Button type="submit" variant="outline" size="sm" disabled={!selectedProjectId || !plan.taskDrafts.length || isCreatingTasks}>
            <ListChecks className="h-4 w-4" />
            Create Tasks from Plan
          </Button>
        </form>
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
        {tabs.map(([tab, label, Icon]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-black',
              activeTab === tab
                ? 'border-[#F7CBCA] bg-[#F7CBCA] text-white'
                : 'border-black/8 bg-[#F1F7F7]/70 text-black/62 hover:border-[#F7CBCA]/30'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <PlanTabContent plan={plan} activeTab={activeTab} />

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/dashboard/projects" className={buttonStyles({ variant: 'ghost', size: 'sm' })}>
          Open Projects
        </Link>
        <Link href="/dashboard/prompt-library" className={buttonStyles({ variant: 'ghost', size: 'sm' })}>
          Open Prompt Library
        </Link>
      </div>
    </Card>
  );
}

function PlanTabContent({ plan, activeTab }: { plan: SoftwareProjectPlan; activeTab: PlanTab }) {
  if (activeTab === 'overview') {
    return (
      <div className="space-y-4">
        <Section title="Executive Summary" items={[plan.executiveSummary.overview, `Target user: ${plan.executiveSummary.targetUser}`, `Business value: ${plan.executiveSummary.businessValue}`, `MVP goal: ${plan.executiveSummary.mvpGoal}`]} />
        <Section title="Problem & Solution" items={[`Problem: ${plan.problemSolution.problem}`, `Solution: ${plan.problemSolution.solution}`, `Why it matters: ${plan.problemSolution.whyItMatters}`]} />
        <Section title="Architecture Notes" items={plan.architectureNotes} />
        {plan.aiNarrative ? <Section title="AI Narrative" items={[plan.aiNarrative]} /> : null}
      </div>
    );
  }

  if (activeTab === 'features') return <DataTable headers={['Feature', 'Description', 'Priority', 'MVP/Future', 'Notes']} rows={plan.features} />;
  if (activeTab === 'routes') return <DataTable headers={['Route', 'Page name', 'Purpose', 'Auth required', 'Notes']} rows={plan.routes} />;
  if (activeTab === 'database') return <DataTable headers={['Table', 'Purpose', 'Important fields', 'Relationships', 'Notes']} rows={plan.databasePlan} empty="Database plan was not requested." />;
  if (activeTab === 'api') return <DataTable headers={['Endpoint/Action', 'Purpose', 'Method', 'Auth required', 'Notes']} rows={plan.apiPlan} empty="API plan was not requested." />;
  if (activeTab === 'testing') return <Section title="Testing Checklist" items={plan.testingChecklist.length ? plan.testingChecklist : ['Testing checklist was not requested.']} />;
  if (activeTab === 'deployment') return <><Section title="Deployment Checklist" items={plan.deploymentChecklist.length ? plan.deploymentChecklist : ['Deployment checklist was not requested.']} /><Section title="Security Checklist" items={plan.securityChecklist} /></>;
  if (activeTab === 'risks') return <DataTable headers={['Risk', 'Impact', 'Mitigation']} rows={plan.risks} />;
  if (activeTab === 'tasks') return <TaskDrafts plan={plan} />;

  return <Phases phases={plan.phases} />;
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-lg border border-black/7 bg-[#F1F7F7]/70 p-4">
      <h3 className="font-black text-[#5D6B6B]">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-black/65">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="break-words">{item}</li>
        ))}
      </ul>
    </section>
  );
}

function DataTable({ headers, rows, empty = 'No rows generated.' }: { headers: string[]; rows: Array<{ cells: string[] }>; empty?: string }) {
  if (!rows.length) {
    return <div className="rounded-lg border border-dashed border-black/10 bg-[#F1F7F7]/70 p-5 text-sm text-black/58">{empty}</div>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-black/7 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#F1F7F7] text-xs font-black uppercase tracking-[0.08em] text-black/42">
            <tr>{headers.map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-black/6">
            {rows.map((row, index) => (
              <tr key={index}>
                {row.cells.map((cell, cellIndex) => (
                  <td key={`${index}-${cellIndex}`} className={cn('px-4 py-3 text-black/64', cellIndex === 0 && 'font-black text-[#5D6B6B]')}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Phases({ phases }: { phases: SoftwareProjectPlan['phases'] }) {
  return (
    <div className="space-y-4">
      {phases.map((phase) => (
        <section key={phase.name} className="rounded-lg border border-black/7 bg-[#F1F7F7]/70 p-4">
          <h3 className="font-black text-[#5D6B6B]">{phase.name}</h3>
          <p className="mt-2 text-sm leading-6 text-black/62">{phase.goal}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <MiniList title="Tasks" items={phase.tasks} />
            <MiniList title="Deliverables" items={phase.deliverables} />
            <MiniList title="Acceptance" items={phase.acceptanceChecklist} />
          </div>
        </section>
      ))}
    </div>
  );
}

function MiniList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.1em] text-black/42">{title}</p>
      <ul className="mt-2 space-y-1 text-sm leading-6 text-black/62">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function TaskDrafts({ plan }: { plan: SoftwareProjectPlan }) {
  if (!plan.taskDrafts.length) {
    return <div className="rounded-lg border border-dashed border-black/10 bg-[#F1F7F7]/70 p-5 text-sm text-black/58">Task drafts were not requested.</div>;
  }

  return (
    <div className="space-y-3">
      {plan.taskDrafts.map((task) => (
        <div key={task.title} className="rounded-lg border border-black/7 bg-[#F1F7F7]/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-black text-[#5D6B6B]">{task.title}</h3>
            <span className="rounded-md bg-white px-2 py-1 text-xs font-black uppercase tracking-[0.08em] text-[#F7CBCA]">{task.priority}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-black/62">{task.description}</p>
        </div>
      ))}
    </div>
  );
}
