'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';

const POLL_INTERVAL_MS = 3000;
const PROCESSING_TIMEOUT_MS = 120000;
const STALE_PROCESSING_TIMEOUT_MS = 12 * 60 * 1000;

interface TaskProcessingPollerProps {
  taskId: string;
  updatedAt: string;
}

function getStaleProcessingDelay(updatedAt: string) {
  const updatedAtMs = Date.parse(updatedAt);

  if (Number.isNaN(updatedAtMs)) {
    return STALE_PROCESSING_TIMEOUT_MS;
  }

  return Math.max(STALE_PROCESSING_TIMEOUT_MS - (Date.now() - updatedAtMs), 0);
}

export function TaskProcessingPoller({ taskId, updatedAt }: TaskProcessingPollerProps) {
  const router = useRouter();
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [isCheckingStale, setIsCheckingStale] = useState(false);

  useEffect(() => {
    let isMounted = true;
    router.refresh();

    const intervalId = window.setInterval(() => {
      router.refresh();
    }, POLL_INTERVAL_MS);

    const timeoutId = window.setTimeout(() => {
      window.clearInterval(intervalId);
      setHasTimedOut(true);
    }, PROCESSING_TIMEOUT_MS);

    const staleTimeoutId = window.setTimeout(() => {
      void (async () => {
        if (isMounted) {
          setIsCheckingStale(true);
        }

        try {
          await fetch('/api/tasks/fail-stale', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ task_id: taskId }),
          });
        } finally {
          if (isMounted) {
            setIsCheckingStale(false);
            router.refresh();
          }
        }
      })();
    }, getStaleProcessingDelay(updatedAt));

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
      window.clearTimeout(staleTimeoutId);
    };
  }, [router, taskId, updatedAt]);

  return (
    <div className="space-y-3">
      <Button type="button" size="lg" className="w-full" disabled>
        <RotateCw className="h-5 w-5 animate-spin" />
        Processing
      </Button>

      {hasTimedOut && (
        <Notice tone="info" title="Still processing">
          This task is still processing. You can leave this page and come back later.
        </Notice>
      )}

      {isCheckingStale && (
        <Notice tone="info" title="Checking task status">
          This task has been processing for a while. Checking whether it should be marked failed.
        </Notice>
      )}
    </div>
  );
}
