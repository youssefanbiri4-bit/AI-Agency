'use client';

import { useActionState, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  ChevronDown,
  ClipboardList,
  Clock,
  FileText,
  Filter,
  Plus,
  Send,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  createCampaignPlannerTask,
  createManualCampaignTrackerTask,
  createPerformanceAnalyzerTask,
  type CampaignTaskState,
} from './actions';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Label, Select, Textarea } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';

type CampaignPlatform = 'instagram' | 'facebook' | 'google_ads' | 'pinterest' | 'manual';
type CampaignBoardStatus =
  | 'draft'
  | 'ready'
  | 'scheduled'
  | 'published'
  | 'failed'
  | 'setup_required'
  | 'approval_pending';

export interface CampaignBoardItem {
  id: string;
  title: string;
  platform: CampaignPlatform;
  status: CampaignBoardStatus;
  providerReadiness: string;
  updatedLabel: string;
  linkedCount?: number;
  href: string;
  actionLabel: string;
}

export interface CampaignReportItem {
  taskId: string;
  title: string;
  status: 'completed' | 'needs_review';
  agentName: string;
  updatedAt: string;
  updatedLabel: string;
  summaryPreview: string;
  href: string;
}

export interface PendingCampaignTaskItem {
  taskId: string;
  title: string;
  status: 'pending';
  agentName: string;
  updatedLabel: string;
  href: string;
}

interface CampaignsClientProps {
  campaignBoardItems: CampaignBoardItem[];
  campaignReports: CampaignReportItem[];
  pendingCampaignTasks: PendingCampaignTaskItem[];
  preferredAgentName: string;
}

const initialState: CampaignTaskState = {
  error: null,
};
const gradientButtonClassName =
  'border-[#F7CBCA] bg-gradient-to-r from-[#F7CBCA] to-[#F7CBCA] text-white shadow-[0_16px_34px_rgba(202,40,81,0.24)] hover:border-[#5D6B6B] hover:from-[#5D6B6B] hover:to-[#F7CBCA] hover:text-white';
const warmOutlineButtonClassName =
  'border-[#5D6B6B]/12 bg-[#F1F7F7] text-[#5D6B6B] hover:border-[#F7CBCA]/35 hover:bg-[#D5E5E5]/55 hover:text-[#F7CBCA]';
const premiumCardClassName =
  'rounded-2xl border-[#5D6B6B]/8 bg-white shadow-[0_20px_58px_rgba(93,107,107,0.08)]';
const softPanelClassName =
  'rounded-2xl border border-[#5D6B6B]/8 bg-[#F1F7F7] shadow-sm';

type CampaignFilter =
  | 'all'
  | 'instagram'
  | 'facebook'
  | 'google_ads'
  | 'pinterest'
  | 'draft'
  | 'scheduled'
  | 'published'
  | 'setup_required';

const filters: Array<{ label: string; value: CampaignFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'Facebook', value: 'facebook' },
  { label: 'Google Ads', value: 'google_ads' },
  { label: 'Pinterest', value: 'pinterest' },
  { label: 'Draft', value: 'draft' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Published', value: 'published' },
  { label: 'Setup Required', value: 'setup_required' },
];

const statusStyles: Record<
  CampaignBoardStatus,
  {
    label: string;
    className: string;
  }
> = {
  draft: {
    label: 'Draft',
    className: 'border-[#5D6B6B]/10 bg-[#5D6B6B]/6 text-[#5D6B6B]/68',
  },
  ready: {
    label: 'Ready',
    className: 'border-[#E7F5DC]/36 bg-[#D5E5E5]/68 text-[#7A3A00]',
  },
  scheduled: {
    label: 'Scheduled',
    className: 'border-[#E7F5DC]/42 bg-[#E7F5DC]/24 text-[#A14C00]',
  },
  published: {
    label: 'Published',
    className: 'border-[#D5E5E5]/60 bg-[#5D6B6B] text-[#D5E5E5]',
  },
  failed: {
    label: 'Failed',
    className: 'border-[#F7CBCA]/28 bg-[#F7CBCA]/12 text-[#F7CBCA]',
  },
  setup_required: {
    label: 'Setup Required',
    className: 'border-[#F7CBCA]/30 bg-[#F7CBCA]/10 text-[#F7CBCA]',
  },
  approval_pending: {
    label: 'Approval Pending',
    className: 'border-[#D5E5E5] bg-[#F1F7F7] text-[#9A5A00]',
  },
};

function CampaignStatusBadge({ status }: { status: CampaignBoardStatus }) {
  const config = statusStyles[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black',
        config.className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
}

function formatPlatform(platform: CampaignPlatform) {
  const labels: Record<CampaignPlatform, string> = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    google_ads: 'Google Ads',
    pinterest: 'Pinterest',
    manual: 'Manual',
  };

  return labels[platform];
}

function matchesFilter(item: CampaignBoardItem, filter: CampaignFilter) {
  if (filter === 'all') {
    return true;
  }

  if (filter === 'instagram' && item.platform === 'facebook') {
    return true;
  }

  return item.platform === filter || item.status === filter;
}

function Field({
  id,
  label,
  required = false,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-[#F7CBCA]"> *</span>}
      </Label>
      {children}
    </div>
  );
}

function CampaignTrackingBoard({ items }: { items: CampaignBoardItem[] }) {
  const [activeFilter, setActiveFilter] = useState<CampaignFilter>('all');
  const filteredItems = useMemo(
    () => items.filter((item) => matchesFilter(item, activeFilter)),
    [activeFilter, items]
  );

  return (
    <Card className={premiumCardClassName}>
      <CardHeader
        title="Campaign Tracking Board"
        description="A focused view of campaign drafts, reports, provider readiness, and imported campaign signals."
        action={
          <div className="inline-flex items-center gap-2 rounded-full border border-[#F7CBCA]/18 bg-[#F1F7F7] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-[#F7CBCA]">
            <Filter className="h-3.5 w-3.5" />
            Live View
          </div>
        }
      />

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {filters.map((filter) => {
          const isActive = activeFilter === filter.value;

          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => setActiveFilter(filter.value)}
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-2 text-sm font-black transition-all',
                isActive
                  ? 'border-[#F7CBCA] bg-gradient-to-r from-[#F7CBCA] to-[#F7CBCA] text-white shadow-[0_12px_24px_rgba(202,40,81,0.20)]'
                  : 'border-[#5D6B6B]/10 bg-[#F1F7F7] text-[#5D6B6B]/60 hover:border-[#F7CBCA]/32 hover:text-[#F7CBCA]'
              )}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#F7CBCA]/22 bg-[#F1F7F7] p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F7CBCA] via-[#F7CBCA] to-[#E7F5DC] text-white shadow-[0_18px_38px_rgba(202,40,81,0.24)]">
            <Sparkles className="h-7 w-7" />
          </div>
          <h3 className="mt-5 text-lg font-black text-[#5D6B6B]">No campaigns yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#5D6B6B]/58">
            Create your first campaign draft from Content & Ads Studio.
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard/content-studio"
              className={buttonStyles({ variant: 'primary', className: gradientButtonClassName })}
            >
              <Plus className="h-4 w-4" />
              Create Campaign Draft
            </Link>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-[#5D6B6B]/8 bg-[#F1F7F7] p-6 text-center">
          <p className="text-sm font-bold text-[#5D6B6B]/62">No campaigns match this filter.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredItems.map((item) => (
            <article
              key={item.id}
              className="group min-w-0 rounded-2xl border border-[#5D6B6B]/8 bg-[#F1F7F7] p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[#F7CBCA]/22 hover:shadow-[0_20px_44px_rgba(202,40,81,0.13)]"
            >
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[#5D6B6B]/10 bg-white px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#5D6B6B]/54">
                      {formatPlatform(item.platform)}
                    </span>
                    <CampaignStatusBadge status={item.status} />
                  </div>
                  <h3 className="mt-3 break-words text-base font-black text-[#5D6B6B]">
                    {item.title}
                  </h3>
                </div>
                <Link
                  href={item.href}
                  className={buttonStyles({
                    variant: 'outline',
                    size: 'sm',
                    className: warmOutlineButtonClassName,
                  })}
                >
                  {item.actionLabel}
                </Link>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[#5D6B6B]/8 bg-white px-3 py-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#5D6B6B]/38">
                    Readiness
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#5D6B6B]/72">
                    {item.providerReadiness}
                  </p>
                </div>
                <div className="rounded-xl border border-[#5D6B6B]/8 bg-white px-3 py-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#5D6B6B]/38">
                    Updated
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#5D6B6B]/72">{item.updatedLabel}</p>
                </div>
                <div className="rounded-xl border border-[#5D6B6B]/8 bg-white px-3 py-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#5D6B6B]/38">
                    Linked
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#5D6B6B]/72">
                    {typeof item.linkedCount === 'number' ? item.linkedCount : 'Available'}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}

export function CampaignsClient({
  campaignBoardItems,
  campaignReports,
  pendingCampaignTasks,
  preferredAgentName,
}: CampaignsClientProps) {
  const [plannerState, plannerAction, isPlannerPending] = useActionState(
    createCampaignPlannerTask,
    initialState
  );
  const [analyzerState, analyzerAction, isAnalyzerPending] = useActionState(
    createPerformanceAnalyzerTask,
    initialState
  );
  const [trackerState, trackerAction, isTrackerPending] = useActionState(
    createManualCampaignTrackerTask,
    initialState
  );

  return (
    <div className="space-y-8">
      <CampaignTrackingBoard items={campaignBoardItems} />

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <Card className={premiumCardClassName}>
          <CardHeader
            title="Campaign Planner"
            description={`Create a pending task for ${preferredAgentName} with a complete campaign brief.`}
            action={<StatusBadge status="Ready" type="system" size="sm" />}
          />

          <form action={plannerAction} className="space-y-5">
            {plannerState?.error && (
              <Notice tone="danger" title="Campaign planner task was not created">
                {plannerState.error}
              </Notice>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              <Field id="serviceOrOffer" label="Service or offer" required>
                <Input
                  id="serviceOrOffer"
                  name="serviceOrOffer"
                  placeholder="AI automation audit, landing page build, coaching offer"
                  required
                  disabled={isPlannerPending}
                />
              </Field>

              <Field id="targetAudience" label="Target audience" required>
                <Input
                  id="targetAudience"
                  name="targetAudience"
                  placeholder="B2B founders, local clinics, ecommerce brands"
                  required
                  disabled={isPlannerPending}
                />
              </Field>

              <Field id="campaignGoal" label="Campaign goal" required>
                <div className="relative">
                  <ChevronDown className="pointer-events-none absolute end-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/34" />
                  <Select id="campaignGoal" name="campaignGoal" required disabled={isPlannerPending} defaultValue="">
                    <option value="" disabled>Select goal</option>
                    <option value="Lead generation">Lead generation</option>
                    <option value="Booked calls">Booked calls</option>
                    <option value="Sales">Sales</option>
                    <option value="Brand awareness">Brand awareness</option>
                    <option value="Retargeting">Retargeting</option>
                    <option value="Content growth">Content growth</option>
                  </Select>
                </div>
              </Field>

              <Field id="platforms" label="Platforms" required>
                <Input
                  id="platforms"
                  name="platforms"
                  placeholder="Meta Ads, TikTok, Google Search"
                  required
                  disabled={isPlannerPending}
                />
              </Field>

              <Field id="budget" label="Budget">
                <Input id="budget" name="budget" placeholder="$1,500/month" disabled={isPlannerPending} />
              </Field>

              <Field id="marketOrCountry" label="Market or country">
                <Input
                  id="marketOrCountry"
                  name="marketOrCountry"
                  placeholder="United States, Morocco, GCC"
                  disabled={isPlannerPending}
                />
              </Field>

              <Field id="tone" label="Tone">
                <Input id="tone" name="tone" placeholder="Premium, direct, friendly" disabled={isPlannerPending} />
              </Field>

              <Field id="duration" label="Duration">
                <Input id="duration" name="duration" placeholder="14 days, 30 days, 6 weeks" disabled={isPlannerPending} />
              </Field>

              <div className="lg:col-span-2">
                <Field id="extraNotes" label="Extra notes">
                  <Textarea
                    id="extraNotes"
                    name="extraNotes"
                    rows={4}
                    placeholder="Constraints, proof points, competitors, offer details, required channels"
                    disabled={isPlannerPending}
                  />
                </Field>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                size="lg"
                disabled={isPlannerPending}
                className={gradientButtonClassName}
              >
                {isPlannerPending ? (
                  <>
                    <Clock className="h-5 w-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Create Planner Task
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>

        <Card className={premiumCardClassName}>
          <CardHeader
            title="Performance Analyzer"
            description="Turn ad metrics and observed problems into a pending analysis task."
            action={<StatusBadge status="Prepared" type="system" size="sm" />}
          />

          <form action={analyzerAction} className="space-y-5">
            {analyzerState?.error && (
              <Notice tone="danger" title="Performance analyzer task was not created">
                {analyzerState.error}
              </Notice>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              <Field id="platform" label="Platform" required>
                <Input id="platform" name="platform" placeholder="Meta Ads, TikTok, Google Ads" required disabled={isAnalyzerPending} />
              </Field>

              <Field id="analyzerCampaignGoal" label="Campaign goal" required>
                <Input
                  id="analyzerCampaignGoal"
                  name="campaignGoal"
                  placeholder="Lead generation, sales, booked calls"
                  required
                  disabled={isAnalyzerPending}
                />
              </Field>

              <Field id="budgetSpent" label="Budget spent">
                <Input id="budgetSpent" name="budgetSpent" placeholder="$740" disabled={isAnalyzerPending} />
              </Field>

              <Field id="impressions" label="Impressions">
                <Input id="impressions" name="impressions" type="number" min="0" placeholder="25000" disabled={isAnalyzerPending} />
              </Field>

              <Field id="clicks" label="Clicks">
                <Input id="clicks" name="clicks" type="number" min="0" placeholder="480" disabled={isAnalyzerPending} />
              </Field>

              <Field id="ctr" label="CTR">
                <Input id="ctr" name="ctr" placeholder="1.9%" disabled={isAnalyzerPending} />
              </Field>

              <Field id="cpc" label="CPC">
                <Input id="cpc" name="cpc" placeholder="$1.54" disabled={isAnalyzerPending} />
              </Field>

              <Field id="leads" label="Leads">
                <Input id="leads" name="leads" type="number" min="0" placeholder="32" disabled={isAnalyzerPending} />
              </Field>

              <Field id="conversions" label="Conversions">
                <Input id="conversions" name="conversions" type="number" min="0" placeholder="7" disabled={isAnalyzerPending} />
              </Field>

              <Field id="creativeType" label="Creative type">
                <Input id="creativeType" name="creativeType" placeholder="UGC video, carousel, static image" disabled={isAnalyzerPending} />
              </Field>

              <div className="lg:col-span-2">
                <Field id="audience" label="Audience">
                  <Textarea
                    id="audience"
                    name="audience"
                    rows={3}
                    placeholder="Audience targeting, exclusions, lookalikes, interests, geo"
                    disabled={isAnalyzerPending}
                  />
                </Field>
              </div>

              <div className="lg:col-span-2">
                <Field id="problemObserved" label="Problem observed" required>
                  <Textarea
                    id="problemObserved"
                    name="problemObserved"
                    rows={3}
                    placeholder="Low CTR, expensive leads, no conversions, weak creative engagement"
                    required
                    disabled={isAnalyzerPending}
                  />
                </Field>
              </div>

              <div className="lg:col-span-2">
                <Field id="analyzerExtraNotes" label="Extra notes">
                  <Textarea
                    id="analyzerExtraNotes"
                    name="extraNotes"
                    rows={3}
                    placeholder="Landing page notes, offer notes, tests already tried"
                    disabled={isAnalyzerPending}
                  />
                </Field>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                size="lg"
                disabled={isAnalyzerPending}
                className={gradientButtonClassName}
              >
                {isAnalyzerPending ? (
                  <>
                    <Clock className="h-5 w-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <BarChart3 className="h-5 w-5" />
                    Create Analyzer Task
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <Card className={premiumCardClassName}>
        <CardHeader
          title="Manual Campaign Tracker"
          description="Log live ad performance and create a pending campaign analysis task."
          action={<StatusBadge status="Prepared" type="system" size="sm" />}
        />

        <form action={trackerAction} className="space-y-5">
          {trackerState?.error && (
            <Notice tone="danger" title="Tracking analysis task was not created">
              {trackerState.error}
            </Notice>
          )}

          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
            <Field id="trackerCampaignName" label="Campaign name" required>
              <Input
                id="trackerCampaignName"
                name="campaignName"
                placeholder="Spring booked calls test"
                required
                disabled={isTrackerPending}
              />
            </Field>

            <Field id="trackerPlatform" label="Platform" required>
              <Input
                id="trackerPlatform"
                name="platform"
                placeholder="Meta Ads, TikTok, Google Search"
                required
                disabled={isTrackerPending}
              />
            </Field>

            <Field id="trackerCampaignGoal" label="Campaign goal" required>
              <Input
                id="trackerCampaignGoal"
                name="campaignGoal"
                placeholder="Lead generation, sales, booked calls"
                required
                disabled={isTrackerPending}
              />
            </Field>

            <Field id="trackerBudgetSpent" label="Budget spent">
              <Input id="trackerBudgetSpent" name="budgetSpent" placeholder="$740" disabled={isTrackerPending} />
            </Field>

            <Field id="trackerImpressions" label="Impressions">
              <Input
                id="trackerImpressions"
                name="impressions"
                type="number"
                min="0"
                placeholder="25000"
                disabled={isTrackerPending}
              />
            </Field>

            <Field id="trackerClicks" label="Clicks">
              <Input
                id="trackerClicks"
                name="clicks"
                type="number"
                min="0"
                placeholder="480"
                disabled={isTrackerPending}
              />
            </Field>

            <Field id="trackerCtr" label="CTR">
              <Input id="trackerCtr" name="ctr" placeholder="1.9%" disabled={isTrackerPending} />
            </Field>

            <Field id="trackerCpc" label="CPC">
              <Input id="trackerCpc" name="cpc" placeholder="$1.54" disabled={isTrackerPending} />
            </Field>

            <Field id="trackerLeads" label="Leads">
              <Input
                id="trackerLeads"
                name="leads"
                type="number"
                min="0"
                placeholder="32"
                disabled={isTrackerPending}
              />
            </Field>

            <Field id="trackerConversions" label="Conversions">
              <Input
                id="trackerConversions"
                name="conversions"
                type="number"
                min="0"
                placeholder="7"
                disabled={isTrackerPending}
              />
            </Field>

            <Field id="trackerCreativeType" label="Creative type">
              <Input
                id="trackerCreativeType"
                name="creativeType"
                placeholder="UGC video, carousel, static image"
                disabled={isTrackerPending}
              />
            </Field>

            <Field id="trackerOffer" label="Offer">
              <Input
                id="trackerOffer"
                name="offer"
                placeholder="Free audit, discount, consultation"
                disabled={isTrackerPending}
              />
            </Field>

            <div className="lg:col-span-2">
              <Field id="trackerAudience" label="Audience">
                <Textarea
                  id="trackerAudience"
                  name="audience"
                  rows={3}
                  placeholder="Targeting, interests, lookalikes, geo, exclusions"
                  disabled={isTrackerPending}
                />
              </Field>
            </div>

            <div className="lg:col-span-2">
              <Field id="trackerLandingPage" label="Landing page">
                <Textarea
                  id="trackerLandingPage"
                  name="landingPage"
                  rows={3}
                  placeholder="Landing page URL, conversion path, page notes"
                  disabled={isTrackerPending}
                />
              </Field>
            </div>

            <div className="lg:col-span-2">
              <Field id="trackerProblemObserved" label="Problem observed" required>
                <Textarea
                  id="trackerProblemObserved"
                  name="problemObserved"
                  rows={3}
                  placeholder="Low CTR, expensive leads, no conversions, weak hook"
                  required
                  disabled={isTrackerPending}
                />
              </Field>
            </div>

            <div className="lg:col-span-2">
              <Field id="trackerNotes" label="Notes">
                <Textarea
                  id="trackerNotes"
                  name="notes"
                  rows={3}
                  placeholder="Tests already tried, context, constraints, hypotheses"
                  disabled={isTrackerPending}
                />
              </Field>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              size="lg"
              disabled={isTrackerPending}
              className={gradientButtonClassName}
            >
              {isTrackerPending ? (
                <>
                  <Clock className="h-5 w-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <ClipboardList className="h-5 w-5" />
                  Create Tracking Analysis Task
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>

      <Card className={premiumCardClassName}>
        <CardHeader
          title="Recent Campaign Reports"
          description="Completed and review-ready campaign tasks with generated report output."
          action={
            <Link
              href="/dashboard/reports"
              className={buttonStyles({
                variant: 'outline',
                size: 'sm',
                className: warmOutlineButtonClassName,
              })}
            >
              <FileText className="h-4 w-4" />
              All Reports
            </Link>
          }
        />

        {campaignReports.length === 0 ? (
          <EmptyState
            icon={<TrendingUp className="h-6 w-6" />}
            title="No generated campaign reports yet"
            description="Create a planner, tracker, or analyzer task, run it from Task Details, then review the generated report."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {campaignReports.map((report) => (
              <article key={report.taskId} className={cn(softPanelClassName, 'min-w-0 p-4 transition-all hover:-translate-y-1 hover:border-[#F7CBCA]/22 hover:shadow-[0_18px_38px_rgba(202,40,81,0.12)]')}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="break-words font-bold text-black">{report.title}</h3>
                    <p className="mt-1 text-sm text-black/52">
                      {report.agentName} · Updated {report.updatedLabel}
                    </p>
                  </div>
                  <StatusBadge status={report.status} type="task" size="sm" />
                </div>
                <p className="mt-4 text-sm leading-6 text-black/62">{report.summaryPreview}</p>
                <div className="mt-4">
                  <Link
                    href={report.href}
                    className={buttonStyles({
                      variant: 'soft',
                      size: 'sm',
                      className: 'border-[#F7CBCA]/15 bg-[#D5E5E5]/55 text-[#F7CBCA] hover:border-[#F7CBCA]/32 hover:bg-[#D5E5E5]',
                    })}
                  >
                    Open Report
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>

      {pendingCampaignTasks.length > 0 && (
        <Card className={premiumCardClassName}>
          <CardHeader
            title="Draft/Pending Campaign Tasks"
            description="Campaign briefs and tracking analyses created as normal pending tasks."
          />

          <div className="grid gap-3 md:grid-cols-2">
            {pendingCampaignTasks.map((task) => (
              <div key={task.taskId} className={cn(softPanelClassName, 'flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between')}>
                <div className="min-w-0">
                  <h3 className="break-words text-sm font-bold text-black">{task.title}</h3>
                  <p className="mt-1 text-xs text-black/52">
                    {task.agentName} · Updated {task.updatedLabel}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={task.status} type="task" size="sm" />
                  <Link
                    href={task.href}
                    className={buttonStyles({
                      variant: 'outline',
                      size: 'sm',
                      className: warmOutlineButtonClassName,
                    })}
                  >
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
