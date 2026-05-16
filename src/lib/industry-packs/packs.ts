import { getAgentTemplateById } from '@/lib/agent-library/templates';

export type IndustryPackExecutionMode = 'planning_only';
export type IndustryPackSafetyLevel = 'safe';

export interface IndustryPackWorkflowPreset {
  id: string;
  name: string;
  steps: string[];
}

export interface IndustryPack {
  id: string;
  name: string;
  category: string;
  short_description: string;
  best_for: string[];
  recommended_agents: string[];
  prompt_templates: string[];
  workflow_presets: IndustryPackWorkflowPreset[];
  automation_blueprints: string[];
  ai_studio_prompt_ideas: string[];
  content_studio_templates: string[];
  quality_review_checklist: string[];
  safe_next_actions: string[];
  execution_mode: IndustryPackExecutionMode;
  safety_level: IndustryPackSafetyLevel;
}

function pack(input: Omit<IndustryPack, 'execution_mode' | 'safety_level'>): IndustryPack {
  return {
    ...input,
    execution_mode: 'planning_only',
    safety_level: 'safe',
  };
}

const commonQualityChecklist = [
  'Confirm the offer, audience, platform, and CTA are clear.',
  'Check claims for accuracy and remove exaggerated guarantees.',
  'Review brand tone, language, and local market fit.',
  'Confirm every output remains draft-only until manually approved.',
  'Run Quality Review before publishing, scheduling, sending, or launching anything manually.',
];

const commonSafeNextActions = [
  'Use with Alex to adapt the pack to one specific client, product, or campaign.',
  'Copy prompt ideas into Prompt Library after manual review.',
  'Open Workflow Builder and review missing inputs before creating pending tasks.',
  'Open AI Studio only to prepare visual prompts; generation requires a separate explicit click.',
  'Open Content Studio only for draft planning; do not publish or schedule automatically.',
];

export const industryPacks: IndustryPack[] = [
  pack({
    id: 'ecommerce-pack',
    name: 'E-commerce Pack',
    category: 'Commerce',
    short_description: 'Create campaigns, product visuals, ad copy, and content for online stores.',
    best_for: ['Online stores', 'Product launches', 'Offer campaigns', 'Product visual planning'],
    recommended_agents: [
      'marketing-strategy-agent',
      'market-research-agent',
      'competitor-analysis-agent',
      'instagram-content-agent',
      'ad-copy-agent',
      'creative-brief-agent',
      'workflow-review-agent',
      'lead-score-agent',
      'content-performance-agent',
    ],
    prompt_templates: [
      'Product launch campaign',
      'Product benefit ad copy',
      'Instagram carousel for product',
      'Product image prompt',
      'Customer pain point campaign',
      'Offer announcement post',
    ],
    workflow_presets: [{
      id: 'industry-ecommerce-workflow',
      name: 'E-commerce Launch Workflow',
      steps: [
        'market-research-agent',
        'competitor-analysis-agent',
        'marketing-strategy-agent',
        'instagram-content-agent',
        'ad-copy-agent',
        'creative-brief-agent',
        'workflow-review-agent',
      ],
    }],
    automation_blueprints: ['Product launch approval workflow', 'Offer campaign review handoff', 'Product creative review checklist'],
    ai_studio_prompt_ideas: ['Clean studio product photo with soft shadows', 'Lifestyle product image with target customer context', 'Carousel cover visual for product benefits'],
    content_studio_templates: ['Product launch Instagram post', 'Offer announcement story', 'Product benefit ad draft'],
    quality_review_checklist: commonQualityChecklist,
    safe_next_actions: commonSafeNextActions,
  }),
  pack({
    id: 'ai-agency-pack',
    name: 'AI Agency Pack',
    category: 'Agency Operations',
    short_description: 'Manage AI agency content, service offers, client proposals, workflows, and reports.',
    best_for: ['AI agency services', 'Client proposals', 'Automation offers', 'Provider and workflow reviews'],
    recommended_agents: [
      'daily-planning-agent',
      'client-proposal-agent',
      'meeting-prep-agent',
      'lead-score-agent',
      'follow-up-email-agent',
      'n8n-workflow-planner-agent',
      'workflow-review-agent',
      'provider-health-report-agent',
      'deployment-review-agent',
      'client-onboarding-agent',
    ],
    prompt_templates: [
      'AI agency service proposal',
      'Client onboarding checklist',
      'AI automation offer',
      'Meeting preparation',
      'Workflow blueprint',
      'Provider blocker summary',
    ],
    workflow_presets: [{
      id: 'industry-ai-agency-workflow',
      name: 'AI Agency Client Workflow',
      steps: [
        'lead-score-agent',
        'client-proposal-agent',
        'meeting-prep-agent',
        'client-onboarding-agent',
        'workflow-review-agent',
      ],
    }],
    automation_blueprints: ['Client onboarding workflow', 'n8n task execution blueprint', 'Workflow review blueprint'],
    ai_studio_prompt_ideas: ['AI automation service visual', 'Clean SaaS dashboard mockup for proposal', 'Founder-led agency brand visual'],
    content_studio_templates: ['AI automation offer post', 'Case-study style service post', 'Provider blocker report summary'],
    quality_review_checklist: commonQualityChecklist,
    safe_next_actions: commonSafeNextActions,
  }),
  pack({
    id: 'real-estate-pack',
    name: 'Real Estate Pack',
    category: 'Local Services',
    short_description: 'Create property marketing content, lead follow-ups, listing ads, and visual concepts.',
    best_for: ['Property listings', 'Buyer lead follow-up', 'Luxury home ads', 'Real estate social content'],
    recommended_agents: [
      'market-research-agent',
      'audience-persona-builder',
      'instagram-content-agent',
      'ad-copy-agent',
      'creative-brief-agent',
      'lead-score-agent',
      'follow-up-email-agent',
      'client-proposal-agent',
      'workflow-review-agent',
    ],
    prompt_templates: [
      'Property listing caption',
      'Luxury property ad copy',
      'Real estate Instagram reel',
      'Property visual prompt',
      'Buyer persona',
      'Lead follow-up message',
    ],
    workflow_presets: [{
      id: 'industry-real-estate-workflow',
      name: 'Real Estate Listing Workflow',
      steps: [
        'market-research-agent',
        'marketing-strategy-agent',
        'instagram-content-agent',
        'ad-copy-agent',
        'creative-brief-agent',
        'lead-score-agent',
        'workflow-review-agent',
      ],
    }],
    automation_blueprints: ['Lead scoring blueprint', 'Meeting summary blueprint', 'Content approval workflow'],
    ai_studio_prompt_ideas: ['Bright modern property exterior', 'Luxury apartment interior visual', 'Neighborhood lifestyle image for listing campaign'],
    content_studio_templates: ['Listing caption draft', 'Open house announcement', 'Buyer follow-up content draft'],
    quality_review_checklist: commonQualityChecklist,
    safe_next_actions: commonSafeNextActions,
  }),
  pack({
    id: 'restaurant-marketing-pack',
    name: 'Restaurant Marketing Pack',
    category: 'Local Services',
    short_description: 'Create social media campaigns, menu promotions, local ads, and creative visuals for restaurants/cafes.',
    best_for: ['Restaurants', 'Cafes', 'Menu launches', 'Local offers', 'Food visuals'],
    recommended_agents: [
      'market-research-agent',
      'marketing-strategy-agent',
      'instagram-content-agent',
      'ad-copy-agent',
      'creative-brief-agent',
      'content-performance-agent',
      'workflow-review-agent',
    ],
    prompt_templates: [
      'New menu launch',
      'Instagram food reel',
      'Local restaurant ad',
      'Food photography prompt',
      'Weekend offer campaign',
      'Story poll idea',
    ],
    workflow_presets: [{
      id: 'industry-restaurant-workflow',
      name: 'Restaurant Campaign Workflow',
      steps: [
        'market-research-agent',
        'marketing-strategy-agent',
        'instagram-content-agent',
        'ad-copy-agent',
        'creative-brief-agent',
        'workflow-review-agent',
      ],
    }],
    automation_blueprints: ['Content approval workflow', 'Lead scoring blueprint', 'Workflow review blueprint'],
    ai_studio_prompt_ideas: ['Warm food photography hero shot', 'Cafe lifestyle social image', 'Menu item promotional visual'],
    content_studio_templates: ['Weekend offer post', 'New menu reel script', 'Local ad copy draft'],
    quality_review_checklist: commonQualityChecklist,
    safe_next_actions: commonSafeNextActions,
  }),
  pack({
    id: 'education-pack',
    name: 'Education Pack',
    category: 'Education',
    short_description: 'Create educational content, course promotion, student-focused ads, and learning material campaigns.',
    best_for: ['Courses', 'Schools', 'Tutors', 'Learning platforms', 'Student campaigns'],
    recommended_agents: [
      'market-research-agent',
      'marketing-strategy-agent',
      'instagram-content-agent',
      'ad-copy-agent',
      'creative-brief-agent',
      'social-media-content-calendar',
      'workflow-review-agent',
    ],
    prompt_templates: [
      'Course launch campaign',
      'Educational carousel',
      'Student motivation post',
      'Online course ad copy',
      'Explainer video prompt',
      'Learning outcome message',
    ],
    workflow_presets: [{
      id: 'industry-education-workflow',
      name: 'Education Campaign Workflow',
      steps: [
        'market-research-agent',
        'marketing-strategy-agent',
        'social-media-content-calendar',
        'instagram-content-agent',
        'ad-copy-agent',
        'workflow-review-agent',
      ],
    }],
    automation_blueprints: ['Prompt-to-task blueprint', 'Content approval workflow', 'Meeting summary blueprint'],
    ai_studio_prompt_ideas: ['Friendly online course visual', 'Student success illustration-style image', 'Explainer video storyboard prompt'],
    content_studio_templates: ['Course launch post', 'Educational carousel outline', 'Student motivation caption'],
    quality_review_checklist: commonQualityChecklist,
    safe_next_actions: commonSafeNextActions,
  }),
  pack({
    id: 'personal-brand-pack',
    name: 'Personal Brand Pack',
    category: 'Creator Growth',
    short_description: 'Create content systems, posts, reels, personal positioning, and audience-building campaigns.',
    best_for: ['Creators', 'Founders', 'Consultants', 'Influencers', 'LinkedIn and Instagram content'],
    recommended_agents: [
      'market-research-agent',
      'competitor-analysis-agent',
      'marketing-strategy-agent',
      'instagram-content-agent',
      'ad-copy-agent',
      'creative-brief-agent',
      'content-performance-agent',
      'workflow-review-agent',
    ],
    prompt_templates: [
      'Personal brand positioning',
      'LinkedIn post',
      'Instagram reel script',
      'Founder story post',
      'Authority-building content',
      'Visual identity prompt',
    ],
    workflow_presets: [{
      id: 'industry-personal-brand-workflow',
      name: 'Personal Brand Content Workflow',
      steps: [
        'market-research-agent',
        'competitor-analysis-agent',
        'marketing-strategy-agent',
        'instagram-content-agent',
        'creative-brief-agent',
        'workflow-review-agent',
      ],
    }],
    automation_blueprints: ['Workflow review blueprint', 'Prompt-to-task blueprint', 'Creative brief to image blueprint'],
    ai_studio_prompt_ideas: ['Personal brand portrait concept', 'Founder story visual', 'LinkedIn thought-leadership image prompt'],
    content_studio_templates: ['Founder story post', 'Authority-building LinkedIn post', 'Instagram reel script draft'],
    quality_review_checklist: commonQualityChecklist,
    safe_next_actions: commonSafeNextActions,
  }),
];

export function getIndustryPackById(id: string | null | undefined) {
  if (!id) return null;
  return industryPacks.find((packItem) => packItem.id === id) ?? null;
}

export function getIndustryPackCategories() {
  return Array.from(new Set(industryPacks.map((packItem) => packItem.category))).sort();
}

export function getAvailableAgentIdsForPack(packItem: IndustryPack) {
  return packItem.recommended_agents.filter((agentId) => Boolean(getAgentTemplateById(agentId)));
}

export function buildIndustryPackMermaid(packItem: IndustryPack) {
  const steps = packItem.workflow_presets[0]?.steps ?? [];
  const labels = steps.map((step) => getAgentTemplateById(step)?.name ?? step);
  const nodes = labels.map((label, index) => `  S${index + 1}["${label.replace(/"/g, "'")}"]`);
  const edges = labels.slice(0, -1).map((_, index) => `  S${index + 1} --> S${index + 2}`);
  return ['flowchart LR', ...nodes, ...edges].join('\n');
}

function listMarkdown(title: string, values: string[]) {
  return [`## ${title}`, ...values.map((value) => `- ${value}`)].join('\n');
}

export function formatIndustryPackMarkdown(packItem: IndustryPack) {
  const agentNames = getAvailableAgentIdsForPack(packItem).map((agentId) => getAgentTemplateById(agentId)?.name ?? agentId);
  const workflow = packItem.workflow_presets[0]?.steps.map((step) => getAgentTemplateById(step)?.name ?? step) ?? [];

  return [
    `# ${packItem.name}`,
    '',
    packItem.short_description,
    '',
    listMarkdown('Best For', packItem.best_for),
    '',
    listMarkdown('Recommended Agents', agentNames),
    '',
    listMarkdown('Prompt Ideas', packItem.prompt_templates),
    '',
    listMarkdown('Workflow', workflow),
    '',
    listMarkdown('Automation Blueprints', packItem.automation_blueprints),
    '',
    listMarkdown('AI Studio Ideas', packItem.ai_studio_prompt_ideas),
    '',
    listMarkdown('Content Studio Ideas', packItem.content_studio_templates),
    '',
    listMarkdown('Quality Checklist', packItem.quality_review_checklist),
    '',
    listMarkdown('Safe Next Actions', packItem.safe_next_actions),
    '',
    '```mermaid',
    buildIndustryPackMermaid(packItem),
    '```',
  ].join('\n').trim() + '\n';
}

const packIntentRules: Array<{ pattern: RegExp; packId: string; reason: string }> = [
  { pattern: /ecommerce|e-commerce|store|product|shop|متجر|منتج/i, packId: 'ecommerce-pack', reason: 'Fits product campaigns, store offers, product visuals, and ad copy.' },
  { pattern: /ai agency|وكالة|client|automation|services|خدمات|عميل/i, packId: 'ai-agency-pack', reason: 'Fits AI agency offers, client proposals, automation workflows, and operational reports.' },
  { pattern: /real estate|property|عقار|منزل|شقة|listing/i, packId: 'real-estate-pack', reason: 'Fits property listings, real estate ads, buyer personas, and lead follow-ups.' },
  { pattern: /restaurant|cafe|مطعم|مقهى|menu|food/i, packId: 'restaurant-marketing-pack', reason: 'Fits local restaurant campaigns, menu promotions, food visuals, and offer posts.' },
  { pattern: /education|course|students|مدرسة|كورس|learning|student/i, packId: 'education-pack', reason: 'Fits course launches, educational content, student motivation, and learning campaigns.' },
  { pattern: /personal brand|creator|influencer|linkedin|personal content|founder/i, packId: 'personal-brand-pack', reason: 'Fits creator positioning, founder stories, LinkedIn posts, and audience-building content.' },
];

export function recommendIndustryPacks(message: string, maxResults = 3) {
  return packIntentRules
    .filter((rule) => rule.pattern.test(message))
    .map((rule) => {
      const packItem = getIndustryPackById(rule.packId);
      return packItem ? { pack: packItem, reason: rule.reason } : null;
    })
    .filter((item): item is { pack: IndustryPack; reason: string } => Boolean(item))
    .slice(0, maxResults);
}

export function formatIndustryPackRecommendationsForAlex(message: string) {
  const recommendations = recommendIndustryPacks(message);
  if (recommendations.length === 0) return null;

  return recommendations.map(({ pack: packItem, reason }) => {
    const workflow = packItem.workflow_presets[0]?.steps.map((step) => getAgentTemplateById(step)?.name ?? step).join(' -> ') ?? 'No workflow';
    const agents = getAvailableAgentIdsForPack(packItem).map((agentId) => getAgentTemplateById(agentId)?.name ?? agentId).slice(0, 8);
    return [
      `Pack: ${packItem.name}`,
      `Why it fits: ${reason}`,
      `Recommended workflow: ${workflow}`,
      `Suggested agents: ${agents.join(', ')}`,
      `Safe next action: ${packItem.safe_next_actions[0]}`,
    ].join('\n');
  }).join('\n\n');
}
