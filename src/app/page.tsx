import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  Layers3,
  LineChart,
  LockKeyhole,
  MonitorCheck,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { buttonStyles } from '@/components/ui/Button';
import { DashboardPreview } from '@/components/marketing/DashboardPreview';
import { FeatureCard } from '@/components/marketing/FeatureCard';
import { MarketingAgentCard } from '@/components/marketing/MarketingAgentCard';
import { MarketingDepartmentCard } from '@/components/marketing/MarketingDepartmentCard';
import { MarketingNavbar } from '@/components/marketing/MarketingNavbar';
import { HeroExperiment } from '@/components/marketing/HeroExperiment';
import { AgentFlowScrollShowcase } from '@/components/marketing/AgentFlowScrollShowcase';
import { SectionHeader } from '@/components/marketing/SectionHeader';
import { WorkflowSection } from '@/components/marketing/WorkflowSection';
import { agentCatalog } from '@/data/agents';
import { DEPARTMENTS } from '@/lib/agents';
import { generatePageMetadata } from '@/lib/seo/metadata';
import { getExperimentVariant } from '@/lib/marketing/experiments';

const features = [
  {
    icon: Users,
    title: 'Configured agent catalog',
    description: 'Coordinate research, growth, sales, support, and reporting specialists from one clean workspace.',
  },
  {
    icon: ClipboardCheck,
    title: 'Structured task intake',
    description: 'Create clear briefs with priority, department context, agent parameters, and review-ready work records.',
  },
  {
    icon: MonitorCheck,
    title: 'Readiness controls',
    description: 'See what is ready, what is guarded, and what still needs production configuration.',
  },
  {
    icon: LineChart,
    title: 'Reporting foundation',
    description: 'Prepare reporting views that populate only after real task and review data exists.',
  },
];

const trustItems = [
  {
    icon: ClipboardCheck,
    title: 'Task management',
    description: 'Plan and organize client-ready agent work with consistent status and priority metadata.',
  },
  {
    icon: Activity,
    title: 'Agent readiness',
    description: 'Review the configured catalog without inventing live operational status.',
  },
  {
    icon: CheckCircle2,
    title: 'Review system',
    description: 'Evaluate completed outputs and collect feedback before work moves forward.',
  },
  {
    icon: BarChart3,
    title: 'Reports',
    description: 'Use honest empty states until real task, review, and reporting data is stored.',
  },
  {
    icon: ShieldCheck,
    title: 'Supabase workspace setup',
    description: 'Authenticated workspace persistence is prepared without exposing private keys in the browser.',
  },
  {
    icon: Workflow,
    title: 'Future n8n workflow integration',
    description: 'Workflow execution can be connected later through protected server-side routes.',
  },
];

export const metadata: Metadata = generatePageMetadata({
  title: 'AI Agency Operations Platform',
  description:
    'Run AI agency work from one disciplined workspace. Manage autonomous agents, tasks, reviews, and workflows with a professional operations dashboard.',
  path: '/',
});

const ORG_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'AgentFlow AI',
  url: (process.env.NEXT_PUBLIC_APP_URL || 'https://agentflow-ai.vercel.app'),
  description:
    'AI Agency Operations Platform for managing autonomous agents, tasks, reviews, and workflows.',
};

export default async function Home() {
  const cookieStore = await cookies();
  const existing = cookieStore.get('af_ab_landing-hero')?.value;
  const seed = existing || crypto.randomUUID();
  const { variant } = getExperimentVariant('landing-hero', existing, seed);
  const anonymousId = cookieStore.get('af_anon_id')?.value || crypto.randomUUID();

  return (
    <div className="dashboard-background premium-page min-h-screen w-full text-black">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSON_LD) }}
      />
      <MarketingNavbar />

      <main className="w-full">
        <section className="relative border-b border-black/8">
          <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center lg:gap-12 lg:px-8 lg:py-28">
            <div className="section-fade min-w-0 max-w-3xl">
              <Badge tone="brand" className="mb-6">
                <Sparkles className="h-3.5 w-3.5" />
                AgentFlow AI operations platform
              </Badge>
              <div className="max-w-full">
                <HeroExperiment experimentId="landing-hero" variant={variant} anonymousId={anonymousId} />
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/auth/signup" className={buttonStyles({ size: 'lg', className: 'h-12 w-full px-6 sm:w-auto' })}>
                  Get Started
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  href="/dashboard"
                  className={buttonStyles({ variant: 'secondary', size: 'lg', className: 'h-12 w-full px-6 sm:w-auto' })}
                >
                  View Dashboard
                </Link>
              </div>

              <div className="mt-10 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { label: 'Agents', value: '27' },
                  { label: 'Departments', value: '4' },
                  { label: 'Metrics', value: 'Awaiting tasks' },
                ].map((item) => (
                  <div key={item.label} className="min-w-0 rounded-lg border border-[#F7CBCA]/10 bg-white/58 p-4 shadow-sm backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]">
                    <p className="text-2xl font-black text-black">{item.value}</p>
                    <p className="mt-1 text-xs font-black uppercase leading-5 tracking-[0.12em] text-black/46">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="section-fade min-w-0">
              <DashboardPreview agents={agentCatalog} />
            </div>
          </div>
        </section>

        <section id="features" className="py-24 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <SectionHeader
              eyebrow="Features"
              title="The operational layer for client-ready agent work"
              description="A polished SaaS workspace for agent coordination, task intake, quality review, and integration readiness."
            />

            <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <FeatureCard key={feature.title} {...feature} />
              ))}
            </div>
          </div>
        </section>

        <AgentFlowScrollShowcase />

        <section id="agents" className="border-y border-[#F7CBCA]/8 bg-white/30 py-24 backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)] sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <SectionHeader
              eyebrow="Agent catalog"
              title="27 specialized agents across agency and engineering workflows"
              description="A focused preview of the configured catalog. The dashboard keeps the full roster available for real workspace tasks."
            />

            <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {agentCatalog.slice(0, 6).map((agent) => (
                <MarketingAgentCard key={agent.id} agent={agent} />
              ))}
            </div>
            <div className="mt-8 flex justify-center">
              <Link href="/dashboard/agents" className={buttonStyles({ variant: 'outline', size: 'lg' })}>
                View all agents
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </section>

        <section className="py-24 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <SectionHeader
              eyebrow="Departments"
              title="Three departments built for agency delivery"
              description="Research strategy, content growth, and sales operations stay clearly separated while still rolling up into one dashboard."
            />

            <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
              {DEPARTMENTS.map((department) => (
                <MarketingDepartmentCard
                  key={department.id}
                  department={department}
                  agents={agentCatalog}
                />
              ))}
            </div>
          </div>
        </section>

        <WorkflowSection />

        <section className="py-24 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
              <SectionHeader
                align="left"
                eyebrow="Built for AI-powered teams"
                title="A trusted workspace for teams turning AI agents into repeatable operations"
                description="The product surface is designed for professional agency delivery: clean handoffs, review checkpoints, and integration boundaries that only show real metrics after data exists."
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {trustItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <article key={item.title} className="card-lift min-w-0 rounded-lg border border-[#F7CBCA]/10 bg-white/70 p-5 shadow-[0_18px_42px_rgba(93,107,107,0.06)] backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)] hover:border-[#F7CBCA]/24">
                      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[#D5E5E5]/62 text-[#F7CBCA]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="font-bold text-black">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-black/62">{item.description}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#F7CBCA]/8 bg-white/30 py-24 backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)] sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
              <div>
                  <Badge tone="accent" className="mb-5">
                  <Layers3 className="h-3.5 w-3.5" />
                  Dashboard preview
                </Badge>
                <h2 className="text-3xl font-black tracking-normal text-black sm:text-4xl">
                  A real product surface, not a collection of raw components
                </h2>
                <p className="mt-4 text-base leading-7 text-black/62 sm:text-lg">
                  The dashboard preview shows the core operating model with configured agents, practical empty states, and clear Supabase/n8n readiness.
                </p>
                <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    { icon: BarChart3, label: 'Department reporting' },
                    { icon: FileSearch, label: 'Agent task visibility' },
                    { icon: LockKeyhole, label: 'Server-side integration posture' },
                    { icon: CheckCircle2, label: 'Review-ready outcomes' },
                  ].map((item) => {
                    const Icon = item.icon;

                    return (
                      <div key={item.label} className="flex min-w-0 items-center gap-3 rounded-lg border border-black/8 bg-[#D5E5E5]/35 p-3 text-sm font-bold text-black/68">
                        <Icon className="h-4 w-4 text-[#F7CBCA]" />
                        <span className="min-w-0">{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <DashboardPreview agents={agentCatalog.slice(6)} />
            </div>
          </div>
        </section>

        {/* Pricing is internal platform only — no commercial tiers */}

        <section className="px-5 pb-24 sm:px-6 sm:pb-28 lg:px-8">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-lg border border-[#F7CBCA]/12 bg-[#5D6B6B]/72 p-8 text-white shadow-[0_30px_80px_rgba(93,107,107,0.18)] backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)] sm:p-10 lg:p-12">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <h2 className="break-words text-3xl font-black tracking-normal sm:text-4xl">
                  Build a client-ready AI agency workspace today.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-white/68">
                  Start with a polished dashboard, real agent catalog, structured task flow, and a clean path toward future data and automation integrations.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/auth/signup" className={buttonStyles({ variant: 'secondary', size: 'lg', className: 'h-12 w-full px-6 sm:w-auto' })}>
                  Get Started
                </Link>
                <Link href="/dashboard" className={buttonStyles({ variant: 'ghost', size: 'lg', className: 'h-12 w-full border-white/20 bg-white/10 px-6 text-white hover:bg-white/15 hover:text-white sm:w-auto' })}>
                  View Dashboard
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
