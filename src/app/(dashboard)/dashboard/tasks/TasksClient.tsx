'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Download,
  FileText,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  Zap,
} from 'lucide-react';
import { Input, Select } from '@/components/ui/FormControls';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { TaskTable, type TaskTableSelection } from '@/components/ui/TaskTable';
import { buttonStyles } from '@/components/ui/Button';
import { getTaskStats } from '@/lib/stats';
import type { Agent, Department, Task, TaskStatus } from '@/types';
import { useLanguage } from '@/i18n/context';
import { translateTaskStatus } from '@/i18n/dashboard-labels';
import { useRowSelection } from '@/hooks/useRowSelection';
import { BulkActionBar, type BulkActionConfig } from '@/components/ui/BulkActionBar';
import { toast } from '@/components/ui/toast';
import { bulkSetTaskStatus, bulkDeleteTasks, bulkDuplicateTasks, bulkAssignTasks, bulkExportTasks } from './bulk-actions';

interface TasksClientProps {
  tasks: Task[];
  agents: Agent[];
  departments: Department[];
  initialSearch?: string;
}

export function TasksClient({ tasks, agents, departments, initialSearch = '' }: TasksClientProps) {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | 'all'>('all');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const taskStats = getTaskStats(tasks);

  const filteredTasks = tasks.filter((task) => {
    const normalizedSearch = searchQuery.toLowerCase();
    const matchesSearch =
      task.title.toLowerCase().includes(normalizedSearch) ||
      task.description.toLowerCase().includes(normalizedSearch);
    const matchesStatus = selectedStatus === 'all' || task.status === selectedStatus;
    const matchesAgent = selectedAgent === 'all' || task.agent_type === selectedAgent;
    const agent = agents.find((item) => item.id === task.agent_type);
    const matchesDepartment =
      selectedDepartment === 'all' || agent?.department === selectedDepartment;

    return matchesSearch && matchesStatus && matchesAgent && matchesDepartment;
  });

  const taskIds = useMemo(() => filteredTasks.map((task) => task.id), [filteredTasks]);
  const { selectedIds, toggle, toggleRange, selectAll, clear, isAllSelected, isSomeSelected } =
    useRowSelection();
  const lastIndexRef = useRef<number | null>(null);

  const handleToggleRow = useCallback(
    (id: string, index: number, shiftKey: boolean) => {
      if (shiftKey && lastIndexRef.current !== null) {
        toggleRange(taskIds, lastIndexRef.current, index, id);
      } else {
        toggle(id);
      }
      lastIndexRef.current = index;
    },
    [taskIds, toggle, toggleRange],
  );

  const handleToggleAll = useCallback(
    (checked: boolean) => {
      if (checked) selectAll(taskIds);
      else clear();
    },
    [taskIds, selectAll, clear],
  );

  const allChecked = isAllSelected(taskIds);
  const someChecked = isSomeSelected(taskIds);

  const selection: TaskTableSelection = {
    selectedIds,
    onToggleRow: handleToggleRow,
    onToggleAll: handleToggleAll,
    allChecked,
    someChecked,
  };

  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [statusPending, setStatusPending] = useState(false);
  const [assignMenuOpen, setAssignMenuOpen] = useState(false);
  const [assignPending, setAssignPending] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportPending, setExportPending] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [duplicatePending, setDuplicatePending] = useState(false);

  const bulkStatuses: { value: TaskStatus; label: string }[] = [
    { value: 'pending', label: translateTaskStatus(t, 'pending') },
    { value: 'processing', label: translateTaskStatus(t, 'processing') },
    { value: 'needs_review', label: translateTaskStatus(t, 'needs_review') },
    { value: 'completed', label: translateTaskStatus(t, 'completed') },
    { value: 'failed', label: translateTaskStatus(t, 'failed') },
  ];

  const handleBulkStatus = useCallback(
    async (status: TaskStatus) => {
      setStatusMenuOpen(false);
      setStatusPending(true);
      try {
        const result = await bulkSetTaskStatus(Array.from(selectedIds), status);
        if (result.ok) {
          toast.success(
            t('page.tasks.bulkStatusSuccess', `Updated ${result.updated} task(s) to ${translateTaskStatus(t, status)}.`),
          );
          clear();
        } else if (result.updated > 0) {
          toast.warning(
            t('page.tasks.bulkStatusPartial', `Updated ${result.updated} task(s); ${result.failed} failed.`),
          );
          clear();
        } else {
          toast.error(result.message || t('page.tasks.bulkStatusError', 'Failed to update task statuses.'));
        }
      } catch {
        toast.error(t('page.tasks.bulkStatusError', 'Failed to update task statuses.'));
      } finally {
        setStatusPending(false);
      }
    },
    [selectedIds, clear, t],
  );

  const handleBulkAssign = useCallback(
    async (agentType: string) => {
      setAssignMenuOpen(false);
      setAssignPending(true);
      try {
        const result = await bulkAssignTasks(Array.from(selectedIds), agentType);
        if (result.ok) {
          toast.success(t('page.tasks.bulkAssignSuccess', `Assigned ${result.updated} task(s) to selected agent.`));
          clear();
        } else if (result.updated > 0) {
          toast.warning(t('page.tasks.bulkAssignPartial', `Assigned ${result.updated} task(s); ${result.failed} failed.`));
          clear();
        } else {
          toast.error(result.message || t('page.tasks.bulkAssignError', 'Failed to assign tasks.'));
        }
      } catch {
        toast.error(t('page.tasks.bulkAssignError', 'Failed to assign tasks.'));
      } finally {
        setAssignPending(false);
      }
    },
    [selectedIds, clear, t],
  );

  const handleBulkDelete = useCallback(
    async () => {
      setDeleteConfirmOpen(false);
      setDeletePending(true);
      try {
        const result = await bulkDeleteTasks(Array.from(selectedIds));
        if (result.ok) {
          toast.success(t('page.tasks.bulkDeleteSuccess', `Deleted ${result.updated} task(s).`));
          clear();
        } else if (result.updated > 0) {
          toast.warning(t('page.tasks.bulkDeletePartial', `Deleted ${result.updated} task(s); ${result.failed} failed.`));
          clear();
        } else {
          toast.error(result.message || t('page.tasks.bulkDeleteError', 'Failed to delete tasks.'));
        }
      } catch {
        toast.error(t('page.tasks.bulkDeleteError', 'Failed to delete tasks.'));
      } finally {
        setDeletePending(false);
      }
    },
    [selectedIds, clear, t],
  );

  const handleBulkDuplicate = useCallback(
    async () => {
      setDuplicatePending(true);
      try {
        const result = await bulkDuplicateTasks(Array.from(selectedIds));
        if (result.ok) {
          toast.success(t('page.tasks.bulkDuplicateSuccess', `Duplicated ${result.updated} task(s).`));
          clear();
        } else if (result.updated > 0) {
          toast.warning(t('page.tasks.bulkDuplicatePartial', `Duplicated ${result.updated} task(s); ${result.failed} failed.`));
          clear();
        } else {
          toast.error(result.message || t('page.tasks.bulkDuplicateError', 'Failed to duplicate tasks.'));
        }
      } catch {
        toast.error(t('page.tasks.bulkDuplicateError', 'Failed to duplicate tasks.'));
      } finally {
        setDuplicatePending(false);
      }
    },
    [selectedIds, clear, t],
  );

  const handleBulkExport = useCallback(
    async (format: 'csv' | 'json') => {
      setExportMenuOpen(false);
      setExportPending(true);
      try {
        const result = await bulkExportTasks(Array.from(selectedIds), format);
        if (result.ok && result.data) {
          // Trigger browser download
          const blob = new Blob([result.data], {
            type: format === 'csv' ? 'text/csv' : 'application/json',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = result.filename ?? `tasks-export.${format}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success(t('page.tasks.bulkExportSuccess', `Exported ${Array.from(selectedIds).length} task(s) as ${format.toUpperCase()}.`));
          clear();
        } else {
          toast.error(result.message || t('page.tasks.bulkExportError', 'Failed to export tasks.'));
        }
      } catch {
        toast.error(t('page.tasks.bulkExportError', 'Failed to export tasks.'));
      } finally {
        setExportPending(false);
      }
    },
    [selectedIds, clear, t],
  );

  const bulkActions: BulkActionConfig[] = [
    {
      key: 'assign',
      label: t('action.assign', 'Assign'),
      icon: UserPlus,
      onClick: () => setAssignMenuOpen((value) => !value),
      disabled: assignPending,
    },
    {
      key: 'status',
      label: t('action.changeStatus', 'Change Status'),
      icon: RefreshCw,
      onClick: () => setStatusMenuOpen((value) => !value),
      disabled: statusPending,
    },
    {
      key: 'duplicate',
      label: t('action.duplicate', 'Duplicate'),
      icon: Copy,
      onClick: () => void handleBulkDuplicate(),
      disabled: duplicatePending,
    },
    {
      key: 'delete',
      label: t('action.delete', 'Delete'),
      icon: Trash2,
      variant: 'danger',
      onClick: () => setDeleteConfirmOpen(true),
      disabled: deletePending,
    },
    {
      key: 'export',
      label: t('action.export', 'Export'),
      icon: Download,
      onClick: () => setExportMenuOpen((value) => !value),
      disabled: exportPending,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t('topbar.pageTitles.tasks.title')}
        title={t('nav.tasks')}
        description={t('topbar.pageTitles.tasks.description')}
        actions={
          <Link href="/dashboard/create-task" className={buttonStyles({ size: 'lg' })}>
            <Plus className="h-5 w-5" />
            {t('action.newTask', 'New Task')}
          </Link>
        }
      />

      <div className="dashboard-stat-grid">
        <StatCard title={t('dashboardI18n.common.total')} value={taskStats.total} icon={FileText} tone="neutral" subtitle={taskStats.total === 0 ? t('page.tasks.createToBegin', 'Create a task to begin') : t('page.tasks.realWorkspaceTasks', 'Real workspace tasks')} />
        <StatCard title={t('status.pending')} value={taskStats.pending} icon={Clock} tone="accent" />
        <StatCard title={t('status.processing')} value={taskStats.processing} icon={Zap} tone="brand" />
        <StatCard title={t('status.needsReview')} value={taskStats.needsReview} icon={AlertCircle} tone="accent" />
        <StatCard title={t('status.completed')} value={taskStats.completed} icon={CheckCircle2} tone="dark" />
        <StatCard title={t('status.failed')} value={taskStats.failed} icon={AlertCircle} tone="accent" />
      </div>

      <section className="min-w-0 rounded-lg border border-[#F7CBCA]/8 bg-white/58 p-4 shadow-[0_18px_42px_rgba(93,107,107,0.06)] backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)] sm:p-5">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-black">{t('page.tasks.filtersTitle', 'Task Filters')}</h2>
          <p className="mt-1 text-sm text-black/52">{t('page.tasks.filtersDescription', 'Find work by agent, department, status, or task description.')}</p>
        </div>
        <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_220px_240px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/34" />
            <Input
              type="search"
              placeholder={t('page.tasks.searchPlaceholder', 'Search tasks by title or description')}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="ps-10"
            />
          </div>

          <div className="relative">
            <ChevronDown className="pointer-events-none absolute end-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/34" />
            <Select
              value={selectedDepartment}
              onChange={(event) => setSelectedDepartment(event.target.value)}
            >
              <option value="all">{t('form.allDepartments')}</option>
              {departments.map((department) => (
                <option key={department.id} value={department.name}>
                  {department.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="relative">
            <ChevronDown className="pointer-events-none absolute end-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/34" />
            <Select value={selectedAgent} onChange={(event) => setSelectedAgent(event.target.value)}>
              <option value="all">{t('form.allAgents', 'All Agents')}</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="relative">
            <ChevronDown className="pointer-events-none absolute end-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/34" />
            <Select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value as TaskStatus | 'all')}
            >
              <option value="all">{t('form.allStatus')}</option>
              <option value="draft">{translateTaskStatus(t, 'draft')}</option>
              <option value="pending">{translateTaskStatus(t, 'pending')}</option>
              <option value="processing">{translateTaskStatus(t, 'processing')}</option>
              <option value="needs_review">{translateTaskStatus(t, 'needs_review')}</option>
              <option value="completed">{translateTaskStatus(t, 'completed')}</option>
              <option value="failed">{translateTaskStatus(t, 'failed')}</option>
              <option value="cancelled">{translateTaskStatus(t, 'cancelled')}</option>
            </Select>
          </div>
        </div>
        <p className="mt-4 text-sm text-black/52">
          {t('dashboardI18n.common.showing')} {filteredTasks.length} {t('dashboardI18n.common.of')} {tasks.length} {t('page.tasks.realTaskRecords', 'real task records')}.
        </p>
      </section>

      <TaskTable
        tasks={filteredTasks}
        agents={agents}
        selection={selection}
        emptyAction={
          <Link href="/dashboard/create-task" className={buttonStyles()}>
            <Plus className="h-4 w-4" />
            {t('action.createTask')}
          </Link>
        }
      />

      {statusMenuOpen && selectedIds.size > 0 && (
        <div className="fixed inset-0 z-40" onClick={() => setStatusMenuOpen(false)} aria-hidden="true" />
      )}

      {statusMenuOpen && selectedIds.size > 0 && (
        <div
          role="menu"
          aria-label={t('action.changeStatus', 'Change Status')}
          className="fixed inset-x-0 bottom-20 z-50 mx-auto flex w-fit flex-col gap-1 rounded-lg border border-primary-light/20 bg-background p-2 shadow-[0_18px_42px_rgba(61,90,90,0.18)]"
        >
          {bulkStatuses.map((item) => (
            <button
              key={item.value}
              type="button"
              role="menuitem"
              onClick={() => handleBulkStatus(item.value)}
              className="rounded-md px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-primary-light/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {assignMenuOpen && selectedIds.size > 0 && (
        <div className="fixed inset-0 z-40" onClick={() => setAssignMenuOpen(false)} aria-hidden="true" />
      )}

      {assignMenuOpen && selectedIds.size > 0 && (
        <div
          role="menu"
          aria-label={t('action.assign', 'Assign')}
          className="fixed inset-x-0 bottom-20 z-50 mx-auto flex w-fit flex-col gap-1 rounded-lg border border-primary-light/20 bg-background p-2 shadow-[0_18px_42px_rgba(61,90,90,0.18)]"
        >
          <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-black/42">
            {t('page.tasks.assignAgent', 'Assign to Agent')}
          </p>
          {agents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              role="menuitem"
              onClick={() => handleBulkAssign(agent.id)}
              className="rounded-md px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-primary-light/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {agent.name}
            </button>
          ))}
        </div>
      )}

      {exportMenuOpen && selectedIds.size > 0 && (
        <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)} aria-hidden="true" />
      )}

      {exportMenuOpen && selectedIds.size > 0 && (
        <div
          role="menu"
          aria-label={t('action.export', 'Export')}
          className="fixed inset-x-0 bottom-20 z-50 mx-auto flex w-fit flex-col gap-1 rounded-lg border border-primary-light/20 bg-background p-2 shadow-[0_18px_42px_rgba(61,90,90,0.18)]"
        >
          <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-black/42">
            {t('page.tasks.exportFormat', 'Export Format')}
          </p>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleBulkExport('csv')}
            className="rounded-md px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-primary-light/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            CSV (.csv)
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleBulkExport('json')}
            className="rounded-md px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-primary-light/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            JSON (.json)
          </button>
        </div>
      )}

      {deleteConfirmOpen && selectedIds.size > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setDeleteConfirmOpen(false)}>
          <div
            className="mx-4 w-full max-w-md rounded-2xl border border-primary-light/20 bg-background p-6 shadow-[0_18px_42px_rgba(61,90,90,0.18)]"
            onClick={(event) => event.stopPropagation()}
            role="alertdialog"
            aria-label="Delete confirmation"
          >
            <h3 className="text-lg font-bold text-foreground">
              {t('page.tasks.deleteConfirmTitle', `Delete ${selectedIds.size} task(s)?`)}
            </h3>
            <p className="mt-2 text-sm text-foreground-muted">
              {t('page.tasks.deleteConfirmDescription', 'This action cannot be undone. The tasks and their events will be permanently removed.')}
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className={buttonStyles({ variant: 'outline', size: 'sm' })}
              >
                {t('action.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleBulkDelete()}
                disabled={deletePending}
                className={buttonStyles({ variant: 'danger', size: 'sm' })}
              >
                {deletePending ? t('common.deleting', 'Deleting...') : t('action.delete', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      <BulkActionBar
        count={selectedIds.size}
        actions={bulkActions}
        onClear={clear}
        label="task"
        aria-label={t('page.tasks.bulkActions', 'Bulk task actions')}
      />
    </div>
  );
}
