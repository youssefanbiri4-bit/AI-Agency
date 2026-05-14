import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BookOpen, Filter, Layers3, Plus, Search } from 'lucide-react';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { listContentStudioItemsForWorkspace } from '@/lib/data/content-studio';
import { buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input, Label, Select } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDateTime } from '@/lib/utils';
import {
  contentStudioStatusOptions,
  contentStudioTabOptions,
  contentStudioTypeOptions,
  formatContentStudioPlatformLabel,
  formatContentStudioTypeLabel,
  getTabForContentType,
  type ContentStudioItemView,
  type ContentStudioTab,
} from '../content-studio/shared';
import type {
  ContentStudioPlatform,
  ContentStudioStatus,
  ContentStudioType,
} from '@/types/database';

interface ContentLibraryPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function getSearchParam(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string
) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function readPlatform(value?: string): ContentStudioPlatform | 'all' {
  const platforms: Array<ContentStudioPlatform | 'all'> = [
    'all',
    'instagram',
    'facebook',
    'google_ads',
    'pinterest',
    'linkedin',
  ];
  return platforms.includes(value as ContentStudioPlatform | 'all')
    ? (value as ContentStudioPlatform | 'all')
    : 'all';
}

function readStatus(value?: string): ContentStudioStatus | 'all' {
  const statuses = contentStudioStatusOptions.map((option) => option.value);
  return statuses.includes(value as ContentStudioStatus) ? (value as ContentStudioStatus) : 'all';
}

function readContentType(value?: string): ContentStudioType | 'all' {
  const types = contentStudioTypeOptions.map((option) => option.value);
  return types.includes(value as ContentStudioType) ? (value as ContentStudioType) : 'all';
}

function buildStudioHref(item: ContentStudioItemView) {
  const tab = getTabForContentType(item.content_type);
  const params = new URLSearchParams({
    item: item.id,
  });

  if (tab !== 'all') {
    params.set('tab', tab);
  }

  return `/dashboard/content-studio?${params.toString()}`;
}

function actionTypeLabel(item: ContentStudioItemView) {
  if (item.status === 'setup_required') return 'Setup Required';
  if (item.status === 'approval_pending') return 'Approval Pending';
  if (item.content_type === 'linkedin_post_planner') return 'Manual-only / Copy LinkedIn Package';
  if (item.content_type === 'google_ads_campaign_draft') return 'Create Paused Google Ads Campaign Draft';
  if (item.content_type === 'pinterest_pin') return 'Publish to Pinterest';
  if (item.content_type === 'facebook_post') return 'Publish to Facebook Page';
  if (item.content_type === 'instagram_post') return 'Publish to Instagram';
  if (item.content_type === 'instagram_reel') return 'Publish Reel to Instagram';
  if (item.content_type.includes('_ad')) return 'Create Paused Meta Ad Draft';
  return 'Unsupported';
}

function itemMatchesQuery(item: ContentStudioItemView, query: string) {
  if (!query) return true;
  const haystack = [
    item.title,
    item.objective,
    item.caption,
    item.ad_copy,
    item.creative_brief,
    item.provider_status,
    item.provider_error,
    item.content_type,
    item.platform,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

export default async function ContentLibraryPage({ searchParams }: ContentLibraryPageProps) {
  const params = await searchParams;
  const platform = readPlatform(getSearchParam(params, 'platform'));
  const status = readStatus(getSearchParam(params, 'status'));
  const contentType = readContentType(getSearchParam(params, 'content_type'));
  const query = getSearchParam(params, 'q')?.trim() ?? '';
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirectTo=/dashboard/content-library');
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    redirect('/onboarding');
  }

  const itemsResult = await listContentStudioItemsForWorkspace(workspaceResult.data.id, supabase);
  const items = (itemsResult.error ? [] : itemsResult.data).filter((item) => {
    if (platform !== 'all' && item.platform !== platform) return false;
    if (status !== 'all' && item.status !== status) return false;
    if (contentType !== 'all' && item.content_type !== contentType) return false;
    return itemMatchesQuery(item, query);
  });
  const platformCounts = contentStudioTabOptions
    .filter((option): option is { value: ContentStudioTab; label: string } => option.value !== 'all')
    .map((option) => ({
      ...option,
      count: (itemsResult.data ?? []).filter((item) => item.platform === option.value).length,
    }));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Library"
        title="Content Library"
        description="Manage saved Content & Ads Studio items separately from the creation workspace. Filter drafts, inspect readiness, and reopen the right platform studio."
        actions={
          <Link href="/dashboard/content-studio" className={buttonStyles({ size: 'lg' })}>
            <Plus className="h-5 w-5" />
            Create Content Draft
          </Link>
        }
      />

      {itemsResult.error ? (
        <Notice tone="danger" title="Content Library unavailable">
          {itemsResult.error}
        </Notice>
      ) : null}

      <div className="dashboard-stat-grid">
        {platformCounts.map((item) => (
          <div key={item.value} className="rounded-2xl border border-black/7 bg-white p-4 shadow-[0_14px_34px_rgba(93,107,107,0.06)]">
            <p className="text-xs font-black uppercase tracking-[0.13em] text-black/42">{item.label}</p>
            <p className="mt-2 text-2xl font-black text-[#5D6B6B]">{item.count}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Library Filters"
          description="Search and filter all saved content by platform, status, and content type."
          action={<Filter className="h-5 w-5 text-[#F7CBCA]" />}
        />
        <form method="get" className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px_190px_220px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/34" />
            <Label htmlFor="content_library_search" className="sr-only">Search</Label>
            <Input
              id="content_library_search"
              name="q"
              defaultValue={query}
              placeholder="Search titles, copy, provider status"
              className="ps-9"
            />
          </div>
          <div>
            <Label htmlFor="content_library_platform" className="sr-only">Platform</Label>
            <Select id="content_library_platform" name="platform" defaultValue={platform}>
              <option value="all">All platforms</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="google_ads">Google Ads</option>
              <option value="pinterest">Pinterest</option>
              <option value="linkedin">LinkedIn</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="content_library_status" className="sr-only">Status</Label>
            <Select id="content_library_status" name="status" defaultValue={status}>
              <option value="all">All statuses</option>
              {contentStudioStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="content_library_type" className="sr-only">Content type</Label>
            <Select id="content_library_type" name="content_type" defaultValue={contentType}>
              <option value="all">All content types</option>
              {contentStudioTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </div>
          <button type="submit" className={buttonStyles({ variant: 'outline' })}>
            Apply Filters
          </button>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Saved Content Items"
          description={`${items.length} item${items.length === 1 ? '' : 's'} match the current filters.`}
          action={<BookOpen className="h-5 w-5 text-[#F7CBCA]" />}
        />

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 bg-[#D5E5E5]/28 px-5 py-12 text-center">
            <Layers3 className="mx-auto h-10 w-10 text-[#F7CBCA]" />
            <p className="mt-4 text-base font-bold text-black">No content items match this library view</p>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-black/54">
              Create a platform draft in Content & Ads Studio, then return here to manage saved items, linked assets, provider status, and planned times.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="bg-[#F1F7F7] text-xs font-black uppercase tracking-[0.14em] text-black/42">
                  <th className="rounded-l-xl border-y border-l border-black/7 px-3 py-3">Item</th>
                  <th className="border-y border-black/7 px-3 py-3">Platform</th>
                  <th className="border-y border-black/7 px-3 py-3">Content Type</th>
                  <th className="border-y border-black/7 px-3 py-3">Status</th>
                  <th className="border-y border-black/7 px-3 py-3">Provider</th>
                  <th className="border-y border-black/7 px-3 py-3">Assets</th>
                  <th className="border-y border-black/7 px-3 py-3">Planned Time</th>
                  <th className="border-y border-black/7 px-3 py-3">Safe Action</th>
                  <th className="rounded-r-xl border-y border-r border-black/7 px-3 py-3">Open</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="align-top transition-colors hover:bg-[#F1F7F7]/75">
                    <td className="border-b border-black/6 px-3 py-4">
                      <Link href={buildStudioHref(item)} className="font-black text-[#5D6B6B] hover:text-[#F7CBCA]">
                        {item.title}
                      </Link>
                      <p className="mt-1 max-w-[260px] text-xs leading-5 text-black/46">
                        Updated {formatDateTime(item.updated_at)}
                      </p>
                    </td>
                    <td className="border-b border-black/6 px-3 py-4 font-bold text-black/64">
                      {formatContentStudioPlatformLabel(item.platform)}
                    </td>
                    <td className="border-b border-black/6 px-3 py-4 text-black/62">
                      {formatContentStudioTypeLabel(item.content_type)}
                    </td>
                    <td className="border-b border-black/6 px-3 py-4">
                      <StatusBadge status={item.status} type="task" size="sm" />
                    </td>
                    <td className="border-b border-black/6 px-3 py-4">
                      <span className="font-semibold text-black/62">
                        {item.provider_status?.replace(/_/g, ' ') || 'not checked'}
                      </span>
                      {item.provider_error ? (
                        <p className="mt-1 max-w-[220px] text-xs leading-5 text-black/46">{item.provider_error}</p>
                      ) : null}
                    </td>
                    <td className="border-b border-black/6 px-3 py-4 font-mono text-sm font-black text-[#5D6B6B]">
                      {item.asset_count}
                    </td>
                    <td className="border-b border-black/6 px-3 py-4 text-black/62">
                      {item.schedule_at ? formatDateTime(item.schedule_at) : 'Not planned'}
                    </td>
                    <td className="border-b border-black/6 px-3 py-4 text-black/62">
                      {actionTypeLabel(item)}
                    </td>
                    <td className="border-b border-black/6 px-3 py-4">
                      <Link href={buildStudioHref(item)} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                        Open/Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
