'use client';

import React from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  ClipboardList,
  Gauge,
  PenSquare,
  Plus,
  Rocket,
  ShieldCheck,
  Users,
  BarChart3,
  Bot,
  FileText,
} from 'lucide-react';
import { useRBAC } from '@/components/layout/DashboardContext';
import { DEPARTMENT_LABELS, getRoleLabel, type RBACRole } from '@/types/auth';
import { buttonStyles } from '@/components/ui/Button';
import { formatTimeAgo } from '@/lib/utils';
import type {
  DashboardActivityItem,
  DashboardTaskPreview,
  PersonalizedDeptStats,
} from '@/lib/dashboard/dashboard-types';

interface PersonalizedDashboardProps {
  welcomeName: string;
  myTasks: DashboardTaskPreview[];
  deptStats: PersonalizedDeptStats;
  recentActivity: DashboardActivityItem[];
}

export function PersonalizedDashboard({
  welcomeName,
  myTasks,
  deptStats,
  recentActivity,
}: PersonalizedDashboardProps) {
  const {
    role,
    effectiveDepartment,
    assignedDepartment,
    isAdminOrHigher,
    assignedRole,
  } = useRBAC();

  const activeRole = (role ?? assignedRole ?? 'viewer') as RBACRole;
  const activeDept = effectiveDepartment ?? assignedDepartment;

  const deptInfo = activeDept ? DEPARTMENT_LABELS[activeDept] : null;
  const roleLabel = getRoleLabel(activeRole, 'en');
  const isAdmin = isAdminOrHigher || activeRole === 'admin' || activeRole === 'owner';

  const getWelcomeMessage = () => {
    if (isAdmin) return `Welcome back, ${welcomeName}. You have full control.`;
    if (activeRole === 'operator') return `Hello ${welcomeName}. Ready to run operations for your department?`;
    if (activeRole === 'editor') return `Hi ${welcomeName}. Let's create and refine some great work.`;
    return `Welcome, ${welcomeName}. Here's what's relevant for you today.`;
  };

  const getQuickActions = () => {
    const base: Array<{
      label: string;
      href: string;
      icon: React.ElementType;
      variant?: 'primary' | 'secondary' | 'outline';
    }> = [
      { label: 'Create Task', href: '/dashboard/create-task', icon: Plus },
      { label: 'View My Tasks', href: '/dashboard/tasks', icon: ClipboardList },
    ];

    if (isAdmin) {
      base.push(
        { label: 'System Health', href: '/dashboard/system-health', icon: Gauge, variant: 'outline' },
        { label: 'Manage Roles', href: '/dashboard/settings/roles', icon: Users, variant: 'outline' },
      );
    } else if (activeRole === 'operator') {
      base.push(
        { label: 'Content Studio', href: '/dashboard/content-studio', icon: PenSquare },
        { label: 'Reports', href: '/dashboard/reports', icon: BarChart3, variant: 'outline' },
      );
    } else if (activeRole === 'editor') {
      base.push(
        { label: 'Content Studio', href: '/dashboard/content-studio', icon: PenSquare },
        { label: 'Creative Assets', href: '/dashboard/creative-assets', icon: PenSquare, variant: 'outline' },
      );
    } else {
      base.push(
        { label: 'Alex Assistant', href: '/dashboard/alex', icon: Bot, variant: 'outline' },
        { label: 'Reports', href: '/dashboard/reports', icon: BarChart3, variant: 'outline' },
      );
    }

    if (activeDept === 'creative' || activeDept === 'social') {
      base.push({ label: 'Reels Studio', href: '/dashboard/reels', icon: Rocket, variant: 'outline' });
    }
    if (activeDept === 'paid_ads' || activeDept === 'strategy') {
      base.push({ label: 'Campaigns', href: '/dashboard/campaigns', icon: BarChart3, variant: 'outline' });
    }

    return base.slice(0, 6);
  };

  const quickActions = getQuickActions();

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-border bg-surface-elevated p-6 shadow-[0_24px_70px_rgba(93,107,107,0.08)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-surface px-3 py-1 text-xs font-bold tracking-[0.5px] text-foreground-muted">
                {roleLabel} {activeDept ? '·' : ''} {deptInfo ? deptInfo.en : 'Workspace'}
              </span>
              {activeDept ? (
                <span className="text-xs text-foreground-muted">Department: {deptInfo?.ar}</span>
              ) : null}
            </div>              <h1 className="text-3xl font-black tracking-[-0.4px] text-foreground sm:text-4xl text-wrap-balance">
              Good to see you, {welcomeName}.
            </h1>
            <p className="mt-2 max-w-2xl text-base text-foreground-muted text-wrap-pretty">{getWelcomeMessage()}</p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href="/dashboard/create-task" className={buttonStyles({ size: 'lg' })}>
              <Plus className="h-4 w-4 shrink-0" /> <span className="break-words">New Task</span>
            </Link>
            <Link href="/dashboard/content-studio" className={buttonStyles({ size: 'lg', variant: 'secondary' })}>
              <span className="break-words">Content Studio</span>
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-foreground">My Tasks</h2>
              <p className="text-sm text-foreground-muted">Tasks you created in this workspace.</p>
            </div>
            <Link href="/dashboard/tasks" className="text-sm font-bold text-primary hover:underline">
              See all →
            </Link>
          </div>

          <div className="rounded-2xl border border-border bg-surface-elevated p-4 shadow-sm">
            {myTasks.length > 0 ? (
              <ul className="space-y-2">
                {myTasks.slice(0, 4).map((task) => (
                  <li key={task.id}>
                    <Link
                      href={task.href}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-surface"
                    >
                      <span className="truncate font-medium">{task.title}</span>
                      <span className="rounded bg-surface px-2 py-1 text-xs text-foreground-muted">{task.status}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <ClipboardList className="h-8 w-8 text-foreground-muted/40" />
                <p className="mt-3 text-sm font-medium text-foreground-muted">No tasks created by you yet.</p>
                <Link href="/dashboard/create-task" className="mt-2 text-sm text-primary underline">
                  Create your first task
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="mb-3">
            <h2 className="text-lg font-black text-foreground">Department Stats</h2>
            <p className="text-sm text-foreground-muted">
              {activeDept ? DEPARTMENT_LABELS[activeDept].en : 'Workspace'} overview
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-xl border border-border bg-surface-elevated p-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <div className="text-2xl font-black text-foreground">{deptStats.yourTasks}</div>
                  <div className="truncate text-xs uppercase tracking-widest text-foreground-muted">Your Tasks</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface-elevated p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                <div className="min-w-0">
                  <div className="text-2xl font-black text-foreground">{deptStats.readyInDept}</div>
                  <div className="truncate text-xs uppercase tracking-widest text-foreground-muted">Ready Content</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface-elevated p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <div className="text-2xl font-black text-foreground">{deptStats.needsReview}</div>
                  <div className="truncate text-xs uppercase tracking-widest text-foreground-muted">Needs Review</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="mb-3">
            <h2 className="text-lg font-black text-foreground">Quick Actions</h2>
            <p className="text-sm text-foreground-muted">Tailored for {roleLabel}s</p>
          </div>

          <div className="flex flex-col gap-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className={buttonStyles({
                    variant: action.variant ?? 'outline',
                    className: 'w-full justify-start gap-2 text-sm',
                  })}
                >
                  <Icon className="h-4 w-4" />
                  {action.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-surface-elevated p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-black text-foreground">Recent Activity</h2>
            <p className="text-sm text-foreground-muted">Latest tasks and content items tied to your work.</p>
          </div>
        </div>

        {recentActivity.length > 0 ? (
          <ul className="space-y-2">
            {recentActivity.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center justify-between gap-2 rounded-lg border border-divider px-3 py-2 hover:bg-surface"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {item.kind === 'task' ? (
                      <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0 text-primary" />
                    )}
                    <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
                  </div>
                  <span className="shrink-0 text-xs text-foreground-muted">{formatTimeAgo(item.at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-foreground-muted">
            No recent activity yet.
          </p>
        )}
      </section>
    </div>
  );
}
