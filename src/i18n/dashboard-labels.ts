import type { AgentTemplate, ExecutionMode, SafetyLevel, TemplateCategory } from '@/lib/agent-library/templates';
import type { ContentStudioPlatform, ContentStudioStatus, ContentStudioType, TaskPriority } from '@/types/database';
import type { TaskStatus } from '@/types';

type Translator = (key: string, fallback?: string) => string;

const templateCategoryKeys: Record<TemplateCategory | 'All', string> = {
  All: 'mappings.agentLibrary.category.all',
  'Research & Strategy': 'mappings.agentLibrary.category.researchStrategy',
  'Content & Growth': 'mappings.agentLibrary.category.contentGrowth',
  'Sales & Operations': 'mappings.agentLibrary.category.salesOperations',
  'Reports & Analytics': 'mappings.agentLibrary.category.reportsAnalytics',
  'Alex Assistant Skills': 'mappings.agentLibrary.category.alexAssistantSkills',
  'Developer/Code Agents': 'mappings.agentLibrary.category.developerCodeAgents',
  'n8n Workflow Ideas': 'mappings.agentLibrary.category.n8nWorkflowIdeas',
};

const safetyKeys: Record<SafetyLevel, string> = {
  safe: 'mappings.agentLibrary.safety.safe',
  requires_review: 'mappings.agentLibrary.safety.requiresReview',
  readonly: 'mappings.agentLibrary.safety.readonly',
};

const executionModeKeys: Record<ExecutionMode, string> = {
  autonomous: 'mappings.agentLibrary.executionMode.autonomous',
  supervised: 'mappings.agentLibrary.executionMode.supervised',
  manual: 'mappings.agentLibrary.executionMode.manual',
  draft_only: 'mappings.agentLibrary.executionMode.draftOnly',
};

const priorityKeys: Record<TaskPriority, string> = {
  Low: 'mappings.priority.low',
  Normal: 'mappings.priority.normal',
  High: 'mappings.priority.high',
};

const taskStatusKeys: Partial<Record<TaskStatus | string, string>> = {
  draft: 'status.draft',
  pending: 'status.pending',
  processing: 'status.processing',
  needs_review: 'status.needsReview',
  completed: 'status.completed',
  failed: 'status.failed',
  cancelled: 'status.cancelled',
};

const contentStudioStatusKeys: Record<ContentStudioStatus, string> = {
  draft: 'status.draft',
  ready: 'status.ready',
  scheduled: 'status.scheduled',
  published: 'status.published',
  failed: 'status.failed',
  approval_pending: 'status.approvalPending',
  setup_required: 'status.setupRequired',
};

const platformKeys: Record<ContentStudioPlatform | 'general', string> = {
  facebook: 'mappings.platform.facebook',
  instagram: 'mappings.platform.instagram',
  google_ads: 'mappings.platform.googleAds',
  pinterest: 'mappings.platform.pinterest',
  linkedin: 'mappings.platform.linkedin',
  general: 'mappings.platform.general',
};

const contentTypeKeys: Record<ContentStudioType, string> = {
  facebook_post: 'mappings.contentType.facebookPost',
  instagram_post: 'mappings.contentType.instagramPost',
  facebook_reel: 'mappings.contentType.facebookReel',
  instagram_reel: 'mappings.contentType.instagramReel',
  google_ads_campaign_draft: 'mappings.contentType.googleAdsCampaignDraft',
  facebook_feed_ad: 'mappings.contentType.facebookFeedAd',
  instagram_feed_ad: 'mappings.contentType.instagramFeedAd',
  facebook_reel_ad: 'mappings.contentType.facebookReelAd',
  instagram_reel_ad: 'mappings.contentType.instagramReelAd',
  facebook_story_ad: 'mappings.contentType.facebookStoryAd',
  instagram_story_ad: 'mappings.contentType.instagramStoryAd',
  facebook_carousel_ad: 'mappings.contentType.facebookCarouselAd',
  instagram_carousel_ad: 'mappings.contentType.instagramCarouselAd',
  pinterest_pin: 'mappings.contentType.pinterestPin',
  linkedin_post_planner: 'mappings.contentType.linkedinPostPlanner',
};

export function translateTemplateCategory(t: Translator, category: TemplateCategory | 'All') {
  return t(templateCategoryKeys[category], category);
}

export function translateSafetyLevel(t: Translator, safetyLevel: SafetyLevel) {
  return t(safetyKeys[safetyLevel], safetyLevel.replace('_', ' '));
}

export function translateExecutionMode(t: Translator, executionMode: ExecutionMode) {
  return t(executionModeKeys[executionMode], executionMode.replace('_', ' '));
}

export function translatePriority(t: Translator, priority: TaskPriority) {
  return t(priorityKeys[priority], priority);
}

export function translateTaskStatus(t: Translator, status: TaskStatus | string) {
  const key = taskStatusKeys[status];
  return key ? t(key, status.replaceAll('_', ' ')) : status.replaceAll('_', ' ');
}

export function translateContentStudioStatus(t: Translator, status: ContentStudioStatus) {
  return t(contentStudioStatusKeys[status], status.replaceAll('_', ' '));
}

export function translateContentStudioPlatform(t: Translator, platform: ContentStudioPlatform | 'general') {
  return t(platformKeys[platform], platform.replaceAll('_', ' '));
}

export function translateContentStudioType(t: Translator, contentType: ContentStudioType) {
  return t(contentTypeKeys[contentType], contentType.replaceAll('_', ' '));
}

export function templateI18nKey(template: Pick<AgentTemplate, 'id'>, field: string) {
  return `agentLibrary.templates.${template.id}.${field}`;
}

export function translateTemplateField(t: Translator, template: Pick<AgentTemplate, 'id'>, field: string, fallback: string) {
  return t(templateI18nKey(template, field), fallback);
}

export function translateTemplateList(
  t: Translator,
  template: Pick<AgentTemplate, 'id'>,
  field: string,
  values: string[]
) {
  return values.map((value, index) => t(`${templateI18nKey(template, field)}.${index}`, value));
}
