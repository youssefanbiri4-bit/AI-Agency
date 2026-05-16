'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { toast } from '@/components/ui/toast';
import type { ContentStudioSchedulerSummary } from '@/lib/content-studio/scheduler-types';

interface SchedulerControlsProps {
  canRunScheduler: boolean;
}

function formatCount(value: number) {
  return value.toLocaleString();
}

function countLabel(value: number) {
  return value === 0 ? '0' : formatCount(value);
}

export function SchedulerControls({ canRunScheduler }: SchedulerControlsProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [summary, setSummary] = useState<ContentStudioSchedulerSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canRunScheduler) {
    return null;
  }

  const handleRunScheduler = async () => {
    if (isRunning) {
      return;
    }

    const confirmed = window.confirm(
      'Run the secure scheduler now? / واش تشغل المجدول دابا؟ This may process due scheduled content only.'
    );

    if (!confirmed) {
      return;
    }

    setIsRunning(true);
    setError(null);

    const loadingToastId = toast.loading('Running scheduler...');

    try {
      const response = await fetch('/api/dashboard/content-studio/run-scheduler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; data?: ContentStudioSchedulerSummary; error?: string }
        | null;

      if (!response.ok || !payload?.success || !payload.data) {
        const message = payload?.error ?? 'Scheduler run failed.';
        setSummary(null);
        setError(message);
        toast.update(loadingToastId, {
          tone: 'error',
          title: 'Could not run scheduler.',
          description: message,
        });
        return;
      }

      setSummary(payload.data);
      const description =
        payload.data.scanned === 0
          ? 'No due scheduled items found.'
          : `Scanned ${formatCount(payload.data.scanned)} item${payload.data.scanned === 1 ? '' : 's'}.`;

      toast.update(loadingToastId, {
        tone: 'success',
        title: 'Scheduler completed.',
        description,
      });
    } catch (runError) {
      const message =
        runError instanceof Error ? runError.message : 'Scheduler run failed.';
      setSummary(null);
      setError(message);
      toast.update(loadingToastId, {
        tone: 'error',
        title: 'Could not run scheduler.',
        description: message,
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Scheduler Controls"
        description="Run the secure scheduler manually to process due scheduled content items without waiting for the next Vercel Cron run."
      />

      <div className="space-y-4">
        {error && (
          <Notice tone="danger" title="Scheduler run failed">
            {error}
          </Notice>
        )}

        {summary && (
          <div className="space-y-3">
            {summary.scanned === 0 ? (
              <Notice tone="info" title="No due scheduled items found.">
                The scheduler ran successfully but there were no scheduled items due right now.
              </Notice>
            ) : null}

            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="muted-panel p-4">
                <p className="font-bold text-black">Scanned</p>
                <p className="mt-1 text-black/62">{countLabel(summary.scanned)}</p>
              </div>
              <div className="muted-panel p-4">
                <p className="font-bold text-black">Executed</p>
                <p className="mt-1 text-black/62">{countLabel(summary.executed)}</p>
              </div>
              <div className="muted-panel p-4">
                <p className="font-bold text-black">Succeeded</p>
                <p className="mt-1 text-black/62">{countLabel(summary.succeeded)}</p>
              </div>
              <div className="muted-panel p-4">
                <p className="font-bold text-black">Failed</p>
                <p className="mt-1 text-black/62">{countLabel(summary.failed)}</p>
              </div>
              <div className="muted-panel p-4">
                <p className="font-bold text-black">Setup Required</p>
                <p className="mt-1 text-black/62">{countLabel(summary.setup_required)}</p>
              </div>
              <div className="muted-panel p-4">
                <p className="font-bold text-black">Approval Pending</p>
                <p className="mt-1 text-black/62">{countLabel(summary.approval_pending)}</p>
              </div>
              <div className="muted-panel p-4">
                <p className="font-bold text-black">Manual Only</p>
                <p className="mt-1 text-black/62">{countLabel(summary.manual_only)}</p>
              </div>
              <div className="muted-panel p-4">
                <p className="font-bold text-black">Unsupported</p>
                <p className="mt-1 text-black/62">{countLabel(summary.unsupported)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="muted-panel p-4">
                <p className="font-bold text-black">Skipped</p>
                <p className="mt-1 text-black/62">{countLabel(summary.skipped)}</p>
              </div>
              <div className="muted-panel p-4">
                <p className="font-bold text-black">Token Missing</p>
                <p className="mt-1 text-black/62">{countLabel(summary.token_missing)}</p>
              </div>
              <div className="muted-panel p-4">
                <p className="font-bold text-black">Billing Required</p>
                <p className="mt-1 text-black/62">{countLabel(summary.quota_limit)}</p>
              </div>
            </div>
          </div>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleRunScheduler();
          }}
        >
          <Button type="submit" disabled={isRunning}>
            <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'Running scheduler...' : 'Run Scheduler Now'}
          </Button>
        </form>
      </div>
    </Card>
  );
}
