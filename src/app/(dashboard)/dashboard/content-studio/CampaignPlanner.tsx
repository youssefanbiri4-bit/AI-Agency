'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCopy,
  FileText,
  Layers3,
  Send,
  Sparkles,
} from 'lucide-react';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input, Label, Select, Textarea } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { toast } from '@/components/ui/toast';
import { campaignTemplates } from '@/lib/content-studio/campaign-templates';
import type { ProviderReadinessResult } from '@/lib/content-studio/provider-types';
import type {
  CampaignPlannerInput,
  CampaignPlannerLength,
  CampaignPlannerResult,
} from '@/lib/content-studio/campaign-planner-types';
import type { BrandKit } from '@/types/brand-kit';
import type { ContentStudioPlatform } from '@/types/database';
import {
  createCampaignPlanDraftsAction,
  generateCampaignPlanAction,
} from './actions';

interface CampaignPlannerProps {
  brandKit: BrandKit;
  brandKitExists: boolean;
  providerReadiness: Record<string, ProviderReadinessResult>;
}

type PlanTab =
  | 'overview'
  | 'instagram'
  | 'facebook'
  | 'google_ads'
  | 'pinterest'
  | 'linkedin'
  | 'creative'
  | 'calendar';

const platformOptions: Array<{ value: ContentStudioPlatform; label: string }> = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'linkedin', label: 'LinkedIn' },
];

const campaignLengths: Array<{ value: CampaignPlannerLength; label: string }> = [
  { value: 'one_post', label: 'One post' },
  { value: '3_day', label: '3-day plan' },
  { value: '7_day', label: '7-day plan' },
  { value: '14_day', label: '14-day plan' },
];

const plannerTemplates = campaignTemplates.filter((template) =>
  [
    'instagram-awareness-post',
    'ai-agency-lead-generation-campaign',
    'product-launch-campaign',
    'weekly-content-pack',
  ].includes(template.id)
);

const tabs: Array<{ value: PlanTab; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'creative', label: 'Creative Brief' },
  { value: 'calendar', label: 'Calendar Plan' },
];

function lines(values: Array<string | number | null | undefined>) {
  return values.filter((value) => value !== null && value !== undefined && String(value).trim()).join('\n');
}

function list(values: string[] | undefined) {
  return Array.isArray(values) ? values.filter(Boolean).join('\n') : '';
}

function defaultBrandValue(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function formatPlatformPackage(plan: CampaignPlannerResult, tab: PlanTab) {
  switch (tab) {
    case 'overview':
      return lines([
        `Campaign: ${plan.overview.campaignName}`,
        `Goal: ${plan.overview.goal}`,
        `Audience: ${plan.overview.audience}`,
        `Offer: ${plan.overview.offer}`,
        `CTA: ${plan.overview.cta}`,
        `Platforms: ${plan.overview.platforms.join(', ')}`,
        `Angle: ${plan.overview.campaignAngle}`,
      ]);
    case 'instagram':
      return lines([
        'Instagram Package',
        `Hook: ${plan.instagram.hook}`,
        `Caption: ${plan.instagram.postCaption}`,
        `CTA: ${plan.instagram.cta}`,
        `Hashtags:\n${list(plan.instagram.hashtags)}`,
        `Creative direction: ${plan.instagram.creativeDirection}`,
        `Reel script: ${plan.instagram.reelScript}`,
        `Scene breakdown:\n${list(plan.instagram.sceneBreakdown)}`,
        `On-screen text:\n${list(plan.instagram.onScreenText)}`,
        `Voiceover: ${plan.instagram.voiceoverScript}`,
      ]);
    case 'facebook':
      return lines([
        'Facebook Package',
        plan.facebook.postCopy,
        `Headline: ${plan.facebook.headline}`,
        `Description: ${plan.facebook.description}`,
        `CTA: ${plan.facebook.cta}`,
        `Creative direction: ${plan.facebook.creativeDirection}`,
      ]);
    case 'google_ads':
      return lines([
        'Google Ads Package',
        `Objective: ${plan.googleAds.campaignObjective}`,
        `Keywords:\n${list(plan.googleAds.keywords)}`,
        `Headlines:\n${list(plan.googleAds.headlines)}`,
        `Descriptions:\n${list(plan.googleAds.descriptions)}`,
        `CTA: ${plan.googleAds.cta}`,
        `Destination URL: ${plan.googleAds.destinationUrl}`,
        `Budget notes: ${plan.googleAds.budgetNotes}`,
        plan.googleAds.pausedDraftReminder || 'Create Paused Google Ads Campaign Draft only.',
      ]);
    case 'pinterest':
      return lines([
        'Pinterest Package',
        `Title: ${plan.pinterest.pinTitle}`,
        `Description: ${plan.pinterest.pinDescription}`,
        `Destination URL: ${plan.pinterest.destinationUrl}`,
        `Creative direction: ${plan.pinterest.creativeDirection}`,
        `Board suggestion: ${plan.pinterest.boardSuggestion}`,
      ]);
    case 'linkedin':
      return lines([
        'LinkedIn Package',
        `Hook: ${plan.linkedin.hook}`,
        plan.linkedin.post,
        `CTA: ${plan.linkedin.cta}`,
        `Hashtags:\n${list(plan.linkedin.hashtags)}`,
        plan.linkedin.manualOnlyNote,
      ]);
    case 'creative':
      return lines([
        'Creative Brief',
        `Image/video direction: ${plan.creativeBrief.imageVideoDirection}`,
        `Visual style: ${plan.creativeBrief.visualStyle}`,
        `Colors:\n${list(plan.creativeBrief.colors)}`,
        `Design notes: ${plan.creativeBrief.designNotes}`,
        `Suggested asset types:\n${list(plan.creativeBrief.suggestedAssetTypes)}`,
      ]);
    case 'calendar':
      return lines([
        'Calendar Plan',
        ...plan.calendarPlan.map(
          (item) =>
            `${item.day} / ${item.plannedTime} / ${item.platform} / ${item.contentType} / ${item.status}\n${item.title}\n${item.notes}`
        ),
      ]);
    default:
      return '';
  }
}

function formatFullPlan(plan: CampaignPlannerResult) {
  return tabs.map((tab) => formatPlatformPackage(plan, tab.value)).join('\n\n---\n\n');
}

function readPlannerInputFromForm(form: HTMLFormElement): CampaignPlannerInput {
  const formData = new FormData(form);
  return {
    campaignName: String(formData.get('campaign_name') ?? ''),
    goal: String(formData.get('campaign_goal') ?? ''),
    productService: String(formData.get('product_service') ?? ''),
    targetAudience: String(formData.get('target_audience') ?? ''),
    offer: String(formData.get('offer') ?? ''),
    destinationUrl: String(formData.get('destination_url') ?? ''),
    platforms: formData.getAll('preferred_platforms') as ContentStudioPlatform[],
    campaignLength: String(formData.get('campaign_length') ?? '7_day') as CampaignPlannerLength,
    tone: String(formData.get('tone') ?? ''),
    language: String(formData.get('language') ?? ''),
    cta: String(formData.get('cta') ?? ''),
    notes: String(formData.get('notes') ?? ''),
    templateId: String(formData.get('template_id') ?? ''),
  };
}

export function CampaignPlanner({
  brandKit,
  brandKitExists,
  providerReadiness,
}: CampaignPlannerProps) {
  const [plan, setPlan] = useState<CampaignPlannerResult | null>(null);
  const [plannerInput, setPlannerInput] = useState<CampaignPlannerInput | null>(null);
  const [activeTab, setActiveTab] = useState<PlanTab>('overview');
  const [scheduleDrafts, setScheduleDrafts] = useState(false);
  const [isGenerating, startGenerateTransition] = useTransition();
  const [isCreatingDrafts, startDraftTransition] = useTransition();
  const brandDefaultOffer = brandKit.campaignDefaults.defaultOffer ?? brandKit.offer;
  const brandDestinationUrl = brandKit.campaignDefaults.defaultDestinationUrl ?? brandKit.websiteUrl;
  const readinessRows = useMemo(
    () => [
      ['Instagram', providerReadiness.instagram?.state ?? 'setup_required'],
      ['Facebook', providerReadiness.facebook?.state ?? 'setup_required'],
      ['Google Ads', providerReadiness.google_ads?.state ?? 'setup_required'],
      ['Pinterest', providerReadiness.pinterest?.state ?? 'setup_required'],
      ['LinkedIn', providerReadiness.linkedin?.state ?? 'manual_only'],
    ],
    [providerReadiness]
  );

  async function copyText(label: string, value: string) {
    if (!value.trim()) {
      toast.info('Nothing to copy yet.');
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error('Could not copy to clipboard.');
    }
  }

  function handleGenerate(formData: FormData, form: HTMLFormElement) {
    startGenerateTransition(async () => {
      const loadingToastId = toast.loading('Generating campaign plan...');
      const result = await generateCampaignPlanAction(formData);

      if (result.error || !result.plan) {
        toast.update(loadingToastId, {
          tone: result.error === 'AI provider setup required.' ? 'warning' : 'error',
          title: result.error ?? 'AI generation failed.',
          description:
            result.error === 'AI provider setup required.'
              ? 'Configure OPENAI_API_KEY server-side to enable planning.'
              : undefined,
        });
        return;
      }

      setPlan(result.plan);
      setPlannerInput(readPlannerInputFromForm(form));
      setActiveTab('overview');
      toast.update(loadingToastId, {
        tone: 'success',
        title: 'Campaign plan generated.',
        description: 'Generated with OpenAI.',
      });
    });
  }

  function handleCreateDrafts() {
    if (!plan || !plannerInput) {
      toast.warning('Generate a campaign plan first.');
      return;
    }

    const confirmed = window.confirm(
      scheduleDrafts
        ? 'This will create draft content items from the generated plan and add schedule_at values from the calendar suggestions. Nothing will be published.'
        : 'This will create draft content items from the generated plan. Nothing will be published.'
    );

    if (!confirmed) {
      return;
    }

    startDraftTransition(async () => {
      const formData = new FormData();
      formData.set('campaign_plan_json', JSON.stringify(plan));
      formData.set('planner_input_json', JSON.stringify(plannerInput));
      formData.set('schedule_drafts', scheduleDrafts ? 'true' : 'false');
      const loadingToastId = toast.loading('Creating campaign drafts...');
      const result = await createCampaignPlanDraftsAction(formData);

      if (result.error) {
        toast.update(loadingToastId, {
          tone: 'error',
          title: result.error,
        });
        return;
      }

      toast.update(loadingToastId, {
        tone: 'success',
        title: result.message ?? 'Campaign drafts created.',
        description: `${result.itemIds?.length ?? 0} draft items created. Nothing was published.`,
      });
    });
  }

  return (
    <Card id="one-click-campaign-planner" className="scroll-mt-24 border-[#F7CBCA]/14 bg-white/92">
      <CardHeader
        title="One-Click Campaign Planner"
        description="Enter one campaign idea and generate copy-ready platform packages, creative direction, and a suggested calendar plan."
        action={<Sparkles className="h-5 w-5 text-[#F7CBCA]" />}
      />

      {!brandKitExists ? (
        <Notice tone="info" title="Brand Kit recommended">
          Add a Brand Kit for more personalized campaign plans.
        </Notice>
      ) : null}

      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <form
          className="space-y-5 rounded-lg border border-black/8 bg-[#F1F7F7]/62 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (isGenerating) {
              return;
            }
            handleGenerate(new FormData(event.currentTarget), event.currentTarget);
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="planner_campaign_name">Campaign name</Label>
              <Input
                id="planner_campaign_name"
                name="campaign_name"
                defaultValue={`${brandKit.brandName} campaign`}
                disabled={isGenerating || isCreatingDrafts}
              />
            </div>
            <div>
              <Label htmlFor="planner_template_id">Starting template</Label>
              <Select id="planner_template_id" name="template_id" disabled={isGenerating || isCreatingDrafts}>
                <option value="">No template</option>
                {plannerTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="planner_campaign_goal">Campaign goal</Label>
              <Textarea
                id="planner_campaign_goal"
                name="campaign_goal"
                rows={3}
                placeholder="Promote AgentFlow AI to freelancers and AI agency owners"
                disabled={isGenerating || isCreatingDrafts}
              />
            </div>
            <div>
              <Label htmlFor="planner_product_service">Product/service to promote</Label>
              <Textarea
                id="planner_product_service"
                name="product_service"
                rows={3}
                defaultValue={defaultBrandValue(brandKit.description) || brandKit.brandName}
                disabled={isGenerating || isCreatingDrafts}
              />
            </div>
            <div>
              <Label htmlFor="planner_target_audience">Target audience</Label>
              <Textarea
                id="planner_target_audience"
                name="target_audience"
                rows={3}
                defaultValue={defaultBrandValue(brandKit.targetAudience)}
                disabled={isGenerating || isCreatingDrafts}
              />
            </div>
            <div>
              <Label htmlFor="planner_offer">Offer/value proposition</Label>
              <Textarea
                id="planner_offer"
                name="offer"
                rows={3}
                defaultValue={defaultBrandValue(brandDefaultOffer)}
                disabled={isGenerating || isCreatingDrafts}
              />
            </div>
            <div>
              <Label htmlFor="planner_destination_url">Destination URL</Label>
              <Input
                id="planner_destination_url"
                name="destination_url"
                type="url"
                defaultValue={defaultBrandValue(brandDestinationUrl)}
                placeholder="https://example.com"
                disabled={isGenerating || isCreatingDrafts}
              />
            </div>
            <div>
              <Label htmlFor="planner_campaign_length">Campaign length</Label>
              <Select
                id="planner_campaign_length"
                name="campaign_length"
                defaultValue="7_day"
                disabled={isGenerating || isCreatingDrafts}
              >
                {campaignLengths.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="planner_language">Language</Label>
              <Input
                id="planner_language"
                name="language"
                defaultValue={brandKit.aiPreferences.defaultLanguage}
                disabled={isGenerating || isCreatingDrafts}
              />
            </div>
            <div>
              <Label htmlFor="planner_tone">Tone</Label>
              <Textarea
                id="planner_tone"
                name="tone"
                rows={3}
                defaultValue={defaultBrandValue(brandKit.toneOfVoice)}
                disabled={isGenerating || isCreatingDrafts}
              />
            </div>
            <div>
              <Label htmlFor="planner_cta">CTA</Label>
              <Textarea
                id="planner_cta"
                name="cta"
                rows={3}
                defaultValue={defaultBrandValue(brandKit.defaultCta)}
                disabled={isGenerating || isCreatingDrafts}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Preferred platforms</Label>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {platformOptions.map((platform) => (
                  <label
                    key={platform.value}
                    className="flex items-center gap-2 rounded-lg border border-black/8 bg-white px-3 py-2 text-sm font-bold text-black/70"
                  >
                    <input
                      type="checkbox"
                      name="preferred_platforms"
                      value={platform.value}
                      defaultChecked
                      disabled={isGenerating || isCreatingDrafts}
                      className="h-4 w-4 rounded border-black/18 text-[#F7CBCA] focus:ring-[#F7CBCA]"
                    />
                    {platform.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="planner_notes">Notes</Label>
              <Textarea
                id="planner_notes"
                name="notes"
                rows={4}
                placeholder="Constraints, audience objections, offer details, content angles, or launch timing."
                disabled={isGenerating || isCreatingDrafts}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-black/8 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-black/38">Provider readiness awareness</p>
            <div className="flex flex-wrap gap-2">
              {readinessRows.map(([label, state]) => (
                <span key={label} className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-[#F1F7F7] px-3 py-1 text-xs font-bold text-black/62">
                  {label}
                  <StatusBadge status={state as Parameters<typeof StatusBadge>[0]['status']} type="system" size="sm" />
                </span>
              ))}
            </div>
            <p className="text-sm leading-6 text-black/55">
              Provider readiness is shown for context only. Planning and draft creation do not require providers to be ready.
            </p>
          </div>

          <Button type="submit" size="lg" disabled={isGenerating || isCreatingDrafts} className="w-full">
            <Sparkles className="h-4 w-4" />
            {isGenerating ? 'Generating Campaign Plan...' : 'Generate Campaign Plan'}
          </Button>
        </form>

        <div className="space-y-5">
          {!plan ? (
            <div className="rounded-lg border border-dashed border-[#F7CBCA]/18 bg-[#D5E5E5]/28 p-8 text-center">
              <Layers3 className="mx-auto h-8 w-8 text-[#F7CBCA]" />
              <h3 className="mt-4 text-lg font-black text-[#5D6B6B]">Generated campaign output will appear here</h3>
              <p className="mt-2 text-sm leading-6 text-black/58">
                The planner creates copy packages, a creative brief, and a suggested content calendar without publishing anything.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <Button
                    key={tab.value}
                    type="button"
                    size="sm"
                    variant={activeTab === tab.value ? 'primary' : 'outline'}
                    onClick={() => setActiveTab(tab.value)}
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>

              <Card className="bg-white">
                <CardHeader
                  title={tabs.find((tab) => tab.value === activeTab)?.label ?? 'Campaign Plan'}
                  description="Review, copy, or create draft Content Studio items from this generated plan."
                  action={<FileText className="h-5 w-5 text-[#F7CBCA]" />}
                />
                <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-lg border border-black/8 bg-[#F1F7F7]/70 p-4 text-sm leading-6 text-black/72">
                  {formatPlatformPackage(plan, activeTab)}
                </pre>
              </Card>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" onClick={() => void copyText('Full campaign plan', formatFullPlan(plan))}>
                  <ClipboardCopy className="h-4 w-4" />
                  Copy Full Campaign Plan
                </Button>
                <Button type="button" variant="outline" onClick={() => void copyText('Instagram package', formatPlatformPackage(plan, 'instagram'))}>
                  Copy Instagram Package
                </Button>
                <Button type="button" variant="outline" onClick={() => void copyText('Reel script', plan.instagram.reelScript)}>
                  Copy Reel Script
                </Button>
                <Button type="button" variant="outline" onClick={() => void copyText('Facebook package', formatPlatformPackage(plan, 'facebook'))}>
                  Copy Facebook Package
                </Button>
                <Button type="button" variant="outline" onClick={() => void copyText('Google Ads package', formatPlatformPackage(plan, 'google_ads'))}>
                  Copy Google Ads Package
                </Button>
                <Button type="button" variant="outline" onClick={() => void copyText('Pinterest package', formatPlatformPackage(plan, 'pinterest'))}>
                  Copy Pinterest Package
                </Button>
                <Button type="button" variant="outline" onClick={() => void copyText('LinkedIn package', formatPlatformPackage(plan, 'linkedin'))}>
                  Copy LinkedIn Package
                </Button>
                <Button type="button" variant="outline" onClick={() => void copyText('Creative brief', formatPlatformPackage(plan, 'creative'))}>
                  Copy Creative Brief
                </Button>
                <Button type="button" variant="outline" onClick={() => void copyText('Calendar plan', formatPlatformPackage(plan, 'calendar'))}>
                  Copy Calendar Plan
                </Button>
              </div>

              <div className="rounded-lg border border-black/8 bg-[#F1F7F7]/70 p-4">
                <label className="flex items-start gap-3 text-sm font-bold text-black/72">
                  <input
                    type="checkbox"
                    checked={scheduleDrafts}
                    onChange={(event) => setScheduleDrafts(event.currentTarget.checked)}
                    className="mt-1 h-4 w-4 rounded border-black/18 text-[#F7CBCA] focus:ring-[#F7CBCA]"
                  />
                  <span>
                    Add to Calendar as Draft Plan
                    <span className="mt-1 block text-sm font-medium leading-6 text-black/55">
                      Uses the generated day/time suggestions as `schedule_at` values. Items stay draft and nothing auto-publishes.
                    </span>
                  </span>
                </label>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <Button type="button" onClick={handleCreateDrafts} disabled={isCreatingDrafts || isGenerating}>
                    <Send className="h-4 w-4" />
                    {isCreatingDrafts ? 'Creating Drafts...' : 'Create Drafts from Campaign Plan'}
                  </Button>
                  <Link href="/dashboard/calendar" className={buttonStyles({ variant: 'outline' })}>
                    <CalendarDays className="h-4 w-4" />
                    Open Calendar
                  </Link>
                </div>
              </div>

              <Notice tone="info" title="Planner safety">
                Draft creation only writes draft Content Studio items. It does not publish, create active campaigns, spend money, or call provider publishing APIs.
              </Notice>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-black/8 bg-[#F1F7F7]/62 p-4">
          <CheckCircle2 className="h-5 w-5 text-[#F7CBCA]" />
          <p className="mt-2 font-bold text-[#5D6B6B]">Draft-only workflow</p>
          <p className="mt-1 text-sm leading-6 text-black/55">Generated output is copy-ready until you explicitly create drafts.</p>
        </div>
        <div className="rounded-lg border border-black/8 bg-[#F1F7F7]/62 p-4">
          <Sparkles className="h-5 w-5 text-[#F7CBCA]" />
          <p className="mt-2 font-bold text-[#5D6B6B]">Brand Kit aware</p>
          <p className="mt-1 text-sm leading-6 text-black/55">Defaults use saved offer, audience, tone, CTA, hashtags, visual style, and colors.</p>
        </div>
        <div className="rounded-lg border border-black/8 bg-[#F1F7F7]/62 p-4">
          <CalendarDays className="h-5 w-5 text-[#F7CBCA]" />
          <p className="mt-2 font-bold text-[#5D6B6B]">Calendar planning</p>
          <p className="mt-1 text-sm leading-6 text-black/55">Schedule suggestions are planning fields only and never trigger publishing from this panel.</p>
        </div>
      </div>
    </Card>
  );
}
