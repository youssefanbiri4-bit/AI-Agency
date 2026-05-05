'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Menu, Search, Settings, X } from 'lucide-react';
import { buttonStyles } from './Button';
import { cn } from '@/lib/utils';
import { useDashboardContext } from '@/components/layout/DashboardContext';

interface TopbarProps {
  onMenuClick?: () => void;
  isMobileMenuOpen?: boolean;
}

const pageTitles: Record<string, { title: string; description: string }> = {
  '/dashboard': {
    title: 'Dashboard',
    description: 'Workspace setup and data readiness overview',
  },
  '/dashboard/agents': {
    title: 'Agents',
    description: 'Manage the AI agent catalog',
  },
  '/dashboard/tasks': {
    title: 'Tasks',
    description: 'Track task status and execution readiness',
  },
  '/dashboard/create-task': {
    title: 'Create Task',
    description: 'Prepare structured agent work requests',
  },
  '/dashboard/review': {
    title: 'Reviews',
    description: 'Quality review area waiting for real task outputs',
  },
  '/dashboard/reports': {
    title: 'Reports',
    description: 'Reporting workspace waiting for real task data',
  },
  '/dashboard/settings': {
    title: 'Settings',
    description: 'Manage account and integration readiness',
  },
};

function getPageMeta(pathname: string) {
  if (pathname.startsWith('/dashboard/agents/')) {
    return { title: 'Agent Details', description: 'Review agent capabilities and integration readiness' };
  }

  if (pathname.startsWith('/dashboard/tasks/')) {
    return { title: 'Task Details', description: 'Inspect task inputs, status, and output' };
  }

  return pageTitles[pathname] ?? pageTitles['/dashboard'];
}

export function Topbar({ onMenuClick, isMobileMenuOpen }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const pageMeta = getPageMeta(pathname);
  const { user, workspace } = useDashboardContext();
  const [searchQuery, setSearchQuery] = useState('');
  const profileLabel = user.fullName || user.email || 'Signed-in user';

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

    if (normalizedQuery.includes('review')) {
      router.push('/dashboard/review');
      return;
    }

    if (pathname.startsWith('/dashboard/tasks') || normalizedQuery.includes('task')) {
      router.push(`/dashboard/tasks?q=${encodedQuery}`);
      return;
    }

    router.push(`/dashboard/agents?q=${encodedQuery}`);
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-30 border-b border-black/8 bg-white/88 backdrop-blur-xl lg:left-72">
      <div className="flex h-20 min-w-0 items-center justify-between gap-3 px-3 sm:gap-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <button
            type="button"
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={onMenuClick}
            className={buttonStyles({ variant: 'ghost', size: 'icon', className: 'lg:hidden' })}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="min-w-0">
            <h1 className="truncate text-lg font-black tracking-normal text-black sm:text-xl">
              {pageMeta.title}
            </h1>
            <p className="hidden truncate text-sm text-black/52 sm:block">{pageMeta.description}</p>
          </div>
        </div>

        <form
          onSubmit={handleSearch}
          className="hidden w-full max-w-md items-center rounded-lg border border-black/8 bg-[#F0DBEF]/35 px-3 py-2 shadow-inner lg:flex"
        >
          <Search className="h-4 w-4 text-black/34" />
          <input
            type="search"
            aria-label="Search workspace"
            placeholder="Search agents, tasks, reports..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="ml-2 w-full border-0 bg-transparent text-sm text-black outline-none placeholder:text-black/34"
          />
        </form>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <Link
            href="/dashboard/tasks"
            aria-label="Open task workspace"
            className={cn(buttonStyles({ variant: 'ghost', size: 'icon' }), 'relative')}
          >
            <Bell className="h-5 w-5" />
          </Link>
          <Link
            href="/dashboard/settings"
            aria-label="Open settings"
            className={buttonStyles({ variant: 'ghost', size: 'icon' })}
          >
            <Settings className="h-5 w-5" />
          </Link>
          <div className="hidden h-8 w-px bg-black/8 sm:block" />
          <div className="flex min-w-0 items-center gap-3 rounded-lg border border-black/8 bg-white px-2 py-2 shadow-sm sm:px-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#8B3CDE] text-xs font-black text-white">
              {profileLabel.charAt(0).toUpperCase()}
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="max-w-[180px] truncate text-sm font-bold text-black">{profileLabel}</p>
              <p className="max-w-[180px] truncate text-xs text-black/52">{workspace.name}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
