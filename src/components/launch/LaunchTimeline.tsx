'use client';

import {
  Calendar,
  CheckCircle2,
  Rocket,
  Target,
  TrendingUp,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  status: 'completed' | 'upcoming' | 'in-progress';
  type: 'milestone' | 'action' | 'review';
}

interface LaunchTimelineProps {
  className?: string;
}

const TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: '1',
    date: '2026-07-15',
    title: 'Final QA Review',
    description: 'Complete end-to-end testing of all marketing pages, pricing, and onboarding flow.',
    status: 'completed',
    type: 'milestone',
  },
  {
    id: '2',
    date: '2026-07-18',
    title: 'Analytics Setup',
    description: 'Configure Google Analytics, Mixpanel, and conversion tracking for launch metrics.',
    status: 'completed',
    type: 'action',
  },
  {
    id: '3',
    date: '2026-07-20',
    title: 'Content Preparation',
    description: 'Finalize blog posts, social media copy, and email sequences.',
    status: 'completed',
    type: 'action',
  },
  {
    id: '4',
    date: '2026-07-22',
    title: 'Product Hunt Submission',
    description: 'Submit Product Hunt page and coordinate with hunters.',
    status: 'in-progress',
    type: 'milestone',
  },
  {
    id: '5',
    date: '2026-07-25',
    title: 'Launch Day',
    description: 'Official launch across all channels: Product Hunt, social media, email.',
    status: 'upcoming',
    type: 'milestone',
  },
  {
    id: '6',
    date: '2026-07-28',
    title: 'First Week Review',
    description: 'Analyze initial metrics: signups, conversions, feedback.',
    status: 'upcoming',
    type: 'review',
  },
  {
    id: '7',
    date: '2026-08-01',
    title: 'Iteration Cycle',
    description: 'Implement learnings from first week: optimize onboarding, CTAs, pricing.',
    status: 'upcoming',
    type: 'action',
  },
  {
    id: '8',
    date: '2026-08-15',
    title: 'Growth Phase',
    description: 'Scale marketing efforts: paid ads, partnerships, content marketing.',
    status: 'upcoming',
    type: 'milestone',
  },
];

const TYPE_CONFIG: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = {
  'milestone': { icon: Rocket, color: 'bg-primary' },
  'action': { icon: Target, color: 'bg-info' },
  'review': { icon: TrendingUp, color: 'bg-success' },
};

const STATUS_CONFIG: Record<string, {
  tone: 'success' | 'warning' | 'info';
  label: string;
}> = {
  'completed': { tone: 'success', label: 'Done' },
  'in-progress': { tone: 'warning', label: 'In Progress' },
  'upcoming': { tone: 'info', label: 'Upcoming' },
};

export function LaunchTimeline({ className }: LaunchTimelineProps) {
  const completedCount = TIMELINE_EVENTS.filter((e) => e.status === 'completed').length;
  const progress = (completedCount / TIMELINE_EVENTS.length) * 100;

  return (
    <Card className={className}>
      <CardHeader
        title="Launch Timeline"
        description="Key milestones and actions for a successful launch."
        action={
          <Badge tone="primary">
            {completedCount}/{TIMELINE_EVENTS.length} Complete
          </Badge>
        }
      />

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground-muted">Timeline Progress</span>
          <span className="font-bold text-foreground">{progress.toFixed(0)}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

        <div className="space-y-6">
          {TIMELINE_EVENTS.map((event) => {
            const typeConfig = TYPE_CONFIG[event.type];
            const statusConfig = STATUS_CONFIG[event.status];
            const TypeIcon = typeConfig.icon;
            return (
              <div key={event.id} className="relative flex gap-4">
                {/* Timeline dot */}
                <div className={cn(
                  'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  event.status === 'completed'
                    ? 'bg-success text-success-foreground'
                    : event.status === 'in-progress'
                      ? 'bg-warning text-warning-foreground'
                      : 'bg-surface-elevated text-foreground-muted'
                )}>
                  {event.status === 'completed' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <TypeIcon className="h-4 w-4" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-foreground">{event.title}</p>
                    <Badge tone={statusConfig.tone}>{statusConfig.label}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-foreground-muted">{event.description}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-foreground-muted">
                    <Calendar className="h-3 w-3" />
                    {new Date(event.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
