'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Clipboard,
  FileArchive,
  FileText,
  GitBranch,
  ListChecks,
  Save,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Label, Select, Textarea } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';
import { useActionToast } from '@/hooks/useActionToast';
import { cn, formatDateTime } from '@/lib/utils';
import type { CodebaseAnalysisReport, CodebaseAnalysisSource } from '@/lib/codebase-analyzer';
import {
  analyzeCodebaseAction,
  saveCodebaseAnalysisAction,
  type CodebaseAnalyzerState,
  type ProjectFormState,
} from './actions';

interface CodebaseAnalyzerProps {
  projectId: string;
  projectName: string;
  githubLinked: boolean;
  githubLabel: string | null;
  savedAnalysis: {
    summary: string | null;
    generated_at: string | null;
    source_label: string | null;
    tech_stack: string[];
    key_findings: string[];
    next_actions: string[];
    report_markdown: string | null;
  };
}

const initialAnalyzeState: CodebaseAnalyzerState = {
  error: null,
  message: null,
  report: null,
};

const initialSaveState: ProjectFormState = {
  error: null,
  message: null,
  projectId: null,
};

function reportMarkdown(report: CodebaseAnalysisReport) {
  return [
    '# Codebase Analysis Report',
    '',
    `Project source: ${report.sourceLabel}`,
    `Generated: ${report.generatedAt}`,
    '',
    '## Overview',
    report.summary,
    '',
    '## Tech Stack',
    ...report.techStack.map((item) => `- ${item}`),
    '',
    '## Routes',
    ...(report.routes.length ? report.routes.map((route) => `- ${route.route} | ${route.file} | ${route.purpose}`) : ['- No page routes detected.']),
    '',
    '## API Routes',
    ...(report.apiRoutes.length ? report.apiRoutes.map((route) => `- ${route.method} ${route.route} | ${route.file} | ${route.securityNotes}`) : ['- No API routes detected.']),
    '',
    '## Database',
    ...report.database.map((item) => `- ${item}`),
    '',
    '## Risks',
    ...report.potentialRisks.map((finding) => `- [${finding.priority}] ${finding.title}: ${finding.reason}`),
    '',
    '## Testing Checklist',
    ...report.testingChecklist.map((item) => `- [ ] ${item}`),
    '',
    '## Next Actions',
    ...report.recommendedNextActions.map((item) => `- ${item}`),
    '',
    '## Safety Notes',
    '- This analyzer is read-only.',
    '- Secret files and real environment values are not included.',
    '- No GitHub writes, pushes, pull requests, or code changes were performed.',
  ].join('\n');
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export function CodebaseAnalyzer({
  projectId,
  projectName,
  githubLinked,
  githubLabel,
  savedAnalysis,
}: CodebaseAnalyzerProps) {
  const [source, setSource] = useState<CodebaseAnalysisSource>(githubLinked ? 'github' : 'manual');
  const [analyzeState, analyzeAction, isAnalyzing] = useActionState(analyzeCodebaseAction, initialAnalyzeState);
  const [saveState, saveAction, isSaving] = useActionState(saveCodebaseAnalysisAction, initialSaveState);
  const report = analyzeState.report;
  const reportText = useMemo(() => (report ? reportMarkdown(report) : savedAnalysis.report_markdown ?? ''), [report, savedAnalysis.report_markdown]);
  const nextActionsText = useMemo(() => {
    const actions = report?.recommendedNextActions ?? savedAnalysis.next_actions;
    return actions.map((item) => `- ${item}`).join('\n');
  }, [report, savedAnalysis.next_actions]);
  const testingChecklistText = useMemo(() => {
    const checklist = report?.testingChecklist ?? [];
    return checklist.map((item) => `- [ ] ${item}`).join('\n');
  }, [report]);

  useActionToast({
    isPending: isAnalyzing,
    state: analyzeState,
    loadingMessage: 'Analyzing codebase...',
    successMessage: (currentState) => currentState.message ?? 'Codebase analyzed.',
    errorMessage: (currentState) => currentState.error ?? 'Could not analyze codebase.',
  });

  useActionToast({
    isPending: isSaving,
    state: saveState,
    loadingMessage: 'Saving analysis...',
    successMessage: (currentState) => currentState.message ?? 'Analysis saved.',
    errorMessage: (currentState) => currentState.error ?? 'Could not save analysis.',
  });

  return (
    <Card id="codebase-analyzer">
      <CardHeader
        title="Codebase Analyzer"
        description="Read-only project structure, route, dependency, security, testing, and deployment review."
        action={
          savedAnalysis.generated_at ? (
            <span className="rounded-lg border border-[#F7CBCA]/10 bg-[#F1F7F7] px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-black/48">
              Last saved {formatDateTime(savedAnalysis.generated_at)}
            </span>
          ) : null
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form action={analyzeAction} className="space-y-5 rounded-lg border border-black/7 bg-[#F1F7F7]/70 p-4">
          <input type="hidden" name="projectId" value={projectId} />
          <div>
            <Label htmlFor="source">Analysis source</Label>
            <Select
              id="source"
              name="source"
              value={source}
              onChange={(event) => setSource(event.target.value as CodebaseAnalysisSource)}
              disabled={isAnalyzing}
            >
              <option value="github">Linked GitHub repository</option>
              <option value="zip">Upload ZIP file</option>
              <option value="manual">Manual project summary</option>
            </Select>
          </div>

          {source === 'github' ? (
            <Notice tone={githubLinked ? 'info' : 'warning'} title={githubLinked ? 'GitHub source ready' : 'No linked repository'}>
              {githubLinked
                ? `Analyzer will read safe files from ${githubLabel} using the server-side GitHub integration.`
                : 'Add GitHub owner/repo metadata in the project form before using GitHub analysis.'}
            </Notice>
          ) : null}

          {source === 'zip' ? (
            <div className="space-y-3">
              <Notice tone="info" title="ZIP safety rules">
                Upload a .zip under 50MB. Files are analyzed in memory, never executed, and secret/build folders are skipped.
              </Notice>
              <input
                type="file"
                name="zipFile"
                accept=".zip,application/zip,application/x-zip-compressed"
                disabled={isAnalyzing}
                className="block w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-black/70 file:me-3 file:rounded-md file:border-0 file:bg-[#D5E5E5] file:px-3 file:py-2 file:text-sm file:font-bold file:text-[#F7CBCA]"
              />
            </div>
          ) : null}

          {source === 'manual' ? (
            <div>
              <Label htmlFor="manualSummary">Manual summary, file tree, package.json, or project notes</Label>
              <Textarea
                id="manualSummary"
                name="manualSummary"
                rows={10}
                disabled={isAnalyzing}
                placeholder={`Example:\npackage.json\nsrc/app/dashboard/page.tsx\nsrc/app/api/health/route.ts\nsupabase/migrations/001_init.sql\n\nOr paste package.json / architecture notes.`}
              />
            </div>
          ) : null}

          {analyzeState.error ? (
            <Notice tone="danger" title="Analysis failed">
              {analyzeState.error}
            </Notice>
          ) : null}

          <Button type="submit" disabled={isAnalyzing || (source === 'github' && !githubLinked)}>
            {source === 'github' ? <GitBranch className="h-4 w-4" /> : source === 'zip' ? <FileArchive className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
            {isAnalyzing ? 'Analyzing...' : 'Analyze Codebase'}
          </Button>
        </form>

        <div className="space-y-4">
          {report ? (
            <AnalysisReportView projectId={projectId} projectName={projectName} report={report} reportText={reportText} nextActionsText={nextActionsText} testingChecklistText={testingChecklistText} saveAction={saveAction} isSaving={isSaving} />
          ) : savedAnalysis.summary ? (
            <SavedAnalysisView savedAnalysis={savedAnalysis} reportText={reportText} nextActionsText={nextActionsText} />
          ) : (
            <div className="rounded-lg border border-dashed border-black/12 bg-white/80 p-6 text-sm leading-6 text-black/58">
              <Sparkles className="mb-3 h-5 w-5 text-[#F7CBCA]" />
              Choose GitHub, ZIP, or Manual, then run a read-only analysis. Results stay local to this project until you save them.
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function AnalysisReportView({
  projectId,
  projectName,
  report,
  reportText,
  nextActionsText,
  testingChecklistText,
  saveAction,
  isSaving,
}: {
  projectId: string;
  projectName: string;
  report: CodebaseAnalysisReport;
  reportText: string;
  nextActionsText: string;
  testingChecklistText: string;
  saveAction: (payload: FormData) => void;
  isSaving: boolean;
}) {
  return (
    <div className="space-y-4">
      <Notice tone={report.aiStatus === 'available' ? 'success' : 'warning'} title="AI analysis status">
        {report.aiMessage}
      </Notice>

      <SummaryCards report={report} />

      <ActionBar reportText={reportText} nextActionsText={nextActionsText} testingChecklistText={testingChecklistText} releaseNotesDraft={report.releaseNotesDraft} />

      <form action={saveAction} className="flex flex-wrap gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="reportJson" value={JSON.stringify(report)} />
        <Button type="submit" disabled={isSaving} variant="secondary">
          <Save className="h-4 w-4" />
          Save to Project
        </Button>
        <Button type="submit" name="saveToNotes" value="true" disabled={isSaving} variant="outline">
          <Save className="h-4 w-4" />
          Save to Project Notes
        </Button>
      </form>

      <ReportSections projectId={projectId} projectName={projectName} report={report} />
    </div>
  );
}

function SavedAnalysisView({
  savedAnalysis,
  reportText,
  nextActionsText,
}: {
  savedAnalysis: CodebaseAnalyzerProps['savedAnalysis'];
  reportText: string;
  nextActionsText: string;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-black/7 bg-white/86 p-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.1em] text-black/42">Saved analysis</p>
        <p className="mt-2 text-sm leading-6 text-black/66">{savedAnalysis.summary}</p>
        <p className="mt-2 text-xs font-bold text-black/42">{savedAnalysis.source_label ?? 'Saved report'}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonStyles({ variant: 'outline', size: 'sm' })} onClick={() => copyText(reportText)}>
          <Clipboard className="h-4 w-4" />
          Copy Analysis Report
        </button>
        <button type="button" className={buttonStyles({ variant: 'outline', size: 'sm' })} onClick={() => copyText(nextActionsText)}>
          <ListChecks className="h-4 w-4" />
          Copy Next Actions
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {savedAnalysis.tech_stack.map((item) => (
          <span key={item} className="rounded-lg bg-[#D5E5E5]/60 px-3 py-2 text-xs font-bold text-[#F7CBCA]">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function SummaryCards({ report }: { report: CodebaseAnalysisReport }) {
  const cards = [
    { label: 'Routes', value: report.routes.length },
    { label: 'API routes', value: report.apiRoutes.length },
    { label: 'Risks', value: report.potentialRisks.length },
    { label: 'Env names', value: report.environmentVariables.length },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-black/7 bg-white/86 p-4">
          <p className="text-2xl font-black text-[#5D6B6B]">{card.value}</p>
          <p className="text-xs font-black uppercase tracking-[0.1em] text-black/42">{card.label}</p>
        </div>
      ))}
    </div>
  );
}

function ActionBar({
  reportText,
  nextActionsText,
  testingChecklistText,
  releaseNotesDraft,
}: {
  reportText: string;
  nextActionsText: string;
  testingChecklistText: string;
  releaseNotesDraft: string;
}) {
  const actions = [
    { label: 'Copy Analysis Report', icon: Clipboard, text: reportText },
    { label: 'Copy Next Actions', icon: ListChecks, text: nextActionsText },
    { label: 'Copy Testing Checklist', icon: ShieldCheck, text: testingChecklistText },
    { label: 'Copy Release Notes Draft', icon: FileText, text: releaseNotesDraft },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const Icon = action.icon;

        return (
          <button key={action.label} type="button" className={buttonStyles({ variant: 'outline', size: 'sm' })} onClick={() => copyText(action.text)}>
            <Icon className="h-4 w-4" />
            {action.label}
          </button>
        );
      })}
    </div>
  );
}

function ReportSections({ projectId, projectName, report }: { projectId: string; projectName: string; report: CodebaseAnalysisReport }) {
  return (
    <div className="space-y-4">
      <ReportList title="Tech Stack" items={report.techStack} />
      <ReportList title="Folder Structure" items={report.folderStructure} />
      <RoutesTable routes={report.routes} />
      <ApiRoutesTable routes={report.apiRoutes} />
      <ReportList title="Database / Migrations" items={report.database} />
      <ReportList title="Environment Variables from .env.example" items={report.environmentVariables.length ? report.environmentVariables : ['No .env.example variables detected.']} />
      <ReportList title="Deployment Setup" items={report.deployment} />
      <ReportList title="Important Components and Dependencies" items={report.importantComponents} />
      <FindingsTable projectId={projectId} projectName={projectName} findings={report.potentialRisks} />
      <ReportList title="Missing Documentation" items={report.missingDocumentation} />
      <ReportList title="Testing Checklist" items={report.testingChecklist} />
      <ReportList title="Recommended Next Actions" items={report.recommendedNextActions} />
      {report.skippedFiles.length ? <ReportList title="Skipped Files" items={report.skippedFiles} /> : null}
    </div>
  );
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-lg border border-black/7 bg-white/86 p-4">
      <h3 className="font-black text-[#5D6B6B]">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-black/64">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F7CBCA]" />
            <span className="break-words">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RoutesTable({ routes }: { routes: CodebaseAnalysisReport['routes'] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-black/7 bg-white/86">
      <h3 className="border-b border-black/6 p-4 font-black text-[#5D6B6B]">Main Pages / Routes</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#F1F7F7] text-xs font-black uppercase tracking-[0.08em] text-black/42">
            <tr>
              <th className="px-4 py-3">Route</th>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Purpose guess</th>
              <th className="px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/6">
            {(routes.length ? routes : [{ route: 'Not detected', file: 'Needs review', purpose: 'Needs review', notes: 'Paste a richer file tree or analyze GitHub/ZIP.' }]).map((route) => (
              <tr key={`${route.route}-${route.file}`}>
                <td className="px-4 py-3 font-bold text-[#F7CBCA]">{route.route}</td>
                <td className="px-4 py-3 text-black/62">{route.file}</td>
                <td className="px-4 py-3 text-black/62">{route.purpose}</td>
                <td className="px-4 py-3 text-black/62">{route.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ApiRoutesTable({ routes }: { routes: CodebaseAnalysisReport['apiRoutes'] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-black/7 bg-white/86">
      <h3 className="border-b border-black/6 p-4 font-black text-[#5D6B6B]">API Routes</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#F1F7F7] text-xs font-black uppercase tracking-[0.08em] text-black/42">
            <tr>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Path</th>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Security notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/6">
            {(routes.length ? routes : [{ method: 'None', route: 'Not detected', file: 'Needs review', purpose: 'Needs review', notes: 'Needs review', securityNotes: 'Needs review.' }]).map((route) => (
              <tr key={`${route.route}-${route.file}`}>
                <td className="px-4 py-3 font-bold text-[#F7CBCA]">{route.method}</td>
                <td className="px-4 py-3 text-black/62">{route.route}</td>
                <td className="px-4 py-3 text-black/62">{route.file}</td>
                <td className="px-4 py-3 text-black/62">{route.securityNotes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FindingsTable({ projectId, projectName, findings }: { projectId: string; projectName: string; findings: CodebaseAnalysisReport['potentialRisks'] }) {
  const rows = findings.length
    ? findings
    : [
        {
          priority: 'low' as const,
          title: 'No major deterministic findings',
          reason: 'The analyzer did not detect obvious blockers in the available file metadata.',
          area: 'Review',
          nextAction: 'Run lint, typecheck, build, and manual smoke tests before release.',
        },
      ];

  return (
    <section className="overflow-hidden rounded-lg border border-black/7 bg-white/86">
      <h3 className="border-b border-black/6 p-4 font-black text-[#5D6B6B]">Potential Risks and Findings</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#F1F7F7] text-xs font-black uppercase tracking-[0.08em] text-black/42">
            <tr>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Finding</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/6">
            {rows.map((finding) => (
              <tr key={`${finding.priority}-${finding.title}`}>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'rounded-md px-2 py-1 text-xs font-black uppercase',
                      finding.priority === 'critical' || finding.priority === 'high'
                        ? 'bg-[#F7CBCA]/12 text-[#F7CBCA]'
                        : 'bg-[#D5E5E5]/70 text-black/62'
                    )}
                  >
                    {finding.priority}
                  </span>
                </td>
                <td className="px-4 py-3 font-bold text-black/78">{finding.title}</td>
                <td className="px-4 py-3 text-black/62">{finding.reason}</td>
                <td className="px-4 py-3">
                  <div className="flex min-w-[220px] flex-col gap-2">
                    <span className="text-black/62">{finding.nextAction}</span>
                    <Link
                      href={`/dashboard/create-task?project=${encodeURIComponent(projectName)}&agent=${agentForFinding(finding.area)}&title=${encodeURIComponent(`Codebase finding: ${finding.title}`)}&description=${encodeURIComponent(`Project: ${projectName}\nArea: ${finding.area}\nPriority: ${finding.priority}\n\nFinding:\n${finding.reason}\n\nSuggested action:\n${finding.nextAction}\n\nCreate a safe plan. Do not modify code automatically, push commits, create pull requests, deploy, or expose secrets.`)}`}
                      className={buttonStyles({ variant: 'ghost', size: 'sm', className: 'self-start' })}
                    >
                      Create Task from Finding
                    </Link>
                    <Link
                      href={`/dashboard/safe-patch-planner?project=${projectId}&finding=${encodeURIComponent(`Codebase finding: ${finding.title}\nArea: ${finding.area}\nPriority: ${finding.priority}\nReason: ${finding.reason}\nSuggested action: ${finding.nextAction}`)}`}
                      className={buttonStyles({ variant: 'outline', size: 'sm', className: 'self-start' })}
                    >
                      Plan Safe Patch
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function agentForFinding(area: string) {
  const normalized = area.toLowerCase();

  if (normalized.includes('security') || normalized.includes('auth')) return 'security-review-agent';
  if (normalized.includes('database')) return 'database-agent';
  if (normalized.includes('testing')) return 'testing-agent';
  if (normalized.includes('documentation')) return 'documentation-agent';
  if (normalized.includes('deployment')) return 'deployment-agent';
  if (normalized.includes('architecture')) return 'architecture-agent';
  return 'code-review-agent';
}
