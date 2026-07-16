'use client';

import { useEffect, useState } from 'react';
import { Brain, Briefcase, ChevronDown, Code, Database, Filter, Megaphone, Search, SlidersHorizontal, Users, Workflow } from 'lucide-react';
import { AgentCard } from '@/components/ui/AgentCard';
import { DepartmentCard } from '@/components/ui/DepartmentCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Select } from '@/components/ui/FormControls';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { useDashboardContext } from '@/components/layout/DashboardContext';
import { listAgentCatalog, type AgentCatalogData } from '@/lib/data/agents';
import { listTasks } from '@/features/tasks/data/tasks';
import { getDepartmentUsageSummary } from '@/lib/agents/agent-display';
import { getAgentStats, getDepartmentMetrics } from '@/lib/stats';
import type { Agent, Department, DepartmentName, Task } from '@/types';

const departmentIcons = {
  'Research & Strategy': Brain,
  'Content & Growth': Megaphone,
  'Sales & Operations': Briefcase,
  'Development & Engineering': Code,
} satisfies Record<DepartmentName, typeof Brain>;

export default function AgentsPage() {
  const { workspace } = useDashboardContext();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [catalogSource, setCatalogSource] = useState<AgentCatalogData['source'] | null>(null);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'department'>('name');

  useEffect(() => {
    let isMounted = true;

    const loadAgents = async () => {
      const result = await listAgentCatalog();

      if (!isMounted) return;

      setAgents(result.data.agents);
      setDepartments(result.data.departments);
      setCatalogSource(result.data.source);
      setLoadError(result.error);
      setIsLoadingAgents(false);
    };

    loadAgents();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadTasks = async () => {
      const result = await listTasks({ workspaceId: workspace.id });

      if (!isMounted) return;

      setTasks(result.data);
    };

    loadTasks();

    return () => {
      isMounted = false;
    };
  }, [workspace.id]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      const params = new URLSearchParams(window.location.search);
      const department = params.get('department');
      const query = params.get('q');

      if (department && departments.some((item) => item.name === department)) {
        setSelectedDepartment(department);
      }

      if (query) {
        setSearchQuery(query);
      }
    });
  }, [departments]);

  const filteredAgents = agents.filter((agent) => {
    const normalizedSearch = searchQuery.toLowerCase();
    const matchesSearch =
      agent.name.toLowerCase().includes(normalizedSearch) ||
      agent.description.toLowerCase().includes(normalizedSearch) ||
      agent.department.toLowerCase().includes(normalizedSearch);
    const matchesDepartment = selectedDepartment === 'all' || agent.department === selectedDepartment;

    return matchesSearch && matchesDepartment;
  });

  const sortedAgents = [...filteredAgents].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return a.department.localeCompare(b.department) || a.name.localeCompare(b.name);
  });

  const departmentMetrics = getDepartmentMetrics(departments, agents, tasks);
  const departmentFilters: Array<'all' | DepartmentName> = [
    'all',
    ...departments.map((department) => department.name),
  ];
  const agentStats = getAgentStats(agents);
  const hasActiveFilters = searchQuery !== '' || selectedDepartment !== 'all';
  const catalogSubtitle =
    catalogSource === 'supabase'
      ? 'Loaded from Supabase catalog'
      : catalogSource === 'fallback'
        ? 'Using local fallback catalog'
        : 'Loading Supabase catalog';

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedDepartment('all');
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Agent catalog"
        title="AI Agents"
        description="Choose the right agent for research, content, growth, sales, and operations tasks."
        actions={
          <Button variant="secondary" onClick={resetFilters} disabled={!hasActiveFilters}>
            <SlidersHorizontal className="h-4 w-4" />
            Reset Filters
          </Button>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.55fr)]">
        <div className="grid gap-4 md:grid-cols-3">
          {departmentFilters
            .filter((department): department is DepartmentName => department !== 'all')
            .map((department) => {
              const summary = getDepartmentUsageSummary(department);
              const Icon = departmentIcons[department];

              return (
                <button
                  key={department}
                  type="button"
                  onClick={() => setSelectedDepartment(department)}
                  className={`rounded-lg border p-5 text-left shadow-[0_18px_42px_rgba(93,107,107,0.06)] transition-all hover:-translate-y-0.5 ${
                    selectedDepartment === department
                      ? 'border-[#F7CBCA]/35 bg-[#D5E5E5]/60'
                      : 'border-[#F7CBCA]/10 bg-white/86 hover:border-[#F7CBCA]/24'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg border border-white bg-[#D5E5E5] p-3 text-[#F7CBCA]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-black leading-6 text-black">{summary.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-black/60">{summary.description}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {summary.examples.map((example) => (
                      <span key={example} className="rounded-full border border-black/8 bg-white px-2.5 py-1 text-xs font-bold text-black/58">
                        {example}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
        </div>

        <div className="rounded-lg border border-[#F7CBCA]/10 bg-[#5D6B6B] p-5 text-white shadow-[0_18px_42px_rgba(93,107,107,0.12)]">
          <h2 className="text-lg font-black">How to choose an agent</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-white/78">
            <p>Use Research & Strategy first when you need direction or market clarity.</p>
            <p>Use Content & Growth when you need captions, scripts, copy, briefs, or campaign output.</p>
            <p>Use Sales & Operations when you need leads, follow-up, reporting, or workflow organization.</p>
            <p className="font-bold text-[#D5E5E5]">For big work, split the request into multiple focused tasks.</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {departmentMetrics.map((department) => (
          <DepartmentCard
            key={department.id}
            department={department}
            agentsCount={department.agentsCount}
            taskRecords={department.taskRecords}
          />
        ))}
      </div>

      <div className="dashboard-stat-grid">
        <StatCard
          title="Agent Catalog"
          value={agentStats.total}
          icon={Users}
          tone="brand"
          subtitle={isLoadingAgents ? 'Loading Supabase catalog' : catalogSubtitle}
        />
        <StatCard
          title="Departments"
          value={departments.length}
          icon={Filter}
          tone="brand"
          subtitle="Strategy, growth, operations, and engineering"
        />
        <StatCard
          title="Task History"
          value={tasks.length}
          icon={Database}
          tone="neutral"
          subtitle={tasks.length === 0 ? 'Create a task to start history' : 'Real workspace tasks'}
        />
        <StatCard
          title="Workflows"
          value="Guarded"
          icon={Workflow}
          tone="accent"
          subtitle="n8n execution waits for setup"
        />
      </div>

      <section className="min-w-0 rounded-lg border border-[#F7CBCA]/8 bg-white/58 p-4 shadow-[0_18px_42px_rgba(93,107,107,0.06)] backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)] sm:p-5">
        <div className="mb-5 flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-black">Find the right agent</h2>
          <p className="text-sm text-black/52">Search by capability, department, or agent responsibility.</p>
        </div>
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_240px_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/34" />
            <Input
              type="search"
              placeholder="Search agents by name, department, or capability"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="ps-10"
            />
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/34" />
            <ChevronDown className="pointer-events-none absolute end-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/34" />
            <Select
              value={selectedDepartment}
              onChange={(event) => setSelectedDepartment(event.target.value)}
              className="ps-10"
            >
              {departmentFilters.map((department) => (
                <option key={department} value={department}>
                  {department === 'all' ? 'All Departments' : department}
                </option>
              ))}
            </Select>
          </div>

          <div className="relative">
            <ChevronDown className="pointer-events-none absolute end-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/34" />
            <Select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as 'name' | 'department')}
            >
              <option value="name">Sort by name</option>
              <option value="department">Sort by department</option>
            </Select>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 text-sm text-black/52 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing <span className="font-semibold text-black">{sortedAgents.length}</span> of{' '}
            <span className="font-semibold text-black">{agents.length}</span> agents
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="w-fit text-sm font-semibold text-[#F7CBCA] hover:text-black"
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {departmentFilters.map((department) => (
          <button
            key={department}
            type="button"
            className={`rounded-full border px-3 py-2 text-sm font-black transition-colors ${
              selectedDepartment === department
                ? 'border-[#F7CBCA] bg-[#F7CBCA] text-white'
                : 'border-black/10 bg-white text-black/58 hover:border-[#F7CBCA]/35 hover:text-[#F7CBCA]'
            }`}
            onClick={() => setSelectedDepartment(department)}
          >
            {department === 'all' ? 'All' : department}
          </button>
        ))}
      </div>

      {isLoadingAgents ? (
        <LoadingState
          title="Loading agent catalog"
          description="Checking Supabase for configured agency agents."
        />
      ) : loadError ? (
        <EmptyState
          icon={Database}
          title="Supabase agent catalog is not available"
          description="Run the schema and seed SQL, then refresh the catalog."
        />
      ) : sortedAgents.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No agents match these filters"
          description="Clear the filters or search a different capability."
          action={<Button onClick={resetFilters}>Reset Filters</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {sortedAgents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
