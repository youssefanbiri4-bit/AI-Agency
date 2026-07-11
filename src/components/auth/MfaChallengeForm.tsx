'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { verifyMfaLoginAction } from '@/actions/auth/mfa';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';

interface MfaChallengeFormProps {
  onVerified: () => void;
  onCancel?: () => void;
  title?: string;
  description?: string;
}

export function MfaChallengeForm({
  onVerified,
  onCancel,
  title = 'Two-factor authentication',
  description = 'Enter the 6-digit code from your authenticator app to finish signing in.',
}: MfaChallengeFormProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsVerifying(true);

    try {
      const result = await verifyMfaLoginAction(code);

      if (!result.success) {
        setError(result.error ?? 'Verification failed. Try again.');
        return;
      }

      onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-[#F7CBCA]/20 bg-[#D5E5E5]/40 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#F7CBCA] shadow-sm">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-black text-black">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-black/58">{description}</p>
        </div>
      </div>

      {error && (
        <Notice tone="danger" className="mb-0">
          {error}
        </Notice>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="mfa-code">Authenticator code</Label>
          <Input
            id="mfa-code"
            name="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            disabled={isVerifying}
            className="text-center text-lg tracking-[0.35em]"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" disabled={isVerifying || code.length !== 6} size="lg" className="w-full sm:flex-1">
            {isVerifying ? 'Verifying...' : 'Verify and continue'}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" disabled={isVerifying} onClick={onCancel} className="w-full sm:w-auto">
              Back
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}