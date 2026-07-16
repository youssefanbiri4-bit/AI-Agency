'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { toast } from '@/components/ui/toast';
import { queueMutation } from '@/lib/pwa/offline-queue';

const POLL_INTERVAL_MS = 3000;
const PROCESSING_TIMEOUT_MS = 120000;

interface RunTaskButtonProps {
  taskId: string;
  mode?: 'run' | 'retry';
  disabled?: boolean;
  disabledReason?: string;
}

interface ExecuteTaskResponse {
  success: boolean;
  error?: string;
}

export function RunTaskButton({
  taskId,
  mode = 'run',
  disabled = false,
  disabledReason,
}: RunTaskButtonProps) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRetry = mode === 'retry';
  const readyLabel = isRetry ? 'Retry Task' : 'Run Task';
  const disabledLabel = isRetry ? 'Retry Disabled' : 'Run Task Disabled';

  useEffect(() => {
    if (!isProcessing) return;

    const intervalId = window.setInterval(() => {
      router.refresh();
    }, POLL_INTERVAL_MS);

    const timeoutId = window.setTimeout(() => {
      window.clearInterval(intervalId);
      setHasTimedOut(true);
    }, PROCESSING_TIMEOUT_MS);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [isProcessing, router]);

  const runTask = async () => {
    if (disabled) {
      toast.warning('Task execution is currently guarded.', {
        description: disabledReason ?? 'Execution is not available yet for this task.',
      });
      return;
    }

    setError(null);

    const confirmed = window.confirm(
      isRetry
        ? 'Retry this task in n8n? / واش بغيتي تعاود تشغيل هاد المهمة؟'
        : 'Run this task in n8n now? / واش بغيتي تشغل هاد المهمة دابا؟'
    );

    if (!confirmed) {
      return;
    }

    setIsRunning(true);
    setIsProcessing(true);
    setHasTimedOut(false);
    const loadingToastId = toast.loading('Sending task to automation...');

    try {
      const outcome = await queueMutation({
        url: '/api/tasks/execute',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId }),
        label: 'Run task',
      });

      // Offline: the request was queued for Background Sync.
      if (outcome.kind === 'queued') {
        setIsProcessing(false);
        toast.update(loadingToastId, {
          tone: 'info',
          title: 'Task queued for sync.',
          description: 'You appear to be offline. It will run automatically when you reconnect.',
        });
        return;
      }

      const response = outcome.response;
      const payload = (await response.json()) as ExecuteTaskResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Task could not be sent to n8n.');
      }

      toast.update(loadingToastId, {
        tone: 'success',
        title: 'Task sent.',
        description: 'Processing has started and the task page will refresh automatically.',
      });
      router.refresh();
    } catch (err) {
      setIsProcessing(false);
      setError(err instanceof Error ? err.message : 'Task could not be sent to n8n.');
      toast.update(loadingToastId, {
        tone: 'error',
        title: 'Task was not sent.',
        description: err instanceof Error ? err.message : 'Task could not be sent to n8n.',
      });
      router.refresh();
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <Notice tone="danger" title="Task was not sent">
          {error}
        </Notice>
      )}

      {disabled && disabledReason && (
        <Notice tone="warning" title="Execution guarded">
          {disabledReason}
        </Notice>
      )}

      {hasTimedOut && (
        <Notice tone="info" title="Still processing">
          This task is still processing. You can leave this page and come back later.
        </Notice>
      )}

      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={isRunning || isProcessing}
        onClick={runTask}
      >
        {isRunning || isProcessing ? (
          <>
            <RotateCw className="h-5 w-5 animate-spin" />
            Processing
          </>
        ) : (
          <>
            {isRetry ? <RotateCw className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            {disabled ? disabledLabel : readyLabel}
          </>
        )}
      </Button>
    </div>
  );
}
