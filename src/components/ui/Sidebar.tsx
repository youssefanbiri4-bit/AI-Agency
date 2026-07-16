'use client';

import {
  BarChart3,
  Bell,
  BookMarked,
  BookOpen,
  Bot,
  CalendarDays,
  CreditCard,
  ClipboardCheck,
  ClipboardList,
  Database,
  DatabaseBackup,
  FileText,
  FolderKanban,
  Home,
  Image as ImageIcon,
  Layers3,
  Library,
  Megaphone,
  PenSquare,
  PlusCircle,
  Rocket,
  Settings,
  Sparkles,
  Users,
  Film,
  LifeBuoy,
  Gauge,
  LockKeyhole,
  SearchCode,
  SearchCheck,
  ShieldAlert,
  Wand2,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useDashboardContext } from '@/components/layout/DashboardContext';
import { BrandMark } from '@/components/brand/BrandMark';
import { StatusBadge } from './StatusBadge';
import { useLanguage } from '@/i18n/context';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const menuItems = [
  { icon: Home, labelKey: 'nav.dashboard', href: '/dashboard' },
  { icon: Bot, labelKey: 'nav.alexAssistant', href: '/dashboard/alex' },
  { icon: Users, labelKey: 'nav.agents', href: '/dashboard/agents' },
  { icon: FolderKanban, labelKey: 'nav.projects', href: '/dashboard/projects' },
  { icon: SearchCode, labelKey: 'nav.safePatchPlanner', href: '/dashboard/safe-patch-planner' },
  { icon: Sparkles, labelKey: 'nav.softwarePlanner', href: '/dashboard/software-planner' },
  { icon: Rocket, labelKey: 'nav.releases', href: '/dashboard/releases' },
  { icon: Library, labelKey: 'nav.agentLibrary', href: '/dashboard/agent-library' },
  { icon: Layers3, labelKey: 'nav.industryPacks', href: '/dashboard/industry-packs' },
  { icon: Workflow, labelKey: 'nav.automationBlueprints', href: '/dashboard/automation-blueprints' },
  { icon: SearchCheck, labelKey: 'nav.qualityReview', href: '/dashboard/quality-review' },
  { icon: Database, labelKey: 'nav.knowledgeBase', href: '/dashboard/knowledge-base' },
  { icon: Wand2, labelKey: 'nav.aiStudio', href: '/dashboard/ai-studio' },
  { icon: ClipboardList, labelKey: 'nav.promptLibrary', href: '/dashboard/prompt-library' },
  { icon: FileText, labelKey: 'nav.tasks', href: '/dashboard/tasks' },
  { icon: Megaphone, labelKey: 'nav.campaigns', href: '/dashboard/campaigns' },
  { icon: Film, labelKey: 'nav.reelsStudio', href: '/dashboard/reels' },
  { icon: PenSquare, labelKey: 'nav.contentAdsStudio', href: '/dashboard/content-studio' },
  { icon: BookOpen, labelKey: 'nav.contentLibrary', href: '/dashboard/content-library' },
  { icon: CalendarDays, labelKey: 'nav.calendar', href: '/dashboard/calendar' },
  { icon: LifeBuoy, labelKey: 'nav.recovery', href: '/dashboard/recovery' },
  { icon: Gauge, labelKey: 'nav.systemHealth', href: '/dashboard/system-health' },
  { icon: ShieldAlert, labelKey: 'nav.production', href: '/dashboard/production' },
  { icon: LockKeyhole, labelKey: 'nav.security', href: '/dashboard/security' },
  { icon: DatabaseBackup, labelKey: 'nav.backups', href: '/dashboard/backups' },
  { icon: BookMarked, labelKey: 'nav.docs', href: '/dashboard/docs' },
  { icon: ImageIcon, labelKey: 'nav.creativeAssets', href: '/dashboard/creative-assets' },
  { icon: ClipboardCheck, labelKey: 'nav.reviews', href: '/dashboard/review' },
  { icon: BarChart3, labelKey: 'nav.reports', href: '/dashboard/reports' },
  { icon: Gauge, labelKey: 'nav.insights', href: '/dashboard/insights' },
  { icon: CreditCard, labelKey: 'nav.billing', href: '/dashboard/billing' },
  { icon: Bell, labelKey: 'nav.notifications', href: '/dashboard/notifications' },
  { icon: Settings, labelKey: 'nav.settings', href: '/dashboard/settings' },
];

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { workspace } = useDashboardContext();
  const { t } = useLanguage();

  return (
    <aside
      className={cn(
        'fixed start-0 top-0 z-40 h-full w-72 transform border-e border-[#F7CBCA]/12 bg-[#F1F7F7]/82 shadow-[18px_0_45px_rgba(93,107,107,0.08)] backdrop-blur-xl [-webkit-backdrop-filter:blur(22px)] transition-transform duration-300 ease-in-out lg:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-black/8 px-5 py-5">
          <BrandMark
            href="/dashboard"
            tagline={t('nav.tagline')}
            customLogoUrl={workspace.branding?.logoUrl}
            customLogoAlt={workspace.branding?.logoAltText}
            onClick={onClose}
            className="w-full"
          />
        </div>

        <div className="px-4 py-4">
          <Link
            href="/dashboard/create-task"
            onClick={onClose}
            className="flex items-center justify-between rounded-lg border border-[#F7CBCA]/16 bg-white/72 px-3 py-3 text-sm font-bold text-[#F7CBCA] shadow-sm backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)] hover:border-[#F7CBCA]/35 hover:bg-[#D5E5E5]/55"
          >
            <span className="flex min-w-0 items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              <span>{t('nav.createTask')}</span>
            </span>
            <span className="rounded-md bg-white/55 px-2 py-1 text-xs text-[#F7CBCA] backdrop-blur-[8px]">{t('status.ready')}</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 pb-4">
          <p className="px-3 pb-2 pt-1 text-xs font-black uppercase tracking-[0.16em] text-black/42">
            {t('nav.workspace')}
          </p>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/dashboard'
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group relative flex min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold leading-5 transition-all focus:outline-none focus:ring-4 focus:ring-[#F7CBCA]/18',
                  isActive
                    ? 'bg-gradient-to-r from-[#F7CBCA] to-[#F7CBCA] text-white shadow-[0_12px_24px_rgba(202,40,81,0.22)]'
                    : 'text-[#5D6B6B]/78 hover:bg-white/72 hover:text-[#5D6B6B]'
                )}
                onClick={onClose}
              >
                <Icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-white' : 'text-[#5D6B6B]/55 group-hover:text-[#F7CBCA]')} />
                <span className="min-w-0 truncate">{t(item.labelKey)}</span>
                {isActive && (
                  <span className="ms-auto h-2 w-2 rounded-full bg-[#F7CBCA] shadow-[0_0_0_4px_rgba(255,103,102,0.2)]" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-black/8 p-4">
          <div className="rounded-lg border border-[#F7CBCA]/12 bg-white/70 p-4 shadow-sm backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/55 text-[#F7CBCA] shadow-sm backdrop-blur-[8px]">
                  <Layers3 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-black">{workspace.name}</p>
                  <p className="text-xs text-black/52">{t('nav.activeWorkspace')}</p>
                </div>
              </div>
            </div>
            <div className="mt-3">
              <StatusBadge status="Prepared" type="system" size="sm" />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
