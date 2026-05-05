'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ClipboardCopy } from 'lucide-react';
import { Button } from '@/components/ui/Button';

type CopyStatus = 'idle' | 'copied' | 'failed' | 'unsupported';

interface CopyReportButtonProps {
  markdown: string;
}

export function CopyReportButton({ markdown }: CopyReportButtonProps) {
  const [status, setStatus] = useState<CopyStatus>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const resetStatusSoon = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => setStatus('idle'), 2800);
  };

  const handleCopy = async () => {
    if (!markdown.trim()) {
      setStatus('failed');
      resetStatusSoon();
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setStatus('unsupported');
      resetStatusSoon();
      return;
    }

    try {
      await navigator.clipboard.writeText(markdown);
      setStatus('copied');
    } catch {
      setStatus('failed');
    } finally {
      resetStatusSoon();
    }
  };

  const copySucceeded = status === 'copied';
  const statusMessage =
    status === 'unsupported'
      ? 'Clipboard unavailable'
      : status === 'failed'
        ? 'Copy failed'
        : copySucceeded
          ? 'Copied'
          : null;

  return (
    <div className="flex min-w-0 flex-col items-stretch gap-2 sm:items-end">
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        aria-label="Copy client-ready report as Markdown"
      >
        {copySucceeded ? <CheckCircle2 className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
        {copySucceeded ? 'Copied' : 'Copy Report'}
      </Button>
      {statusMessage && (
        <p className="text-xs font-semibold text-black/48" aria-live="polite">
          {statusMessage}
        </p>
      )}
    </div>
  );
}
