import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import {
  Layers3,
  PenSquare,
  TriangleAlert,
  Workflow,
} from 'lucide-react';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { listCreativeAssetsForWorkspace } from '@/lib/data/creative-assets';
import { getContentStudioItemById, listContentStudioItemsForWorkspace } from '@/features/content-studio/data/content-studio';
import { getBrandKitForWorkspace } from '@/lib/data/brand-kit';
import { getCurrentWorkspaceMembership } from '@/lib/data/workspaces';
import { getGoogleAdsConfigReadiness } from '@/lib/ads/google-ads';
import { getPinterestConfigReadiness } from '@/lib/ads/pinterest';
import { getContentStudioSchedulerReadiness } from '@/lib/content-studio/scheduler';
import { getContentStudioProviderReadiness } from '@/lib/content-studio/provider-actions';
import { getAgentTemplateById } from '@/lib/agent-library/templates';
import dynamic from 'next/dynamic';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { LoadingState } from '@/components/ui/LoadingState';
import { buttonStyles } from '@/components/ui/Button';
import { SchedulerControls } from './SchedulerControls';

const ContentStudioClient = dynamic(
  () => import('./ContentStudioClient').then((mod) => mod.ContentStudioClient),
  {
    loading: () => (
      <LoadingState title="Loading Content Studio" description="Preparing the content creation workspace." />
    ),
  }
);
import {
  contentStudioTypeOptions,
  contentStudioStatusOptions,
  getTabForContentType,
  itemMatchesTab,
  type ContentStudioTab,
} from './shared';
import type { ContentStudioStatus, ContentStudioType } from '@/types/database';

function readMetadataObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readItemMetadataString(item: { metadata: unknown } | null, group: string, key: string) {
  const object = readMetadataObject(readMetadataObject(item?.metadata)[group]);
  const value = object[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readItemMetadataNumber(item: { metadata: unknown } | null, group: string, key: string) {
  const object = readMetadataObject(readMetadataObject(item?.metadata)[group]);
  const value = object[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readItemMetadataStringList(item: { metadata: unknown } | null, group: string, key: string) {
  const object = readMetadataObject(readMetadataObject(item?.metadata)[group]);
  const value = object[key];
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];
}

interface ContentStudioPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function getSearchParam(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string
) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function readTab(value?: string): ContentStudioTab {
  if (value === 'fb_ig_posts' || value === 'reels' || value === 'meta_ads') {
    return 'instagram';
  }

  if (value === 'linkedin_planner') {
    return 'linkedin';
  }

  const allowedTabs: ContentStudioTab[] = [
    'all',
    'instagram',
    'facebook',
    'google_ads',
    'pinterest',
    'linkedin',
  ];

  return allowedTabs.includes(value as ContentStudioTab) ? (value as ContentStudioTab) : 'all';
}

function readStatus(value?: string): ContentStudioStatus | 'all' {
  const statuses = contentStudioStatusOptions.map((option) => option.value);
  return statuses.includes(value as ContentStudioStatus) ? (value as ContentStudioStatus) : 'all';
}

function readContentType(value?: string): ContentStudioType | undefined {
  const types = contentStudioTypeOptions.map((option) => option.value);
  return types.includes(value as ContentStudioType) ? (value as ContentStudioType) : undefined;
}

export default async function ContentStudioPage({ searchParams }: ContentStudioPageProps) {
  const params = await searchParams;
  const requestedTab = readTab(getSearchParam(params, 'tab'));
  const activeStatus = readStatus(getSearchParam(params, 'status'));
  const selectedItemId = getSearchParam(params, 'item');
  const initialDraftType = readContentType(getSearchParam(params, 'type'));
  const requestedTemplateId = getSearchParam(params, 'template')?.trim();
  const selectedTemplate = getAgentTemplateById(requestedTemplateId);
  const activeContentType = readContentType(getSearchParam(params, 'content_type'));
  const searchQuery = getSearchParam(params, 'q')?.trim() ?? '';
  const googleAdsReadiness = getGoogleAdsConfigReadiness();
  const pinterestReadiness = getPinterestConfigReadiness();
  const schedulerReadiness = getContentStudioSchedulerReadiness();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirectTo=/dashboard/content-studio');
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    redirect('/onboarding');
  }

  const workspaceId = workspaceResult.data.id;
  const [membershipResult, itemsResult, creativeAssetsResult, brandKitResult] = await Promise.all([
    getCurrentWorkspaceMembership(supabase, workspaceId, user.id),
    listContentStudioItemsForWorkspace(workspaceId, supabase, { limit: 80 }),
    listCreativeAssetsForWorkspace(workspaceId, undefined, supabase, { limit: 80 }),
    getBrandKitForWorkspace(supabase, workspaceId),
  ]);
  const listedItems = itemsResult.error ? [] : itemsResult.data;
  const selectedItemResult =
    selectedItemId && !listedItems.some((item) => item.id === selectedItemId)
      ? await getContentStudioItemById(workspaceId, selectedItemId, supabase)
      : null;
  const allItems =
    selectedItemResult?.data && !listedItems.some((item) => item.id === selectedItemResult.data?.id)
      ? [selectedItemResult.data, ...listedItems]
      : listedItems;
  const selectedItem =
    allItems.find((item) => item.id === selectedItemId) ?? null;
  const activeTab = selectedItem ? getTabForContentType(selectedItem.content_type) : requestedTab;
  const filteredItems = allItems.filter((item) => {
    if (!itemMatchesTab(item.content_type, activeTab)) {
      return false;
    }

    if (activeContentType && item.content_type !== activeContentType) {
      return false;
    }

    if (activeStatus !== 'all' && item.status !== activeStatus) {
      return false;
    }

    if (searchQuery) {
      const haystack = [
        item.title,
        item.objective,
        item.caption,
        item.ad_copy,
        item.creative_brief,
        item.provider_error,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!haystack.includes(searchQuery.toLowerCase())) {
        return false;
      }
    }

    return true;
  });
  const creativeAssets = creativeAssetsResult.error ? [] : creativeAssetsResult.data;
  const providerReadinessEntries = await Promise.all([
    getContentStudioProviderReadiness({
      workspaceId,
      userId: user.id,
      contentType: 'facebook_post',
    }).then((readiness) => ['facebook', readiness] as const),
    getContentStudioProviderReadiness({
      workspaceId,
      userId: user.id,
      contentType: 'instagram_post',
    }).then((readiness) => ['instagram', readiness] as const),
    getContentStudioProviderReadiness({
      workspaceId,
      userId: user.id,
      contentType: 'google_ads_campaign_draft',
    }).then((readiness) => ['google_ads', readiness] as const),
    getContentStudioProviderReadiness({
      workspaceId,
      userId: user.id,
      contentType: 'pinterest_pin',
    }).then((readiness) => ['pinterest', readiness] as const),
    getContentStudioProviderReadiness({
      workspaceId,
      userId: user.id,
      contentType: 'linkedin_post_planner',
    }).then((readiness) => ['linkedin', readiness] as const),
  ]);
  const providerReadiness = Object.fromEntries(providerReadinessEntries);
  const selectedItemProviderReadiness =
    selectedItem
      ? await getContentStudioProviderReadiness({
          workspaceId,
          userId: user.id,
          itemId: selectedItem.id,
          title: selectedItem.title,
          contentType: selectedItem.content_type,
          caption: selectedItem.caption,
          script: selectedItem.script,
          adCopy: selectedItem.ad_copy,
          creativeBrief: selectedItem.creative_brief,
          objective: selectedItem.objective,
          destinationUrl: readItemMetadataString(selectedItem, 'campaign', 'destination_url'),
          budgetNotes: readItemMetadataString(selectedItem, 'campaign', 'offer'),
          keywords: readItemMetadataStringList(selectedItem, 'campaign', 'keywords'),
          dailyBudget: readItemMetadataNumber(selectedItem, 'meta_ads', 'daily_budget'),
          lifetimeBudget: readItemMetadataNumber(selectedItem, 'meta_ads', 'lifetime_budget'),
          targetAudience: readItemMetadataString(selectedItem, 'meta_ads', 'target_audience'),
          countries: readItemMetadataStringList(selectedItem, 'meta_ads', 'countries'),
          ageMin: readItemMetadataNumber(selectedItem, 'meta_ads', 'age_min'),
          ageMax: readItemMetadataNumber(selectedItem, 'meta_ads', 'age_max'),
          callToAction: readItemMetadataString(selectedItem, 'meta_ads', 'call_to_action'),
          headline: readItemMetadataString(selectedItem, 'meta_ads', 'headline'),
          description: readItemMetadataString(selectedItem, 'meta_ads', 'description'),
          linkedAssets: creativeAssets
            .filter((asset) => selectedItem.asset_ids.includes(asset.id))
            .map((asset) => ({
              id: asset.id,
              title: asset.title,
              assetType: asset.asset_type,
              platform: asset.platform,
              imageUrl: asset.image_url,
              storagePath: asset.storage_path,
              metadata: asset.metadata as Record<string, unknown> | null,
            })),
          validateContent: true,
        })
      : null;
  const totalItems = allItems.length;
  const readyItems = allItems.filter((item) => item.status === 'ready').length;
  const setupRequiredItems = allItems.filter((item) => item.status === 'setup_required').length;
  const linkedAssets = allItems.reduce((sum, item) => sum + item.asset_count, 0);
  const canRunScheduler =
    membershipResult.data?.role === 'owner' || membershipResult.data?.role === 'admin';

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Studio"
        title="Content & Ads Studio"
        description="Create cross-channel drafts, link creative assets, and use provider actions that either execute for real or explain the exact setup gap."
        actions={
          <Link href="/dashboard/content-library" className={buttonStyles({ variant: 'outline' })}>
            <Layers3 className="h-4 w-4" />
            Content Library
          </Link>
        }
      />

      <div className="dashboard-stat-grid">
        <StatCard title="Total Items" value={totalItems} icon={Layers3} tone="neutral" />
        <StatCard title="Ready Items" value={readyItems} icon={Workflow} tone="accent" />
        <StatCard title="Setup Required" value={setupRequiredItems} icon={TriangleAlert} tone="brand" />
        <StatCard title="Linked Assets" value={linkedAssets} icon={PenSquare} tone="dark" />
      </div>

      {itemsResult.error ? (
        <Notice tone="danger" title="Content Studio data unavailable">
          {itemsResult.error}
        </Notice>
      ) : null}

      {creativeAssetsResult.error ? (
        <Notice tone="warning" title="Creative Assets unavailable">
          {creativeAssetsResult.error}
        </Notice>
      ) : null}

      <details className="group rounded-lg border border-[#F7CBCA]/12 bg-surface/50 p-2 text-sm">
        <summary className="flex cursor-pointer items-center gap-2 font-bold text-foreground-muted select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7CBCA]/50 rounded">
          <span className="text-xs transition-transform group-open:rotate-90">▶</span>
          Provider Status
          <span className="text-xs font-normal text-foreground-muted ml-auto">
            {schedulerReadiness.isConfigured ? '' : 'Scheduler — '}
            {!schedulerReadiness.isConfigured ? 'setup needed · ' : ''}
            {googleAdsReadiness.isConfigured ? '' : 'Google Ads — setup needed · '}
            {!pinterestReadiness.isConfigured ? 'Pinterest — setup needed' : ''}
          </span>
        </summary>
        <div className="mt-2 space-y-2">
          <div className="rounded-lg border border-divider bg-surface p-2 text-xs leading-5">
            <span className="font-semibold">
              {schedulerReadiness.isConfigured ? '✅ Scheduler:' : '⚠️ Scheduler:'}
            </span>{' '}
            {schedulerReadiness.isConfigured
              ? 'Publish and provider send actions run server-side when the provider is ready. Scheduled items are picked up by the secure cron route after their planned time.'
              : `${schedulerReadiness.message}. Add CRON_SECRET in the server environment, configure Vercel Cron, and redeploy after env changes.`}
          </div>
          <div className="rounded-lg border border-divider bg-surface p-2 text-xs leading-5">
            <span className="font-semibold">⚠️ Google Ads:</span>{' '}
            {googleAdsReadiness.isConfigured
              ? 'Campaign draft creation needs an approved developer token and a connected customer account. If either is missing, the action will explain it exactly.'
              : `Setup still needs: ${googleAdsReadiness.missingEnvironmentVariables.join(', ') || 'GOOGLE_ADS_DEVELOPER_TOKEN'}.`}
          </div>
          {!pinterestReadiness.isConfigured ? (
            <div className="rounded-lg border border-divider bg-surface p-2 text-xs leading-5">
              <span className="font-semibold">⚠️ Pinterest:</span>{' '}
              Pins can be drafted here, but provider setup is incomplete. Missing: {pinterestReadiness.missingEnvironmentVariables.join(', ') || 'PINTEREST_APP_SECRET'}.
            </div>
          ) : null}
        </div>
      </details>

      <Suspense fallback={<div className="animate-pulse rounded-2xl border border-black/7 bg-white p-4 h-12" />}>
        <SchedulerControls canRunScheduler={canRunScheduler} />
      </Suspense>

      <Suspense fallback={<div className="animate-pulse rounded-2xl border border-black/7 bg-white p-6 h-96" />}>
        <ContentStudioClient
        items={filteredItems}
        selectedItem={selectedItem}
        creativeAssets={creativeAssets}
        activeTab={activeTab}
        activeStatus={activeStatus}
        activeContentType={activeContentType}
        searchQuery={searchQuery}
        initialDraftType={initialDraftType}
        schedulerReady={schedulerReadiness.isConfigured}
        schedulerMessage={schedulerReadiness.message}
        providerReadiness={providerReadiness}
        selectedItemProviderReadiness={selectedItemProviderReadiness}
        brandKit={brandKitResult.data.brandKit}
        brandKitExists={brandKitResult.data.exists}
        agentTemplate={selectedTemplate}
        templateNotFound={Boolean(requestedTemplateId && !selectedTemplate)}
        />
      </Suspense>
    </div>
  );
}
