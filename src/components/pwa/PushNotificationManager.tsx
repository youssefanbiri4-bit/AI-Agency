'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, BellRing, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

async function getSubscription(): Promise<PushSubscription | null> {
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

async function subscribePush(): Promise<PushSubscription | null> {
  if (!VAPID_PUBLIC_KEY) {
    toast.error('Push notifications not configured', {
      description: 'VAPID key is missing from environment.',
    });
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      toast.warning('Permission denied', {
        description: 'Notifications blocked by browser.',
      });
      return null;
    }

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
      credentials: 'include',
    });

    return subscription;
  } catch (err) {
    toast.error('Subscription failed', {
      description: err instanceof Error ? err.message : 'Unknown error',
    });
    return null;
  }
}

async function unsubscribePush(): Promise<boolean> {
  try {
    const subscription = await getSubscription();
    if (!subscription) return true;

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();

    await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
      credentials: 'include',
    });

    return true;
  } catch {
    return false;
  }
}

interface PushNotificationManagerProps {
  className?: string;
}

export function PushNotificationManager({ className }: PushNotificationManagerProps) {
  const [supported] = useState(() => isPushSupported());
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(
    () => (typeof Notification !== 'undefined' ? Notification.permission : 'default')
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supported) return;

    let cancelled = false;
    getSubscription().then((sub) => {
      if (!cancelled) setSubscribed(!!sub);
    });
    return () => { cancelled = true; };
  }, [supported]);

  const handleSubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const sub = await subscribePush();
      if (sub) {
        setSubscribed(true);
        setPermission('granted');
        toast.success('Notifications enabled', {
          description: "You'll receive updates for tasks and activity.",
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUnsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const ok = await unsubscribePush();
      if (ok) {
        setSubscribed(false);
        toast.info('Notifications disabled');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  if (!supported) return null;

  if (subscribed) {
    return (
      <button
        type="button"
        onClick={handleUnsubscribe}
        disabled={loading}
        className={cn(
          'inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-bold text-foreground transition-all duration-200',
          'hover:border-border-strong hover:bg-surface-elevated',
          'active:scale-[0.98]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          'disabled:opacity-60',
          className
        )}
        aria-label="Disable push notifications"
      >
        <BellRing className="h-4 w-4 text-success" />
        <span>Notifications on</span>
        <Check className="h-3.5 w-3.5 text-success" />
      </button>
    );
  }

  if (permission === 'denied') {
    return (
      <div
        className={cn(
          'inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-bold text-foreground-muted',
          className
        )}
      >
        <BellOff className="h-4 w-4" />
        <span>Notifications blocked</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSubscribe}
      disabled={loading}
      className={cn(
        'inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-bold text-primary transition-all duration-200',
        'hover:border-primary/50 hover:bg-primary/10',
        'active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        'disabled:opacity-60',
        className
      )}
      aria-label="Enable push notifications"
    >
      <Bell className="h-4 w-4" />
      <span>Enable notifications</span>
    </button>
  );
}
