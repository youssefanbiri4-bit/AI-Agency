import {
  Activity,
  Bot,
  CheckCircle2,
  Clock3,
  FileStack,
  FolderKanban,
  Image as ImageIcon,
  Layers3,
  MessageSquareText,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ContainerScrollAnimation } from '@/components/ui/container-scroll-animation';

const statusCards = [
  { label: 'AI agents', value: '18', tone: 'text-[#F7CBCA]' },
  { label: 'Content drafts', value: '42', tone: 'text-white' },
  { label: 'Creative assets', value: '128', tone: 'text-[#F7CBCA]' },
  { label: 'Reviews ready', value: '9', tone: 'text-white' },
];

const taskRows = [
  {
    title: 'Caption variants for spring launch',
    meta: 'Content Studio',
    status: 'Ready',
  },
  {
    title: 'Creative brief for paid social reel',
    meta: 'Tasks',
    status: 'In review',
  },
  {
    title: 'Google campaign draft headlines',
    meta: 'Campaign drafts',
    status: 'Draft',
  },
];

const sectionPills = [
  { icon: Bot, label: '18 AI agents' },
  { icon: FileStack, label: 'Content Studio' },
  { icon: ImageIcon, label: 'Creative Assets' },
  { icon: FolderKanban, label: 'Campaign drafts' },
];

export function AgentFlowScrollShowcase() {
  return (
    <ContainerScrollAnimation
      titleComponent={
        <>
          <Badge tone="brand" className="mx-auto mb-5">
            <Sparkles className="h-3.5 w-3.5" />
            AgentFlow AI
          </Badge>
          <h2 className="text-3xl font-black tracking-normal text-black sm:text-4xl lg:text-5xl">
            Run your AI agency from one intelligent dashboard
          </h2>
          <p className="mt-4 text-base leading-7 text-black/62 sm:text-lg">
            Plan content, manage AI agents, organize creative assets, and prepare
            campaign drafts without messy workflows.
          </p>
        </>
      }
      containerClassName="border-y border-[#F7CBCA]/8 bg-white/30 backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]"
    >
      <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(202,40,81,0.22),transparent_28%),linear-gradient(180deg,#0A0713_0%,#0F0A19_48%,#120B18_100%)] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(255,103,102,0.18),transparent_22%),radial-gradient(circle_at_20%_100%,rgba(202,40,81,0.14),transparent_28%)]" />

        <div className="relative border-b border-white/10 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-[#F7CBCA]" />
                <div className="h-2.5 w-2.5 rounded-full bg-white/35" />
                <div className="h-2.5 w-2.5 rounded-full bg-white/20" />
              </div>
              <p className="mt-3 text-sm font-black tracking-[0.14em] text-white/72 uppercase">
                AgentFlow AI
              </p>
              <h3 className="mt-1 text-2xl font-black text-white sm:text-3xl">
                Intelligent operations layer
              </h3>
            </div>

            <div className="flex flex-wrap gap-2">
              {sectionPills.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-2 text-xs font-bold text-white/76 backdrop-blur"
                  >
                    <Icon className="h-3.5 w-3.5 text-[#D4B3F5]" />
                    {item.label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {statusCards.map((card) => (
                <article
                  key={card.label}
                  className="rounded-2xl border border-white/10 bg-white/6 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur"
                >
                  <p className={`text-3xl font-black ${card.tone}`}>{card.value}</p>
                  <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-white/48">
                    {card.label}
                  </p>
                </article>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <article className="rounded-[1.4rem] border border-white/10 bg-white/6 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">Content Studio</p>
                    <p className="mt-1 text-xs leading-5 text-white/50">
                      Draft generation and review-ready planning
                    </p>
                  </div>
                  <MessageSquareText className="h-5 w-5 text-[#D4B3F5]" />
                </div>

                <div className="mt-5 space-y-3">
                  {[
                    'AI-generated caption for product launch reel',
                    'Creative brief for carousel concept',
                    'Ad copy draft for search campaign',
                  ].map((line, index) => (
                    <div
                      key={line}
                      className="rounded-xl border border-white/8 bg-black/20 px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white/86">{line}</p>
                        <span className="rounded-full border border-[#F7CBCA]/30 bg-[#F7CBCA]/16 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#E0C5FA]">
                          v0{index + 1}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-[1.4rem] border border-white/10 bg-white/6 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">Tasks, reviews, and campaign drafts</p>
                    <p className="mt-1 text-xs leading-5 text-white/50">
                      Track execution status without leaving the workspace
                    </p>
                  </div>
                  <Layers3 className="h-5 w-5 text-[#F8A3B6]" />
                </div>

                <div className="mt-5 space-y-3">
                  {taskRows.map((row) => (
                    <div
                      key={row.title}
                      className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/20 px-3 py-3"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/8 text-[#D4B3F5]">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white/88">{row.title}</p>
                        <p className="mt-1 text-xs text-white/48">{row.meta}</p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/72">
                        {row.status}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </div>

          <div className="space-y-4">
            <article className="rounded-[1.4rem] border border-white/10 bg-white/6 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">Agent activity</p>
                  <p className="mt-1 text-xs leading-5 text-white/50">
                    Readiness, asset prep, and review signals
                  </p>
                </div>
                <Activity className="h-5 w-5 text-[#D4B3F5]" />
              </div>

              <div className="mt-5 space-y-4">
                {[
                  { label: 'Content & Growth', value: '6 agents active', width: '78%' },
                  { label: 'Creative pipeline', value: '31 assets linked', width: '66%' },
                  { label: 'Approval velocity', value: '9 reviews this week', width: '58%' },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-white/82">{item.label}</span>
                      <span className="text-xs text-white/48">{item.value}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white/8">
                      <div
                        className="h-2 rounded-full bg-[linear-gradient(90deg,#F7CBCA_0%,#F7CBCA_100%)]"
                        style={{ width: item.width }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[1.4rem] border border-white/10 bg-white/6 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">Status summary</p>
                  <p className="mt-1 text-xs leading-5 text-white/50">
                    Content planning, assets, and reviews in one view
                  </p>
                </div>
                <Clock3 className="h-5 w-5 text-[#F8A3B6]" />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  { label: 'Content Studio', value: 'Drafts syncing cleanly' },
                  { label: 'Creative Assets', value: 'Workspace-linked files ready' },
                  { label: 'Reviews', value: 'Approval flow visible' },
                  { label: 'Campaign drafts', value: 'Google and Pinterest guarded' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-white/8 bg-black/20 p-3"
                  >
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-white/46">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white/84">{item.value}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      </div>
    </ContainerScrollAnimation>
  );
}
