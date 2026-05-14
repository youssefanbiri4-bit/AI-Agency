import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, ClipboardCheck, FileText, Star } from 'lucide-react';
import type { JsonObject, JsonValue } from '@/types';
import { CopyReportButton } from './CopyReportButton';
import { ExportReportButton } from './ExportReportButton';
import {
  extractStructuredOutput,
  hasRenderableJsonValue,
  isInternalTaskResultKey,
  parseStringifiedJsonValue,
  type StructuredOutputAction,
  type StructuredOutputPriority,
  type StructuredTaskOutput,
} from '@/lib/task-results';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';

interface ResultEmptyState {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface TaskResultOutputProps {
  title: string;
  description: string;
  result: JsonObject | null;
  emptyState: ResultEmptyState;
  errorMessage?: string | null;
  reportContext?: TaskReportContext;
}

interface DetailSection {
  key: keyof Pick<StructuredTaskOutput, 'analysis' | 'contentPlan' | 'outreachPlan'>;
  title: string;
  description: string;
  data: JsonValue;
}

interface TaskReportContext {
  taskTitle?: string | null;
  agentName?: string | null;
  department?: string | null;
}

const priorityStyles: Record<StructuredOutputPriority, string> = {
  high: 'border-[#F7CBCA]/22 bg-[#F7CBCA]/10 text-[#A90F31]',
  medium: 'border-[#F7CBCA]/18 bg-[#D5E5E5]/70 text-[#6D2FB1]',
  low: 'border-black/10 bg-white text-black/62',
};

function formatLabel(key: string) {
  const label = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!label) {
    return 'Field';
  }

  return label
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanReportText(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function getPrintableReportMetadata(output: StructuredTaskOutput, context?: TaskReportContext) {
  const metadataDepartment = cleanReportText(output.metadata?.departmentKey);

  return {
    taskTitle: cleanReportText(context?.taskTitle) ?? 'Untitled task',
    agentName: cleanReportText(context?.agentName) ?? cleanReportText(output.metadata?.agentName),
    department:
      cleanReportText(context?.department) ??
      (metadataDepartment ? formatLabel(metadataDepartment) : null),
  };
}

function normalizeReportValue(value: JsonValue | undefined): JsonValue | undefined {
  return parseStringifiedJsonValue(value);
}

function getRenderableEntries(value: JsonObject) {
  return Object.entries(value).filter(
    ([key, entryValue]) => !isInternalTaskResultKey(key) && hasRenderableReportValue(entryValue)
  );
}

function hasRenderableReportValue(value: JsonValue | null | undefined): value is JsonValue {
  const normalized = normalizeReportValue(typeof value === 'undefined' ? undefined : value);

  if (typeof normalized === 'undefined' || normalized === null || !hasRenderableJsonValue(normalized)) {
    return false;
  }

  if (Array.isArray(normalized)) {
    return normalized.some(hasRenderableReportValue);
  }

  if (isJsonObject(normalized)) {
    return getRenderableEntries(normalized).length > 0;
  }

  return true;
}

function getDetailSections(output: StructuredTaskOutput): DetailSection[] {
  const sections: Array<Omit<DetailSection, 'data'> & { data: JsonValue | null }> = [
    {
      key: 'analysis',
      title: 'Analysis',
      description: 'Key findings and strategic interpretation from the agent output.',
      data: output.analysis,
    },
    {
      key: 'contentPlan',
      title: 'Content Plan',
      description: 'Structured content direction, topics, formats, and publishing guidance.',
      data: output.contentPlan,
    },
    {
      key: 'outreachPlan',
      title: 'Outreach Plan',
      description: 'Recommended audience, messaging, sequencing, and follow-up direction.',
      data: output.outreachPlan,
    },
  ];

  return sections.flatMap((section): DetailSection[] => {
    if (!hasRenderableReportValue(section.data)) {
      return [];
    }

    return [{ ...section, data: normalizeReportValue(section.data) ?? section.data }];
  });
}

function isScalarJsonValue(value: JsonValue | undefined): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function indentMarkdown(markdown: string) {
  return markdown
    .split('\n')
    .map((line) => (line ? `  ${line}` : line))
    .join('\n');
}

function renderMarkdownValue(value: JsonValue | undefined): string {
  const normalized = normalizeReportValue(value);

  if (typeof normalized === 'undefined' || normalized === null || !hasRenderableReportValue(normalized)) {
    return 'Not provided.';
  }

  if (isScalarJsonValue(normalized)) {
    return String(normalized);
  }

  if (Array.isArray(normalized)) {
    const items = normalized.filter(hasRenderableReportValue);

    if (items.length === 0) {
      return 'Not provided.';
    }

    return items
      .map((item) => {
        const rendered = renderMarkdownValue(item);

        if (isScalarJsonValue(item)) {
          return `- ${rendered}`;
        }

        return `- ${indentMarkdown(rendered).trimStart()}`;
      })
      .join('\n');
  }

  const entries = getRenderableEntries(normalized);

  if (entries.length === 0) {
    return 'Not provided.';
  }

  return entries
    .map(([key, entryValue]) => {
      const label = formatLabel(key);
      const rendered = renderMarkdownValue(entryValue);

      if (isScalarJsonValue(entryValue)) {
        return `- **${label}:** ${rendered}`;
      }

      return `- **${label}:**\n${indentMarkdown(rendered)}`;
    })
    .join('\n');
}

function renderMarkdownList(items: string[], emptyText: string) {
  const cleanItems = items
    .map((item) => renderMarkdownValue(item))
    .filter((item) => item !== 'Not provided.');

  if (cleanItems.length === 0) {
    return emptyText;
  }

  return cleanItems.map((item) => `- ${item}`).join('\n');
}

function renderNextActionsMarkdown(actions: StructuredOutputAction[]) {
  if (actions.length === 0) {
    return 'No next actions provided.';
  }

  return actions
    .map((action) => {
      const title = action.title || 'Untitled action';
      const description = action.description || 'No description provided.';

      return `- **${title}** (Priority: ${action.priority})\n  ${description}`;
    })
    .join('\n');
}

function renderDetailSectionMarkdown(section: DetailSection) {
  const data = normalizeReportValue(section.data);

  if (typeof data === 'undefined' || data === null || !hasRenderableReportValue(data)) {
    return '';
  }

  if (!isJsonObject(data)) {
    return `### ${section.title}\n${renderMarkdownValue(data)}`;
  }

  const entries = getRenderableEntries(data);

  if (entries.length === 0) {
    return '';
  }

  const fields = entries.map(([key, value]) => {
    return `#### ${formatLabel(key)}\n${renderMarkdownValue(value)}`;
  });

  return [`### ${section.title}`, ...fields].join('\n\n');
}

function buildReportMarkdown(output: StructuredTaskOutput) {
  const detailSections = getDetailSections(output);
  const mainReport =
    detailSections.length > 0
      ? detailSections.map(renderDetailSectionMarkdown).filter(Boolean).join('\n\n')
      : 'No analysis, content plan, or outreach plan fields were provided.';

  return [
    '# Client-ready Report',
    '## Executive Summary',
    output.summary || 'No executive summary provided.',
    '## Main Report Section',
    mainReport,
    '## Recommendations',
    renderMarkdownList(output.recommendations, 'No recommendations provided.'),
    '## Next Actions',
    renderNextActionsMarkdown(output.nextActions),
    '## Quality Notes',
    renderMarkdownList(output.qualityNotes, 'No quality notes provided.'),
    'Generated by AgentFlow AI',
  ]
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function RawJsonBlock({ result }: { result: JsonObject }) {
  return (
    <pre className="max-h-96 overflow-auto rounded-lg border border-black/12 bg-black p-4 text-sm leading-6 text-white">
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}

function MetadataPills({ output }: { output: StructuredTaskOutput }) {
  const metadata = output.metadata;

  if (!metadata) {
    return null;
  }

  const items = [
    metadata.agentName ? { label: 'Agent', value: metadata.agentName } : null,
    metadata.departmentKey ? { label: 'Department', value: formatLabel(metadata.departmentKey) } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge key={item.label} tone="neutral">
          {item.label}: {item.value}
        </Badge>
      ))}
    </div>
  );
}

function JsonValueRenderer({ value }: { value: JsonValue }) {
  const normalized = normalizeReportValue(value);

  if (typeof normalized === 'undefined' || normalized === null || !hasRenderableReportValue(normalized)) {
    return <p className="text-sm leading-6 text-black/42">Not provided</p>;
  }

  if (typeof normalized === 'string' || typeof normalized === 'number' || typeof normalized === 'boolean') {
    return <p className="break-words text-sm leading-6 text-black/68">{String(normalized)}</p>;
  }

  if (Array.isArray(normalized)) {
    const items = normalized.filter(hasRenderableReportValue);

    return (
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex min-w-0 gap-2">
            <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F7CBCA]" />
            <div className="min-w-0 flex-1">
              <JsonValueRenderer value={item} />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  const entries = getRenderableEntries(normalized);

  return (
    <div className="space-y-2">
      {entries.map(([key, entryValue]) => (
        <div key={key} className="rounded-md border border-black/8 bg-white p-3">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-black/38">
            {formatLabel(key)}
          </p>
          <JsonValueRenderer value={entryValue} />
        </div>
      ))}
    </div>
  );
}

function ReportFallback({ text }: { text: string }) {
  return (
    <p className="rounded-md border border-dashed border-black/12 bg-white px-4 py-3 text-sm leading-6 text-black/48">
      {text}
    </p>
  );
}

function ClientReportDetailSection({ section }: { section: DetailSection }) {
  const data = normalizeReportValue(section.data);

  if (typeof data === 'undefined' || data === null || !hasRenderableReportValue(data)) {
    return null;
  }

  const entries = isJsonObject(data) ? getRenderableEntries(data) : [];

  return (
    <div className="overflow-hidden rounded-lg border border-black/8 bg-white">
      <div className="border-b border-black/8 bg-[#D5E5E5]/24 px-4 py-3">
        <h4 className="text-sm font-bold text-black">{section.title}</h4>
        <p className="mt-1 text-xs leading-5 text-black/52">{section.description}</p>
      </div>
      {isJsonObject(data) ? (
        <div className="divide-y divide-black/8">
          {entries.map(([key, value]) => (
            <div key={key} className="px-4 py-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-black/38">
                {formatLabel(key)}
              </p>
              <JsonValueRenderer value={value} />
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-4">
          <JsonValueRenderer value={data} />
        </div>
      )}
    </div>
  );
}

function ClientReportList({
  items,
  emptyText,
}: {
  items: string[];
  emptyText: string;
}) {
  const cleanItems = items
    .map((item) => renderMarkdownValue(item))
    .filter((item) => item !== 'Not provided.');

  if (cleanItems.length === 0) {
    return <ReportFallback text={emptyText} />;
  }

  return (
    <ul className="space-y-2">
      {cleanItems.map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-3 rounded-md border border-black/8 bg-white px-4 py-3">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F7CBCA]" />
          <p className="min-w-0 text-sm leading-6 text-black/68">{item}</p>
        </li>
      ))}
    </ul>
  );
}

function ClientReportNextActions({ actions }: { actions: StructuredOutputAction[] }) {
  if (actions.length === 0) {
    return <ReportFallback text="No next actions provided." />;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {actions.map((action, index) => (
        <div key={`${action.title}-${index}`} className="rounded-md border border-black/8 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h4 className="min-w-0 break-words text-sm font-bold text-black">
              {action.title || 'Untitled action'}
            </h4>
            <ActionPriorityBadge priority={action.priority} />
          </div>
          <p className="mt-3 text-sm leading-6 text-black/62">
            {action.description || 'No action description provided.'}
          </p>
        </div>
      ))}
    </div>
  );
}

function PrintableReportHeader({
  output,
  context,
}: {
  output: StructuredTaskOutput;
  context?: TaskReportContext;
}) {
  const metadata = getPrintableReportMetadata(output, context);
  const items = [
    { label: 'Task', value: metadata.taskTitle },
    metadata.agentName ? { label: 'Agent', value: metadata.agentName } : null,
    metadata.department ? { label: 'Department', value: metadata.department } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  return (
    <header className="client-ready-report-print-header">
      <p className="client-ready-report-print-brand">AgentFlow AI</p>
      <h1>Client-ready Report</h1>
      <dl>
        {items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}

function ClientReadyReport({
  output,
  reportContext,
}: {
  output: StructuredTaskOutput;
  reportContext?: TaskReportContext;
}) {
  const detailSections = getDetailSections(output);
  const markdown = buildReportMarkdown(output);

  return (
    <Card>
      <CardHeader
        title="Client-ready Report"
        description="A polished report assembled from the existing structured agent output."
        action={
          <>
            <CopyReportButton markdown={markdown} />
            <ExportReportButton />
          </>
        }
      />

      <article id="client-ready-report-print" className="overflow-hidden rounded-lg border border-black/10 bg-white">
        <PrintableReportHeader output={output} context={reportContext} />

        <section className="border-b border-black/8 bg-[#D5E5E5]/18 p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/42">Executive Summary</p>
          {output.summary ? (
            <p className="mt-3 text-sm leading-7 text-black/72 sm:text-base">{output.summary}</p>
          ) : (
            <div className="mt-3">
              <ReportFallback text="No executive summary provided." />
            </div>
          )}
        </section>

        <section className="border-b border-black/8 p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/42">Main Report Section</p>
          {detailSections.length > 0 ? (
            <div className="mt-4 space-y-4">
              {detailSections.map((section) => (
                <ClientReportDetailSection key={section.key} section={section} />
              ))}
            </div>
          ) : (
            <div className="mt-3">
              <ReportFallback text="No analysis, content plan, or outreach plan fields were provided." />
            </div>
          )}
        </section>

        <section className="border-b border-black/8 bg-[#FAFAFA] p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/42">Recommendations</p>
          <div className="mt-3">
            <ClientReportList
              items={output.recommendations}
              emptyText="No recommendations provided."
            />
          </div>
        </section>

        <section className="border-b border-black/8 p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/42">Next Actions</p>
          <div className="mt-3">
            <ClientReportNextActions actions={output.nextActions} />
          </div>
        </section>

        <section className="border-b border-black/8 bg-[#FAFAFA] p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/42">Quality Notes</p>
          <div className="mt-3">
            <ClientReportList
              items={output.qualityNotes}
              emptyText="No quality notes provided."
            />
          </div>
        </section>

        <footer className="bg-black px-4 py-3 text-sm font-semibold text-white sm:px-5">
          Generated by AgentFlow AI
        </footer>
      </article>
    </Card>
  );
}

function SummaryCard({ output }: { output: StructuredTaskOutput }) {
  return (
    <Card>
      <CardHeader
        title="Summary"
        description="Executive-ready overview returned by the agent."
        action={<CheckCircle2 className="h-5 w-5 text-[#F7CBCA]" />}
      />
      {output.summary ? (
        <>
          <p className="text-sm leading-7 text-black/70">{output.summary}</p>
          <MetadataPills output={output} />
        </>
      ) : (
        <EmptyState
          icon={FileText}
          title="No summary provided"
          description="The callback included structured output, but the summary field was empty."
        />
      )}
    </Card>
  );
}

function DetailSectionCard({ section }: { section: DetailSection }) {
  const data = normalizeReportValue(section.data);

  if (typeof data === 'undefined' || data === null || !hasRenderableReportValue(data)) {
    return null;
  }

  const entries = isJsonObject(data) ? getRenderableEntries(data) : [];

  return (
    <Card>
      <CardHeader title={section.title} description={section.description} />
      {isJsonObject(data) ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {entries.map(([key, value]) => (
            <div key={key} className="muted-panel min-w-0 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-black/38">
                {formatLabel(key)}
              </p>
              <JsonValueRenderer value={value} />
            </div>
          ))}
        </div>
      ) : (
        <div className="muted-panel min-w-0 p-4">
          <JsonValueRenderer value={data} />
        </div>
      )}
    </Card>
  );
}

function RecommendationsCard({ recommendations }: { recommendations: string[] }) {
  const cleanRecommendations = recommendations
    .map((recommendation) => renderMarkdownValue(recommendation))
    .filter((recommendation) => recommendation !== 'Not provided.');

  return (
    <Card>
      <CardHeader title="Recommendations" description="Specific guidance to consider before approval." />
      {cleanRecommendations.length > 0 ? (
        <ol className="space-y-3">
          {cleanRecommendations.map((recommendation, index) => (
            <li key={`${recommendation}-${index}`} className="flex gap-3 rounded-lg border border-black/8 bg-white p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black text-xs font-bold text-white">
                {index + 1}
              </span>
              <p className="min-w-0 text-sm leading-6 text-black/70">{recommendation}</p>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          icon={Star}
          title="No recommendations"
          description="The structured callback did not include recommendation items."
        />
      )}
    </Card>
  );
}

function ActionPriorityBadge({ priority }: { priority: StructuredOutputPriority }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize',
        priorityStyles[priority]
      )}
    >
      {priority}
    </span>
  );
}

function NextActionsCard({ actions }: { actions: StructuredOutputAction[] }) {
  return (
    <Card>
      <CardHeader title="Next Actions" description="Follow-up work surfaced by the agent." />
      {actions.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {actions.map((action, index) => (
            <div key={`${action.title}-${index}`} className="muted-panel min-w-0 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="min-w-0 break-words text-sm font-bold text-black">{action.title}</h3>
                <ActionPriorityBadge priority={action.priority} />
              </div>
              {action.description ? (
                <p className="mt-3 text-sm leading-6 text-black/62">{action.description}</p>
              ) : (
                <p className="mt-3 text-sm leading-6 text-black/42">No action description provided.</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ClipboardCheck}
          title="No next actions"
          description="The structured callback did not include follow-up actions."
        />
      )}
    </Card>
  );
}

function QualityNotesCard({ notes }: { notes: string[] }) {
  const cleanNotes = notes
    .map((note) => renderMarkdownValue(note))
    .filter((note) => note !== 'Not provided.');

  return (
    <Card>
      <CardHeader title="Quality Notes" description="Review notes and caveats to keep with this result." />
      {cleanNotes.length > 0 ? (
        <ul className="space-y-3">
          {cleanNotes.map((note, index) => (
            <li key={`${note}-${index}`} className="flex gap-3 rounded-lg border border-black/8 bg-white p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#F7CBCA]" />
              <p className="min-w-0 text-sm leading-6 text-black/70">{note}</p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={CheckCircle2}
          title="No quality notes"
          description="The structured callback did not include quality notes."
        />
      )}
    </Card>
  );
}

function StructuredDetails({ output }: { output: StructuredTaskOutput }) {
  const detailSections = getDetailSections(output);

  if (detailSections.length === 0) {
    return null;
  }

  return (
    <>
      {detailSections.map((section) => (
        <DetailSectionCard key={section.key} section={section} />
      ))}
    </>
  );
}

export function TaskResultOutput({
  title,
  description,
  result,
  emptyState,
  errorMessage,
  reportContext,
}: TaskResultOutputProps) {
  if (errorMessage) {
    return (
      <Card>
        <CardHeader title={title} description={description} />
        <Notice tone="danger" title="Task failed">
          {errorMessage}
        </Notice>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card>
        <CardHeader title={title} description={description} />
        <EmptyState
          icon={emptyState.icon}
          title={emptyState.title}
          description={emptyState.description}
        />
      </Card>
    );
  }

  const structuredOutput = extractStructuredOutput(result);

  if (!structuredOutput) {
    return (
      <Card>
        <CardHeader title={title} description={description} />
        <RawJsonBlock result={result} />
      </Card>
    );
  }

  return (
    <section className="space-y-5">
      <div className="min-w-0">
        <h2 className="break-words text-base font-bold text-black sm:text-lg">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-black/58">{description}</p>
      </div>
      <ClientReadyReport output={structuredOutput} reportContext={reportContext} />
      <SummaryCard output={structuredOutput} />
      <StructuredDetails output={structuredOutput} />
      <RecommendationsCard recommendations={structuredOutput.recommendations} />
      <NextActionsCard actions={structuredOutput.nextActions} />
      <QualityNotesCard notes={structuredOutput.qualityNotes} />
      <Card>
        <CardHeader
          title="Raw Output"
          description="Original callback result kept visible for auditing and compatibility."
        />
        <RawJsonBlock result={result} />
      </Card>
    </section>
  );
}
