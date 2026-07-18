'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Globe, Menu, Search, Settings, X } from 'lucide-react';
import { buttonStyles } from './Button';
import { ThemeToggle } from '@/features/theme/ThemeToggle';
import { useDashboardContext } from '@/components/layout/DashboardContext';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import type { NotificationRecord } from '@/types/database';
import { useLanguage } from '@/i18n/context';
import { LANGUAGES } from '@/i18n/index';
import type { LanguageCode } from '@/i18n/index';

interface TopbarProps {
  onMenuClick?: () => void;
  isMobileMenuOpen?: boolean;
  initialNotifications?: NotificationRecord[];
  initialUnreadCount?: number;
}

const pageTitleMap: Record<string, { titleKey: string; descriptionKey: string }> = {
  '/dashboard': { titleKey: 'topbar.pageTitles.dashboard.title', descriptionKey: 'topbar.pageTitles.dashboard.description' },
  '/dashboard/agents': { titleKey: 'topbar.pageTitles.agents.title', descriptionKey: 'topbar.pageTitles.agents.description' },
  '/dashboard/projects': { titleKey: 'topbar.pageTitles.projects.title', descriptionKey: 'topbar.pageTitles.projects.description' },
  '/dashboard/releases': { titleKey: 'topbar.pageTitles.releases.title', descriptionKey: 'topbar.pageTitles.releases.description' },
  '/dashboard/agent-library': { titleKey: 'topbar.pageTitles.agentLibrary.title', descriptionKey: 'topbar.pageTitles.agentLibrary.description' },
  '/dashboard/agent-builder': { titleKey: 'topbar.pageTitles.agentBuilder.title', descriptionKey: 'topbar.pageTitles.agentBuilder.description' },
  '/dashboard/agent-builder/gallery': { titleKey: 'topbar.pageTitles.marketplace.title', descriptionKey: 'topbar.pageTitles.marketplace.description' },
  '/dashboard/automation-blueprints': { titleKey: 'topbar.pageTitles.automationBlueprints.title', descriptionKey: 'topbar.pageTitles.automationBlueprints.description' },
  '/dashboard/quality-review': { titleKey: 'topbar.pageTitles.qualityReview.title', descriptionKey: 'topbar.pageTitles.qualityReview.description' },
  '/dashboard/knowledge-base': { titleKey: 'topbar.pageTitles.knowledgeBase.title', descriptionKey: 'topbar.pageTitles.knowledgeBase.description' },
  '/dashboard/agent-library/workflows': { titleKey: 'topbar.pageTitles.workflowBuilder.title', descriptionKey: 'topbar.pageTitles.workflowBuilder.description' },
  '/dashboard/agent-library/playbooks': { titleKey: 'topbar.pageTitles.playbooks.title', descriptionKey: 'topbar.pageTitles.playbooks.description' },
  '/dashboard/ai-studio': { titleKey: 'topbar.pageTitles.aiStudio.title', descriptionKey: 'topbar.pageTitles.aiStudio.description' },
  '/dashboard/alex': { titleKey: 'topbar.pageTitles.alex.title', descriptionKey: 'topbar.pageTitles.alex.description' },
  '/dashboard/prompt-library': { titleKey: 'topbar.pageTitles.promptLibrary.title', descriptionKey: 'topbar.pageTitles.promptLibrary.description' },
  '/dashboard/tasks': { titleKey: 'topbar.pageTitles.tasks.title', descriptionKey: 'topbar.pageTitles.tasks.description' },
  '/dashboard/create-task': { titleKey: 'topbar.pageTitles.createTask.title', descriptionKey: 'topbar.pageTitles.createTask.description' },
  '/dashboard/campaigns': { titleKey: 'topbar.pageTitles.campaigns.title', descriptionKey: 'topbar.pageTitles.campaigns.description' },
  '/dashboard/reels': { titleKey: 'topbar.pageTitles.reels.title', descriptionKey: 'topbar.pageTitles.reels.description' },
  '/dashboard/creative-assets': { titleKey: 'topbar.pageTitles.creativeAssets.title', descriptionKey: 'topbar.pageTitles.creativeAssets.description' },
  '/dashboard/content-studio': { titleKey: 'topbar.pageTitles.contentStudio.title', descriptionKey: 'topbar.pageTitles.contentStudio.description' },
  '/dashboard/content-library': { titleKey: 'topbar.pageTitles.contentLibrary.title', descriptionKey: 'topbar.pageTitles.contentLibrary.description' },
  '/dashboard/calendar': { titleKey: 'topbar.pageTitles.calendar.title', descriptionKey: 'topbar.pageTitles.calendar.description' },
  '/dashboard/recovery': { titleKey: 'topbar.pageTitles.recovery.title', descriptionKey: 'topbar.pageTitles.recovery.description' },
  '/dashboard/review': { titleKey: 'topbar.pageTitles.review.title', descriptionKey: 'topbar.pageTitles.review.description' },
  '/dashboard/reports': { titleKey: 'topbar.pageTitles.reports.title', descriptionKey: 'topbar.pageTitles.reports.description' },
  '/dashboard/notifications': { titleKey: 'topbar.pageTitles.notifications.title', descriptionKey: 'topbar.pageTitles.notifications.description' },
  '/dashboard/settings': { titleKey: 'topbar.pageTitles.settings.title', descriptionKey: 'topbar.pageTitles.settings.description' },
};

export function Topbar({
  onMenuClick,
  isMobileMenuOpen,
  initialNotifications,
  initialUnreadCount,
}: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const { user, workspace } = useDashboardContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const profileLabel = user.fullName || user.email || t('topbar.signedInUser');

  const pageMetaKey = (() => {
    if (pathname.startsWith('/dashboard/agents/')) return { titleKey: 'topbar.pageTitles.agentDetails.title', descriptionKey: 'topbar.pageTitles.agentDetails.description' };
    if (pathname.startsWith('/dashboard/tasks/')) return { titleKey: 'topbar.pageTitles.taskDetails.title', descriptionKey: 'topbar.pageTitles.taskDetails.description' };
    if (pathname.startsWith('/dashboard/projects/')) return { titleKey: 'topbar.pageTitles.projectDetails.title', descriptionKey: 'topbar.pageTitles.projectDetails.description' };
    if (pathname.startsWith('/dashboard/releases/')) return { titleKey: 'topbar.pageTitles.releaseDetails.title', descriptionKey: 'topbar.pageTitles.releaseDetails.description' };
    if (pathname.startsWith('/dashboard/prompt-library/')) return { titleKey: 'topbar.pageTitles.promptDetails.title', descriptionKey: 'topbar.pageTitles.promptDetails.description' };
    if (pathname.startsWith('/dashboard/agent-builder/shared/')) return { titleKey: 'topbar.pageTitles.sharedTemplate.title', descriptionKey: 'topbar.pageTitles.sharedTemplate.description' };
    if (pathname.startsWith('/dashboard/reels/')) return { titleKey: 'topbar.pageTitles.reelDetails.title', descriptionKey: 'topbar.pageTitles.reelDetails.description' };
    if (pathname.startsWith('/dashboard/creative-assets/')) return { titleKey: 'topbar.pageTitles.creativeAssetDetails.title', descriptionKey: 'topbar.pageTitles.creativeAssetDetails.description' };
    return pageTitleMap[pathname] ?? pageTitleMap['/dashboard'];
  })();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    }
    if (langOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [langOpen]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    const normalizedQuery = query.toLowerCase();
    const encodedQuery = encodeURIComponent(query);

    if (normalizedQuery.includes('setting') || normalizedQuery.includes('integration')) {
      router.push('/dashboard/settings');
      return;
    }
    if (normalizedQuery.includes('report')) {
      router.push('/dashboard/reports');
      return;
    }
    if (
      normalizedQuery.includes('campaign') ||
      normalizedQuery.includes('ads') ||
      normalizedQuery.includes('growth') ||
      normalizedQuery.includes('marketing') ||
      normalizedQuery.includes('performance') ||
      normalizedQuery.includes('lead generation')
    ) {
      router.push('/dashboard/campaigns');
      return;
    }
    if (normalizedQuery.includes('review')) {
      router.push('/dashboard/review');
      return;
    }
    if (normalizedQuery.includes('blueprint') || normalizedQuery.includes('automation') || normalizedQuery.includes('workflow plan')) {
      router.push('/dashboard/automation-blueprints');
      return;
    }
    if (normalizedQuery.includes('quality') || normalizedQuery.includes('evaluate') || normalizedQuery.includes('score')) {
      router.push('/dashboard/quality-review');
      return;
    }
    if (normalizedQuery.includes('knowledge') || normalizedQuery.includes('rag') || normalizedQuery.includes('search my')) {
      router.push('/dashboard/knowledge-base');
      return;
    }
    if (pathname.startsWith('/dashboard/tasks') || normalizedQuery.includes('task')) {
      router.push(`/dashboard/tasks?q=${encodedQuery}`);
      return;
    }
    router.push(`/dashboard/agents?q=${encodedQuery}`);
  };

  return (
    <header className="glass-panel fixed start-0 end-0 top-0 z-50 h-20 border-b border-border/20 lg:start-60">
      <div className="flex h-full min-w-0 items-center justify-between gap-3 px-3 sm:gap-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <button
            type="button"
            aria-label={isMobileMenuOpen ? t('topbar.closeNavMenu') : t('topbar.openNavMenu')}
            onClick={onMenuClick}
            className={buttonStyles({ variant: 'ghost', size: 'icon', className: 'lg:hidden transition-[background-color,color] duration-150 ease-premium' })}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-normal text-foreground sm:text-xl">
              {t(pageMetaKey.titleKey)}
            </h1>
            <p className="hidden truncate text-sm font-medium text-foreground-muted sm:block">{t(pageMetaKey.descriptionKey)}</p>
          </div>
        </div>

        <form
          onSubmit={handleSearch}
          className="hidden w-full max-w-md items-center rounded-lg border border-border bg-surface-elevated px-3 py-2 shadow-inner focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30 lg:flex"
        >
          <Search className="h-4 w-4 text-foreground-muted" />
          <input
            type="search"
            aria-label={t('common.search')}
            placeholder={t('topbar.searchPlaceholder')}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="ms-2 w-full border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-foreground-muted"
          />
        </form>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <ThemeToggle />
          <div ref={langRef} className="relative">
            <button
              type="button"
              onClick={() => setLangOpen((o) => !o)}
              aria-label={t('language.switchTo')}
              className={buttonStyles({ variant: 'ghost', size: 'icon', className: 'transition-[background-color,color] duration-150 ease-premium' })}
            >
              <Globe className="h-5 w-5" />
            </button>
            {langOpen && (
              <div className="absolute end-0 top-full z-50 mt-1.5 min-w-[160px] rounded-lg border border-border bg-background p-1.5 shadow-xl">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => { setLanguage(l.code as LanguageCode); setLangOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-bold transition-[background-color,color] duration-150 ease-premium hover:bg-primary/10 ${
                      language === l.code ? 'text-primary' : 'text-foreground-muted'
                    }`}
                  >
                    {language === l.code && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                    <span>{l.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <NotificationBell
            initialNotifications={initialNotifications}
            initialUnreadCount={initialUnreadCount}
          />
          <Link
            href="/dashboard/settings"
            aria-label={t('topbar.openSettings')}
            className={buttonStyles({ variant: 'ghost', size: 'icon', className: 'transition-[background-color,color] duration-150 ease-premium' })}
          >
            <Settings className="h-5 w-5" />
          </Link>
          <div className="hidden h-8 w-px bg-border/40 sm:block" />
          <div className="flex min-w-0 items-center gap-3 rounded-lg bg-surface/60 px-2 py-2 shadow-soft sm:px-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-black text-primary-foreground">
              {profileLabel.charAt(0).toUpperCase()}
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="max-w-[180px] truncate text-sm font-bold text-foreground">{profileLabel}</p>
              <p className="max-w-[180px] truncate text-xs text-foreground-muted">{workspace.name}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}