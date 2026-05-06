'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { createTask } from '@/lib/data/tasks';
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
