import type { Metadata } from 'next';
import Link from 'next/link';
import { generatePageMetadata } from '@/lib/seo/metadata';
import {
  ArrowRight,
  Bell,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
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
import { MarketingNavbar } from '@/components/marketing/MarketingNavbar';
import { SectionHeader } from '@/components/marketing/SectionHeader';
import { FeatureCard } from '@/components/marketing/FeatureCard';

const coreFeatures = [
  {
    icon: Bot,
    title: 'AI Agent Catalog',
    description: '27 specialized agents across research, content, sales, and engineering workflows. Configure, assign, and review output from one workspace.',
  },
  {
    icon: ClipboardCheck,
    title: 'Structured Task Intake',
    description: 'Create clear briefs with priority, department context, agent parameters, and review-ready work records — no more scattered instructions.',
  },
  {
    icon: MonitorCheck,
    title: 'Readiness Controls',
    description: 'See what is ready, what is guarded, and what still needs production configuration. No fake status indicators.',
  },
  {
    icon: LineChart,
    title: 'Reporting Foundation',
    description: 'Prepare reporting views that populate only after real task and review data exists. Honest empty states until you have data.',
  },
  {
    icon: Workflow,
    title: 'Workflow Automation',
    description: 'Connect n8n workflows for automated task execution, content publishing, and campaign operations through protected server-side routes.',
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    description: 'Multi-workspace support with RBAC. Assign roles, control access by department, and keep client work isolated.',
  },
];

const departmentFeatures = [
  {
    name: 'Research & Strategy',
    color: '#8B5CF6',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    items: [
      'Market research & competitor analysis',
      'SEO content cluster planning',
      'Marketing strategy development',
      'Brand positioning & messaging',
      'Audience insights & targeting',
    ],
  },
  {
    name: 'Content & Growth',
    color: '#F59E0B',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    items: [
      'Content & Ads Studio',
      'AI image & video generation',
      'Reels planning & management',
      'Social media content calendar',
      'Content library & scheduling',
    ],
  },
  {
    name: 'Sales & Operations',
    color: '#10B981',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    items: [
      'Campaign management & tracking',
      'Lead scoring & follow-up automation',
      'Client onboarding workflows',
      'Quality review & approval gates',
      'Usage tracking & cost awareness',
    ],
  },
];

const integrations = [
  { name: 'OpenAI', description: 'GPT-5.5 text, DALL-E images, and video generation.', color: '#10A37F' },
  { name: 'Supabase', description: 'PostgreSQL database with Row-Level Security and real-time subscriptions.', color: '#3ECF8E' },
  { name: 'n8n', description: 'Workflow automation for task execution, publishing, and campaign operations.', color: '#EA4C89' },
  { name: 'Meta Ads', description: 'Facebook and Instagram ad management with OAuth-based authentication.', color: '#1877F2' },
  { name: 'Google Ads', description: 'Campaign management with developer token approval and customer ID linking.', color: '#4285F4' },
  { name: 'Pinterest', description: 'Pin creation and board management through OAuth integration.', color: '#E60023' },
  { name: 'Resend', description: 'Transactional email delivery for alerts and onboarding sequences.', color: '#FF6900' },
  { name: 'Sentry', description: 'Error tracking, performance monitoring, and source map uploads.', color: '#362D59' },
];

export const metadata: Metadata = generatePageMetadata({
  title: 'Features — AI Agent Catalog, Task Management & Workflow Automation',
  description:
    'Explore AgentFlow AI features: 27 specialized AI agents, structured task intake, workflow automation, department management, team collaboration, and secure integrations with OpenAI, Supabase, n8n, Meta Ads, and more.',
  path: '/features',
});

export default function FeaturesPage() {
  return (
    <div className="dashboard-background premium-page min-h-screen w-full text-black">
      <MarketingNavbar />

      <main className="w-full">
        {/* Hero */}
        <section className="relative border-b border-black/8 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#F1F7F7] via-white to-[#F7CBCA]/5" />
          <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <Badge tone="brand" className="mb-5">
                <Sparkles className="h-3.5 w-3.5" />
                Everything you need
              </Badge>
              <h1 className="text-4xl font-black tracking-normal text-black sm:text-5xl lg:text-6xl">
                A complete AI agency operations platform
              </h1>
              <p className="mt-4 text-base leading-7 text-black/62 sm:text-lg sm:leading-8">
                From agent orchestration to content publishing — AgentFlow AI brings every tool your team needs into one disciplined workspace.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link href="/auth/signup" className={buttonStyles({ size: 'lg', className: 'h-12 px-6' })}>
                  Get Started Free
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link href="/pricing" className={buttonStyles({ variant: 'outline', size: 'lg', className: 'h-12 px-6' })}>
                  View Pricing
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Core Features */}
        <section className="py-24 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <SectionHeader
              eyebrow="Core platform"
              title="Built for real AI agency delivery"
              description="Every feature is designed to support the full lifecycle of AI-powered work — from brief to review to delivery."
            />
            <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {coreFeatures.map((feature) => (
                <FeatureCard key={feature.title} {...feature} />
              ))}
            </div>
          </div>
        </section>

        {/* Department Features */}
        <section className="border-y border-black/8 bg-white/30 py-24 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <SectionHeader
              eyebrow="Department workflows"
              title="Three departments, one command center"
              description="Research strategy, content growth, and sales operations stay clearly separated while rolling up into one dashboard."
            />

            <div className="mt-14 grid gap-6 lg:grid-cols-3">
              {departmentFeatures.map((dept) => (
                <div
                  key={dept.name}
                  className={`rounded-2xl border ${dept.border} ${dept.bg} p-6 sm:p-8`}
                >
                  <h3 className="text-lg font-black" style={{ color: dept.color }}>
                    {dept.name}
                  </h3>
                  <ul className="mt-5 space-y-3">
                    {dept.items.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                        <span className="text-sm text-black/72">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Integrations */}
        <section className="py-24 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <SectionHeader
              eyebrow="Integrations"
              title="Connect the tools you already use"
              description="Server-side integrations with industry-leading platforms — safe, auditable, and protected."
            />

            <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {integrations.map((integration) => (
                <div
                  key={integration.name}
                  className="card-lift flex items-start gap-4 rounded-xl border border-black/8 bg-white/70 p-5 backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)] hover:border-black/16"
                >
                  <div
                    className="mt-0.5 h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: integration.color }}
                  />
                  <div className="min-w-0">
                    <h3 className="font-bold text-black">{integration.name}</h3>
                    <p className="mt-1 text-xs leading-5 text-black/54">{integration.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Security & Trust */}
        <section className="border-y border-black/8 bg-[#5D6B6B]/5 py-24 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <Badge tone="accent" className="mb-5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Security & Trust
                </Badge>
                <h2 className="text-3xl font-black tracking-normal text-black sm:text-4xl">
                  Built with security at every layer
                </h2>
                <p className="mt-4 text-base leading-7 text-black/62 sm:text-lg">
                  Your workspace data is protected by Supabase Row-Level Security, encrypted provider tokens, and server-side-only integration patterns.
                </p>
              </div>

              <div className="grid gap-4">
                {[
                  { icon: LockKeyhole, title: 'Row-Level Security', description: 'Every database query is scoped to your workspace and role.' },
                  { icon: ShieldCheck, title: 'Encrypted Tokens', description: 'OAuth tokens and API keys are encrypted at rest and never exposed to the browser.' },
                  { icon: FileSearch, title: 'Audit Logging', description: 'Security-sensitive events are logged for review and compliance.' },
                  { icon: Bell, title: 'Alerting', description: 'Real-time alerts for errors, quota usage, and security events via email and Slack.' },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="flex items-start gap-4 rounded-xl border border-black/8 bg-white/70 p-5 backdrop-blur-[14px]">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#D5E5E5]/62 text-[#F7CBCA]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-black">{item.title}</h3>
                        <p className="mt-1 text-sm leading-5 text-black/54">{item.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-5 pb-24 sm:px-6 sm:pb-28 lg:px-8">
          <div className="mx-auto mt-24 max-w-7xl overflow-hidden rounded-lg border border-[#F7CBCA]/12 bg-[#5D6B6B]/72 p-8 text-white shadow-[0_30px_80px_rgba(93,107,107,0.18)] sm:p-10 lg:p-12">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <h2 className="text-3xl font-black tracking-normal sm:text-4xl">
                  Ready to see it in action?
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-white/68">
                  Create your workspace in seconds — no credit card required.
                </p>
              </div>
              <Link href="/auth/signup" className={buttonStyles({ variant: 'secondary', size: 'lg', className: 'h-12 px-6' })}>
                Get Started Free
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
