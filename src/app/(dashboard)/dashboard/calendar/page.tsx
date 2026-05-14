import dynamic from 'next/dynamic';
import { redirect } from 'next/navigation';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { listContentStudioItemsForWorkspace } from '@/lib/data/content-studio';
import { listReleasesForWorkspace } from '@/lib/data/releases';
import { listReelsForWorkspace } from '@/lib/data/reels';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import type { CalendarContentItem } from './CalendarClient';

const CalendarClient = dynamic(
  () => import('./CalendarClient').then((mod) => mod.CalendarClient),
  {
    loading: () => (
      <LoadingState
        title="Loading calendar"
        description="Preparing your schedule view."
      />
    ),
  }
);

function isCalendarVisibleItem(item: CalendarContentItem) {
  return Boolean(item.schedule_at);
}

export default async function CalendarPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirectTo=/dashboard/calendar');
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    redirect('/onboarding');
  }

  const [itemsResult, releasesResult, reelsResult] = await Promise.all([
    listContentStudioItemsForWorkspace(workspaceResult.data.id, supabase),
    listReleasesForWorkspace(workspaceResult.data.id, supabase),
    listReelsForWorkspace(workspaceResult.data.id, user.id, supabase),
  ]);

  const contentItems: CalendarContentItem[] = (itemsResult.error ? [] : itemsResult.data)
    .map((item) => ({
      id: item.id,
      title: item.title,
      platform: item.platform,
      content_type: item.content_type,
      status: item.status,
      provider_status: item.provider_status,
      schedule_at: item.schedule_at,
      provider_error: item.provider_error,
      source: 'content' as const,
    }))
    .filter(isCalendarVisibleItem);

  const releaseItems: CalendarContentItem[] = (releasesResult.error ? [] : releasesResult.data)
    .filter((r) => r.deployed_at)
    .map((r) => ({
      id: r.id,
      title: r.title,
      platform: 'facebook' as const,
      content_type: 'facebook_post' as const,
      status: r.status === 'deployed' ? 'published' as const : 'draft' as const,
      provider_status: null,
      schedule_at: r.deployed_at,
      provider_error: null,
      source: 'release' as const,
    }));

  const reelItems: CalendarContentItem[] = (reelsResult.error ? [] : reelsResult.data)
    .filter((r) => r.scheduled_for)
    .map((r) => ({
      id: r.id,
      title: r.title,
      platform: 'instagram' as const,
      content_type: 'instagram_reel' as const,
      status: r.status === 'published' ? 'published' as const : 'scheduled' as const,
      provider_status: null,
      schedule_at: r.scheduled_for,
      provider_error: null,
      source: 'reel' as const,
    }));

  const allItems = [...contentItems, ...releaseItems, ...reelItems];

  return (
    <div className="-mx-4 -my-6 min-h-screen bg-[var(--theme-background,#F1F7F7)] px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-[1540px] space-y-6">
        {itemsResult.error ? (
          <Notice tone="warning" title="Calendar data unavailable">
            {itemsResult.error}
          </Notice>
        ) : null}

        <Notice tone="info" title="Calendar is planning-only">
          Scheduled items are labeled as planned. Provider setup gaps, approval pending states, and failures stay visible here without implying a publish will happen.
        </Notice>

        <CalendarClient items={allItems} />
      </div>
    </div>
  );
}
