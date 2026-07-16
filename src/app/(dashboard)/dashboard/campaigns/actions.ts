'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { createTask } from '@/features/tasks/data/tasks';
import { createNotification } from '@/lib/data/notifications';
import {
  getGoogleAdsCampaignMetricsForWorkspace,
  getMetaAdAccountsForWorkspace,
  type GoogleAdsCustomerCampaignsData,
  type GoogleAdsCampaignMetricsRow,
  type MetaAdAccountCampaignsData,
  type MetaCampaignWithInsights,
} from '@/lib/data/ad-connections';
import {
  buildMetaPerformanceDiagnosis,
  formatMetaDiagnosisForBrief,
} from '@/lib/ads/meta-diagnosis';
import type { AgentType } from '@/types';

const preferredCampaignAgentIds: AgentType[] = [
  'social_media_content',
  'copywriting',
  'ads_script',
  'email_marketing',
];

export interface CampaignTaskState {
  error: string | null;
}

function readField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function valueOrFallback(value: string) {
  return value || 'Not specified';
}

function formatMetricValue(value: number | null | undefined, suffix = '') {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'Not available';
  }

  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value)}${suffix}`;
}

function formatMoneyMetric(value: number | null | undefined, currency: string | null) {
  const formatted = formatMetricValue(value);

  if (formatted === 'Not available') {
    return formatted;
  }

  return currency ? `${formatted} ${currency}` : formatted;
}

function formatPercentMetric(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'Not available';
  }

  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value * 100)}%`;
}

function normalizeAccountMatchValue(value: string | null | undefined) {
  return value?.trim().replace(/^act_/i, '') ?? '';
}

function findMetaCampaignForAnalysis({
  accounts,
  accountId,
  campaignId,
}: {
  accounts: MetaAdAccountCampaignsData[];
  accountId: string;
  campaignId: string;
}) {
  const normalizedAccountId = normalizeAccountMatchValue(accountId);

  const account = accounts.find((item) => {
    const accountValues = [item.accountId, item.id].map(normalizeAccountMatchValue);
    return accountValues.includes(normalizedAccountId);
  });

  if (!account) {
    return {
      account: null,
      campaign: null,
    };
  }

  return {
    account,
    campaign: account.campaigns.find((item) => item.id === campaignId) ?? null,
  };
}

function buildMetaCampaignAnalysisDescription({
  account,
  campaign,
}: {
  account: MetaAdAccountCampaignsData;
  campaign: MetaCampaignWithInsights;
}) {
  const insights = campaign.insights;
  const diagnosis = buildMetaPerformanceDiagnosis(insights);
  const accountLabel = account.name ?? account.accountId ?? account.id ?? 'Not available';
  const campaignLabel = campaign.name ?? campaign.id ?? 'Not available';

  return `META CAMPAIGN PERFORMANCE BRIEF

Platform:
Meta Ads / Instagram & Facebook

Ad account:
${accountLabel}

Campaign:
${campaignLabel}

Campaign ID:
${campaign.id ?? 'Not available'}

Status:
${valueOrFallback(campaign.effectiveStatus ?? campaign.status ?? '')}

Objective:
${valueOrFallback(campaign.objective ?? '')}

Date range:
last_30d

Metrics:
Spend:
${formatMoneyMetric(insights?.spend, account.currency)}

Impressions:
${formatMetricValue(insights?.impressions)}

Reach:
${formatMetricValue(insights?.reach)}

Clicks:
${formatMetricValue(insights?.clicks)}

CTR:
${formatMetricValue(insights?.ctr, '%')}

CPC:
${formatMoneyMetric(insights?.cpc, account.currency)}

CPM:
${formatMoneyMetric(insights?.cpm, account.currency)}

Leads:
${formatMetricValue(insights?.leads)}

Conversions:
${formatMetricValue(insights?.conversions)}

Local diagnosis:
${formatMetaDiagnosisForBrief(diagnosis)}

Please analyze:
- Why performance may be weak or strong
- Platform fit
- Audience fit
- Creative and hook issues
- Offer/message issues
- Landing page issues
- Budget efficiency
- What to change next
- Recommendations
- Next actions`;
}

function findGoogleAdsCampaignForAnalysis({
  customers,
  customerId,
  campaignId,
}: {
  customers: GoogleAdsCustomerCampaignsData[];
  customerId: string;
  campaignId: string;
}) {
  const customer = customers.find((item) => item.customerId === customerId);

  if (!customer) {
    return {
      customer: null,
      campaign: null,
    };
  }

  return {
    customer,
    campaign: customer.campaigns.find((item) => item.campaignId === campaignId) ?? null,
  };
}

function buildGoogleAdsCampaignAnalysisDescription({
  customer,
  campaign,
}: {
  customer: GoogleAdsCustomerCampaignsData;
  campaign: GoogleAdsCampaignMetricsRow;
}) {
  return `GOOGLE ADS CAMPAIGN PERFORMANCE BRIEF

Platform:
Google Ads

Customer ID:
${valueOrFallback(customer.customerId)}

Campaign ID:
${valueOrFallback(campaign.campaignId)}

Campaign name:
${valueOrFallback(campaign.campaignName)}

Date range:
last 30 days

Status:
${valueOrFallback(campaign.status ?? '')}

Channel type:
${valueOrFallback(campaign.channelType ?? '')}

Impressions:
${formatMetricValue(campaign.impressions)}

Clicks:
${formatMetricValue(campaign.clicks)}

CTR:
${formatPercentMetric(campaign.ctr)}

Average CPC:
${formatMetricValue(campaign.averageCpc)}

Cost:
${formatMetricValue(campaign.cost)}

Conversions:
${formatMetricValue(campaign.conversions)}

Conversion value:
${formatMetricValue(campaign.conversionsValue)}

Please analyze weak performance causes, budget efficiency, targeting/channel fit, creative/offer/landing-page assumptions, and next actions.`;
}

async function getCampaignAgent(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
) {
  const { data: preferredAgent, error: preferredError } = await supabase
    .from('agents')
    .select('id')
    .eq('id', 'social_media_content')
    .eq('is_active', true)
    .maybeSingle();

  if (preferredError) {
    return { agentType: null, error: preferredError.message };
  }

  if (preferredAgent?.id) {
    return { agentType: preferredAgent.id as AgentType, error: null };
  }

  const { data: fallbackAgents, error: fallbackError } = await supabase
    .from('agents')
    .select('id')
    .eq('department_id', 'content_growth')
    .eq('is_active', true)
    .in('id', preferredCampaignAgentIds)
    .order('sort_order', { ascending: true })
    .limit(1);

  if (fallbackError) {
    return { agentType: null, error: fallbackError.message };
  }

  const fallbackAgent = fallbackAgents?.[0]?.id;

  if (!fallbackAgent) {
    return { agentType: null, error: 'No active Content & Growth agent is available.' };
  }

  return { agentType: fallbackAgent as AgentType, error: null };
}

async function createCampaignTask({
  title,
  description,
}: {
  title: string;
  description: string;
}): Promise<CampaignTaskState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirectTo=/dashboard/campaigns');
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    redirect('/onboarding');
  }

  const agentResult = await getCampaignAgent(supabase);

  if (agentResult.error || !agentResult.agentType) {
    return { error: agentResult.error ?? 'Campaign agent could not be selected.' };
  }

  const taskResult = await createTask(
    {
      workspaceId: workspaceResult.data.id,
      userId: user.id,
      agentType: agentResult.agentType,
      title,
      description,
      priority: 'Normal',
    },
    supabase
  );

  if (taskResult.error || !taskResult.data) {
    return { error: taskResult.error ?? 'Campaign task could not be created.' };
  }

  try {
    await createNotification(
      {
        workspaceId: workspaceResult.data.id,
        userId: user.id,
        type: 'campaign_task_created',
        title: 'Campaign task created',
        message: `${taskResult.data.title} was created and is ready to run manually.`,
        metadata: {
          task_id: taskResult.data.id,
          source: 'campaigns_page',
        },
      },
      supabase
    );
  } catch {
    // Notifications must not affect campaign task creation.
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/tasks');
  revalidatePath('/dashboard/reports');
  revalidatePath('/dashboard/campaigns');
  revalidatePath(`/dashboard/tasks/${taskResult.data.id}`);

  redirect(`/dashboard/tasks/${taskResult.data.id}`);
}

export async function createCampaignPlannerTask(
  _state: CampaignTaskState,
  formData: FormData
): Promise<CampaignTaskState> {
  const serviceOrOffer = readField(formData, 'serviceOrOffer');
  const targetAudience = readField(formData, 'targetAudience');
  const campaignGoal = readField(formData, 'campaignGoal');
  const platforms = readField(formData, 'platforms');
  const budget = readField(formData, 'budget');
  const marketOrCountry = readField(formData, 'marketOrCountry');
  const tone = readField(formData, 'tone');
  const duration = readField(formData, 'duration');
  const extraNotes = readField(formData, 'extraNotes');

  if (serviceOrOffer.length < 2) {
    return { error: 'Add the service or offer before creating the campaign planner task.' };
  }

  if (targetAudience.length < 2) {
    return { error: 'Add the target audience before creating the campaign planner task.' };
  }

  if (campaignGoal.length < 2) {
    return { error: 'Add the campaign goal before creating the campaign planner task.' };
  }

  if (platforms.length < 2) {
    return { error: 'Add at least one platform before creating the campaign planner task.' };
  }

  const title = `[Campaign Planner] ${serviceOrOffer} - ${campaignGoal}`;
  const description = `CAMPAIGN PLANNER BRIEF

Service or offer:
${valueOrFallback(serviceOrOffer)}

Target audience:
${valueOrFallback(targetAudience)}

Campaign goal:
${valueOrFallback(campaignGoal)}

Platforms:
${valueOrFallback(platforms)}

Budget:
${valueOrFallback(budget)}

Market or country:
${valueOrFallback(marketOrCountry)}

Tone:
${valueOrFallback(tone)}

Duration:
${valueOrFallback(duration)}

Extra notes:
${valueOrFallback(extraNotes)}

Please create:
- Best platform strategy
- Target audience strategy
- Campaign angle
- Ad copy ideas
- Creative brief
- Budget distribution suggestion
- Posting plan
- Risks
- Recommendations
- Next actions`;

  return createCampaignTask({ title, description });
}

export async function createPerformanceAnalyzerTask(
  _state: CampaignTaskState,
  formData: FormData
): Promise<CampaignTaskState> {
  const platform = readField(formData, 'platform');
  const campaignGoal = readField(formData, 'campaignGoal');
  const budgetSpent = readField(formData, 'budgetSpent');
  const impressions = readField(formData, 'impressions');
  const clicks = readField(formData, 'clicks');
  const ctr = readField(formData, 'ctr');
  const cpc = readField(formData, 'cpc');
  const leads = readField(formData, 'leads');
  const conversions = readField(formData, 'conversions');
  const creativeType = readField(formData, 'creativeType');
  const audience = readField(formData, 'audience');
  const problemObserved = readField(formData, 'problemObserved');
  const extraNotes = readField(formData, 'extraNotes');

  if (platform.length < 2) {
    return { error: 'Add the platform before creating the performance analyzer task.' };
  }

  if (campaignGoal.length < 2) {
    return { error: 'Add the campaign goal before creating the performance analyzer task.' };
  }

  if (problemObserved.length < 2) {
    return { error: 'Add the observed performance issue before creating the analyzer task.' };
  }

  const title = `[Performance Analyzer] ${platform} - ${campaignGoal}`;
  const description = `AD PERFORMANCE ANALYSIS BRIEF

Platform:
${valueOrFallback(platform)}

Campaign goal:
${valueOrFallback(campaignGoal)}

Budget spent:
${valueOrFallback(budgetSpent)}

Impressions:
${valueOrFallback(impressions)}

Clicks:
${valueOrFallback(clicks)}

CTR:
${valueOrFallback(ctr)}

CPC:
${valueOrFallback(cpc)}

Leads:
${valueOrFallback(leads)}

Conversions:
${valueOrFallback(conversions)}

Creative type:
${valueOrFallback(creativeType)}

Audience:
${valueOrFallback(audience)}

Problem observed:
${valueOrFallback(problemObserved)}

Extra notes:
${valueOrFallback(extraNotes)}

Please analyze:
- Why performance may be weak
- Whether the platform is suitable
- Audience issues
- Creative issues
- Offer/message issues
- Budget issues
- What to change next
- Recommendations
- Next actions`;

  return createCampaignTask({ title, description });
}

export async function createManualCampaignTrackerTask(
  _state: CampaignTaskState,
  formData: FormData
): Promise<CampaignTaskState> {
  const campaignName = readField(formData, 'campaignName');
  const platform = readField(formData, 'platform');
  const campaignGoal = readField(formData, 'campaignGoal');
  const budgetSpent = readField(formData, 'budgetSpent');
  const impressions = readField(formData, 'impressions');
  const clicks = readField(formData, 'clicks');
  const ctr = readField(formData, 'ctr');
  const cpc = readField(formData, 'cpc');
  const leads = readField(formData, 'leads');
  const conversions = readField(formData, 'conversions');
  const creativeType = readField(formData, 'creativeType');
  const audience = readField(formData, 'audience');
  const offer = readField(formData, 'offer');
  const landingPage = readField(formData, 'landingPage');
  const problemObserved = readField(formData, 'problemObserved');
  const notes = readField(formData, 'notes');

  if (campaignName.length < 2) {
    return { error: 'Add the campaign name before creating the tracking analysis task.' };
  }

  if (platform.length < 2) {
    return { error: 'Add the platform before creating the tracking analysis task.' };
  }

  if (campaignGoal.length < 2) {
    return { error: 'Add the campaign goal before creating the tracking analysis task.' };
  }

  if (problemObserved.length < 2) {
    return { error: 'Add the observed performance issue before creating the tracking analysis task.' };
  }

  const title = `[Manual Campaign Tracker] ${campaignName} - ${platform}`;
  const description = `MANUAL CAMPAIGN TRACKER BRIEF

Campaign name:
${valueOrFallback(campaignName)}

Platform:
${valueOrFallback(platform)}

Campaign goal:
${valueOrFallback(campaignGoal)}

Budget spent:
${valueOrFallback(budgetSpent)}

Impressions:
${valueOrFallback(impressions)}

Clicks:
${valueOrFallback(clicks)}

CTR:
${valueOrFallback(ctr)}

CPC:
${valueOrFallback(cpc)}

Leads:
${valueOrFallback(leads)}

Conversions:
${valueOrFallback(conversions)}

Creative type:
${valueOrFallback(creativeType)}

Audience:
${valueOrFallback(audience)}

Offer:
${valueOrFallback(offer)}

Landing page:
${valueOrFallback(landingPage)}

Problem observed:
${valueOrFallback(problemObserved)}

Notes:
${valueOrFallback(notes)}

Please analyze:
- Why performance may be weak
- Platform fit
- Audience fit
- Creative and hook issues
- Offer and message issues
- Landing page issues
- Budget efficiency
- What to change next
- Recommendations
- Next actions`;

  return createCampaignTask({ title, description });
}

export async function createMetaCampaignAnalysisTask(
  _state: CampaignTaskState,
  formData: FormData
): Promise<CampaignTaskState> {
  const accountId = readField(formData, 'accountId');
  const campaignId = readField(formData, 'campaignId');

  if (!accountId) {
    return { error: 'Meta ad account is missing.' };
  }

  if (!campaignId) {
    return { error: 'Meta campaign is missing.' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirectTo=/dashboard/campaigns');
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    redirect('/onboarding');
  }

  const metaResult = await getMetaAdAccountsForWorkspace(workspaceResult.data.id, user.id);

  if (metaResult.error) {
    return { error: 'Meta campaign metrics could not be loaded.' };
  }

  if (metaResult.data.state === 'not_connected') {
    return { error: 'Connect Meta Ads before creating a campaign analysis task.' };
  }

  if (metaResult.data.state === 'token_invalid') {
    return { error: 'Meta token expired or invalid. Reconnect Meta Ads first.' };
  }

  if (metaResult.data.state === 'permission_issue') {
    return { error: 'Meta API permission issue. Check ads_read access first.' };
  }

  if (metaResult.data.state !== 'connected') {
    return { error: 'Meta ad accounts could not be loaded.' };
  }

  const { account, campaign } = findMetaCampaignForAnalysis({
    accounts: metaResult.data.accounts,
    accountId,
    campaignId,
  });

  if (!account) {
    return { error: 'Meta ad account could not be found.' };
  }

  if (account.campaignsState === 'token_invalid') {
    return { error: 'Meta token expired or invalid. Reconnect Meta Ads first.' };
  }

  if (account.campaignsState === 'permission_issue') {
    return { error: 'Meta API permission issue. Check ads_read access first.' };
  }

  if (account.campaignsState !== 'connected') {
    return { error: 'Meta campaigns could not be loaded for this ad account.' };
  }

  if (!campaign) {
    return { error: 'Meta campaign could not be found.' };
  }

  if (campaign.insightsState === 'not_requested') {
    return {
      error:
        'Insights were not loaded for this campaign because this page uses safe Meta API limits.',
    };
  }

  if (campaign.insightsState === 'token_invalid') {
    return { error: 'Meta token expired or invalid. Reconnect Meta Ads first.' };
  }

  if (campaign.insightsState === 'permission_issue') {
    return { error: 'Meta API permission issue. Check ads_read access first.' };
  }

  if (campaign.insightsState === 'error') {
    return { error: 'Meta campaign insights could not be loaded.' };
  }

  const title = `[Meta Campaign Analysis] ${campaign.name ?? campaign.id ?? 'Meta campaign'}`;
  const description = buildMetaCampaignAnalysisDescription({ account, campaign });

  return createCampaignTask({ title, description });
}

export async function createGoogleAdsCampaignAnalysisTask(
  _state: CampaignTaskState,
  formData: FormData
): Promise<CampaignTaskState> {
  const customerId = readField(formData, 'customerId');
  const campaignId = readField(formData, 'campaignId');

  if (!customerId) {
    return { error: 'Google Ads customer is missing.' };
  }

  if (!campaignId) {
    return { error: 'Google Ads campaign is missing.' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirectTo=/dashboard/campaigns');
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    redirect('/onboarding');
  }

  const googleAdsResult = await getGoogleAdsCampaignMetricsForWorkspace(
    workspaceResult.data.id,
    user.id
  );

  if (googleAdsResult.error) {
    return { error: 'Google Ads campaign metrics could not be loaded.' };
  }

  if (googleAdsResult.data.state === 'not_connected') {
    return { error: 'Connect Google Ads before creating a campaign analysis task.' };
  }

  if (googleAdsResult.data.state === 'token_invalid') {
    return { error: 'Google Ads token expired or invalid. Reconnect Google Ads first.' };
  }

  if (googleAdsResult.data.state === 'permission_issue') {
    return { error: 'Google Ads permission issue. Check account access first.' };
  }

  if (googleAdsResult.data.state === 'api_issue') {
    return { error: 'Google Ads developer token / API issue. Check API access first.' };
  }

  if (googleAdsResult.data.state !== 'connected') {
    return { error: 'Google Ads campaign metrics could not be loaded.' };
  }

  const { customer, campaign } = findGoogleAdsCampaignForAnalysis({
    customers: googleAdsResult.data.customers,
    customerId,
    campaignId,
  });

  if (!customer) {
    return { error: 'Google Ads customer could not be found.' };
  }

  if (customer.campaignsState === 'token_invalid') {
    return { error: 'Google Ads token expired or invalid. Reconnect Google Ads first.' };
  }

  if (customer.campaignsState === 'permission_issue') {
    return { error: 'Google Ads permission issue. Check account access first.' };
  }

  if (customer.campaignsState === 'api_issue') {
    return { error: 'Google Ads developer token / API issue. Check API access first.' };
  }

  if (customer.campaignsState === 'not_requested') {
    return {
      error:
        'Google Ads metrics were not loaded for this customer because this page uses safe campaign limits.',
    };
  }

  if (customer.campaignsState !== 'connected') {
    return { error: 'Google Ads campaigns could not be loaded for this customer.' };
  }

  if (!campaign) {
    return { error: 'Google Ads campaign could not be found.' };
  }

  const title = `[Google Ads Campaign Analysis] ${campaign.campaignName}`;
  const description = buildGoogleAdsCampaignAnalysisDescription({
    customer,
    campaign,
  });

  return createCampaignTask({ title, description });
}
