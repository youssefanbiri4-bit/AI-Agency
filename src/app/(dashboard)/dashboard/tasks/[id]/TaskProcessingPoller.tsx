'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';

const POLL_INTERVAL_MS = 3000;
const PROCESSING_TIMEOUT_MS = 120000;

export function TaskProcessingPoller() {
  const router = useRouter();
  const [hasTimedOut, setHasTimedOut] = useState(false);

  useEffect(() => {
    router.refresh();

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
  }, [router]);

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
    </div>
  );
}
