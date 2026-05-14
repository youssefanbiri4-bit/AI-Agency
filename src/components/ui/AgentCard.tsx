'use client';

import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, Lightbulb, Play, Sparkles } from 'lucide-react';
import type { Agent } from '@/types';
import { AgentAvatar } from './AgentAvatar';
import { StatusBadge } from './StatusBadge';
import { buttonStyles } from './Button';
import { cn } from '@/lib/utils';
import { getAgentDisplayMetadata } from '@/lib/agents/agent-display';

interface AgentCardProps {
  agent: Agent;
  onClick?: () => void;
  compact?: boolean;
}

export function AgentCard({ agent, onClick, compact = false }: AgentCardProps) {
  const display = getAgentDisplayMetadata(agent);
  const visibleUseCases = display.bestUseCases.slice(0, compact ? 2 : 3);
  const visibleHelpsWith = display.helpsWith.slice(0, 3);

  return (
    <article
      className={cn(
        'group card-lift flex h-full min-w-0 flex-col rounded-lg border border-[#F7CBCA]/10 bg-white/88 p-5 shadow-[0_18px_42px_rgba(93,107,107,0.06)] backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]',
        'hover:border-[#F7CBCA]/24 hover:shadow-[0_22px_54px_rgba(202,40,81,0.12)]',
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
            <h3 className="line-clamp-2 text-base font-bold leading-6 text-black transition-colors group-hover:text-[#F7CBCA]">
              {agent.name}
            </h3>
            <p className="mt-1 text-sm font-black text-[#F7CBCA]">{display.alias}</p>
          </div>
        </div>
        <StatusBadge status={agent.status} type="agent" size="sm" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-[#F7CBCA]/16 bg-[#D5E5E5]/50 px-2.5 py-1 text-xs font-black text-[#F7CBCA]">
          {agent.department}
        </span>
        <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs font-bold text-black/58">
          {agent.role}
        </span>
      </div>

      <p className={cn('mt-4 text-sm font-semibold leading-6 text-black/72', compact ? 'line-clamp-2' : 'line-clamp-3')}>
        {display.role}
      </p>

      {!compact && (
        <div className="mt-4 rounded-lg border border-black/8 bg-[#F1F7F7] p-4">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.1em] text-black/42">
            <Lightbulb className="h-3.5 w-3.5 text-[#F7CBCA]" />
            When to use
          </p>
          <p className="mt-2 text-sm leading-6 text-black/62">{display.whenToUse}</p>
        </div>
      )}

      <div className="mt-4 space-y-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.1em] text-black/42">Helps with</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {visibleHelpsWith.map((item) => (
              <span key={item} className="rounded-full border border-black/8 bg-white px-2.5 py-1 text-xs font-bold text-black/62">
                {item}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.1em] text-black/42">Best use cases</p>
          <ul className="mt-2 space-y-2">
            {visibleUseCases.map((useCase) => (
              <li key={useCase} className="flex items-start gap-2 text-sm leading-5 text-black/62">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#F7CBCA]" />
                <span>{useCase}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-[#E7F5DC]/24 bg-[#D5E5E5]/42 p-3">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.1em] text-[#8A4300]">
          <Sparkles className="h-3.5 w-3.5" />
          Expected output
        </p>
        <p className="mt-2 text-sm leading-6 text-black/64">{display.expectedOutput}</p>
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row">
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
