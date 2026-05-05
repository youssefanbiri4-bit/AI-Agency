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
import type { Agent, Department, Task, TaskStatus } from '@/types';

interface TasksClientProps {
  tasks: Task[];
  agents: Agent[];
  departments: Department[];
  initialSearch?: string;
}

export function TasksClient({ tasks, agents, departments, initialSearch = '' }: TasksClientProps) {
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

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Task operations"
        title="Tasks"
        description="Track real agent work requests stored in the active workspace."
        actions={
          <Link href="/dashboard/create-task" className={buttonStyles({ size: 'lg' })}>
            <Plus className="h-5 w-5" />
            New Task
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard title="Total" value={taskStats.total} icon={FileText} tone="neutral" subtitle={taskStats.total === 0 ? 'Create a task to begin' : 'Real workspace tasks'} />
        <StatCard title="Pending" value={taskStats.pending} icon={Clock} tone="accent" />
        <StatCard title="Processing" value={taskStats.processing} icon={Zap} tone="brand" />
        <StatCard title="Needs Review" value={taskStats.needsReview} icon={AlertCircle} tone="accent" />
        <StatCard title="Completed" value={taskStats.completed} icon={CheckCircle2} tone="dark" />
        <StatCard title="Failed" value={taskStats.failed} icon={AlertCircle} tone="accent" />
      </div>

      <section className="min-w-0 rounded-lg border border-black/8 bg-white p-4 shadow-[0_18px_48px_rgba(0,0,0,0.06)] sm:p-5">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-black">Task Filters</h2>
          <p className="mt-1 text-sm text-black/52">Find work by agent, department, status, or task description.</p>
        </div>
        <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_220px_240px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/34" />
            <Input
              type="search"
              placeholder="Search tasks by title or description"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-10"
            />
          </div>

          <div className="relative">
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/34" />
            <Select
              value={selectedDepartment}
              onChange={(event) => setSelectedDepartment(event.target.value)}
            >
              <option value="all">All Departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.name}>
                  {department.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="relative">
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/34" />
            <Select value={selectedAgent} onChange={(event) => setSelectedAgent(event.target.value)}>
              <option value="all">All Agents</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="relative">
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/34" />
            <Select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value as TaskStatus | 'all')}
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="needs_review">Needs Review</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>
        </div>
        <p className="mt-4 text-sm text-black/52">
          Showing {filteredTasks.length} of {tasks.length} real task records.
        </p>
      </section>

      <TaskTable
        tasks={filteredTasks}
        agents={agents}
        emptyAction={
          <Link href="/dashboard/create-task" className={buttonStyles()}>
            <Plus className="h-4 w-4" />
            Create Task
          </Link>
        }
      />
    </div>
  );
}
