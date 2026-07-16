'use client';

import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { AnnouncementBanner, useAnnouncements } from '@/components/customer-success/AnnouncementBanner';
import type { Announcement } from '@/components/customer-success/AnnouncementBanner';

interface AnnouncementContextValue {
  announcements: Announcement[];
  visible: Announcement[];
  addAnnouncement: (a: Announcement) => void;
  removeAnnouncement: (id: string) => void;
  dismiss: (id: string) => void;
}

const AnnouncementContext = createContext<AnnouncementContextValue | null>(null);

export function useAnnouncementContext() {
  const ctx = useContext(AnnouncementContext);
  if (!ctx) throw new Error('useAnnouncementContext must be used within AnnouncementProvider');
  return ctx;
}

interface AnnouncementProviderProps {
  children: ReactNode;
  initial?: Announcement[];
}

export function AnnouncementProvider({ children, initial = [] }: AnnouncementProviderProps) {
  const [all, setAll] = useState<Announcement[]>(initial);
  const { visible, dismiss } = useAnnouncements(all);

  const addAnnouncement = useCallback((a: Announcement) => {
    setAll((prev) => [...prev, a]);
  }, []);

  const removeAnnouncement = useCallback((id: string) => {
    setAll((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const value = useMemo<AnnouncementContextValue>(
    () => ({ announcements: all, visible, addAnnouncement, removeAnnouncement, dismiss }),
    [all, visible, addAnnouncement, removeAnnouncement, dismiss]
  );

  return (
    <AnnouncementContext.Provider value={value}>
      {children}
      {visible.length > 0 && (
        <div className="fixed bottom-20 left-4 right-4 z-[80] max-w-2xl sm:left-auto sm:right-4">
          <AnnouncementBanner announcements={visible} onDismiss={dismiss} />
        </div>
      )}
    </AnnouncementContext.Provider>
  );
}
