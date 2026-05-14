import { CheckCircle2, Clock, Database, FileText, Users, Workflow } from 'lucide-react';
import type { Agent } from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DEPARTMENTS } from '@/lib/agents';
import { getAgentBrandColor } from '@/lib/brand';

interface DashboardPreviewProps {
  agents: Agent[];
}

export function DashboardPreview({ agents }: DashboardPreviewProps) {
  const featuredAgents = agents.slice(0, 4);

  return (
    <div className="relative w-full min-w-0 max-w-full">
      <div className="w-full max-w-full rounded-[1.35rem] border border-[#F7CBCA]/10 bg-white/58 p-3 shadow-[0_30px_80px_rgba(93,107,107,0.12)] backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]">
        <div className="w-full max-w-full overflow-hidden rounded-lg border border-[#F7CBCA]/10 bg-[#D5E5E5]/24 backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]">
          <div className="flex items-start justify-between gap-3 border-b border-[#F7CBCA]/10 bg-white/52 px-4 py-3 backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-black">Agency Command Center</p>
              <p className="text-xs leading-5 text-black/52">Configured catalog with workspace-scoped data</p>
            </div>
            <StatusBadge status="Setup Required" type="system" size="sm" />
          </div>

          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
            {[
              {
                label: 'Agent catalog',
                value: agents.length,
                icon: Users,
                color: 'text-[#F7CBCA]',
                bg: 'bg-[#D5E5E5]',
              },
              {
                label: 'Departments',
                value: DEPARTMENTS.length,
                icon: Database,
                color: 'text-[#F7CBCA]',
                bg: 'bg-[#D5E5E5]',
              },
              {
                label: 'Workspace data',
                value: 'Task-ready',
                icon: FileText,
                color: 'text-[#F7CBCA]',
                bg: 'bg-[#D5E5E5]',
              },
            ].map((stat) => {
              const Icon = stat.icon;

              return (
                <div key={stat.label} className="rounded-lg border border-[#F7CBCA]/10 bg-white/70 p-3 shadow-sm backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]">
                  <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${stat.bg} ${stat.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-2xl font-black text-black">{stat.value}</p>
                  <p className="text-xs font-semibold text-black/52">{stat.label}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 px-4 pb-4 lg:grid-cols-[0.85fr_1fr]">
            <div className="min-w-0 rounded-lg border border-[#F7CBCA]/10 bg-white/70 p-4 shadow-sm backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-bold text-black">Agent Readiness</p>
                <Clock className="h-4 w-4 text-black/34" />
              </div>
              <div className="space-y-3">
                {featuredAgents.map((agent) => {
                  const brandColor = getAgentBrandColor({
                    color: agent.color,
                    department: agent.department,
                  });

                  return (
                    <div key={agent.id} className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-black"
                        style={{ backgroundColor: `${brandColor}18`, color: brandColor }}
                      >
                        {agent.name
                          .split(' ')
                          .slice(0, 2)
                          .map((word) => word.charAt(0))
                          .join('')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-black">{agent.name}</p>
                        <p className="text-xs text-black/52">Workflow execution guarded</p>
                      </div>
                      <span className="h-2 w-2 shrink-0 rounded-full bg-[#F7CBCA]" />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="min-w-0 rounded-lg border border-[#F7CBCA]/10 bg-white/70 p-4 shadow-sm backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-bold text-black">Task Records</p>
                <FileText className="h-4 w-4 text-black/34" />
              </div>
              <div className="rounded-lg border border-dashed border-[#F7CBCA]/22 bg-[#D5E5E5]/35 p-4 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#F7CBCA] shadow-sm">
                  <Database className="h-5 w-5" />
                </div>
                <p className="text-sm font-bold text-black">Ready for first task</p>
                <p className="mt-1 text-xs leading-5 text-black/52">
                  Create a workspace task to populate this panel.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-[#F7CBCA]/10 bg-white/52 px-4 py-3 backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold leading-5 text-black/52">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#F7CBCA]" />
              Supabase-ready workspace with guarded n8n execution
              <Workflow className="h-4 w-4 shrink-0 text-[#F7CBCA]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
