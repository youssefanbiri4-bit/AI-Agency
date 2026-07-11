'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BrandMark } from '@/components/brand/BrandMark';
import { MfaChallengeForm } from '@/components/auth/MfaChallengeForm';
import { getMfaStatusAction } from '@/actions/auth/mfa';
import { logout } from '@/lib/supabase-client';
import { Notice } from '@/components/ui/Notice';

export default function MfaVerificationPage() {
  const router = useRouter();
  const [redirectTo, setRedirectTo] = useState('/dashboard');
  const [isChecking, setIsChecking] = useState(true);
  const [requiresVerification, setRequiresVerification] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadState = async () => {
      await Promise.resolve();
      const params = new URLSearchParams(window.location.search);
      const nextPath = params.get('redirectTo');

      if (nextPath?.startsWith('/') && !nextPath.startsWith('//')) {
        setRedirectTo(nextPath);
      }

      try {
        const status = await getMfaStatusAction();

        if (!status.success) {
          setError(status.error ?? 'You must sign in before verifying MFA.');
          setRequiresVerification(false);
          return;
        }

        if (!status.requiresVerification) {
          router.replace(nextPath?.startsWith('/') ? nextPath : '/dashboard');
          router.refresh();
          return;
        }

        if (!status.enabled) {
          setError('No authenticator app is enrolled. Enable MFA in Settings first.');
          setRequiresVerification(false);
          return;
        }

        setRequiresVerification(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load MFA status.');
      } finally {
        setIsChecking(false);
      }
    };

    void loadState();
  }, [router]);

  const handleCancel = async () => {
    try {
      await logout();
    } finally {
      router.replace('/auth/login?message=Sign in again to continue');
      router.refresh();
    }
  };

  if (isChecking) {
    return (
      <div className="w-full max-w-md rounded-lg border border-black/8 bg-white p-8 text-center shadow-[0_28px_80px_rgba(0,0,0,0.10)]">
        <p className="text-sm text-black/58">Checking security requirements...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-black/8 bg-white p-5 shadow-[0_28px_80px_rgba(0,0,0,0.10)] sm:p-8">
      <div className="mb-8 text-center">
        <BrandMark href="/" size="lg" className="mb-7 justify-center" />
        <h1 className="mb-2 break-words text-3xl font-black text-black">Verify your identity</h1>
        <p className="text-black/58">Complete two-factor authentication to access your workspace.</p>
      </div>

      {error ? (
        <div className="space-y-4">
          <Notice tone="danger">{error}</Notice>
          <p className="text-center text-sm leading-6 text-black/58">
            <Link href="/auth/login" className="font-bold text-[#F7CBCA] hover:text-black">
              Return to sign in
            </Link>
            {' · '}
            <Link href="/dashboard/settings#security" className="font-bold text-[#F7CBCA] hover:text-black">
              Open security settings
            </Link>
          </p>
        </div>
      ) : requiresVerification ? (
        <MfaChallengeForm
          onVerified={() => {
            router.replace(redirectTo);
            router.refresh();
          }}
          onCancel={() => void handleCancel()}
        />
      ) : null}
    </div>
  );
}