'use client';

import {
  BarChart3,
  ClipboardCheck,
  FileText,
  Home,
  Layers3,
  PlusCircle,
  Settings,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useDashboardContext } from '@/components/layout/DashboardContext';
import { BrandMark } from '@/components/brand/BrandMark';
import { StatusBadge } from './StatusBadge';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const menuItems = [
  { icon: Home, label: 'Dashboard', href: '/dashboard' },
  { icon: Users, label: 'Agents', href: '/dashboard/agents' },
  { icon: FileText, label: 'Tasks', href: '/dashboard/tasks' },
  { icon: ClipboardCheck, label: 'Reviews', href: '/dashboard/review' },
  { icon: BarChart3, label: 'Reports', href: '/dashboard/reports' },
  { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
];

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { workspace } = useDashboardContext();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-full w-72 transform border-r border-black/8 bg-white/92 shadow-[18px_0_45px_rgba(0,0,0,0.07)] backdrop-blur-xl transition-transform duration-300 ease-in-out lg:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-black/8 px-5 py-5">
          <BrandMark href="/dashboard" tagline="Operations Dashboard" onClick={onClose} className="w-full" />
        </div>

        <div className="px-4 py-4">
          <Link
            href="/dashboard/create-task"
            onClick={onClose}
            className="flex items-center justify-between rounded-lg border border-[#8B3CDE]/16 bg-[#F0DBEF]/58 px-3 py-3 text-sm font-bold text-[#8B3CDE] shadow-sm hover:border-[#8B3CDE]/32 hover:bg-[#F0DBEF]"
          >
            <span className="flex min-w-0 items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              <span>Create Task</span>
            </span>
            <span className="rounded-md bg-white px-2 py-1 text-xs text-[#8B3CDE]">Ready</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 pb-4">
          <p className="px-3 pb-2 pt-1 text-xs font-black uppercase tracking-[0.16em] text-black/36">
            Workspace
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
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-all',
                  isActive
                    ? 'bg-black text-white shadow-[0_12px_24px_rgba(0,0,0,0.18)]'
                    : 'text-black/58 hover:bg-[#F0DBEF]/55 hover:text-black'
                )}
                onClick={onClose}
              >
                <Icon className={cn('h-5 w-5', isActive ? 'text-[#F0DBEF]' : 'text-black/34 group-hover:text-[#8B3CDE]')} />
              <span className="truncate">{item.label}</span>
                {isActive && (
                  <span className="ml-auto h-2 w-2 rounded-full bg-[#F55477] shadow-[0_0_0_4px_rgba(245,84,119,0.2)]" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-black/8 p-4">
          <div className="rounded-lg border border-black/8 bg-[#F0DBEF]/35 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#8B3CDE] shadow-sm">
                  <Layers3 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-black">{workspace.name}</p>
                  <p className="text-xs text-black/52">Active workspace</p>
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
