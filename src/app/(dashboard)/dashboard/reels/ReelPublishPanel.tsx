'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Settings } from 'lucide-react';
import Link from 'next/link';
import { publishReelAction, type PublishReelActionState } from './actions';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { toast } from '@/components/ui/toast';
import { useActionToast } from '@/components/ui/useActionToast';
import type { InstagramPublishingState } from '@/lib/ads/instagram-publishing';
import type { ReelStatus } from '@/types/database';

interface ReelPublishPanelProps {
  reelId: string;
  status: ReelStatus;
  readiness: InstagramPublishingState;
  publishedPermalink?: string | null;
  errorMessage?: string | null;
}

const initialState: PublishReelActionState = {
  error: null,
  published: false,
};

type ReadinessBadgeStatus = 'processing' | 'completed' | 'failed' | 'Ready' | 'Setup Required';

function statusBadge(status: ReelStatus, readiness: InstagramPublishingState): ReadinessBadgeStatus {
  if (status === 'publishing') return 'processing';
  if (status === 'published') return 'completed';
  if (status === 'failed') return 'failed';
  return readiness.isReady ? 'Ready' : 'Setup Required';
}

export function ReelPublishPanel({
  reelId,
  status,
  readiness,
  publishedPermalink,
  errorMessage,
}: ReelPublishPanelProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    publishReelAction.bind(null, reelId),
    initialState
  );
  const canPublish = readiness.isReady && status !== 'published' && status !== 'publishing';

  useActionToast({
    isPending,
    state,
    loadingMessage: 'Publishing Reel to Instagram...',
    successMessage: () => 'Reel published.',
    successDescription: 'Instagram publishing completed.',
    errorMessage: (currentState) => currentState.error ?? 'Failed to publish reel.',
  });

  useEffect(() => {
    if (state.published || state.error) {
      router.refresh();
    }
  }, [router, state.error, state.published]);

  return (
    <Card>
      <CardHeader
        title="Publishing Readiness"
        description="Organic Instagram Reels publishing remains gated until all setup checks pass."
        action={<StatusBadge status={statusBadge(status, readiness)} type="system" size="sm" />}
      />

      <div className="space-y-4">
        {status === 'published' && (
          <Notice tone="success" title="Published">
            {publishedPermalink ? (
              <Link
                href={publishedPermalink}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-[#F7CBCA]"
              >
                Open published Reel
              </Link>
            ) : (
              'The Reel is marked as published.'
            )}
          </Notice>
        )}

        {status === 'failed' && (
          <Notice tone="danger" title="Failed">
            {errorMessage || 'The previous publishing attempt failed.'}
          </Notice>
        )}

        {!readiness.isReady && status !== 'published' && (
          <Notice tone="warning" title={readiness.label}>
            Instagram publishing setup required. Connect an Instagram Business or Creator account with content publishing permissions.
          </Notice>
        )}

        {state.error && (
          <Notice tone="danger" title="Publish failed">
            {state.error}
          </Notice>
        )}

        {state.published && !state.error && (
          <Notice tone="success" title="Published">
            Reel published to Instagram.
          </Notice>
        )}

        <div className="grid gap-3 text-sm text-black/62 sm:grid-cols-2">
          <div className="muted-panel p-4">
            <p className="font-bold text-black">Meta app configured</p>
            <p className="mt-1">{readiness.state === 'publishing_setup_required' ? 'Required' : 'Checked'}</p>
          </div>
          <div className="muted-panel p-4">
            <p className="font-bold text-black">Content publishing permission</p>
            <p className="mt-1">
              {readiness.missingScopes.length > 0 ? 'Missing' : 'Checked'}
            </p>
          </div>
          <div className="muted-panel p-4">
            <p className="font-bold text-black">Instagram Business / Creator account</p>
            <p className="mt-1">{readiness.hasInstagramBusinessAccount ? 'Connected' : 'Required'}</p>
          </div>
          <div className="muted-panel p-4">
            <p className="font-bold text-black">Public video URL</p>
            <p className="mt-1">{readiness.hasValidVideoUrl ? 'Ready' : 'Required'}</p>
          </div>
        </div>

        {canPublish ? (
          <form action={formAction}>
            <Button type="submit" disabled={isPending}>
              <Send className="h-4 w-4" />
              {isPending ? 'Publishing Reel...' : 'Publish Reel to Instagram'}
            </Button>
          </form>
        ) : (
          status !== 'published' && (
            <Link
              href="/dashboard/settings"
              onClick={() =>
                toast.warning('Publishing setup is incomplete.', {
                  description: 'Review Instagram publishing requirements in Settings before publishing.',
                })
              }
            >
              <Button variant="outline">
                <Settings className="h-4 w-4" />
                Review Settings
              </Button>
            </Link>
          )
        )}
      </div>
    </Card>
  );
}
