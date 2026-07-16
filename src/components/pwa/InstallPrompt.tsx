'use client';

import { useState } from 'react';
import { Download, Share, Smartphone, Star, X } from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';
import { usePWA } from './PWAProvider';

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream
  );
}

function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function InstallPrompt() {
  const { canInstall, isInstalled, promptInstall, dismissInstall } = usePWA();
  const [dismissed, setDismissed] = useState(() => {
    try {
      const ts = window.localStorage.getItem('af-install-dismiss-ts');
      if (ts && Date.now() - Number(ts) < DISMISS_COOLDOWN_MS) return true;
      return window.localStorage.getItem('af-install-dismissed') === '1';
    } catch {
      return false;
    }
  });
  const [iosHintDismissed, setIosHintDismissed] = useState(dismissed);

  const showChromiumPrompt = canInstall && !isInstalled && !dismissed;
  const showIosHint = isIOS() && isSafari() && !isInstalled && !iosHintDismissed && !dismissed;

  if (!showChromiumPrompt && !showIosHint) return null;

  const handleDismiss = () => {
    setDismissed(true);
    dismissInstall();
    setIosHintDismissed(true);
    try {
      window.localStorage.setItem('af-install-dismiss-ts', String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      role="region"
      aria-label="Install AgentFlow AI"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex justify-center px-4 pb-4 sm:pb-6"
    >
      <div className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-[0_18px_46px_rgba(0,0,0,0.18)] backdrop-blur-xl">
        {showIosHint ? (
          <div className="p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Smartphone className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">Install AgentFlow AI</p>
                <p className="mt-1 text-sm leading-5 text-foreground-muted">
                  Add to your Home Screen for the full app experience.
                </p>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 rounded-lg bg-surface p-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground-muted/10">
                      <Share className="h-4 w-4 text-foreground-muted" />
                    </span>
                    <span className="text-xs text-foreground-muted">
                      Tap the <strong>Share</strong> button below
                    </span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-surface p-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground-muted/10">
                      <Download className="h-4 w-4 text-foreground-muted" />
                    </span>
                    <span className="text-xs text-foreground-muted">
                      Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className={buttonStyles({ variant: 'ghost', size: 'sm' })}
                  >
                    Got it
                  </button>
                </div>
              </div>
              <button
                type="button"
                aria-label="Dismiss install prompt"
                onClick={handleDismiss}
                className="rounded-md p-1 text-foreground-muted/50 transition-colors hover:bg-foreground-muted/10 hover:text-foreground-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Download className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">Install AgentFlow AI</p>
                <p className="mt-1 text-sm leading-5 text-foreground-muted">
                  Add to your home screen for a faster, app-like experience — works offline too.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={promptInstall}
                    className={buttonStyles({ variant: 'primary', size: 'sm' })}
                  >
                    <Download className="h-4 w-4" />
                    Install
                  </button>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className={buttonStyles({ variant: 'ghost', size: 'sm' })}
                  >
                    Not now
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[10px] text-foreground-muted/60">
                  <Star className="h-3 w-3" />
                  <span>Fast, offline-ready, no app store needed</span>
                </div>
              </div>
              <button
                type="button"
                aria-label="Dismiss install prompt"
                onClick={handleDismiss}
                className="rounded-md p-1 text-foreground-muted/50 transition-colors hover:bg-foreground-muted/10 hover:text-foreground-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
