import Link from 'next/link';
import { AlertCircle, BarChart3, Bot, ClipboardList, FolderKanban, Gauge, Layers3, Settings, Sparkles } from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';

const safeRoutes = [
  ['Open Alex', '/dashboard/alex', Bot],
  ['Agent Library', '/dashboard/agent-library', Bot],
  ['Workflow Builder', '/dashboard/agent-library/workflows', Layers3],
  ['AI Studio', '/dashboard/ai-studio', Sparkles],
  ['Projects', '/dashboard/projects', FolderKanban],
  ['Tasks', '/dashboard/tasks', ClipboardList],
  ['Reports', '/dashboard/reports', BarChart3],
  ['Settings', '/dashboard/settings', Settings],
] as const;

export default function DashboardLoading() {
  return (
    <div className="-mx-4 -my-6 min-h-screen bg-[var(--theme-background,#F1F7F7)] px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-[1540px] space-y-6">
        <Notice tone="warning" title="Dashboard shell is available">
          Workspace navigation is ready. Data-heavy sections are isolated so a slow request cannot freeze the whole app.
        </Notice>

        <section className="rounded-2xl border border-black/7 bg-white/90 p-6 shadow-[0_24px_70px_rgba(93,107,107,0.08)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F1F7F7] text-[#F7CBCA]">
                <Gauge className="h-6 w-6" />
              </div>
              <h1 className="text-3xl font-black text-[#5D6B6B]">Agency Command Center</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-black/58">
                Preparing this route with safe fallbacks. You can keep navigating while widgets recover independently.
              </p>
            </div>
            <div className="rounded-2xl border border-black/7 bg-[#F1F7F7]/70 p-4 text-sm font-semibold text-black/60">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-[#F7CBCA]" />
                Protected from infinite loading
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {safeRoutes.map(([label, href, Icon]) => (
            <Link
              key={href}
              href={href}
              className={buttonStyles({ variant: 'outline', size: 'lg', className: 'w-full justify-start' })}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
