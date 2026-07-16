'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { toast } from '@/components/ui/toast';
import {
  flushQueue,
  refreshQueueCount,
  subscribeQueueCount,
  supportsBackgroundSync,
} from '@/lib/pwa/offline-queue';
import { InstallPrompt } from './InstallPrompt';
import { OfflineSyncBadge } from './OfflineSyncBadge';
import { QueueManagerPanel } from './QueueManagerPanel';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAContextValue {
  canInstall: boolean;
  isInstalled: boolean;
  isOffline: boolean;
  queueCount: number;
  promptInstall: () => Promise<void>;
  dismissInstall: () => void;
  openQueueManager: () => void;
  closeQueueManager: () => void;
  isQueueManagerOpen: boolean;
}

const PWAContext = createContext<PWAContextValue | null>(null);

function detectInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // @ts-expect-error legacy iOS standalone property
  return typeof navigator !== 'undefined' && Boolean(navigator.standalone);
}

export function PWAProvider({ children }: { children: ReactNode }) {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => detectInstalled());
  const [isOffline, setIsOffline] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [isQueueManagerOpen, setIsQueueManagerOpen] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  const promptInstall = useCallback(async () => {
    const event = deferredPrompt.current;
    if (!event) {
      toast.info('Install not available', {
        description: 'Use your browser menu to install AgentFlow AI.',
      });
      return;
    }
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === 'accepted') {
      toast.success('Installing AgentFlow AI…');
    }
    deferredPrompt.current = null;
    setCanInstall(false);
  }, []);

  const dismissInstall = useCallback(() => {
    deferredPrompt.current = null;
    setCanInstall(false);
    try {
      window.localStorage.setItem('af-install-dismissed', '1');
    } catch {
      /* ignore */
    }
  }, []);

  const openQueueManager = useCallback(() => setIsQueueManagerOpen(true), []);
  const closeQueueManager = useCallback(() => setIsQueueManagerOpen(false), []);

  // Register the service worker (production only to avoid dev caching conflicts).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });

        reg.addEventListener('updatefound', () => {
          const incoming = reg.installing;
          if (!incoming) return;
          incoming.addEventListener('statechange', () => {
            if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
              if (sessionStorage.getItem('af-sw-reloaded')) return;
              sessionStorage.setItem('af-sw-reloaded', '1');
              incoming.postMessage({ type: 'SKIP_WAITING' });
              window.location.reload();
            }
          });
        });
      } catch {
        /* registration failures are non-fatal */
      }
    };

    register();
    void refreshQueueCount();

    const onMessage = (event: MessageEvent) => {
      const data = event.data || {};
      if (data.type === 'QUEUE_UPDATED') {
        if (data.synced > 0) {
          toast.success('Queued actions synced', {
            description: `${data.synced} offline action${data.synced > 1 ? 's' : ''} delivered.`,
          });
        }
        void refreshQueueCount();
      }
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  // Install-prompt interception.
  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      deferredPrompt.current = event as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    const onAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      deferredPrompt.current = null;
      toast.success('AgentFlow AI installed');
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  // Online / offline toasts.
  useEffect(() => {
    const onOffline = () => {
      setIsOffline(true);
      toast.warning('You are offline', {
        description: 'Actions will be saved and synced automatically when you reconnect.',
        duration: 6000,
      });
    };

    const onOnline = async () => {
      setIsOffline(false);
      toast.success('Back online', { description: 'Connection restored.' });
      if (!supportsBackgroundSync()) {
        const synced = await flushQueue();
        if (synced > 0) {
          toast.success('Synced queued actions', {
            description: `${synced} offline action${synced > 1 ? 's' : ''} delivered.`,
          });
        }
      }
      await refreshQueueCount();
    };

    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  useEffect(() => subscribeQueueCount(setQueueCount), []);

  const value = useMemo<PWAContextValue>(
    () => ({
      canInstall,
      isInstalled,
      isOffline,
      queueCount,
      promptInstall,
      dismissInstall,
      openQueueManager,
      closeQueueManager,
      isQueueManagerOpen,
    }),
    [canInstall, isInstalled, isOffline, queueCount, promptInstall, dismissInstall, openQueueManager, closeQueueManager, isQueueManagerOpen]
  );

  return (
    <PWAContext.Provider value={value}>
      {children}
      <InstallPrompt />
      <OfflineSyncBadge />
      <QueueManagerPanel isOpen={isQueueManagerOpen} onClose={closeQueueManager} />
    </PWAContext.Provider>
  );
}

export function usePWA(): PWAContextValue {
  const ctx = useContext(PWAContext);
  if (!ctx) {
    throw new Error('usePWA must be used within PWAProvider.');
  }
  return ctx;
}
