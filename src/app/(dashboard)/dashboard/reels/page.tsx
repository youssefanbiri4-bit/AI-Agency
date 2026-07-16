import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { listContentStudioItemsForWorkspace } from '@/features/content-studio/data/content-studio';
import { Notice } from '@/components/ui/Notice';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';
import type { ContentStudioStatus, ContentStudioType } from '@/types/database';
import { formatContentStudioPlatformLabel } from '../content-studio/shared';
import { PaginatedReelsList } from './PaginatedReelsList';

const reelContentTypes: ContentStudioType[] = [
  'facebook_reel',
  'instagram_reel',
  'facebook_reel_ad',
  'instagram_reel_ad',
];

type ReelStudioStatus = Extract<ContentStudioStatus, 'draft' | 'ready' | 'scheduled' | 'published'>;

const visibleStatuses: ReelStudioStatus[] = ['draft', 'ready', 'scheduled', 'published'];

interface ReelCardProps {
  title: string;
  count: number;
  status: string;
  color: string;
}

function ReelStatsCard({ title, count, status, color }: ReelCardProps) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 px-6 py-8">
      <div className={`text-4xl font-bold ${color}`}>{count}</div>
      <div className="text-center text-sm font-medium text-black/58">{title}</div>
      <span className="rounded-full bg-black/8 px-3 py-0.5 text-xs font-semibold text-black/64">{status}</span>
    </Card>
  );
}

export default async function ReelsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirectTo=/dashboard/reels');
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    redirect('/onboarding');
  }

  const itemsResult = await listContentStudioItemsForWorkspace(workspaceResult.data.id, supabase, { limit: 500 });
  const reels = itemsResult.error
    ? []
    : itemsResult.data.filter((item) => reelContentTypes.includes(item.content_type));
  const counts = visibleStatuses.reduce<Record<ReelStudioStatus, number>>(
    (nextCounts, status) => ({
      ...nextCounts,
      [status]: reels.filter((item) => item.status === status).length,
    }),
    { draft: 0, ready: 0, scheduled: 0, published: 0 }
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-black">Reels Studio</h1>
          <p className="mt-1 text-sm text-black/46">
            Plan, draft, and manage reel content from Content & Ads Studio
          </p>
        </div>
        <Link href="/dashboard/content-studio?tab=reels&type=instagram_reel">
          <Button>
            <Plus className="h-4 w-4" />
            New Reel
          </Button>
        </Link>
      </div>

      {itemsResult.error && (
        <Notice tone="danger" title="Data unavailable">
          {itemsResult.error}
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReelStatsCard
          title="Drafts"
          count={counts.draft}
          status="draft"
          color="text-black"
        />
        <ReelStatsCard
          title="Ready"
          count={counts.ready}
          status="ready"
          color="text-[#F7CBCA]"
        />
        <ReelStatsCard
          title="Scheduled"
          count={counts.scheduled}
          status="scheduled"
          color="text-[#E7F5DC]"
        />
        <ReelStatsCard
          title="Published"
          count={counts.published}
          status="published"
          color="text-[#155724]"
        />
      </div>

      <PaginatedReelsList
        reels={reels.map((reel) => ({
          id: reel.id,
          title: reel.title,
          status: reel.status,
          platform: formatContentStudioPlatformLabel(reel.platform),
          contentType: reel.content_type,
          objective: reel.objective,
          scheduleAt: reel.schedule_at,
          publishedAt: reel.published_at,
          createdAt: reel.created_at,
          updatedAt: reel.updated_at,
        }))}
      />
    </div>
  );
}
