import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { listContentStudioItemsForWorkspace } from '@/lib/data/content-studio';
import { Notice } from '@/components/ui/Notice';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { redirect } from 'next/navigation';
import { Film, Plus } from 'lucide-react';
import type { ContentStudioStatus, ContentStudioType } from '@/types/database';
import {
  formatContentStudioPlatformLabel,
  formatContentStudioTypeLabel,
  getTabForContentType,
} from '../content-studio/shared';

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
      <Badge className="bg-black/8 text-black/64">{status}</Badge>
    </Card>
  );
}

interface ReelItemProps {
  id: string;
  title: string;
  status: ContentStudioStatus;
  platform: string;
  contentType: ContentStudioType;
  objective?: string | null;
  scheduleAt?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

function ReelItem({
  id,
  title,
  status,
  platform,
  contentType,
  objective,
  scheduleAt,
  publishedAt,
  createdAt,
  updatedAt,
}: ReelItemProps) {
  const statusColors: Record<string, string> = {
    draft: 'bg-black/8 text-black/64',
    ready: 'bg-[#D5E5E5]/58 text-[#F7CBCA]',
    scheduled: 'bg-[#F1F7F7]/58 text-[#E7F5DC]',
    published: 'bg-[#D4EDDA]/58 text-[#155724]',
    failed: 'bg-[#FFD4D4]/58 text-[#A00000]',
    approval_pending: 'bg-[#FFF1D6]/70 text-[#9A5A00]',
    setup_required: 'bg-[#FFF1D6]/70 text-[#9A5A00]',
  };
  const contentStudioHref = `/dashboard/content-studio?tab=${getTabForContentType(contentType)}&item=${id}`;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-black/8 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1 min-w-0">
        <Link href={contentStudioHref}>
          <h3 className="text-sm font-bold text-black hover:text-[#F7CBCA] transition-colors truncate">
            {title}
          </h3>
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-black/46">
          <span>Platform: {platform}</span>
          <span>Type: {formatContentStudioTypeLabel(contentType)}</span>
          <span>Status: {status}</span>
          {objective && <span>Objective: {objective}</span>}
          {scheduleAt && (
            <span>
              Scheduled: {new Date(scheduleAt).toLocaleDateString()}
            </span>
          )}
          {publishedAt && (
            <span>
              Published: {new Date(publishedAt).toLocaleDateString()}
            </span>
          )}
          <span>Created: {new Date(createdAt).toLocaleDateString()}</span>
          <span>Updated: {new Date(updatedAt).toLocaleDateString()}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:ms-4 sm:justify-end">
        <Badge className={statusColors[status] || statusColors.draft}>
          {status}
        </Badge>
        <Link href={contentStudioHref}>
          <Button variant="outline" size="sm">
            Open Reel
          </Button>
        </Link>
        {status === 'draft' && (
          <Link href={contentStudioHref}>
            <Button variant="secondary" size="sm">
              Edit Draft
            </Button>
          </Link>
        )}
      </div>
    </div>
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

  const itemsResult = await listContentStudioItemsForWorkspace(workspaceResult.data.id, supabase);
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

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-black">All Reels</h2>
        {reels.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-4 py-12 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#D5E5E5]/70 text-[#F7CBCA]">
              <Film className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-black">No reels yet</h3>
              <p className="mt-1 text-sm text-black/46">
                Create your first Instagram Reel in Content & Ads Studio to get started.
              </p>
            </div>
            <Link href="/dashboard/content-studio?tab=reels&type=instagram_reel">
              <Button className="mt-4">New Reel</Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-3">
            {reels.map((reel) => (
              <ReelItem
                key={reel.id}
                id={reel.id}
                title={reel.title}
                status={reel.status}
                platform={formatContentStudioPlatformLabel(reel.platform)}
                contentType={reel.content_type}
                objective={reel.objective}
                scheduleAt={reel.schedule_at}
                publishedAt={reel.published_at}
                createdAt={reel.created_at}
                updatedAt={reel.updated_at}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
