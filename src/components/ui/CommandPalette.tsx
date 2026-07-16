'use client';

import {
  Filter,
  Bot,
  CalendarDays,
  Camera,
  ClipboardList,
  Cloud,
  FileText,
  FolderKanban,
  Image as ImageIcon,
  LayoutDashboard,
  Library,
  Megaphone,
  MessagesSquare,
  PenLine,
  ShieldCheck,
  Sparkles,
  Star,
  Workflow,
  Wrench,
  Activity,
  PlusCircle,
  Settings,
  Languages,
  Clock,
  CornerDownLeft,
  Code2,
  HeartHandshake,
  Gauge,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '@/i18n/context';
import { useDashboardContext } from '@/components/layout/DashboardContext';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface CommandItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  keywords?: string[];
  run?: () => void;
}

const NAV_ITEMS: CommandItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', keywords: ['home', 'overview'] },
  { id: 'alex', label: 'Alex Assistant', icon: Bot, href: '/dashboard/alex', keywords: ['chat', 'ai', 'assistant'] },
  { id: 'agents', label: 'Agents', icon: Bot, href: '/dashboard/agents', keywords: ['ai', 'agent catalog'] },
  { id: 'projects', label: 'Projects', icon: FolderKanban, href: '/dashboard/projects', keywords: ['software', 'saas'] },
  { id: 'releases', label: 'Releases', icon: Cloud, href: '/dashboard/releases', keywords: ['deploy'] },
  { id: 'promptLibrary', label: 'Prompt Library', icon: FileText, href: '/dashboard/prompt-library', keywords: ['prompts'] },
  { id: 'agentBuilder', label: 'AI Agent Builder', icon: Sparkles, href: '/dashboard/agent-builder', keywords: ['agent', 'builder', 'no-code'] },
  { id: 'templatesMarketplace', label: 'Templates Marketplace', icon: Star, href: '/dashboard/agent-builder/gallery', keywords: ['gallery', 'marketplace', 'templates'] },
  { id: 'industryPacks', label: 'Industry Packs', icon: Star, href: '/dashboard/industry-packs', keywords: ['templates'] },
  { id: 'automationBlueprints', label: 'Automation Blueprints', icon: Workflow, href: '/dashboard/automation-blueprints', keywords: ['workflows'] },
  { id: 'qualityReview', label: 'Quality Review', icon: ShieldCheck, href: '/dashboard/quality-review', keywords: ['score'] },
  { id: 'knowledgeBase', label: 'Knowledge Base', icon: Library, href: '/dashboard/knowledge-base', keywords: ['docs'] },
  { id: 'aiStudio', label: 'AI Studio', icon: Sparkles, href: '/dashboard/ai-studio', keywords: ['images', 'video'] },
  { id: 'tasks', label: 'Tasks', icon: ClipboardList, href: '/dashboard/tasks', keywords: ['work'] },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone, href: '/dashboard/campaigns', keywords: ['ads'] },
  { id: 'reelsStudio', label: 'Reels Studio', icon: Camera, href: '/dashboard/reels-studio', keywords: ['instagram'] },
  { id: 'contentStudio', label: 'Content & Ads Studio', icon: PenLine, href: '/dashboard/content-studio', keywords: ['drafts', 'copy'] },
  { id: 'contentLibrary', label: 'Content Library', icon: Library, href: '/dashboard/content-library', keywords: ['saved'] },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, href: '/dashboard/calendar', keywords: ['schedule'] },
  { id: 'recovery', label: 'Recovery', icon: Activity, href: '/dashboard/recovery', keywords: ['failed', 'errors'] },
  { id: 'opsDashboard', label: 'Operations Dashboard', icon: LayoutDashboard, href: '/dashboard/ops', keywords: ['health', 'usage'] },
  { id: 'systemHealth', label: 'System Health', icon: Activity, href: '/dashboard/system-health', keywords: ['monitoring'] },
  { id: 'security', label: 'Security', icon: ShieldCheck, href: '/dashboard/security', keywords: ['protection'] },
  { id: 'backups', label: 'Backups', icon: Cloud, href: '/dashboard/backups', keywords: ['export'] },
  { id: 'docs', label: 'Docs', icon: FileText, href: '/dashboard/docs', keywords: ['guides'] },
  { id: 'apiDocs', label: 'API Docs', icon: Code2, href: '/api/docs', keywords: ['api', 'keys', 'reference', 'openapi'] },
  { id: 'customerSuccess', label: 'Customer Success', icon: HeartHandshake, href: '/dashboard/customer-success', keywords: ['support', 'tickets', 'nps', 'churn', 'retention', 'feedback'] },
  { id: 'creativeAssets', label: 'Creative Assets', icon: ImageIcon, href: '/dashboard/creative-assets', keywords: ['images', 'prompts'] },
  { id: 'reviews', label: 'Reviews', icon: Star, href: '/dashboard/reviews', keywords: ['quality'] },
  { id: 'reports', label: 'Reports', icon: FileText, href: '/dashboard/reports', keywords: ['metrics'] },
  { id: 'insights', label: 'Analytics & Insights', icon: Gauge, href: '/dashboard/insights', keywords: ['analytics', 'forecast', 'churn', 'team', 'performance'] },
  { id: 'notifications', label: 'Notifications', icon: MessagesSquare, href: '/dashboard/notifications', keywords: ['alerts'] },
  { id: 'usageLimits', label: 'Usage & Limits', icon: Activity, href: '/dashboard/usage', keywords: ['quota'] },
  { id: 'settings', label: 'Settings', icon: Wrench, href: '/dashboard/settings', keywords: ['preferences'] },
];

const RECENT_STORAGE_KEY = 'af_recent_commands';
const LANGUAGE_CYCLE: Array<'en' | 'fr' | 'ar' | 'es'> = ['en', 'fr', 'ar', 'es'];

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t, language, setLanguage } = useLanguage();
  const { workspace } = useDashboardContext();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(timer);
  }, [open]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSelectedIndex(0);
  };

  const handleClose = useCallback(() => {
    setQuery('');
    setSelectedIndex(0);
    onOpenChange(false);
  }, [onOpenChange]);

  const actions = useMemo<CommandItem[]>(() => {
    const askAlexLabel = query
      ? t('commandPalette.askAlexAbout', 'Ask Alex about "{{query}}"').replace('{{query}}', query)
      : t('nav.alexAssistant', 'Alex Assistant');
    const askAlex: CommandItem = {
      id: 'askAlex',
      label: askAlexLabel,
      icon: Sparkles,
      href: query ? `/dashboard/alex?q=${encodeURIComponent(query)}` : '/dashboard/alex',
      keywords: ['ai', 'chat', 'help'],
    };
    const toggleLanguage: CommandItem = {
      id: 'toggleLanguage',
      label: t('commandPalette.toggleLanguage', 'Switch Language'),
      icon: Languages,
      keywords: ['lang', 'translate', 'traduction', 'لغة'],
      run: () => {
        const idx = LANGUAGE_CYCLE.indexOf(language);
        const next = LANGUAGE_CYCLE[(idx + 1) % LANGUAGE_CYCLE.length];
        setLanguage(next);
      },
    };
    return [
      askAlex,
      { id: 'createTask', label: t('action.createTask', 'Create Task'), icon: PlusCircle, href: '/dashboard/tasks', keywords: ['new', 'add', 'task'] },
      { id: 'openContentStudio', label: t('action.contentStudio', 'Content Studio'), icon: PenLine, href: '/dashboard/content-studio', keywords: ['draft', 'copy'] },
      { id: 'openSystemHealth', label: t('action.systemHealth', 'System Health'), icon: Activity, href: '/dashboard/system-health', keywords: ['monitor'] },
      { id: 'openProjects', label: t('action.openProjects', 'Open Projects'), icon: FolderKanban, href: '/dashboard/projects', keywords: ['software'] },
      { id: 'openSettings', label: t('action.openSettings', 'Open Settings'), icon: Settings, href: '/dashboard/settings', keywords: ['preferences'] },
      toggleLanguage,
    ];
  }, [query, language, setLanguage, t]);

  const allById = useMemo(() => {
    const map = new Map<string, CommandItem>();
    [...NAV_ITEMS, ...actions].forEach((c) => map.set(c.id, c));
    return map;
  }, [actions]);

  const flatList = useMemo<CommandItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      const matches = [...actions, ...NAV_ITEMS].filter((c) => {
        if (c.id === 'askAlex') return true;
        return (
          c.label.toLowerCase().includes(q) ||
          c.href?.toLowerCase().includes(q) ||
          c.keywords?.some((k) => k.toLowerCase().includes(q))
        );
      });
      return matches;
    }

    const recents = recentIds
      .map((id) => allById.get(id))
      .filter((c): c is CommandItem => c !== undefined && c.id !== 'toggleLanguage' && c.id !== 'askAlex')
      .slice(0, 4);

    const suggestionExtras = actions.filter(
      (a) => a.id === 'createTask' || a.id === 'askAlex'
    );
    return [...recents, ...suggestionExtras, ...actions, ...NAV_ITEMS];
  }, [query, recentIds, actions, allById]);

  const grouped = useMemo(() => {
    const q = query.trim();
    if (q) {
      return [{ group: t('commandPalette.results', 'Results'), items: flatList }];
    }
    const result: Array<{ group: string; items: CommandItem[] }> = [];
    const recents = flatList.filter((c) => recentIds.includes(c.id));
    if (recents.length) result.push({ group: t('commandPalette.recentGroup', 'Recent'), items: recents });
    const suggestions = flatList.filter((c) => !recentIds.includes(c.id) && (c.id === 'createTask' || c.id === 'askAlex'));
    if (suggestions.length) result.push({ group: t('commandPalette.suggestionsGroup', 'Suggested for you'), items: suggestions });
    result.push({ group: t('commandPalette.actionsGroup', 'Quick Actions'), items: actions });
    result.push({ group: t('commandPalette.navGroup', 'Navigation'), items: NAV_ITEMS });
    return result;
  }, [flatList, recentIds, actions, query, t]);

  const runCommand = useCallback(
    (cmd: CommandItem) => {
      try {
        const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
        const prev: string[] = raw ? JSON.parse(raw) : [];
        const next = [cmd.id, ...prev.filter((id) => id !== cmd.id)].slice(0, 6);
        window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
        setRecentIds(next);
      } catch {
        /* ignore */
      }
      if (cmd.href) router.push(cmd.href);
      cmd.run?.();
      handleClose();
    },
    [router, handleClose]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatList.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = flatList[selectedIndex];
        if (cmd) runCommand(cmd);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, flatList, selectedIndex, runCommand, handleClose]);

  useEffect(() => {
    const active = listRef.current?.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!open) return null;

  let flatCursor = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('commandPalette.title', 'Command Palette')}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Filter className="h-5 w-5 shrink-0 text-foreground-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder={t('commandPalette.searchPlaceholder', 'Search or run a command...')}
            className="h-14 w-full bg-transparent text-base text-foreground outline-none placeholder:text-foreground-muted"
            aria-label={t('commandPalette.searchPlaceholder', 'Search or run a command...')}
          />
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-xs text-foreground-muted sm:inline">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[55vh] overflow-y-auto p-2">
          {flatList.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-foreground-muted">
              {t('commandPalette.noResults', 'No results found.')}
            </p>
          ) : (
            grouped.map((section) => (
              <div key={section.group} className="mb-2">
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                  {section.group}
                </p>
                {section.items.map((cmd) => {
                  flatCursor += 1;
                  const index = flatCursor;
                  const isActive = index === selectedIndex;
                  const Icon = cmd.icon;
                  return (
                    <button
                      key={`${section.group}-${cmd.id}`}
                      type="button"
                      data-active={isActive}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => runCommand(cmd)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                        isActive ? 'bg-primary-light text-primary' : 'text-foreground hover:bg-surface-elevated'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-80" />
                      <span className="flex-1 truncate">{cmd.label}</span>
                      {cmd.id === 'askAlex' && query ? (
                        <CornerDownLeft className="h-3.5 w-3.5 text-foreground-muted" />
                      ) : isActive ? (
                        <CornerDownLeft className="h-3.5 w-3.5 text-primary" />
                      ) : recentIds.includes(cmd.id) ? (
                        <Clock className="h-3.5 w-3.5 text-foreground-muted" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-foreground-muted">
          <span>{workspace?.name}</span>
          <span className="flex items-center gap-2">
            <kbd className="rounded border border-border px-1.5 py-0.5">↑</kbd>
            <kbd className="rounded border border-border px-1.5 py-0.5">↓</kbd>
            <span>to navigate</span>
            <kbd className="rounded border border-border px-1.5 py-0.5">↵</kbd>
            <span>to select</span>
          </span>
        </div>
      </div>
    </div>
  );
}
