import Link from 'next/link';
import { ArrowRight, CheckCircle2, Database } from 'lucide-react';
import type { Agent, Department } from '@/types';
import { buttonStyles } from '@/components/ui/Button';
import { getDepartmentBrandColor } from '@/lib/brand';

interface MarketingDepartmentCardProps {
  department: Department;
  agents: Agent[];
}

export function MarketingDepartmentCard({
  department,
  agents,
}: MarketingDepartmentCardProps) {
  const departmentAgents = agents.filter((agent) => agent.department === department.name);
  const exampleTasks = departmentAgents.flatMap((agent) => agent.exampleTasks).slice(0, 3);
  const brandColor = getDepartmentBrandColor(department.name);

  return (
    <article className="card-lift flex h-full flex-col rounded-lg border border-[#F7CBCA]/10 bg-white/70 p-6 shadow-[0_18px_42px_rgba(93,107,107,0.06)] backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)] hover:border-[#F7CBCA]/24 hover:shadow-[0_24px_64px_rgba(202,40,81,0.12)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="break-words text-xl font-bold text-black">{department.name}</h3>
          <p className="mt-2 text-sm leading-6 text-black/62">{department.description}</p>
        </div>
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-black"
          style={{ backgroundColor: `${brandColor}18`, color: brandColor }}
        >
          {departmentAgents.length}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-black/8 bg-[#D5E5E5]/35 p-3">
          <p className="text-xs font-semibold text-black/52">Agents</p>
          <p className="mt-1 text-2xl font-black text-black">{departmentAgents.length}</p>
        </div>
        <div className="rounded-lg border border-black/8 bg-[#D5E5E5]/35 p-3">
          <p className="flex items-center gap-1 text-xs font-semibold text-black/52">
            <Database className="h-3.5 w-3.5" />
            Task data
          </p>
          <p className="mt-1 text-sm font-bold text-black">Workspace scoped</p>
        </div>
      </div>

      <div className="mt-6 flex-1">
        <p className="text-sm font-bold text-black">Task starters</p>
        <div className="mt-3 space-y-3">
          {exampleTasks.map((task) => (
            <div key={task} className="flex gap-2 text-sm leading-6 text-black/62">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#F7CBCA]" />
              <span>{task}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-5 text-xs font-black uppercase leading-5 tracking-[0.14em] text-black/34">
        Task records appear from the active workspace
      </p>

      <Link
        href={`/dashboard/agents?department=${encodeURIComponent(department.name)}`}
        className={buttonStyles({ variant: 'soft', size: 'md', className: 'mt-5 w-full' })}
      >
        View Agents
        <ArrowRight className="h-4 w-4" />
      </Link>
    </article>
  );
}
