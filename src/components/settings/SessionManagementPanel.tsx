'use client';

import { useCallback, useEffect, useState } from 'react';
import { LogOut, MonitorSmartphone, RefreshCw, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  getSessionInfoAction,
  logoutAllDevicesAction,
  logoutSessionAction,
  refreshSessionAction,
} from '@/actions/auth/session';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { toast } from '@/components/ui/toast';

export function SessionManagementPanel() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [idleTimeoutMinutes, setIdleTimeoutMinutes] = useState(45);
  const [lastActivityAt, setLastActivityAt] = useState<string | null>(null);
  const [sessionIp, setSessionIp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSessionInfo = useCallback(async () => {
    setError(null);

    try {
      const info = await getSessionInfoAction();
      if (!info.success) {
        setError(info.error ?? 'Could not load session details.');
        return;
      }

      setIdleTimeoutMinutes(info.idleTimeoutMinutes ?? 45);
      setLastActivityAt(info.lastActivityAt ?? null);
      setSessionIp(info.sessionIp ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load session details.');
    }
  }, []);

  // TODO(wave2+): Refactor to avoid setState in effect.
  // Current pattern is intentional for initial data loading.
  // Revisit when introducing React Query / data-fetching layer.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadSessionInfo().then(() => {
      setTimeout(() => setIsLoading(false), 0);
    });
  }, [loadSessionInfo]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleRefreshSession = async () => {
    setIsProcessing(true);
    try {
      const result = await refreshSessionAction();
      if (!result.success) {
        throw new Error(result.error ?? 'Session refresh failed.');
      }

      toast.success('Session refreshed.');
      await loadSessionInfo();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Session refresh failed.';
      toast.error('Refresh failed.', { description: message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogoutAllDevices = async () => {
    const confirmed = window.confirm(
      'Sign out from every device? You will need to sign in again on this browser too.'
    );

    if (!confirmed) {
      return;
    }

    setIsProcessing(true);
    try {
      const result = await logoutAllDevicesAction();
      if (!result.success) {
        throw new Error(result.error ?? 'Could not sign out from all devices.');
      }

      toast.success('Signed out from all devices.');
      router.replace('/auth/login?message=Signed out from all devices');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not sign out from all devices.';
      toast.error('Logout failed.', { description: message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSignOutHere = async () => {
    setIsProcessing(true);
    try {
      const result = await logoutSessionAction('local');
      if (!result.success) {
        throw new Error(result.error ?? 'Could not sign out.');
      }

      toast.success('Signed out.');
      router.replace('/auth/login?message=Signed out');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not sign out.';
      toast.error('Sign out failed.', { description: message });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-black/58">Loading session security settings...</p>;
  }

  return (
    <div className="space-y-4">
      {error && <Notice tone="danger">{error}</Notice>}

      <div className="muted-panel space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-black/75">
            <MonitorSmartphone className="h-4 w-4 text-[#F7CBCA]" />
            Session policy
          </span>
          <StatusBadge status="Ready" type="system" size="sm" />
        </div>
        <p className="text-sm leading-6 text-black/58">
          Sessions expire after {idleTimeoutMinutes} minutes of inactivity. Refresh tokens rotate on
          every renewal to reduce replay risk.
        </p>
        {lastActivityAt && (
          <p className="text-xs text-black/45">
            Last activity: {new Date(lastActivityAt).toLocaleString()}
          </p>
        )}
        {sessionIp && (
          <p className="text-xs text-black/45">Trusted network fingerprint: {sessionIp}</p>
        )}
      </div>

      <Notice tone="info" title="Suspicious activity protection">
        <span className="inline-flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Idle timeouts and network changes automatically end the session and require a fresh sign-in.
        </span>
      </Notice>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={isProcessing} onClick={() => void handleRefreshSession()}>
          <RefreshCw className="h-4 w-4" />
          Refresh session
        </Button>
        <Button type="button" variant="danger" disabled={isProcessing} onClick={() => void handleLogoutAllDevices()}>
          <LogOut className="h-4 w-4" />
          Logout from all devices
        </Button>
        <Button type="button" variant="outline" disabled={isProcessing} onClick={() => void handleSignOutHere()}>
          Sign out on this device
        </Button>
      </div>
    </div>
  );
}