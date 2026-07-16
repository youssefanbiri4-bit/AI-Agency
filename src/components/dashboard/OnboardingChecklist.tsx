'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, Sparkles, X } from 'lucide-react';
import { useLanguage } from '@/i18n/context';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'af_onboarding_checklist_dismissed';

interface OnboardingStep {
  id: string;
  label: string;
  href: string;
  done: boolean;
}

interface OnboardingChecklistProps {
  hasTasks?: boolean;
  hasProjects?: boolean;
  hasContent?: boolean;
  hasProviders?: boolean;
  hasBrandKit?: boolean;
  hasTeamMembers?: boolean;
}

export function OnboardingChecklist({
  hasTasks = false,
  hasProjects = false,
  hasContent = false,
  hasProviders = false,
  hasBrandKit = false,
  hasTeamMembers = false,
}: OnboardingChecklistProps) {
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(false);

  const steps = useMemo<OnboardingStep[]>(
    () => [
      { id: 'task', label: t('onboarding.stepTask', 'Create your first task'), href: '/dashboard/tasks', done: hasTasks },
      {
        id: 'project',
        label: t('onboarding.stepProject', 'Create your first project'),
        href: '/dashboard/projects',
        done: hasProjects,
      },
      {
        id: 'content',
        label: t('onboarding.stepContent', 'Publish your first content'),
        href: '/dashboard/content-studio',
        done: hasContent,
      },
      {
        id: 'brandKit',
        label: t('onboarding.stepBrandKit', 'Set up your brand kit'),
        href: '/dashboard/settings?tab=brand',
        done: hasBrandKit,
      },
      {
        id: 'provider',
        label: t('onboarding.stepProvider', 'Connect an AI or social provider'),
        href: '/dashboard/settings',
        done: hasProviders,
      },
      {
        id: 'team',
        label: t('onboarding.stepTeam', 'Invite team members'),
        href: '/dashboard/referrals',
        done: hasTeamMembers,
      },
    ],
    [hasTasks, hasProjects, hasContent, hasBrandKit, hasProviders, hasTeamMembers, t]
  );

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const allDone = completed === total;

  if (dismissed || (typeof window !== 'undefined' && window.localStorage.getItem(DISMISS_KEY) === '1' && allDone)) {
    return null;
  }

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <section
      className="rounded-2xl border border-border bg-gradient-to-br from-primary-light/40 to-surface p-5"
      aria-label={t('onboarding.title', 'Get started')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            {t('onboarding.title', 'Get started with AgentFlow AI')}
          </h2>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t('common.close', 'Close')}
          className="rounded-md p-1 text-foreground-muted transition-colors hover:bg-surface-elevated hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-1 text-sm text-foreground-muted">
        {allDone
          ? t('onboarding.allDone', "You're all set. Explore the dashboard anytime.")
          : t('onboarding.description', 'Complete these steps to get your workspace running.')}
      </p>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${(completed / total) * 100}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-foreground-muted">
        {t('onboarding.progress', '{{completed}} of {{total}} complete')
          .replace('{{completed}}', String(completed))
          .replace('{{total}}', String(total))}
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-foreground-muted" />
              )}
              <span className={cn('truncate text-sm', step.done ? 'text-foreground-muted line-through' : 'text-foreground')}>
                {step.label}
              </span>
            </span>
            {!step.done ? (
              <Link href={step.href} className="shrink-0">
                <Button variant="soft" size="sm">
                  {t('onboarding.start', 'Start')}
                </Button>
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
