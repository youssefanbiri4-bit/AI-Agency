'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Clock, Database, Lightbulb, Plus, Search, Workflow } from 'lucide-react';
import { createTaskAction, type CreateTaskState } from './actions';
import type { Agent, AgentType } from '@/types';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input, Label, Select, Textarea } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useActionToast } from '@/hooks/useActionToast';
import { getAgentDisplayMetadata } from '@/lib/agents/agent-display';

interface CreateTaskFormProps {
  agents: Agent[];
  initialAgentId?: AgentType | null;
  initialTitle?: string;
  initialDescription?: string;
}

const initialState: CreateTaskState = {
  error: null,
  message: null,
  taskId: null,
};

export function CreateTaskForm({
  agents,
  initialAgentId = null,
  initialTitle = '',
  initialDescription = '',
}: CreateTaskFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createTaskAction, initialState);
  const [selectedAgentId, setSelectedAgentId] = useState<AgentType | ''>(initialAgentId ?? '');
  const [agentSearchQuery, setAgentSearchQuery] = useState('');
  const [agentDepartmentFilter, setAgentDepartmentFilter] = useState('all');
  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [agents, selectedAgentId]
  );
  const filteredAgents = useMemo(() => {
    const normalizedSearch = agentSearchQuery.trim().toLowerCase();

    return agents.filter((agent) => {
      const display = getAgentDisplayMetadata(agent);
      const matchesDepartment =
        agentDepartmentFilter === 'all' || agent.department === agentDepartmentFilter;
      const matchesSearch =
        !normalizedSearch ||
        agent.name.toLowerCase().includes(normalizedSearch) ||
        agent.department.toLowerCase().includes(normalizedSearch) ||
        agent.description.toLowerCase().includes(normalizedSearch) ||
        display.alias.toLowerCase().includes(normalizedSearch) ||
        display.helpsWith.some((item) => item.toLowerCase().includes(normalizedSearch)) ||
        display.bestUseCases.some((item) => item.toLowerCase().includes(normalizedSearch));

      return matchesDepartment && matchesSearch;
    });
  }, [agentDepartmentFilter, agentSearchQuery, agents]);
  const agentDepartments = useMemo(
    () => Array.from(new Set(agents.map((agent) => agent.department))),
    [agents]
  );

  useActionToast({
    isPending,
    state,
    loadingMessage: 'Creating task...',
    successMessage: () => 'Task created.',
    successDescription: 'Opening it now.',
    errorMessage: (currentState) => currentState.error ?? 'Could not create task.',
  });

  useEffect(() => {
    if (state.taskId && !state.error) {
      router.push(`/dashboard/tasks/${state.taskId}`);
    }
  }, [router, state.error, state.taskId]);

  return (
    <div className="space-y-8">
      <Card className="border-[#F7CBCA]/16 bg-[#D5E5E5]/50">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#F7CBCA] shadow-sm">
              <Plus className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-black">Create a real workspace task</h2>
              <p className="mt-1 text-sm leading-6 text-black/62">
                The task will be saved to Supabase with pending status. Execution remains guarded until n8n is connected.
              </p>
            </div>
          </div>
          <StatusBadge status="Ready" type="system" size="sm" />
        </div>
      </Card>

      <form action={formAction} className="space-y-8">
        {state?.error && (
          <Notice tone="danger" title="Task was not created">
            {state.error}
          </Notice>
        )}

        <Card>
          <CardHeader
            title="Assigned Agent"
            description="Select one configured Supabase agent. Cards show when to use each agent and what output to expect."
          />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_260px]">
            <div className="relative">
              <Label htmlFor="agent-search">Search agents</Label>
              <Search className="pointer-events-none absolute bottom-3 end-3.5 h-4 w-4 text-black/34" />
              <Input
                id="agent-search"
                type="search"
                value={agentSearchQuery}
                onChange={(event) => setAgentSearchQuery(event.target.value)}
                placeholder="Search by name, alias, department, or use case"
                disabled={isPending}
              />
            </div>

            <div className="relative">
              <Label htmlFor="agent-department">Department</Label>
              <ChevronDown className="pointer-events-none absolute bottom-3 end-3.5 h-4 w-4 text-black/34" />
              <Select
                id="agent-department"
                value={agentDepartmentFilter}
                onChange={(event) => setAgentDepartmentFilter(event.target.value)}
                disabled={isPending}
              >
                <option value="all">All Departments</option>
                {agentDepartments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </Select>
            </div>

            <div className="relative">
              <Label htmlFor="agentType">
                Agent <span className="text-[#F7CBCA]">*</span>
              </Label>
              <ChevronDown className="pointer-events-none absolute bottom-3 end-3.5 h-4 w-4 text-black/34" />
              <Select
                id="agentType"
                name="agentType"
                value={selectedAgentId}
                onChange={(event) => setSelectedAgentId(event.target.value as AgentType | '')}
                disabled={isPending}
                required
              >
                <option value="">Select an agent</option>
                {agents.map((agent) => {
                  const display = getAgentDisplayMetadata(agent);

                  return (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} - {display.alias}
                    </option>
                  );
                })}
              </Select>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredAgents.map((agent) => {
              const isSelected = agent.id === selectedAgentId;
              const display = getAgentDisplayMetadata(agent);

              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setSelectedAgentId(agent.id)}
                  disabled={isPending}
                  aria-pressed={isSelected}
                  className={`group min-w-0 rounded-lg border p-5 text-left shadow-[0_18px_48px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-0.5 hover:border-[#F7CBCA]/24 hover:shadow-[0_20px_52px_rgba(202,40,81,0.11)] disabled:cursor-not-allowed disabled:opacity-60 ${
                    isSelected ? 'border-[#F7CBCA]/40 bg-[#D5E5E5]/60' : 'border-black/8 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <AgentAvatar icon={agent.icon} color={agent.color} department={agent.department} />
                      <div className="min-w-0">
                        <h3 className="font-bold leading-5 text-black group-hover:text-[#F7CBCA]">{agent.name}</h3>
                        <p className="mt-1 text-sm font-black text-[#F7CBCA]">{display.alias}</p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-black/40">{agent.department}</p>
                      </div>
                    </div>
                    <StatusBadge status={agent.status} size="sm" />
                  </div>
                  <p className="mt-4 line-clamp-2 text-sm font-semibold leading-6 text-black/68">{display.role}</p>
                  <div className="mt-4 rounded-lg border border-[#E7F5DC]/24 bg-[#D5E5E5]/38 p-3">
                    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-[#8A4300]">
                      <Lightbulb className="h-3.5 w-3.5" />
                      Best for
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-black/62">
                      {display.bestUseCases.join(', ')}
                    </p>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-2 text-xs font-semibold min-[390px]:grid-cols-2">
                    <span className="inline-flex items-center gap-1 rounded-lg border border-black/8 bg-[#D5E5E5]/35 px-2.5 py-2 text-black/62">
                      <Database className="h-3.5 w-3.5" />
                      Supabase
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-lg border border-[#F7CBCA]/16 bg-[#D5E5E5]/45 px-2.5 py-2 text-[#F7CBCA]">
                      <Workflow className="h-3.5 w-3.5" />
                      Guarded run
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {filteredAgents.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-[#F7CBCA]/20 bg-[#F1F7F7] p-5 text-center">
              <p className="font-black text-black">No agents match this search</p>
              <p className="mt-1 text-sm text-black/56">Clear the search or choose another department.</p>
            </div>
          ) : null}
        </Card>

        {selectedAgent && (
          <Card className="border-[#F7CBCA]/16 premium-surface">
            {(() => {
              const display = getAgentDisplayMetadata(selectedAgent);

              return (
            <div className="flex items-start gap-4">
              <AgentAvatar icon={selectedAgent.icon} color={selectedAgent.color} department={selectedAgent.department} size="lg" />
              <div className="min-w-0">
                <StatusBadge status={selectedAgent.status} type="agent" size="sm" />
                <h2 className="mt-3 text-2xl font-bold text-black">{selectedAgent.name}</h2>
                <p className="mt-1 text-sm font-black text-[#F7CBCA]">{display.alias}</p>
                <p className="mt-2 text-sm leading-6 text-black/62">{display.whenToUse}</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-black/8 bg-white/80 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.1em] text-black/42">Expected output</p>
                    <p className="mt-2 text-sm leading-6 text-black/62">{display.expectedOutput}</p>
                  </div>
                  <div className="rounded-lg border border-black/8 bg-white/80 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.1em] text-black/42">Task tip</p>
                    <p className="mt-2 text-sm leading-6 text-black/62">{display.taskTip}</p>
                  </div>
                </div>
              </div>
            </div>
              );
            })()}
          </Card>
        )}

        <Card>
          <CardHeader
            title="Task Brief"
            description="Give the agent enough context for the future automation layer."
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <Label htmlFor="title">
                Task Title <span className="text-[#F7CBCA]">*</span>
              </Label>
              <Input
                type="text"
                id="title"
                name="title"
                defaultValue={initialTitle}
                placeholder="Create a concise task title"
                required
                disabled={isPending}
              />
            </div>

            <div className="lg:col-span-2">
              <Label htmlFor="description">
                Description <span className="text-[#F7CBCA]">*</span>
              </Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={initialDescription}
                placeholder="Describe the objective, audience, deliverables, and constraints"
                rows={5}
                required
                disabled={isPending}
              />
            </div>

            <div className="relative">
              <Label htmlFor="priority">Priority Level</Label>
              <ChevronDown className="pointer-events-none absolute bottom-3 end-3.5 h-4 w-4 text-black/34" />
              <Select id="priority" name="priority" defaultValue="Normal" disabled={isPending}>
                <option value="Low">Low</option>
                <option value="Normal">Normal</option>
                <option value="High">High</option>
              </Select>
            </div>
          </div>
        </Card>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="submit" size="lg" disabled={isPending}>
            {isPending ? (
              <>
                <Clock className="h-5 w-5 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-5 w-5" />
                Create Task
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
