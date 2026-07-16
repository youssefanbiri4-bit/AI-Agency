'use client';

import { useState } from 'react';
import {
  Rocket,
  CheckCircle2,
  Clock,
  Target,
  BarChart3,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface LaunchChecklistItem {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'in-progress' | 'pending';
  category: 'pre-launch' | 'launch' | 'post-launch';
  dueDate?: string;
}

interface LaunchChecklistProps {
  className?: string;
}

const LAUNCH_ITEMS: LaunchChecklistItem[] = [
  {
    id: '1',
    title: 'Finalize pricing page',
    description: 'Ensure all plan details, comparison tables, and CTAs are live.',
    status: 'completed',
    category: 'pre-launch',
    dueDate: '2026-07-20',
  },
  {
    id: '2',
    title: 'Set up analytics tracking',
    description: 'Configure Google Analytics, Mixpanel, and conversion tracking.',
    status: 'completed',
    category: 'pre-launch',
    dueDate: '2026-07-21',
  },
  {
    id: '3',
    title: 'Launch Product Hunt campaign',
    description: 'Prepare assets, schedule post, coordinate hunters.',
    status: 'in-progress',
    category: 'launch',
    dueDate: '2026-07-25',
  },
  {
    id: '4',
    title: 'Send launch email sequence',
    description: 'Welcome series, announcement, and follow-up emails.',
    status: 'pending',
    category: 'launch',
    dueDate: '2026-07-25',
  },
  {
    id: '5',
    title: 'Social media blitz',
    description: 'Twitter, LinkedIn, Reddit, Hacker News posts.',
    status: 'pending',
    category: 'launch',
    dueDate: '2026-07-25',
  },
  {
    id: '6',
    title: 'Monitor onboarding funnel',
    description: 'Track signups, workspace creation, first actions.',
    status: 'pending',
    category: 'post-launch',
    dueDate: '2026-07-26',
  },
  {
    id: '7',
    title: 'Collect user feedback',
    description: 'NPS survey, support tickets, feature requests.',
    status: 'pending',
    category: 'post-launch',
    dueDate: '2026-07-30',
  },
  {
    id: '8',
    title: 'Iterate on conversion rate',
    description: 'A/B test CTAs, pricing, onboarding flow.',
    status: 'pending',
    category: 'post-launch',
    dueDate: '2026-08-01',
  },
];

const CATEGORY_CONFIG: Record<string, {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  'pre-launch': { label: 'Pre-Launch', color: 'bg-blue-500', icon: Target },
  'launch': { label: 'Launch Day', color: 'bg-primary', icon: Rocket },
  'post-launch': { label: 'Post-Launch', color: 'bg-success', icon: BarChart3 },
};

const STATUS_CONFIG: Record<string, {
  tone: 'success' | 'warning' | 'info';
  label: string;
}> = {
  'completed': { tone: 'success', label: 'Done' },
  'in-progress': { tone: 'warning', label: 'In Progress' },
  'pending': { tone: 'info', label: 'Pending' },
};

export function LaunchChecklist({ className }: LaunchChecklistProps) {
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filteredItems = activeCategory === 'all'
    ? LAUNCH_ITEMS
    : LAUNCH_ITEMS.filter((item) => item.category === activeCategory);

  const completedCount = LAUNCH_ITEMS.filter((item) => item.status === 'completed').length;
  const progress = (completedCount / LAUNCH_ITEMS.length) * 100;

  return (
    <Card className={className}>
      <CardHeader
        title="Launch Checklist"
        description="Track your launch progress across all phases."
        action={
          <Badge tone="primary">
            {completedCount}/{LAUNCH_ITEMS.length} Complete
          </Badge>
        }
      />

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground-muted">Overall Progress</span>
          <span className="font-bold text-foreground">{progress.toFixed(0)}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Category filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-bold transition-colors',
            activeCategory === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-surface-elevated text-foreground-muted hover:text-foreground'
          )}
        >
          All Phases
        </button>
        {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveCategory(key)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-bold transition-colors',
              activeCategory === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-surface-elevated text-foreground-muted hover:text-foreground'
            )}
          >
            {config.label}
          </button>
        ))}
      </div>

      {/* Checklist items */}
      <div className="space-y-3">
        {filteredItems.map((item) => {
          const statusConfig = STATUS_CONFIG[item.status];
          const categoryConfig = CATEGORY_CONFIG[item.category];

          return (
            <div
              key={item.id}
              className={cn(
                'flex items-start gap-4 rounded-lg border p-4 transition-all',
                item.status === 'completed'
                  ? 'border-success/20 bg-success/5'
                  : item.status === 'in-progress'
                    ? 'border-warning/20 bg-warning/5'
                    : 'border-border bg-surface'
              )}
            >
              <div className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                item.status === 'completed'
                  ? 'bg-success text-success-foreground'
                  : item.status === 'in-progress'
                    ? 'bg-warning text-warning-foreground'
                    : 'bg-surface-elevated text-foreground-muted'
              )}>
                {item.status === 'completed' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={cn(
                    'font-bold text-foreground',
                    item.status === 'completed' && 'line-through opacity-60'
                  )}>
                    {item.title}
                  </p>
                  <Badge tone={statusConfig.tone}>{statusConfig.label}</Badge>
                </div>
                <p className="mt-1 text-sm text-foreground-muted">{item.description}</p>
                {item.dueDate && (
                  <p className="mt-2 text-xs text-foreground-muted">
                    Due: {new Date(item.dueDate).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                categoryConfig.color
              )} />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
