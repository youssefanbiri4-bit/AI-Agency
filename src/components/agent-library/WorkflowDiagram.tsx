import { ArrowRight } from 'lucide-react';
import type { WorkflowDiagramModel } from '@/lib/agent-library/workflow-diagram';
import { cn } from '@/lib/utils';

interface WorkflowDiagramProps {
  diagram: WorkflowDiagramModel;
  compact?: boolean;
}

function nodeTone(status: string) {
  if (status === 'blocked') return 'border-rose-200 bg-rose-50';
  if (status === 'review_required') return 'border-amber-200 bg-amber-50';
  if (status === 'reference_only') return 'border-sky-200 bg-sky-50';
  return 'border-emerald-100 bg-white';
}

export function WorkflowDiagram({ diagram, compact = false }: WorkflowDiagramProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex min-w-max items-stretch gap-3">
        {diagram.nodes.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500">
            No workflow steps selected
          </div>
        ) : diagram.nodes.map((node, index) => (
          <div key={node.id} className="flex items-center gap-3">
            <article
              className={cn(
                'w-60 rounded-2xl border p-4 shadow-sm',
                compact && 'w-48 p-3',
                nodeTone(node.status)
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-black text-sky-700">
                  {index + 1}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-black text-slate-500">
                  {node.safety_level}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-black leading-5 text-slate-950">{node.label}</h3>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{node.category}</p>
              {!compact ? (
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">{node.description}</p>
              ) : null}
              <p className="mt-3 text-[11px] font-black uppercase tracking-[0.08em] text-emerald-700">
                {node.execution_mode}
              </p>
            </article>
            {index < diagram.nodes.length - 1 ? (
              <div className="flex h-full items-center text-slate-300">
                <ArrowRight className="h-5 w-5" />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
