import {
  getAgentTemplateById,
  templates,
  type AgentTemplate,
  type TemplateCategory,
} from './templates';
import { getWorkflowPresetById, type AgentWorkflowPresetDefinition } from './workflow-presets';

type Confidence = 'low' | 'medium' | 'high';

interface UsageTemplateItem {
  template_id: string;
  template_name: string;
  template_category: string;
  count: number;
  last_used_at: string | null;
}

interface UsageSummaryLike {
  total_events: number;
  most_used_templates: UsageTemplateItem[];
  recently_used_templates: UsageTemplateItem[];
  top_categories: Array<{ category: string; count: number }>;
  action_counts?: Record<string, number>;
  per_template_summary: UsageTemplateItem[];
}

export interface AgentTemplateRecommendation {
  template: AgentTemplate;
  reason: string;
  confidence: Confidence;
  score: number;
}

export interface AgentTemplateRecommendationResult {
  recommendedTemplates: AgentTemplateRecommendation[];
  recommendedWorkflow: string[];
  recommendedWorkflowPreset: AgentWorkflowPresetDefinition | null;
  nextBestTemplate: AgentTemplateRecommendation | null;
  safeNextActions: string[];
  detectedIntents: string[];
  shouldRecommend: boolean;
}

interface RecommendationInput {
  userMessage?: string;
  selectedTemplateId?: string | null;
  usageSummary?: UsageSummaryLike | null;
  maxResults?: number;
}

const intentRules: Array<{
  intent: string;
  pattern: RegExp;
  categories?: TemplateCategory[];
  ids?: string[];
}> = [
  { intent: 'campaign', pattern: /campaign|campagne|حملة|تسويق|marketing/i, categories: ['Content & Growth', 'Research & Strategy'], ids: ['social-media-content-calendar', 'seo-content-cluster-planner'] },
  { intent: 'content', pattern: /content|contenu|محتوى|ريلز|reels|instagram|إنستغرام|caption|hook/i, categories: ['Content & Growth'], ids: ['social-media-content-calendar', 'viral-content-hook-generator', 'newsletter-campaign-builder'] },
  { intent: 'ads', pattern: /ads?|ad copy|publicit|إعلان|إعلانات|اعلان|اعلانات|google ads|facebook ads/i, categories: ['Content & Growth', 'Sales & Operations'], ids: ['viral-content-hook-generator', 'sales-outreach-sequence'] },
  { intent: 'research', pattern: /research|بحث|منافسين|competitor|concurrent|marché|market|audience|جمهور/i, categories: ['Research & Strategy'], ids: ['competitive-landscape-analysis', 'audience-persona-builder', 'market-trend-intelligence'] },
  { intent: 'strategy', pattern: /strategy|stratégie|استراتيجية|خطة|planning|planification|swot/i, categories: ['Research & Strategy', 'Alex Assistant Skills'], ids: ['swot-analysis-generator', 'cross-project-dependency-mapper'] },
  { intent: 'reports', pattern: /reports?|rapport|تقرير|تقارير|لخص|summary|summarize|briefing|ملخص/i, categories: ['Reports & Analytics', 'Alex Assistant Skills', 'Research & Strategy'], ids: ['task-performance-agent', 'campaign-report-agent', 'content-performance-agent', 'provider-health-report-agent', 'workflow-usage-report-agent', 'daily-briefing-generator'] },
  { intent: 'tasks', pattern: /tasks?|مهام|مهمة|priorit|delegate|assignee|تعيين/i, categories: ['Alex Assistant Skills'], ids: ['context-aware-task-delegation', 'daily-briefing-generator'] },
  { intent: 'workflow', pattern: /workflow|workflow review|review workflow|readiness score|approval check|missing inputs?|blockers?|safe workflow|workflow blueprint|workflow plan|راجع ليا هاد workflow|واش هاد workflow آمن|شوف واش خاص شي inputs|سير العمل|flux|automation|automation plan|automatisation/i, categories: ['Alex Assistant Skills', 'n8n Workflow Ideas'], ids: ['workflow-review-agent', 'n8n-workflow-planner-agent', 'lead-capture-enrichment-workflow', 'content-publishing-pipeline-workflow'] },
  { intent: 'n8n', pattern: /n8n|webhook|callback|payload|node|بغيت workflow ديال n8n|بغيت نخطط automation|أتمتة/i, categories: ['n8n Workflow Ideas'], ids: ['n8n-workflow-planner-agent', 'lead-capture-enrichment-workflow', 'monitoring-alerting-workflow'] },
  { intent: 'code', pattern: /code review|review code|code|api|database|migration|github|pull request|pr|review|typescript|lint|security|performance|patch|كود|برمجة|راجع ليا الكود/i, categories: ['Developer/Code Agents'], ids: ['bug-diagnosis-agent', 'patch-planner-agent', 'code-review-agent', 'deployment-review-agent', 'supabase-migration-review-agent'] },
  { intent: 'debugging', pattern: /debug|bug|error|fix|issue|deployment failed|build failed|typescript error|runtime error|lint error|مشكل|غلط|عندي bug|شنو المشكل فهاد error|خطأ|مشكلة|débog|corriger/i, categories: ['Developer/Code Agents', 'n8n Workflow Ideas'], ids: ['bug-diagnosis-agent', 'patch-planner-agent', 'code-review-agent', 'monitoring-alerting-workflow'] },
  { intent: 'patch plan', pattern: /patch|fix plan|خطة إصلاح|implementation plan|safe patch|code fix proposal|plan de correction/i, categories: ['Developer/Code Agents'], ids: ['patch-planner-agent', 'bug-diagnosis-agent', 'code-review-agent'] },
  { intent: 'release notes', pattern: /release notes|شنو تبدل|ملخص التغييرات|changelog|release summary|notes de version/i, categories: ['Developer/Code Agents'], ids: ['release-notes-agent', 'deployment-review-agent'] },
  { intent: 'deployment review', pattern: /deploy|deployment|إعادة النشر|vercel|production|pre[- ]?deploy|déploiement/i, categories: ['Developer/Code Agents'], ids: ['deployment-review-agent', 'release-notes-agent', 'bug-diagnosis-agent'] },
  { intent: 'migration review', pattern: /migration|supabase migration|rls|sql|postgres|database migration|قاعدة البيانات/i, categories: ['Developer/Code Agents'], ids: ['supabase-migration-review-agent', 'deployment-review-agent', 'database-migration-planner'] },
  { intent: 'lead scoring', pattern: /lead|عميل محتمل|prospect/i, categories: ['Sales & Operations'], ids: ['lead-score-agent'] },
  { intent: 'follow up', pattern: /follow up|follow-up|متابعة|رسالة للعميل|email|whatsapp|dm/i, categories: ['Sales & Operations'], ids: ['follow-up-email-agent'] },
  { intent: 'proposal', pattern: /proposal|عرض خدمة|عرض للعميل|proposition|devis/i, categories: ['Sales & Operations'], ids: ['client-proposal-agent'] },
  { intent: 'onboarding', pattern: /onboarding|عميل جديد|زبون جديد|بداية مشروع|new client|kickoff/i, categories: ['Sales & Operations'], ids: ['client-onboarding-agent'] },
  { intent: 'meeting prep', pattern: /meeting|اجتماع|call|agenda|réunion/i, categories: ['Sales & Operations'], ids: ['meeting-prep-agent'] },
  { intent: 'client work', pattern: /client|customer|عميل|زبون|agency|proposal|prospect/i, categories: ['Sales & Operations', 'Research & Strategy'], ids: ['lead-score-agent', 'follow-up-email-agent', 'client-proposal-agent', 'client-onboarding-agent', 'meeting-prep-agent'] },
  { intent: 'campaign report', pattern: /campaign report|تقرير حملة|حالة الحملة|campaign status|rapport campagne/i, categories: ['Reports & Analytics'], ids: ['campaign-report-agent'] },
  { intent: 'tasks report', pattern: /tasks? report|task performance|تقرير المهام|شنو باقي فالمهام|remaining tasks|rapport tâches/i, categories: ['Reports & Analytics'], ids: ['task-performance-agent'] },
  { intent: 'content report', pattern: /content report|content performance|تقرير المحتوى|راجع المحتوى|rapport contenu/i, categories: ['Reports & Analytics'], ids: ['content-performance-agent'] },
  { intent: 'provider health report', pattern: /provider health|system health|blockers|google ads status|openai status|صحة النظام|حالة Google Ads|حالة OpenAI|bloqueurs|santé système/i, categories: ['Reports & Analytics'], ids: ['provider-health-report-agent'] },
  { intent: 'workflow usage report', pattern: /workflow usage|playbooks?|template analytics|شنو أكثر workflow كنستعمل|workflow analytics|usage workflow/i, categories: ['Reports & Analytics'], ids: ['workflow-usage-report-agent'] },
  { intent: 'daily plan', pattern: /today|daily|اليوم|شنو خاصني|صباح|morning|quotidien/i, categories: ['Alex Assistant Skills'], ids: ['daily-briefing-generator', 'context-aware-task-delegation'] },
  { intent: 'system health', pattern: /system health|health|security|backup|monitor|صحة النظام|sécurité|système/i, categories: ['Alex Assistant Skills', 'n8n Workflow Ideas'], ids: ['daily-briefing-generator', 'monitoring-alerting-workflow'] },
  { intent: 'provider blockers', pattern: /provider|blocker|setup|meta|pinterest|linkedin|مزود|إعداد|bloqueur/i, categories: ['Alex Assistant Skills', 'Sales & Operations'], ids: ['daily-briefing-generator', 'operational-sop-writer'] },
];

const relatedTemplateMap: Record<string, string[]> = {
  'seo-content-cluster-planner': ['social-media-content-calendar', 'viral-content-hook-generator', 'newsletter-campaign-builder'],
  'social-media-content-calendar': ['viral-content-hook-generator', 'newsletter-campaign-builder', 'seo-content-cluster-planner'],
  'viral-content-hook-generator': ['social-media-content-calendar', 'newsletter-campaign-builder', 'audience-persona-builder'],
  'competitive-landscape-analysis': ['audience-persona-builder', 'swot-analysis-generator', 'market-trend-intelligence'],
  'market-trend-intelligence': ['competitive-landscape-analysis', 'audience-persona-builder', 'swot-analysis-generator'],
  'audience-persona-builder': ['competitive-landscape-analysis', 'social-media-content-calendar', 'sales-outreach-sequence'],
  'lead-capture-enrichment-workflow': ['monitoring-alerting-workflow', 'crm-enrichment-scoring', 'sales-outreach-sequence'],
  'n8n-workflow-planner-agent': ['lead-capture-enrichment-workflow', 'monitoring-alerting-workflow', 'content-publishing-pipeline-workflow'],
  'content-publishing-pipeline-workflow': ['social-media-content-calendar', 'monitoring-alerting-workflow', 'viral-content-hook-generator'],
  'monitoring-alerting-workflow': ['daily-briefing-generator', 'lead-capture-enrichment-workflow', 'context-aware-task-delegation'],
  'workflow-review-agent': ['daily-planning-agent', 'n8n-workflow-planner-agent', 'code-review-agent'],
  'lead-score-agent': ['follow-up-email-agent', 'client-proposal-agent', 'workflow-review-agent'],
  'follow-up-email-agent': ['lead-score-agent', 'meeting-prep-agent', 'workflow-review-agent'],
  'client-proposal-agent': ['lead-score-agent', 'meeting-prep-agent', 'workflow-review-agent'],
  'client-onboarding-agent': ['meeting-prep-agent', 'follow-up-email-agent', 'workflow-review-agent'],
  'meeting-prep-agent': ['follow-up-email-agent', 'client-proposal-agent', 'workflow-review-agent'],
  'campaign-report-agent': ['task-performance-agent', 'content-performance-agent', 'provider-health-report-agent', 'workflow-review-agent'],
  'task-performance-agent': ['campaign-report-agent', 'provider-health-report-agent', 'workflow-usage-report-agent', 'workflow-review-agent'],
  'content-performance-agent': ['campaign-report-agent', 'workflow-usage-report-agent', 'workflow-review-agent'],
  'provider-health-report-agent': ['task-performance-agent', 'campaign-report-agent', 'workflow-usage-report-agent', 'workflow-review-agent'],
  'workflow-usage-report-agent': ['task-performance-agent', 'provider-health-report-agent', 'content-performance-agent', 'workflow-review-agent'],
  'bug-diagnosis-agent': ['patch-planner-agent', 'code-review-agent', 'deployment-review-agent', 'workflow-review-agent'],
  'patch-planner-agent': ['bug-diagnosis-agent', 'code-review-agent', 'deployment-review-agent', 'workflow-review-agent'],
  'release-notes-agent': ['deployment-review-agent', 'code-review-agent', 'workflow-review-agent'],
  'deployment-review-agent': ['code-review-agent', 'supabase-migration-review-agent', 'release-notes-agent', 'workflow-review-agent'],
  'supabase-migration-review-agent': ['deployment-review-agent', 'database-migration-planner', 'code-review-agent', 'workflow-review-agent'],
  'code-review-agent': ['bug-diagnosis-agent', 'patch-planner-agent', 'deployment-review-agent', 'pr-review-checklist-generator', 'database-migration-planner', 'api-integration-scaffolder'],
  'pr-review-checklist-generator': ['database-migration-planner', 'api-integration-scaffolder', 'operational-sop-writer'],
  'database-migration-planner': ['pr-review-checklist-generator', 'api-integration-scaffolder', 'operational-sop-writer'],
  'daily-briefing-generator': ['context-aware-task-delegation', 'cross-project-dependency-mapper', 'monitoring-alerting-workflow'],
  'context-aware-task-delegation': ['daily-briefing-generator', 'cross-project-dependency-mapper', 'operational-sop-writer'],
};

const workflowPresetIntentRules: Array<{ pattern: RegExp; presetId: string }> = [
  { pattern: /lead.*follow|follow.*lead|follow up|follow-up|متابعة|رسالة للعميل|email/i, presetId: 'lead-follow-up-workflow' },
  { pattern: /proposal|عرض خدمة|عرض للعميل|client proposal|proposition/i, presetId: 'client-proposal-workflow' },
  { pattern: /onboarding|عميل جديد|زبون جديد|بداية مشروع|new client|kickoff/i, presetId: 'client-onboarding-workflow' },
  { pattern: /meeting|اجتماع|call|agenda|réunion/i, presetId: 'meeting-preparation-workflow' },
  { pattern: /weekly agency report|agency report|weekly report|rapport hebdo|تقرير أسبوعي|تقرير الوكالة|summary/i, presetId: 'weekly-agency-report-workflow' },
  { pattern: /provider health|system health|google ads status|openai status|blockers|صحة النظام|حالة Google Ads|حالة OpenAI/i, presetId: 'provider-health-review-workflow' },
  { pattern: /content report|content review report|content performance|تقرير المحتوى|راجع المحتوى/i, presetId: 'content-review-report-workflow' },
  { pattern: /workflow analytics|workflow usage|playbooks?|template analytics|شنو أكثر workflow كنستعمل/i, presetId: 'workflow-analytics-report-workflow' },
  { pattern: /bug fix|fix bug|bug|error|مشكل|غلط|typescript error|runtime error|build failed|خطة إصلاح/i, presetId: 'bug-fix-workflow' },
  { pattern: /safe deployment|deploy|deployment|vercel|production|إعادة النشر/i, presetId: 'safe-deployment-workflow' },
  { pattern: /migration review|supabase migration|rls|sql|database migration/i, presetId: 'migration-review-workflow' },
  { pattern: /release preparation|release notes|changelog|شنو تبدل|ملخص التغييرات/i, presetId: 'release-preparation-workflow' },
  { pattern: /instagram|content|caption|reels?|posts?|محتوى|انستغرام|إنستغرام|ريلز/i, presetId: 'instagram-content-workflow' },
  { pattern: /campaign|launch|حملة|marketing/i, presetId: 'campaign-launch-workflow' },
  { pattern: /research|strategy|market|competitor|منافس|بحث|استراتيجية|سوق/i, presetId: 'research-strategy-workflow' },
  { pattern: /daily|today|plan my day|priorities|blockers|شنو خاصني|إجراءات اليوم|خطط ليا نهاري/i, presetId: 'daily-operator-workflow' },
  { pattern: /n8n|workflow|automation|webhook|callback|payload|بغيت workflow ديال n8n|بغيت نخطط automation/i, presetId: 'n8n-planning-workflow' },
  { pattern: /code|bug|review code|code review|typescript|lint|build failed|deployment failed|راجع ليا الكود|عندي bug/i, presetId: 'code-review-workflow' },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function detectIntents(userMessage = '') {
  const message = normalize(userMessage);
  if (!message) return [];
  return intentRules.filter((rule) => rule.pattern.test(message)).map((rule) => rule.intent);
}

function scoreTemplate(
  template: AgentTemplate,
  input: RecommendationInput,
  detectedIntents: string[]
): { score: number; reasons: string[] } {
  const message = normalize(input.userMessage ?? '');
  const selectedTemplate = getAgentTemplateById(input.selectedTemplateId ?? undefined);
  const reasons: string[] = [];
  let score = 0;

  for (const rule of intentRules) {
    if (!message || !rule.pattern.test(message)) continue;
    if (rule.categories?.includes(template.category)) {
      score += 18;
      reasons.push(`matches ${rule.intent} intent`);
    }
    if (rule.ids?.includes(template.id)) {
      score += 24;
      reasons.push(`strong fit for ${rule.intent}`);
    }
  }

  if (message) {
    const haystack = normalize([
      template.name,
      template.category,
      template.description,
      template.recommended_for.join(' '),
      template.inputs.join(' '),
      template.outputs.join(' '),
    ].join(' '));

    for (const token of message.split(' ').filter((token) => token.length > 3).slice(0, 16)) {
      if (haystack.includes(token)) score += 2;
    }
  }

  if (selectedTemplate) {
    if (template.id === selectedTemplate.id) {
      score += 8;
      reasons.push('selected as active context');
    }
    if (template.category === selectedTemplate.category && template.id !== selectedTemplate.id) {
      score += 10;
      reasons.push(`continues ${selectedTemplate.category}`);
    }
    if (relatedTemplateMap[selectedTemplate.id]?.includes(template.id)) {
      score += 26;
      reasons.push(`natural next step after ${selectedTemplate.name}`);
    }
  }

  const usage = input.usageSummary;
  const used = usage?.per_template_summary?.find((item) => item.template_id === template.id);
  if (used) {
    score += Math.min(14, used.count * 3);
    reasons.push('used often in your Agent Library');
  }
  if (usage?.recently_used_templates?.some((item) => item.template_id === template.id)) {
    score += 6;
    reasons.push('recently used');
  }
  if (usage?.top_categories?.[0]?.category === template.category) {
    score += 5;
    reasons.push('matches your most-used category');
  }

  if (!message && !selectedTemplate && !usage?.total_events) {
    if (['competitive-landscape-analysis', 'seo-content-cluster-planner', 'daily-briefing-generator'].includes(template.id)) {
      score += 12;
      reasons.push('high-value starter template');
    }
  }

  if (detectedIntents.length === 0 && !selectedTemplate && !usage?.total_events) {
    score = Math.min(score, 12);
  }

  return { score, reasons };
}

function confidenceFor(score: number): Confidence {
  if (score >= 36) return 'high';
  if (score >= 18) return 'medium';
  return 'low';
}

function defaultWorkflow(recommendations: AgentTemplateRecommendation[]) {
  const first = recommendations[0]?.template;
  if (!first) {
    return [
      'Clarify the goal and the audience.',
      'Choose a safe AgentFlow template.',
      'Create a draft task or prompt for manual review.',
    ];
  }

  if (first.category === 'n8n Workflow Ideas') {
    return [
      'Define the workflow trigger and required inputs.',
      'Export the n8n workflow plan as a reference blueprint.',
      'Manually build and test in n8n with sample non-secret data.',
    ];
  }

  if (first.category === 'Content & Growth') {
    return [
      'Gather brand, audience, offer, and platform context.',
      'Send the template to Content Studio as an editable draft.',
      'Review generated drafts manually before any publishing step.',
    ];
  }

  if (first.category === 'Developer/Code Agents') {
    return [
      'Collect repo context, error details, or PR diff.',
      'Use the template to prepare a safe checklist or patch plan.',
      'Review manually before applying code changes.',
    ];
  }

  return [
    'Gather the required inputs for the recommended template.',
    'Use Alex to prepare a safe draft plan or create a pending task.',
    'Review outputs before any execution or external handoff.',
  ];
}

function recommendWorkflowPreset(userMessage = '', recommendations: AgentTemplateRecommendation[]) {
  const message = normalize(userMessage);
  const directMatch = workflowPresetIntentRules.find((rule) => rule.pattern.test(message));
  if (directMatch) return getWorkflowPresetById(directMatch.presetId);

  const first = recommendations[0]?.template;
  if (!first) return null;
  if (first.id === 'instagram-content-agent') return getWorkflowPresetById('instagram-content-workflow');
  if (first.id === 'daily-planning-agent') return getWorkflowPresetById('daily-operator-workflow');
  if (first.id === 'n8n-workflow-planner-agent') return getWorkflowPresetById('n8n-planning-workflow');
  if (first.id === 'code-review-agent') return getWorkflowPresetById('code-review-workflow');
  if (first.category === 'Research & Strategy') return getWorkflowPresetById('research-strategy-workflow');
  if (first.category === 'Content & Growth') return getWorkflowPresetById('campaign-launch-workflow');
  return null;
}

export function recommendAgentTemplates(input: RecommendationInput): AgentTemplateRecommendationResult {
  const detectedIntents = detectIntents(input.userMessage);
  const maxResults = Math.max(1, Math.min(input.maxResults ?? 5, 6));
  const shouldRecommend = detectedIntents.length > 0 || Boolean(input.selectedTemplateId);

  const scored = templates
    .map((template) => {
      const { score, reasons } = scoreTemplate(template, input, detectedIntents);
      return {
        template,
        score,
        reason: reasons.length ? reasons.slice(0, 2).join('; ') : 'safe general-purpose fit',
        confidence: confidenceFor(score),
      };
    })
    .filter((item) => item.score > (shouldRecommend ? 6 : 10))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.template.name.localeCompare(b.template.name);
    })
    .slice(0, maxResults);

  const recommendations = scored.length ? scored : templates
    .filter((template) => ['daily-briefing-generator', 'seo-content-cluster-planner', 'competitive-landscape-analysis'].includes(template.id))
    .map((template) => ({
      template,
      score: 10,
      reason: 'high-value starter template',
      confidence: 'low' as Confidence,
    }))
    .slice(0, maxResults);

  const safeNextActions = [
    'Use Template in Alex to refine the prompt.',
    'Create a pending draft task for manual review.',
    'Send content-related templates to Content Studio as editable drafts.',
    'Export n8n templates as planning blueprints only.',
  ];
  const recommendedWorkflowPreset = recommendWorkflowPreset(input.userMessage, recommendations);

  return {
    recommendedTemplates: recommendations,
    recommendedWorkflow: defaultWorkflow(recommendations),
    recommendedWorkflowPreset,
    nextBestTemplate: recommendations[0] ?? null,
    safeNextActions,
    detectedIntents,
    shouldRecommend,
  };
}

export function formatRecommendationContextForAlex(result: AgentTemplateRecommendationResult) {
  if (!result.shouldRecommend && result.detectedIntents.length === 0) {
    return 'No strong template recommendation intent detected. Do not force template recommendations unless useful.';
  }

  return [
    `recommendations_relevant: ${result.shouldRecommend ? 'yes' : 'maybe'}`,
    `detected_intents: ${result.detectedIntents.join(', ') || 'none'}`,
    '',
    'Recommended templates:',
    ...result.recommendedTemplates.slice(0, 5).map((item, index) => [
      `${index + 1}. ${item.template.name}`,
      `category: ${item.template.category}`,
      `reason: ${item.reason}`,
      `confidence: ${item.confidence}`,
      `inputs: ${item.template.inputs.slice(0, 4).join('; ')}`,
      `outputs: ${item.template.outputs.slice(0, 4).join('; ')}`,
      `safety_level: ${item.template.safety_level}`,
      `execution_mode: ${item.template.execution_mode}`,
    ].join('\n')),
    '',
    'Suggested safe workflow:',
    ...(result.recommendedWorkflowPreset ? [
      `Preset: ${result.recommendedWorkflowPreset.name}`,
      `preset_id: ${result.recommendedWorkflowPreset.id}`,
      `open_in_workflow_builder: /dashboard/agent-library/workflows?preset=${result.recommendedWorkflowPreset.id}`,
      `steps: ${result.recommendedWorkflowPreset.steps.join(' -> ')}`,
      '',
    ] : []),
    ...result.recommendedWorkflow.map((step, index) => `${index + 1}. ${step}`),
    '',
    'Safe next actions:',
    ...result.safeNextActions.map((action) => `- ${action}`),
  ].join('\n');
}
