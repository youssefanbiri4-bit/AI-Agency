'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  Building2,
  CreditCard,
  Users,
  Settings,
  Zap,
  ArrowRight,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  completed: boolean;
}

interface OnboardingChecklistProps {
  workspaceName: string;
  className?: string;
}

const STORAGE_KEY = 'af_onboarding_checklist';

export function OnboardingChecklist({
  workspaceName,
  className,
}: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        return data.dismissed || false;
      }
    } catch {}
    return false;
  });

  const [completedItems, setCompletedItems] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        return new Set(data.completed || []);
      }
    } catch {}
    return new Set<string>();
  });

  const markCompleted = useCallback((itemId: string) => {
    setCompletedItems((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          completed: Array.from(next),
          dismissed: false,
        }));
      } catch {}
      return next;
    });
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        completed: Array.from(completedItems),
        dismissed: true,
      }));
    } catch {}
  }, [completedItems]);

  const items: ChecklistItem[] = [
    {
      id: 'workspace',
      label: 'Create workspace',
      description: 'Your workspace is ready!',
      href: '/dashboard',
      icon: Building2,
      completed: true,
    },
    {
      id: 'plan',
      label: 'Select a plan',
      description: 'Choose the plan that fits your team.',
      href: '/dashboard/settings/billing',
      icon: CreditCard,
      completed: completedItems.has('plan'),
    },
    {
      id: 'invite',
      label: 'Invite team members',
      description: 'Collaborate with your team.',
      href: '/dashboard/settings',
      icon: Users,
      completed: completedItems.has('invite'),
    },
    {
      id: 'connect',
      label: 'Connect providers',
      description: 'Set up AI and social providers.',
      href: '/dashboard/settings',
      icon: Settings,
      completed: completedItems.has('connect'),
    },
    {
      id: 'first_task',
      label: 'Create your first task',
      description: 'Start automating your workflow.',
      href: '/dashboard/tasks',
      icon: Zap,
      completed: completedItems.has('first_task'),
    },
  ];

  const completedCount = items.filter((i) => i.completed).length;
  const progress = (completedCount / items.length) * 100;

  if (dismissed || completedCount === items.length) {
    return null;
  }

  return (
    <Card className={cn('border-primary/20 bg-primary/5', className)}>
      <CardHeader
        title="Getting Started"
        description={`Welcome to ${workspaceName}! Complete these steps to get set up.`}
        action={
          <button
            type="button"
            onClick={handleDismiss}
            className="text-foreground-muted hover:text-foreground"
            aria-label="Dismiss checklist"
          >
            <X className="h-5 w-5" />
          </button>
        }
      />

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground-muted">Progress</span>
          <span className="font-bold text-foreground">{completedCount}/{items.length}</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Checklist items */}
      <div className="space-y-3">
        {items.map((item) => {
          return (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3 transition-all',
                item.completed
                  ? 'border-success/20 bg-success/5'
                  : 'border-border bg-surface hover:border-border-strong'
              )}
            >
              {item.completed ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-foreground-muted" />
              )}

              <div className="flex-1 min-w-0">
                <p className={cn(
                  'font-bold text-foreground',
                  item.completed && 'line-through opacity-60'
                )}>
                  {item.label}
                </p>
                <p className="text-sm text-foreground-muted">{item.description}</p>
              </div>

              {!item.completed && (
                <Link href={item.href}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markCompleted(item.id)}
                  >
                    Go
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
