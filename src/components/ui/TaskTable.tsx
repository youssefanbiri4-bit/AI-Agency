'use client';

import { useEffect, useRef } from 'react';
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
  /** Optional bulk-selection wiring. When omitted, the table renders without checkboxes. */
  selection?: TaskTableSelection;
}

export interface TaskTableSelection {
  selectedIds: Set<string>;
  onToggleRow: (id: string, index: number, shiftKey: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  allChecked: boolean;
  someChecked: boolean;
}

function getTaskPriority(task: Task) {
  return task.priority;
}

function priorityClasses(priority: string) {
  if (priority === 'High') return 'border-primary-light/28 bg-status-neutral-bg/80 text-primary-light';
  if (priority === 'Low') return 'border-border bg-background text-foreground-muted';
  return 'border-primary-light/24 bg-status-neutral-bg/75 text-primary-light';
}

function rowCheckboxClasses() {
  return 'h-4 w-4 rounded border-border text-primary accent-[rgb(61,90,90)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50';
}

/** Header checkbox that reflects an indeterminate (some selected) state. */
function SelectAllCheckbox({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      aria-label={label}
      className={rowCheckboxClasses()}
    />
  );
}

export function TaskTable({ tasks, agents, emptyAction, className, selection }: TaskTableProps) {
  if (!tasks.length) {
    return (
      <EmptyState
        icon={<FileText className="h-6 w-6" />}
        title="No tasks to show"
        description="Create a task to start tracking agent work in this workspace."
        action={emptyAction}
        className={className}
      />
    );
  }

  const hasSelection = Boolean(selection);

  return (
    <div className={cn('overflow-hidden rounded-lg border border-primary-light/20 bg-background/82 shadow-[0_18px_42px_rgba(61,90,90,0.07)] backdrop-blur-[18px] [-webkit-backdrop-filter:blur(18px)]', className)}>
      <div className="divide-y divide-black/5 md:hidden">
        {tasks.map((task, index) => {
          const agent = agents.find((item) => item.id === task.agent_type);
          const priority = getTaskPriority(task);
          const selected = hasSelection && selection!.selectedIds.has(task.id);

          return (
            <article
              key={task.id}
              className={cn('p-4', selected && 'bg-primary-light/5')}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  {hasSelection && (
                    <input
                      type="checkbox"
                      checked={selected}
                      onClick={(event) => {
                        event.preventDefault();
                        selection!.onToggleRow(task.id, index, event.shiftKey);
                      }}
                      aria-label={`Select ${task.title}`}
                      className={cn(rowCheckboxClasses(), 'mt-1')}
                    />
                  )}
                  <div className="min-w-0">
                    <h3 className="break-words font-bold leading-6 text-foreground">{task.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-foreground-muted">{task.description}</p>
                  </div>
                </div>
                <StatusBadge status={task.status} type="task" size="sm" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground-muted">Agent</p>
                  <p className="mt-1 break-words text-foreground-muted">{agent?.name || task.agent_type}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground-muted">Created</p>
                  <p className="mt-1 text-foreground-muted">{formatDate(task.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground-muted">Department</p>
                  <p className="mt-1 break-words text-foreground-muted">{agent?.department || 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground-muted">Priority</p>
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
              {hasSelection && (
                <th scope="col" className="w-10">
                  <SelectAllCheckbox
                    checked={selection!.allChecked}
                    indeterminate={selection!.someChecked}
                    onChange={(checked) => selection!.onToggleAll(checked)}
                    label="Select all tasks"
                  />
                </th>
              )}
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
            {tasks.map((task, index) => {
              const agent = agents.find((item) => item.id === task.agent_type);
              const priority = getTaskPriority(task);
              const selected = hasSelection && selection!.selectedIds.has(task.id);

              return (
                <tr key={task.id} className={cn('group', selected && 'bg-primary-light/5')} aria-selected={selected}>
                  {hasSelection && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selected}
                        onClick={(event) => {
                          event.preventDefault();
                          selection!.onToggleRow(task.id, index, event.shiftKey);
                        }}
                        aria-label={`Select ${task.title}`}
                        className={rowCheckboxClasses()}
                      />
                    </td>
                  )}
                  <td>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-status-neutral-bg/80 text-primary-light">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-foreground">{task.title}</p>
                        <p className="mt-1 max-w-md truncate text-sm text-foreground-muted">{task.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-sm font-semibold text-foreground-muted">
                    {agent?.name || task.agent_type}
                  </td>
                  <td className="text-sm text-foreground-muted">
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
                  <td className="text-sm text-foreground-muted">
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
