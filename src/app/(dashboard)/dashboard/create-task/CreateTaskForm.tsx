'use client';

import { useActionState, useMemo, useState } from 'react';
import { ChevronDown, Clock, Database, Plus, Workflow } from 'lucide-react';
import { createTaskAction, type CreateTaskState } from './actions';
import type { Agent, AgentType } from '@/types';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input, Label, Select, Textarea } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface CreateTaskFormProps {
  agents: Agent[];
  initialAgentId?: AgentType | null;
  initialTitle?: string;
  initialDescription?: string;
}

const initialState: CreateTaskState = {
  error: null,
};

export function CreateTaskForm({
  agents,
  initialAgentId = null,
  initialTitle = '',
  initialDescription = '',
}: CreateTaskFormProps) {
  const [state, formAction, isPending] = useActionState(createTaskAction, initialState);
  const [selectedAgentId, setSelectedAgentId] = useState<AgentType | ''>(initialAgentId ?? '');
  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [agents, selectedAgentId]
  );

  return (
    <div className="space-y-8">
      <Card className="border-[#8B3CDE]/16 bg-[#F0DBEF]/50">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#8B3CDE] shadow-sm">
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
            description="Select one configured Supabase agent for this task."
          />

          <div className="relative">
            <Label htmlFor="agentType">
              Agent <span className="text-[#F55477]">*</span>
            </Label>
            <ChevronDown className="pointer-events-none absolute bottom-3 right-3.5 h-4 w-4 text-black/34" />
            <Select
              id="agentType"
              name="agentType"
              value={selectedAgentId}
              onChange={(event) => setSelectedAgentId(event.target.value as AgentType | '')}
              disabled={isPending}
              required
            >
              <option value="">Select an agent</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((agent) => {
              const isSelected = agent.id === selectedAgentId;

              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setSelectedAgentId(agent.id)}
                  disabled={isPending}
                  aria-pressed={isSelected}
                  className={`group min-w-0 rounded-lg border p-5 text-left shadow-[0_18px_48px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-0.5 hover:border-[#8B3CDE]/24 hover:shadow-[0_20px_52px_rgba(139,60,222,0.11)] disabled:cursor-not-allowed disabled:opacity-60 ${
                    isSelected ? 'border-[#8B3CDE]/40 bg-[#F0DBEF]/60' : 'border-black/8 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <AgentAvatar icon={agent.icon} color={agent.color} department={agent.department} />
                      <div className="min-w-0">
                        <h3 className="font-bold text-black group-hover:text-[#8B3CDE]">{agent.name}</h3>
                        <p className="mt-1 text-sm text-black/52">{agent.department}</p>
                      </div>
                    </div>
                    <StatusBadge status={agent.status} size="sm" />
                  </div>
                  <p className="mt-4 line-clamp-2 text-sm leading-6 text-black/62">{agent.description}</p>
                  <div className="mt-4 grid grid-cols-1 gap-2 text-xs font-semibold min-[390px]:grid-cols-2">
                    <span className="inline-flex items-center gap-1 rounded-lg border border-black/8 bg-[#F0DBEF]/35 px-2.5 py-2 text-black/62">
                      <Database className="h-3.5 w-3.5" />
                      Supabase
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-lg border border-[#F55477]/16 bg-[#F0DBEF]/45 px-2.5 py-2 text-[#F55477]">
                      <Workflow className="h-3.5 w-3.5" />
                      Guarded run
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {selectedAgent && (
          <Card className="border-[#8B3CDE]/16 premium-surface">
            <div className="flex items-start gap-4">
              <AgentAvatar icon={selectedAgent.icon} color={selectedAgent.color} department={selectedAgent.department} size="lg" />
              <div>
                <StatusBadge status={selectedAgent.status} type="agent" size="sm" />
                <h2 className="mt-3 text-2xl font-bold text-black">{selectedAgent.name}</h2>
                <p className="mt-1 text-sm text-black/62">{selectedAgent.department}</p>
              </div>
            </div>
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
                Task Title <span className="text-[#F55477]">*</span>
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
                Description <span className="text-[#F55477]">*</span>
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
              <ChevronDown className="pointer-events-none absolute bottom-3 right-3.5 h-4 w-4 text-black/34" />
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
