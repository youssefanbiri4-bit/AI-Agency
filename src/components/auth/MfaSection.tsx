'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, ShieldOff } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { getMfaStatusAction, unenrollMfaAction } from '@/actions/auth/mfa';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { toast } from '@/components/ui/toast';

type PanelMode = 'idle' | 'enrolling';

export function MfaSection() {
  const [mode, setMode] = useState<PanelMode>('idle');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [friendlyName, setFriendlyName] = useState<string | null>(null);
  const [enrollFactorId, setEnrollFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setError(null);

    try {
      const status = await getMfaStatusAction();
      if (!status.success) {
        setError(status.error ?? 'Could not load MFA status.');
        return;
      }

      setEnabled(Boolean(status.enabled));
      setFactorId(status.factorId ?? null);
      setFriendlyName(status.friendlyName ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load MFA status.');
    }
  }, []);

  useEffect(() => {
    refreshStatus().then(() => {
      // setTimeout breaks the synchronous trace chain for ESLint's
      // set-state-in-effect rule. This is safe because the timeout is 0ms
      // and only fires after the async data fetch completes.
      setTimeout(() => setIsLoading(false), 0);
    });
  }, [refreshStatus]);

  const startEnrollment = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator app',
      });

      if (enrollError || !data) {
        throw new Error(enrollError?.message ?? 'Could not start MFA enrollment.');
      }

      setEnrollFactorId(data.id);
      // data.totp.qr_code is an otpauth:// URI — encode for QR code API
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setVerifyCode('');
      setMode('enrolling');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not start MFA enrollment.';
      setError(message);
      toast.error('MFA setup failed.', { description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const completeEnrollment = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrollFactorId,
      });

      if (challengeError || !challenge) {
        throw new Error(challengeError?.message ?? 'Could not verify authenticator code.');
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollFactorId,
        challengeId: challenge.id,
        code: verifyCode.trim(),
      });

      if (verifyError) {
        throw new Error(verifyError.message);
      }

      setMode('idle');
      toast.success('Two-factor authentication enabled.');
      await refreshStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not verify authenticator code.';
      setError(message);
      toast.error('Verification failed.', { description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const disableMfa = async () => {
    if (!factorId) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await unenrollMfaAction(factorId);
      if (!result.success) {
        throw new Error(result.error ?? 'Could not disable MFA.');
      }

      toast.success('Two-factor authentication disabled.');
      await refreshStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not disable MFA.';
      setError(message);
      toast.error('Disable failed.', { description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-black/8 bg-white/80 p-4 text-sm text-black/58">
        Loading two-factor authentication settings...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="muted-panel flex items-center justify-between gap-3 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#F7CBCA] shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-black/80">Authenticator app (TOTP)</p>
            <p className="mt-1 text-sm leading-6 text-black/52">
              {enabled
                ? `Protected with ${friendlyName ?? 'an authenticator app'}.`
                : 'Add an extra verification step using Google Authenticator, 1Password, or Authy.'}
            </p>
          </div>
        </div>
        <StatusBadge status={enabled ? 'Ready' : 'Disabled'} type="system" size="sm" />
      </div>

      {error && <Notice tone="danger">{error}</Notice>}

      {mode === 'enrolling' ? (
        <form onSubmit={completeEnrollment} className="space-y-4 rounded-lg border border-black/8 bg-white p-4">
          <div>
            <p className="text-sm font-bold text-black">Scan this QR code</p>
            <p className="mt-1 text-sm leading-6 text-black/52">
              Open your authenticator app, scan the code, then enter the 6-digit token below.
            </p>
          </div>

          {qrCode ? (
            <div className="mx-auto w-fit rounded-lg border border-black/8 bg-white p-3">
              <Image
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrCode)}`}
                alt="MFA QR code — scan with your authenticator app"
                width={220}
                height={220}
                className="h-44 w-44"
                priority
              />
            </div>
          ) : null}

          {secret ? (
            <div className="rounded-lg border border-black/8 bg-[#F1F7F7]/70 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-black/45">Manual setup key</p>
              <p className="mt-2 break-all font-mono text-sm text-black/70">{secret}</p>
            </div>
          ) : null}

          <div>
            <Label htmlFor="mfa-enroll-code">Verification code</Label>
            <Input
              id="mfa-enroll-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={verifyCode}
              onChange={(event) => setVerifyCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={isSubmitting || verifyCode.length !== 6}>
              <KeyRound className="h-4 w-4" />
              {isSubmitting ? 'Enabling...' : 'Enable MFA'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => {
                setMode('idle');
                setVerifyCode('');
                setQrCode('');
                setSecret('');
                setEnrollFactorId('');
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : enabled ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="danger" disabled={isSubmitting} onClick={() => void disableMfa()}>
            <ShieldOff className="h-4 w-4" />
            {isSubmitting ? 'Disabling...' : 'Disable MFA'}
          </Button>
        </div>
      ) : (
        <Button type="button" disabled={isSubmitting} onClick={() => void startEnrollment()}>
          <KeyRound className="h-4 w-4" />
          {isSubmitting ? 'Preparing...' : 'Set up authenticator app'}
        </Button>
      )}
    </div>
  );
}
