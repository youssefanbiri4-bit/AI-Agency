import Link from 'next/link';
import { ArrowUpRight, BriefcaseBusiness, Database, Users } from 'lucide-react';
import type { Department } from '@/types';
import { buttonStyles } from './Button';
import { getDepartmentBrandColor } from '@/lib/brand';

interface DepartmentCardProps {
  department: Department;
  agentsCount: number;
  taskRecords?: number;
}

export function DepartmentCard({
  department,
  agentsCount,
  taskRecords = 0,
}: DepartmentCardProps) {
  const brandColor = getDepartmentBrandColor(department.name);

  return (
    <article className="group card-lift flex h-full min-w-0 flex-col rounded-lg border border-black/8 bg-white p-5 shadow-[0_18px_48px_rgba(0,0,0,0.06)] hover:border-[#8B3CDE]/24 hover:shadow-[0_22px_54px_rgba(139,60,222,0.12)]">
      <div className="flex items-start justify-between gap-4">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-lg border border-white shadow-sm"
          style={{ backgroundColor: `${brandColor}18`, color: brandColor }}
        >
          <BriefcaseBusiness className="h-5 w-5" />
        </div>
        <span className="shrink-0 rounded-full border border-black/8 bg-[#F0DBEF]/45 px-2.5 py-1 text-xs font-bold text-black/64">
          {agentsCount} agents
        </span>
      </div>

      <h3 className="mt-5 text-lg font-bold text-black">{department.name}</h3>
      <p className="mt-2 min-h-[48px] text-sm leading-6 text-black/62">{department.description}</p>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-black/8 bg-[#F0DBEF]/35 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-black/52">
            <Users className="h-3.5 w-3.5" />
            Agents
          </p>
          <p className="mt-1 text-xl font-black text-black">{agentsCount}</p>
        </div>
        <div className="rounded-lg border border-black/8 bg-[#F0DBEF]/35 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-black/52">
            <Database className="h-3.5 w-3.5" />
            Tasks
          </p>
          <p className="mt-1 text-xl font-black text-black">{taskRecords}</p>
        </div>
      </div>

      <Link
        href={`/dashboard/agents?department=${encodeURIComponent(department.name)}`}
        className={buttonStyles({
          variant: 'soft',
          size: 'md',
          className: 'mt-5 w-full',
        })}
      >
        <span>View Department</span>
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </article>
  );
}
