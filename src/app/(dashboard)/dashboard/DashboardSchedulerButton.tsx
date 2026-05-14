'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';
import type { ContentStudioSchedulerSummary } from '@/lib/content-studio/scheduler-types';

function formatSummary(summary: ContentStudioSchedulerSummary) {
  if (summary.scanned === 0) {
    return 'No due scheduled items found.';
  }

  return `Scanned ${summary.scanned}, executed ${summary.executed}, succeeded ${summary.succeeded}.`;
}

export function DashboardSchedulerButton({ canRunScheduler }: { canRunScheduler: boolean }) {
  const [isRunning, setIsRunning] = useState(false);

  if (!canRunScheduler) {
    return null;
  }

  async function runScheduler() {
    if (isRunning) {
      return;
    }

    setIsRunning(true);
    const loadingToastId = toast.loading('Running scheduler...');

    try {
      const response = await fetch('/api/dashboard/content-studio/run-scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; data?: ContentStudioSchedulerSummary; error?: string }
        | null;

      if (!response.ok || !payload?.success || !payload.data) {
        toast.update(loadingToastId, {
          tone: 'error',
          title: 'Could not run scheduler.',
          description: payload?.error ?? 'Scheduler run failed.',
        });
        return;
      }

      toast.update(loadingToastId, {
        tone: 'success',
        title: 'Scheduler completed.',
        description: formatSummary(payload.data),
      });
    } catch (error) {
      toast.update(loadingToastId, {
        tone: 'error',
        title: 'Could not run scheduler.',
        description: error instanceof Error ? error.message : 'Scheduler run failed.',
      });
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <Button type="button" size="lg" variant="outline" onClick={runScheduler} disabled={isRunning}>
      <RefreshCw className={`h-5 w-5 ${isRunning ? 'animate-spin' : ''}`} />
      {isRunning ? 'Running...' : 'Run Scheduler Now'}
    </Button>
  );
}
