'use client';

import Link from 'next/link';
import { ArrowUpRight, Database, FileText, Play, Workflow } from 'lucide-react';
import type { Agent } from '@/types';
import { AgentAvatar } from './AgentAvatar';
import { StatusBadge } from './StatusBadge';
import { buttonStyles } from './Button';
import { cn } from '@/lib/utils';

interface AgentCardProps {
  agent: Agent;
  onClick?: () => void;
  compact?: boolean;
}

export function AgentCard({ agent, onClick, compact = false }: AgentCardProps) {
  return (
    <article
      className={cn(
        'group card-lift flex h-full min-w-0 flex-col rounded-lg border border-black/8 bg-white p-5 shadow-[0_18px_48px_rgba(0,0,0,0.06)]',
        'hover:border-[#8B3CDE]/24 hover:shadow-[0_22px_54px_rgba(139,60,222,0.12)]',
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <AgentAvatar icon={agent.icon} color={agent.color} department={agent.department} />
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-base font-bold leading-6 text-black transition-colors group-hover:text-[#8B3CDE]">
              {agent.name}
            </h3>
            <p className="mt-1 text-sm font-semibold text-black/52">{agent.department}</p>
          </div>
        </div>
        <StatusBadge status={agent.status} type="agent" size="sm" />
      </div>

      <p className={cn('mt-4 text-sm leading-6 text-black/62', compact ? 'line-clamp-2' : 'line-clamp-3')}>
        {agent.description}
      </p>

      <div className="mt-5 grid grid-cols-1 gap-2 min-[430px]:grid-cols-3">
        <div className="rounded-lg border border-black/8 bg-[#F0DBEF]/35 p-3">
          <p className="flex items-center gap-1 text-xs font-semibold text-black/52">
            <FileText className="h-3.5 w-3.5" />
            Tasks
          </p>
          <p className="mt-1 text-sm font-bold text-black">Details</p>
        </div>
        <div className="rounded-lg border border-black/8 bg-[#F0DBEF]/35 p-3">
          <p className="flex items-center gap-1 text-xs font-semibold text-black/52">
            <Database className="h-3.5 w-3.5" />
            Storage
          </p>
          <p className="mt-1 text-sm font-bold text-black">Ready</p>
        </div>
        <div className="rounded-lg border border-black/8 bg-[#F0DBEF]/35 p-3">
          <p className="flex items-center gap-1 text-xs font-semibold text-black/52">
            <Workflow className="h-3.5 w-3.5" />
            Workflow
          </p>
          <p className="mt-1 text-sm font-bold leading-5 text-black">Guarded</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Link
          href={`/dashboard/agents/${agent.id}`}
          className={buttonStyles({
            variant: 'outline',
            size: 'md',
            className: 'flex-1',
          })}
        >
          <span>View Details</span>
          <ArrowUpRight className="h-4 w-4" />
        </Link>
        <Link
          href={`/dashboard/create-task?agent=${agent.id}`}
          className={buttonStyles({
            variant: 'primary',
            size: 'md',
            className: 'flex-1',
          })}
        >
          <Play className="h-4 w-4" />
          <span>Create Task</span>
        </Link>
      </div>
    </article>
  );
}
