'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Plus,
  Search,
  Zap,
} from 'lucide-react';
import { Input, Select } from '@/components/ui/FormControls';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { TaskTable } from '@/components/ui/TaskTable';
import { buttonStyles } from '@/components/ui/Button';
import { getTaskStats } from '@/lib/stats';
import type { Agent, Task, TaskStatus } from '@/types';
import { useLanguage } from '@/i18n/context';
import { translateTaskStatus } from '@/i18n/dashboard-labels';
import { useRBAC } from '@/components/layout/DashboardContext';
import type { Department } from '@/types/auth';
import { DEPARTMENT_LABELS } from '@/types/auth';
import { getRbacDepartmentsForCatalog, resolveCatalogDepartmentId } from '@/lib/auth/rbac-client';
import type { TaskWithAgentDept } from '@/lib/tasks/task-service';

interface TasksClientProps {
  tasks: TaskWithAgentDept[];
  agents: Agent[];
  initialSearch?: string;
}

function taskMatchesRbacDepartment(task: TaskWithAgentDept, selectedDepartment: Department): boolean {
  const catalogRef =
    task.agentCatalogDepartmentId ??
    resolveCatalogDepartmentId(task.agentDepartment) ??
    task.agentDepartment ??
    null;

  if (!catalogRef) return false;
  return getRbacDepartmentsForCatalog(catalogRef).includes(selectedDepartment);
}

export function TasksClient({ tasks, agents, initialSearch = '' }: TasksClientProps) {
  const { t } = useLanguage();
  const { department: userDept, isAdminOrHigher } = useRBAC();
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const defaultDept = !isAdminOrHigher && userDept ? userDept : 'all';
  const [selectedDepartment, setSelectedDepartment] = useState<Department | 'all'>(defaultDept);
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | 'all'>('all');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const taskStats = getTaskStats(tasks as Task[]);

  const filteredTasks = tasks.filter((task) => {
    const normalizedSearch = searchQuery.toLowerCase();
    const matchesSearch =
      task.title.toLowerCase().includes(normalizedSearch) ||
      task.description.toLowerCase().includes(normalizedSearch);
    const matchesStatus = selectedStatus === 'all' || task.status === selectedStatus;
    const matchesAgent = selectedAgent === 'all' || task.agent_type === selectedAgent;
    const matchesDepartment =
      selectedDepartment === 'all' || taskMatchesRbacDepartment(task, selectedDepartment);

    return matchesSearch && matchesStatus && matchesAgent && matchesDepartment;
  });

  const rbacDepartmentOptions = (Object.keys(DEPARTMENT_LABELS) as Department[]).map((dept) => ({
    value: dept,
    label: DEPARTMENT_LABELS[dept].en,
  }));

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
              onChange={(event) => setSelectedDepartment(event.target.value as Department | 'all')}
            >
              <option value="all">{t('form.allDepartments')}</option>
              {rbacDepartmentOptions.map((department) => (
                <option key={department.value} value={department.value}>
                  {department.label}
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
        emptyAction={
          <Link href="/dashboard/create-task" className={buttonStyles()}>
            <Plus className="h-4 w-4" />
            {t('action.createTask')}
          </Link>
        }
      />
    </div>
  );
}