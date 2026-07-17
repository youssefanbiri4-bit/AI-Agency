'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  LoaderCircle,
  ShieldAlert,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastTone = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface ToastAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface ToastOptions {
  description?: string;
  duration?: number;
  action?: ToastAction;
}

export interface ToastRecord extends ToastOptions {
  id: string;
  title: string;
  tone: ToastTone;
}

type ToastPatch = Partial<Omit<ToastRecord, 'id'>> & { title?: string };
type ToastListener = (toasts: ToastRecord[]) => void;

const DEFAULT_DURATION_MS = 4200;
const DEFAULT_ERROR_DURATION_MS = 5200;
const DEFAULT_WARNING_DURATION_MS = 4800;

let activeToasts: ToastRecord[] = [];
const listeners = new Set<ToastListener>();

function emit() {
  for (const listener of listeners) {
    listener(activeToasts);
  }
}

function subscribe(listener: ToastListener) {
  listeners.add(listener);
  listener(activeToasts);

  return () => {
    listeners.delete(listener);
  };
}

function createId() {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function resolveDuration(tone: ToastTone, duration?: number) {
  if (typeof duration === 'number') {
    return duration;
  }

  if (tone === 'loading') {
    return 0;
  }

  if (tone === 'error') {
    return DEFAULT_ERROR_DURATION_MS;
  }

  if (tone === 'warning') {
    return DEFAULT_WARNING_DURATION_MS;
  }

  return DEFAULT_DURATION_MS;
}

function addToast(tone: ToastTone, title: string, options: ToastOptions = {}) {
  const toast: ToastRecord = {
    id: createId(),
    tone,
    title,
    description: options.description,
    duration: resolveDuration(tone, options.duration),
    action: options.action,
  };

  activeToasts = [toast, ...activeToasts].slice(0, 6);
  emit();

  return toast.id;
}

function dismissToast(id: string) {
  activeToasts = activeToasts.filter((toast) => toast.id !== id);
  emit();
}

function updateToast(id: string, patch: ToastPatch) {
  activeToasts = activeToasts.map((toast) => {
    if (toast.id !== id) {
      return toast;
    }

    const nextTone = patch.tone ?? toast.tone;

    return {
      ...toast,
      ...patch,
      duration: resolveDuration(nextTone, patch.duration ?? toast.duration),
    };
  });

  emit();
}

export const toast = {
  success(title: string, options?: ToastOptions) {
    return addToast('success', title, options);
  },
  error(title: string, options?: ToastOptions) {
    return addToast('error', title, options);
  },
  warning(title: string, options?: ToastOptions) {
    return addToast('warning', title, options);
  },
  info(title: string, options?: ToastOptions) {
    return addToast('info', title, options);
  },
  loading(title: string, options?: ToastOptions) {
    return addToast('loading', title, options);
  },
  dismiss(id: string) {
    dismissToast(id);
  },
  update(id: string, patch: ToastPatch) {
    updateToast(id, patch);
  },
};

const ToastContext = createContext<typeof toast | null>(null);

const toneConfig: Record<
  ToastTone,
  {
    icon: typeof Info;
    cardClassName: string;
    iconClassName: string;
    actionClassName: string;
    borderColor: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    cardClassName: 'border-border bg-surface-elevated text-foreground shadow-[0_18px_46px_rgba(0,0,0,0.12)]',
    iconClassName: 'text-success',
    actionClassName: 'text-success hover:text-foreground',
    borderColor: 'border-l-success',
  },
  error: {
    icon: AlertCircle,
    cardClassName: 'border-border bg-surface-elevated text-foreground shadow-[0_18px_46px_rgba(0,0,0,0.12)]',
    iconClassName: 'text-danger',
    actionClassName: 'text-danger hover:text-foreground',
    borderColor: 'border-l-danger',
  },
  warning: {
    icon: ShieldAlert,
    cardClassName: 'border-border bg-surface-elevated text-foreground shadow-[0_18px_46px_rgba(0,0,0,0.10)]',
    iconClassName: 'text-warning',
    actionClassName: 'text-warning hover:text-foreground',
    borderColor: 'border-l-warning',
  },
  info: {
    icon: Info,
    cardClassName: 'border-border bg-surface-elevated text-foreground shadow-[0_18px_46px_rgba(0,0,0,0.10)]',
    iconClassName: 'text-info',
    actionClassName: 'text-info hover:text-foreground',
    borderColor: 'border-l-info',
  },
  loading: {
    icon: LoaderCircle,
    cardClassName: 'border-border bg-surface-elevated text-foreground shadow-[0_18px_46px_rgba(0,0,0,0.10)]',
    iconClassName: 'text-info',
    actionClassName: 'text-info hover:text-foreground',
    borderColor: 'border-l-info',
  },
};

function ToastActionLink({
  action,
  className,
}: {
  action: ToastAction;
  className: string;
}) {
  if (action.href) {
    return (
      <Link href={action.href} className={cn('text-sm font-bold transition-colors', className)}>
        {action.label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={action.onClick}
      className={cn('text-sm font-bold transition-colors', className)}
    >
      {action.label}
    </button>
  );
}

function ToastViewport({ toasts }: { toasts: ToastRecord[] }) {
  useEffect(() => {
    const timeouts = toasts
      .filter((toast) => (toast.duration ?? 0) > 0)
      .map((toast) =>
        window.setTimeout(() => {
          dismissToast(toast.id);
        }, toast.duration)
      );

    return () => {
      for (const timeout of timeouts) {
        window.clearTimeout(timeout);
      }
    };
  }, [toasts]);

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-4 end-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 sm:bottom-6 sm:end-6"
    >
      {toasts.map((item) => {
        const config = toneConfig[item.tone];
        const Icon = config.icon;

        return (
          <div
            key={item.id}
            role={item.tone === 'error' || item.tone === 'warning' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto toast-enter rounded-xl border border-l-[3px] px-4 py-3 backdrop-blur-xl',
              'transition-all duration-200 ease-out',
              'hover:shadow-lg',
              config.cardClassName,
              config.borderColor
            )}
          >
            <div className="flex items-start gap-3">
              <Icon
                className={cn(
                  'mt-0.5 h-5 w-5 shrink-0',
                  config.iconClassName,
                  item.tone === 'loading' && 'animate-spin'
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-5">{item.title}</p>
                {item.description ? (
                  <p className="mt-1 text-sm leading-5 text-foreground-muted">
                    {item.description}
                  </p>
                ) : null}
                {item.action ? (
                  <div className="mt-2">
                    <ToastActionLink action={item.action} className={config.actionClassName} />
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => dismissToast(item.id)}
                className="rounded-md p-1 text-foreground-muted/36 transition-colors hover:bg-foreground-muted/10 hover:text-foreground-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const value = useMemo(() => toast, []);

  useEffect(() => subscribe(setToasts), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);

  if (!value) {
    throw new Error('useToast must be used within ToastProvider.');
  }

  return value;
}
