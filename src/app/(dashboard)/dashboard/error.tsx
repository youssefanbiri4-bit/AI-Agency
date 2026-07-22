'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Settings } from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('[dashboard] render boundary caught an error', error);
    console.error('!!! EXPOSED DASHBOARD CRASH !!!', { message: error.message, stack: error.stack, digest: error.digest });
  }, [error]);

  return (
    <div className="-mx-4 -my-6 min-h-screen bg-[var(--theme-background,#F1F7F7)] px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <Notice tone="warning" title="Dashboard recovered safely">
          One dashboard section failed while loading. The navigation and workspace shell are still available, and you can retry the dashboard without refreshing the whole app.
        </Notice>

        <section className="rounded-2xl border border-black/7 bg-white/90 p-6 shadow-[0_24px_70px_rgba(93,107,107,0.08)]">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F1F7F7] text-[#F7CBCA]">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-black text-[#5D6B6B]">Dashboard data is temporarily unavailable</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-black/58">
                This fallback prevents an infinite loading screen. Retry the route, or open Settings/System Health to check provider and workspace status.
              </p>
              {error.digest ? (
                <p className="mt-3 font-mono text-xs text-black/42">Digest: {error.digest}</p>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-col gap-2 sm:min-w-48">
              <button
                type="button"
                onClick={() => unstable_retry()}
                className={buttonStyles({ size: 'lg', className: 'w-full' })}
              >
                <RefreshCw className="h-5 w-5" />
                Retry dashboard
              </button>
              <Link
                href="/dashboard/settings"
                className={buttonStyles({ variant: 'outline', size: 'lg', className: 'w-full' })}
              >
                <Settings className="h-5 w-5" />
                Open settings
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
