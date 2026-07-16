'use client';

import { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'feature';
  url?: string;
  createdAt: string;
}

interface AnnouncementBannerProps {
  announcements: Announcement[];
  onDismiss: (id: string) => void;
  className?: string;
}

const TYPE_STYLES: Record<string, string> = {
  info: 'border-info/30 bg-info/5',
  warning: 'border-warning/30 bg-warning/5',
  success: 'border-success/30 bg-success/5',
  feature: 'border-primary/30 bg-primary/5',
};

const TYPE_DOT: Record<string, string> = {
  info: 'bg-info',
  warning: 'bg-warning',
  success: 'bg-success',
  feature: 'bg-primary',
};

export function AnnouncementBanner({ announcements, onDismiss, className }: AnnouncementBannerProps) {
  if (announcements.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      {announcements.map((a) => (
        <div
          key={a.id}
          role="status"
          className={cn(
            'flex items-start gap-3 rounded-xl border px-4 py-3 transition-all',
            TYPE_STYLES[a.type] ?? TYPE_STYLES.info
          )}
        >
          <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', TYPE_DOT[a.type])} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">{a.title}</p>
            <p className="mt-0.5 text-xs leading-5 text-foreground-muted">{a.message}</p>
            {a.url && (
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-block text-xs font-bold text-primary hover:underline"
              >
                Learn more
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(a.id)}
            aria-label={`Dismiss: ${a.title}`}
            className="shrink-0 rounded-md p-1 text-foreground-muted/50 transition-colors hover:bg-foreground-muted/10 hover:text-foreground-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

interface UseAnnouncementsReturn {
  visible: Announcement[];
  dismiss: (id: string) => void;
}

const STORAGE_KEY = 'af-announcements-dismissed';

export function useAnnouncements(all: Announcement[]): UseAnnouncementsReturn {
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch { /* */ }
      return next;
    });
  }, []);

  const visible = all.filter((a) => !dismissed.has(a.id));
  return { visible, dismiss };
}
