'use client';

import Link from 'next/link';
import { CloudOff, Home, RotateCw, Wifi } from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface-elevated p-8 text-center shadow-[0_24px_60px_rgba(93,107,107,0.18)]">
        <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <CloudOff className="h-8 w-8" />
        </span>
        <h1 className="text-2xl font-black tracking-tight">You’re offline</h1>
        <p className="mt-3 text-sm leading-6 text-foreground-muted">
          AgentFlow AI can’t reach the network right now. Pages you’ve already visited are still
          available, and any actions you take will be saved and synced automatically when you
          reconnect.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={buttonStyles({ variant: 'primary', size: 'md' })}
          >
            <RotateCw className="h-4 w-4" />
            Try again
          </button>
          <Link href="/" className={buttonStyles({ variant: 'secondary', size: 'md' })}>
            <Home className="h-4 w-4" />
            Go home
          </Link>
        </div>

        <p className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-foreground-muted/70">
          <Wifi className="h-3.5 w-3.5" />
          We’ll reconnect you as soon as possible.
        </p>
      </div>
    </div>
  );
}
