import { CheckCircle2, ClipboardCheck, FileText, PlayCircle, Send, UserRoundCheck } from 'lucide-react';
import { SectionHeader } from './SectionHeader';

const workflowSteps = [
  {
    title: 'Create task',
    description: 'Capture the objective, priority, audience, and structured agent parameters.',
    icon: ClipboardCheck,
  },
  {
    title: 'Agent processes',
    description: 'Connect n8n later so approved tasks can route to the right specialist workflow.',
    icon: PlayCircle,
  },
  {
    title: 'Review result',
    description: 'Capture quality feedback after real completed outputs exist in the workspace.',
    icon: UserRoundCheck,
  },
  {
    title: 'Approve',
    description: 'Move client-ready work forward with status clarity and quality notes.',
    icon: CheckCircle2,
  },
  {
    title: 'Report generated',
    description: 'Generate reporting only after real task, review, and approval records are stored.',
    icon: FileText,
  },
];

export function WorkflowSection() {
  return (
    <section id="workflow" className="border-y border-black/8 bg-white py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Workflow"
          title="A clean operating model for AI-powered delivery"
          description="The product is prepared around a simple client-safe workflow: request, process, review, approve, and report."
        />

        <div className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-5">
          {workflowSteps.map((step, index) => {
            const Icon = step.icon;

            return (
              <article
                key={step.title}
                className="relative rounded-lg border border-black/8 bg-[#F0DBEF]/35 p-5 shadow-sm"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-[#8B3CDE] shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-black text-black/22">0{index + 1}</span>
                </div>
                <h3 className="font-bold text-black">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-black/62">{step.description}</p>
              </article>
            );
          })}
        </div>

        <div className="mt-10 rounded-lg border border-[#F55477]/18 bg-[#F0DBEF]/48 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="font-bold text-black">Future workflow integrations stay server-side</h3>
              <p className="mt-2 text-sm leading-6 text-black/62">
                n8n can be connected later through protected API routes without exposing workflow secrets in the browser.
              </p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white text-[#F55477] shadow-sm">
              <Send className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
