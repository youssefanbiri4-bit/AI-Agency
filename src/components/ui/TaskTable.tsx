'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight, FileText, MoreHorizontal } from 'lucide-react';
import type { Agent, Task } from '@/types';
import { buttonStyles } from './Button';
import { EmptyState } from './EmptyState';
import { StatusBadge } from './StatusBadge';
import { cn, formatDate } from '@/lib/utils';

interface TaskTableProps {
  tasks: Task[];
  agents: Agent[];
  emptyAction?: ReactNode;
  className?: string;
}

function getTaskPriority(task: Task) {
  return task.priority;
}

function priorityClasses(priority: string) {
  if (priority === 'High') return 'border-[#F7CBCA]/22 bg-[#D5E5E5]/70 text-[#F7CBCA]';
  if (priority === 'Low') return 'border-black/10 bg-white text-black/58';
  return 'border-[#F7CBCA]/18 bg-[#D5E5E5]/65 text-[#F7CBCA]';
}

export function TaskTable({ tasks, agents, emptyAction, className }: TaskTableProps) {
  if (!tasks.length) {
    return (
      <EmptyState
        icon={FileText}
        title="No tasks to show"
        description="Create a task to start tracking agent work in this workspace."
        action={emptyAction}
        className={className}
      />
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border border-[#F7CBCA]/10 bg-white/82 shadow-[0_18px_42px_rgba(93,107,107,0.07)] backdrop-blur-[18px] [-webkit-backdrop-filter:blur(18px)]', className)}>
      <div className="divide-y divide-black/5 md:hidden">
        {tasks.map((task) => {
          const agent = agents.find((item) => item.id === task.agent_type);
          const priority = getTaskPriority(task);

          return (
            <article key={task.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words font-bold leading-6 text-black">{task.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-black/56">{task.description}</p>
                </div>
                <StatusBadge status={task.status} type="task" size="sm" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-black/38">Agent</p>
                  <p className="mt-1 break-words text-black/72">{agent?.name || task.agent_type}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-black/38">Created</p>
                  <p className="mt-1 text-black/72">{formatDate(task.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-black/38">Department</p>
                  <p className="mt-1 break-words text-black/72">{agent?.department || 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-black/38">Priority</p>
                  <span className={cn('mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', priorityClasses(priority))}>
                    {priority}
                  </span>
                </div>
              </div>

              <Link
                href={`/dashboard/tasks/${task.id}`}
                className={buttonStyles({ variant: 'outline', size: 'sm', className: 'mt-4 w-full' })}
              >
                <span>View Details</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="data-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Agent</th>
              <th>Department</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Created</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const agent = agents.find((item) => item.id === task.agent_type);
              const priority = getTaskPriority(task);

              return (
                <tr key={task.id} className="group">
                  <td>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-[#D5E5E5]/70 text-[#F7CBCA]">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-black">{task.title}</p>
                        <p className="mt-1 max-w-md truncate text-sm text-black/56">{task.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-sm font-semibold text-black/72">
                    {agent?.name || task.agent_type}
                  </td>
                  <td className="text-sm text-black/60">
                    {agent?.department || 'Unassigned'}
                  </td>
                  <td>
                    <StatusBadge status={task.status} type="task" size="sm" />
                  </td>
                  <td>
                    <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', priorityClasses(priority))}>
                      {priority}
                    </span>
                  </td>
                  <td className="text-sm text-black/60">
                    {formatDate(task.created_at)}
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/dashboard/tasks/${task.id}`}
                      aria-label={`View ${task.title}`}
                      className={buttonStyles({ variant: 'ghost', size: 'icon' })}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
