import Link from 'next/link';
import { ArrowRight, BriefcaseBusiness, Database, FileText, Workflow } from 'lucide-react';
import type { Agent } from '@/types';
import { buttonStyles } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getAgentBrandColor } from '@/lib/brand';

interface MarketingAgentCardProps {
  agent: Agent;
}

export function MarketingAgentCard({ agent }: MarketingAgentCardProps) {
  const brandColor = getAgentBrandColor({ color: agent.color, department: agent.department });

  return (
    <article className="group card-lift flex h-full flex-col rounded-lg border border-black/8 bg-white p-5 shadow-[0_18px_48px_rgba(0,0,0,0.06)] hover:border-[#8B3CDE]/24 hover:shadow-[0_24px_64px_rgba(139,60,222,0.12)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white text-sm font-black shadow-sm"
            style={{ backgroundColor: `${brandColor}18`, color: brandColor }}
          >
            {agent.name
              .split(' ')
              .slice(0, 2)
              .map((word) => word.charAt(0))
              .join('')}
          </div>
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-base font-bold leading-6 text-black">{agent.name}</h3>
            <span className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-black/8 bg-[#F0DBEF]/45 px-2.5 py-1 text-xs font-bold text-black/62">
              <BriefcaseBusiness className="h-3.5 w-3.5" />
              <span className="truncate">{agent.department}</span>
            </span>
          </div>
        </div>
        <StatusBadge status={agent.status} type="agent" size="sm" />
      </div>

      <p className="mt-4 line-clamp-3 flex-1 text-sm leading-6 text-black/62">{agent.description}</p>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-black/8 bg-[#F0DBEF]/35 p-3">
          <p className="flex items-center gap-1 text-xs font-semibold text-black/52">
            <FileText className="h-3.5 w-3.5" />
            Tasks
          </p>
          <p className="mt-1 text-sm font-bold text-black">Ready for tasks</p>
        </div>
        <div className="rounded-lg border border-black/8 bg-[#F0DBEF]/35 p-3">
          <p className="flex items-center gap-1 text-xs font-semibold text-black/52">
            <Database className="h-3.5 w-3.5" />
            Storage
          </p>
          <p className="mt-1 text-sm font-bold text-black">Ready</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#F55477]/16 bg-[#F0DBEF]/45 px-3 py-2 text-xs font-bold leading-5 text-[#F55477]">
        <Workflow className="h-3.5 w-3.5" />
        <span>Workflow execution is guarded</span>
      </div>

      <Link
        href={`/dashboard/agents/${agent.id}`}
        className={buttonStyles({ variant: 'outline', size: 'md', className: 'mt-5 w-full' })}
      >
        View Agent
        <ArrowRight className="h-4 w-4" />
      </Link>
    </article>
  );
}
