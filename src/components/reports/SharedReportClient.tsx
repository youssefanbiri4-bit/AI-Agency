'use client';

import { useState } from 'react';
import { Download, FileText, Lock, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/FormControls';
import { formatDateTime } from '@/lib/utils';

interface SharedReportClientProps {
  token: string;
  title?: string;
  expiresAt?: string;
  requiresPassword?: boolean;
  initialError?: string;
}

export function SharedReportClient({
  token,
  title,
  expiresAt,
  requiresPassword = false,
  initialError,
}: SharedReportClientProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError ?? '');
  const [loading, setLoading] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(requiresPassword);

  const requestAccess = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/reports/share/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() || undefined }),
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        if (payload.data?.requiresPassword) {
          setNeedsPassword(true);
        }
        throw new Error(payload.error || payload.message || 'Access denied.');
      }

      const signedUrl = payload.data?.signedUrl as string | undefined;
      const filename = (payload.data?.filename as string | undefined) || 'client-report.pdf';

      if (!signedUrl) {
        throw new Error('Signed download URL was not returned.');
      }

      const anchor = document.createElement('a');
      anchor.href = signedUrl;
      anchor.download = filename;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.click();
    } catch (accessError) {
      setError(accessError instanceof Error ? accessError.message : 'Failed to access report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg rounded-[28px] border border-black/7 bg-white/92 p-6 shadow-[0_24px_70px_rgba(93,107,107,0.08)] sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D5E5E5] text-[#5D6B6B]">
          <FileText className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#F7CBCA]">
            Shared Report
          </p>
          <h1 className="mt-2 text-2xl font-black text-[#5D6B6B]">
            {title || 'Client Report'}
          </h1>
          {expiresAt ? (
            <p className="mt-2 text-sm text-black/55">Link expires {formatDateTime(expiresAt)}</p>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mt-5 flex items-start gap-2 rounded-2xl border border-[#F7CBCA]/30 bg-[#F7CBCA]/8 p-4 text-sm text-[#8A4300]">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {needsPassword ? (
        <div className="mt-5">
          <label className="mb-1 block text-xs font-semibold text-black/50">Password</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter the share link password"
          />
          <p className="mt-2 flex items-center gap-1 text-[10px] text-black/45">
            <Lock className="h-3 w-3" />
            This link is password protected by the report owner.
          </p>
        </div>
      ) : null}

      <Button
        className="mt-6 w-full gap-2"
        onClick={requestAccess}
        disabled={loading || (needsPassword && !password.trim())}
      >
        <Download className="h-4 w-4" />
        {loading ? 'Preparing download...' : 'Download PDF'}
      </Button>
    </div>
  );
}

export default SharedReportClient;