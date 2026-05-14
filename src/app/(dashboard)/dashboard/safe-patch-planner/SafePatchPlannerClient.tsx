'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  Clipboard,
  Code2,
  FileText,
  FolderKanban,
  ListChecks,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input, Label, Select, Textarea } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';
import { useActionToast } from '@/components/ui/useActionToast';
import { cn, formatDateTime } from '@/lib/utils';
import type { SafePatchPlanRecord } from '@/lib/data/safe-patch-plans';
import type { ProjectRecord } from '@/types/database';
import {
  generateSafePatchPlanAction,
  saveSafePatchPlanAction,
  updateSafePatchPlanStatusAction,
  type SafePatchPlannerState,
} from './actions';

interface SafePatchPlannerClientProps {
  projects: ProjectRecord[];
  plans: SafePatchPlanRecord[];
  selectedProjectId: string | null;
  initialContext: string;
}

const initialState: SafePatchPlannerState = {
  error: null,
  message: null,
  plan: null,
  savedPlan: null,
};

type ClientSafePatchPlan = NonNullable<SafePatchPlannerState['plan']>;

const defaultNoTouchSystems = [
  'n8n/callbacks/webhooks/task execution',
  'provider publishing logic',
  'Real Scheduling Execution core logic',
  'Supabase schema unless required',
  'environment variables/secrets',
  'ads_management',
  'live campaign spending',
  'GitHub writes',
  'production deploy unless explicitly requested',
];

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

function planFromRecord(record: SafePatchPlanRecord): ClientSafePatchPlan | null {
  const metadata = record.metadata as Record<string, unknown>;
  return metadata.plan && typeof metadata.plan === 'object' ? (metadata.plan as ClientSafePatchPlan) : null;
}

function safePatchPlanToClientMarkdown(plan: ClientSafePatchPlan) {
  const affectedTable = [
    '| File/Area | Expected change | Risk | Notes |',
    '| --- | --- | --- | --- |',
    ...plan.affectedFiles.map((file) =>
      `| ${file.fileOrArea.replace(/\|/g, '/')} | ${file.expectedChange.replace(/\|/g, '/')} | ${file.risk} | ${file.notes.replace(/\|/g, '/')} |`
    ),
  ];

  return [
    `# ${plan.title}`,
    '',
    `Generated: ${plan.generatedAt}`,
    `Change type: ${plan.changeType}`,
    `Priority: ${plan.priority}`,
    `Risk level: ${plan.riskLevel}`,
    '',
    '## Change Summary',
    ...plan.changeSummary.map((item) => `- ${item}`),
    '',
    '## Scope',
    ...plan.scope.included.map((item) => `- Include: ${item}`),
    ...plan.scope.excluded.map((item) => `- Exclude: ${item}`),
    '',
    '## Affected Files',
    ...affectedTable,
    '',
    '## Implementation Steps',
    ...plan.implementationSteps.map((item, index) => `${index + 1}. ${item}`),
    '',
    '## Safety Constraints',
    ...plan.safetyConstraints.map((item) => `- ${item}`),
    '',
    '## Test Checklist',
    ...plan.testChecklist.map((item) => `- [ ] ${item}`),
    '',
    '## Rollback Plan',
    ...plan.rollbackPlan.map((item) => `- ${item}`),
    '',
    '## Suggested Codex Prompt',
    plan.suggestedCodexPrompt,
    '',
    '## Approval Checklist',
    ...plan.approvalChecklist.map((item) => `- [ ] ${item}`),
  ].join('\n');
}

function riskClass(value: string) {
  if (value === 'critical') return 'border-[#F7CBCA]/30 bg-[#F7CBCA]/12 text-[#A30D1D]';
  if (value === 'high') return 'border-[#F7CBCA]/24 bg-[#D5E5E5]/72 text-[#F7CBCA]';
  if (value === 'medium') return 'border-[#E7F5DC]/34 bg-[#E7F5DC]/20 text-[#8A4300]';
  return 'border-black/10 bg-white text-black/60';
}

export function SafePatchPlannerClient({
  projects,
  plans,
  selectedProjectId,
  initialContext,
}: SafePatchPlannerClientProps) {
  const [selectedProject, setSelectedProject] = useState(selectedProjectId ?? '');
  const [activeRecord, setActiveRecord] = useState<SafePatchPlanRecord | null>(plans[0] ?? null);
  const [generateState, generateAction, isGenerating] = useActionState(generateSafePatchPlanAction, initialState);
  const [saveState, saveAction, isSaving] = useActionState(saveSafePatchPlanAction, initialState);
  const [statusState, statusAction, isUpdatingStatus] = useActionState(updateSafePatchPlanStatusAction, initialState);
  const generatedPlan = saveState.plan ?? generateState.plan;
  const activePlan = generatedPlan ?? (activeRecord ? planFromRecord(activeRecord) : null);
  const activeMarkdown = useMemo(() => (activePlan ? safePatchPlanToClientMarkdown(activePlan) : ''), [activePlan]);
  const selectedProjectRecord = projects.find((project) => project.id === selectedProject) ?? null;

  useActionToast({
    isPending: isGenerating,
    state: generateState,
    loadingMessage: 'Generating safe patch plan...',
    successMessage: (state) => state.message ?? 'Safe patch plan generated.',
    errorMessage: (state) => state.error ?? 'Could not generate safe patch plan.',
  });

  useActionToast({
    isPending: isSaving,
    state: saveState,
    loadingMessage: 'Saving patch plan...',
    successMessage: (state) => state.message ?? 'Safe patch plan saved.',
    errorMessage: (state) => state.error ?? 'Could not save patch plan.',
  });

  useActionToast({
    isPending: isUpdatingStatus,
    state: statusState,
    loadingMessage: 'Updating patch plan...',
    successMessage: (state) => state.message ?? 'Patch plan updated.',
    errorMessage: (state) => state.error ?? 'Could not update patch plan.',
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(340px,0.84fr)_minmax(0,1.16fr)]">
      <form action={generateAction} className="space-y-6">
        <Card>
          <CardHeader
            title="Patch Request"
            description="Describe the desired change. This creates a plan only; it does not edit files."
          />
          <div className="grid gap-5">
            <div>
              <Label htmlFor="title">Patch title</Label>
              <Input id="title" name="title" placeholder="Fix crowded dashboard buttons" disabled={isGenerating} />
            </div>
            <div>
              <Label htmlFor="projectId">Related project</Label>
              <Select
                id="projectId"
                name="projectId"
                value={selectedProject}
                onChange={(event) => setSelectedProject(event.target.value)}
                disabled={isGenerating}
              >
                <option value="">No project selected</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="changeType">Change type</Label>
                <Select id="changeType" name="changeType" defaultValue="feature" disabled={isGenerating}>
                  <option value="bug_fix">Bug fix</option>
                  <option value="ui_update">UI update</option>
                  <option value="feature">Feature</option>
                  <option value="refactor">Refactor</option>
                  <option value="security">Security</option>
                  <option value="database_migration">Database migration</option>
                  <option value="provider_update">Provider update</option>
                  <option value="docs">Docs</option>
                  <option value="deployment">Deployment</option>
                  <option value="stabilization">Stabilization</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select id="priority" name="priority" defaultValue="medium" disabled={isGenerating}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="changeRequest">What do you want to change?</Label>
              <Textarea id="changeRequest" name="changeRequest" rows={5} disabled={isGenerating} />
            </div>
            <div>
              <Label htmlFor="currentProblem">Current problem</Label>
              <Textarea id="currentProblem" name="currentProblem" rows={3} disabled={isGenerating} />
            </div>
            <div>
              <Label htmlFor="expectedResult">Expected result</Label>
              <Textarea id="expectedResult" name="expectedResult" rows={3} disabled={isGenerating} />
            </div>
            <div>
              <Label htmlFor="filesOrPages">Files or pages involved if known</Label>
              <Textarea id="filesOrPages" name="filesOrPages" rows={3} placeholder="/dashboard/projects&#10;src/app/.../page.tsx" disabled={isGenerating} />
            </div>
            <div>
              <Label>Systems that must not be touched</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {defaultNoTouchSystems.map((item) => (
                  <label key={item} className="flex items-start gap-2 rounded-lg border border-black/7 bg-[#F1F7F7]/70 p-3 text-sm font-semibold leading-6 text-black/64">
                    <input
                      type="checkbox"
                      name="systemsNotToTouch"
                      value={item}
                      defaultChecked
                      className="mt-1 h-4 w-4 rounded border-black/20 accent-[#F7CBCA]"
                    />
                    {item}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="riskNotes">Risk notes</Label>
              <Textarea id="riskNotes" name="riskNotes" rows={3} disabled={isGenerating} />
            </div>
            <div>
              <Label htmlFor="testingRequirements">Testing requirements</Label>
              <Textarea id="testingRequirements" name="testingRequirements" rows={3} disabled={isGenerating} />
            </div>
            <input type="hidden" name="sourceContext" value={initialContext} />
            {selectedProjectRecord ? (
              <Notice tone="info" title="Project context included">
                {selectedProjectRecord.name} context will be included without secrets.
              </Notice>
            ) : null}
            {generateState.error ? (
              <Notice tone="danger" title="Could not generate plan">
                {generateState.error}
              </Notice>
            ) : null}
            <Button type="submit" disabled={isGenerating}>
              <Sparkles className="h-4 w-4" />
              {isGenerating ? 'Generating...' : 'Generate Safe Patch Plan'}
            </Button>
          </div>
        </Card>
      </form>

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Generated Patch Plan"
            description="Review the plan, copy the safe implementation prompt, then save it if it is useful."
            action={
              activePlan ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => copyText(activeMarkdown)}>
                    <Clipboard className="h-4 w-4" />
                    Copy Full Patch Plan
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => copyText(activePlan.suggestedCodexPrompt)}>
                    <Code2 className="h-4 w-4" />
                    Copy Codex Prompt
                  </Button>
                </div>
              ) : null
            }
          />

          {!activePlan ? (
            <div className="rounded-lg border border-dashed border-black/12 bg-[#F1F7F7]/70 p-6 text-sm leading-6 text-black/58">
              <ShieldCheck className="mb-3 h-5 w-5 text-[#F7CBCA]" />
              Generate or open a saved plan. This planner never applies patches, writes to GitHub, deploys, or runs tasks.
            </div>
          ) : (
            <PatchPlanView
              plan={activePlan}
              markdown={activeMarkdown}
              selectedProject={selectedProject}
              saveAction={saveAction}
              isSaving={isSaving}
              changeRequest={generateState.plan ? '' : activeRecord?.change_request ?? ''}
            />
          )}
        </Card>

        <Card>
          <CardHeader title="Saved Patch Plans" description="Draft and approved prompt plans saved in this workspace." />
          {plans.length === 0 ? (
            <p className="rounded-lg border border-dashed border-black/10 bg-[#F1F7F7]/70 p-4 text-sm text-black/55">
              No saved patch plans yet.
            </p>
          ) : (
            <div className="space-y-3">
              {plans.map((record) => (
                <div key={record.id} className="rounded-lg border border-black/7 bg-[#F1F7F7]/70 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <button type="button" className="min-w-0 text-left" onClick={() => setActiveRecord(record)}>
                      <p className="font-black text-[#5D6B6B]">{record.title}</p>
                      <p className="mt-1 text-sm leading-6 text-black/55">
                        {record.project_name ?? 'No project'} / {record.change_type.replace(/_/g, ' ')} / {formatDateTime(record.created_at)}
                      </p>
                    </button>
                    <div className="flex flex-wrap gap-2">
                      <span className={cn('rounded-full border px-2.5 py-1 text-xs font-black uppercase', riskClass(record.risk_level))}>
                        {record.risk_level}
                      </span>
                      <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs font-black uppercase text-black/55">
                        {record.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setActiveRecord(record)}>
                      <FileText className="h-4 w-4" />
                      Open
                    </Button>
                    {record.suggested_prompt ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => copyText(record.suggested_prompt ?? '')}>
                        <Clipboard className="h-4 w-4" />
                        Copy Prompt
                      </Button>
                    ) : null}
                    <form action={statusAction}>
                      <input type="hidden" name="planId" value={record.id} />
                      <input type="hidden" name="status" value="archived" />
                      <Button type="submit" variant="ghost" size="sm">
                        <Archive className="h-4 w-4" />
                        Archive
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function PatchPlanView({
  plan,
  markdown,
  selectedProject,
  saveAction,
  isSaving,
  changeRequest,
}: {
  plan: ClientSafePatchPlan;
  markdown: string;
  selectedProject: string;
  saveAction: (payload: FormData) => void;
  isSaving: boolean;
  changeRequest: string;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('rounded-full border px-2.5 py-1 text-xs font-black uppercase', riskClass(plan.riskLevel))}>
          Risk: {plan.riskLevel}
        </span>
        <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs font-black uppercase text-black/55">
          {plan.changeType.replace(/_/g, ' ')}
        </span>
        <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs font-black uppercase text-black/55">
          {plan.priority}
        </span>
      </div>

      <PlanSection title="A. Change Summary" items={plan.changeSummary} />
      <PlanSection title="B. Scope" items={[...plan.scope.included.map((item) => `Include: ${item}`), ...plan.scope.excluded.map((item) => `Exclude: ${item}`)]} />

      <section>
        <h3 className="mb-3 font-black text-[#5D6B6B]">C. Affected Files</h3>
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/8 text-xs font-black uppercase tracking-[0.12em] text-black/42">
                <th className="px-3 py-2">File/Area</th>
                <th className="px-3 py-2">Expected change</th>
                <th className="px-3 py-2">Risk</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {plan.affectedFiles.map((file) => (
                <tr key={`${file.fileOrArea}-${file.expectedChange}`} className="border-b border-black/6 align-top">
                  <td className="px-3 py-2 font-mono text-xs text-black/64">{file.fileOrArea}</td>
                  <td className="px-3 py-2 text-black/62">{file.expectedChange}</td>
                  <td className="px-3 py-2">{file.risk}</td>
                  <td className="px-3 py-2 text-black/52">{file.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <PlanSection title="D. Implementation Steps" items={plan.implementationSteps} ordered />
      <PlanSection
        title="E. Risk Assessment"
        items={[
          `Technical risk: ${plan.riskAssessment.technical}`,
          `Data risk: ${plan.riskAssessment.data}`,
          `Provider risk: ${plan.riskAssessment.provider}`,
          `UI risk: ${plan.riskAssessment.ui}`,
          `Deployment risk: ${plan.riskAssessment.deployment}`,
          ...plan.riskAssessment.notes,
        ]}
      />
      <PlanSection title="F. Safety Constraints" items={plan.safetyConstraints} />
      <PlanSection title="G. Test Checklist" items={plan.testChecklist} checklist />
      <PlanSection title="H. Rollback Plan" items={plan.rollbackPlan} />
      <section className="rounded-lg border border-black/7 bg-[#F1F7F7]/70 p-4">
        <h3 className="font-black text-[#5D6B6B]">I. Suggested Codex Prompt</h3>
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-[#5D6B6B] p-4 text-xs leading-6 text-[#D5E5E5]">
          {plan.suggestedCodexPrompt}
        </pre>
      </section>
      <PlanSection title="J. Approval Checklist" items={plan.approvalChecklist} checklist />

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => copyText(plan.testChecklist.map((item) => `- [ ] ${item}`).join('\n'))}>
          <ListChecks className="h-4 w-4" />
          Copy Test Checklist
        </Button>
        <Button type="button" variant="outline" onClick={() => copyText(plan.rollbackPlan.map((item) => `- ${item}`).join('\n'))}>
          <RotateCcw className="h-4 w-4" />
          Copy Rollback Plan
        </Button>
        <form action={saveAction}>
          <input type="hidden" name="projectId" value={selectedProject} />
          <input type="hidden" name="planJson" value={JSON.stringify(plan)} />
          <input type="hidden" name="changeRequest" value={changeRequest || plan.changeSummary.join('\n')} />
          <Button type="submit" disabled={isSaving}>
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Patch Plan'}
          </Button>
        </form>
        <Link href="/dashboard/prompt-library" className={buttonStyles({ variant: 'outline' })}>
          <FolderKanban className="h-4 w-4" />
          Open Prompt Library
        </Link>
      </div>

      {plan.aiNotes ? (
        <Notice tone="info" title="AI planning notes">
          {plan.aiNotes}
        </Notice>
      ) : null}

      <textarea className="sr-only" readOnly value={markdown} aria-label="Full patch plan markdown" />
    </div>
  );
}

function PlanSection({
  title,
  items,
  ordered = false,
  checklist = false,
}: {
  title: string;
  items: string[];
  ordered?: boolean;
  checklist?: boolean;
}) {
  const Tag = ordered ? 'ol' : 'ul';

  return (
    <section>
      <h3 className="mb-3 font-black text-[#5D6B6B]">{title}</h3>
      <Tag className="space-y-2">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="rounded-lg border border-black/7 bg-[#F1F7F7]/70 p-3 text-sm leading-6 text-black/64">
            {checklist ? `☐ ${item}` : ordered ? `${index + 1}. ${item}` : item}
          </li>
        ))}
      </Tag>
    </section>
  );
}
