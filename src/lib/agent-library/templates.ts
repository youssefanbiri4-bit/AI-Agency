export type TemplateCategory =
  | 'Research & Strategy'
  | 'Content & Growth'
  | 'Sales & Operations'
  | 'Reports & Analytics'
  | 'Alex Assistant Skills'
  | 'Developer/Code Agents'
  | 'n8n Workflow Ideas';

export type SafetyLevel = 'safe' | 'requires_review' | 'readonly';

export type ExecutionMode = 'autonomous' | 'supervised' | 'manual' | 'draft_only';

export interface AgentTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  source_inspiration: string;
  description: string;
  recommended_for: string[];
  inputs: string[];
  outputs: string[];
  safety_level: SafetyLevel;
  execution_mode: ExecutionMode;
  suggested_prompt: string;
  review_checklist: string[];
}

export type AlexAgentTemplateContext = Pick<
  AgentTemplate,
  | 'id'
  | 'name'
  | 'category'
  | 'description'
  | 'recommended_for'
  | 'inputs'
  | 'outputs'
  | 'safety_level'
  | 'execution_mode'
  | 'suggested_prompt'
  | 'review_checklist'
>;

export const categories: TemplateCategory[] = [
  'Research & Strategy',
  'Content & Growth',
  'Sales & Operations',
  'Reports & Analytics',
  'Alex Assistant Skills',
  'Developer/Code Agents',
  'n8n Workflow Ideas',
];

export const templates: AgentTemplate[] = [
  // ── Research & Strategy ──────────────────────────────────────────────
  {
    id: 'market-research-agent',
    name: 'Market Research Agent',
    category: 'Research & Strategy',
    source_inspiration:
      'Inspired by market research, audience analysis, competitive research, and AI research agent use cases.',
    description:
      'Analyzes a product, niche, audience, market context, pain points, opportunities, and campaign direction to prepare a clear research foundation before strategy, content, or ads work.',
    recommended_for: ['Alex', 'Reports', 'Campaigns', 'Workflow Builder', 'Tasks', 'Playbooks', 'Content Studio'],
    inputs: [
      'Product or service name',
      'Industry or niche',
      'Target market',
      'Target audience',
      'Campaign goal',
      'Main problem to solve',
      'Existing offer',
      'Competitors if known',
      'Region or country',
      'Language',
      'Available notes or assumptions',
    ],
    outputs: [
      'Market summary',
      'Target audience overview',
      'Customer pain points',
      'Customer desires',
      'Market opportunities',
      'Competitor notes',
      'Positioning ideas',
      'Content angles',
      'Campaign recommendations',
      'Research gaps',
      'Review checklist',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    suggested_prompt:
      'Act as a senior market research agent for an AI agency.\n\nAnalyze the provided product, niche, audience, market, offer, competitors, region, and campaign goal.\n\nReturn the result in this structure:\n\n1. Market Summary\n2. Target Audience Overview\n3. Customer Pain Points\n4. Customer Desires\n5. Market Opportunities\n6. Competitor Notes\n7. Positioning Ideas\n8. Content Angles\n9. Campaign Recommendations\n10. Research Gaps\n11. Final Review Checklist\n\nKeep the research practical, clear, and useful for building a marketing strategy, content plan, or campaign workflow.\nIf live web research is not available, clearly state that the output is based only on the provided context and should be verified before important business decisions.\nDo not publish, schedule, run n8n, create live ads, spend money, browse externally without approval, or execute any external action.',
    review_checklist: [
      'The market summary is clear.',
      'The target audience is specific.',
      'Customer pain points are realistic.',
      'Customer desires are useful for messaging.',
      'Opportunities are practical.',
      'Competitor notes are clearly separated from assumptions.',
      'Positioning ideas can support a marketing strategy.',
      'Content angles are relevant.',
      'Research gaps are clearly listed.',
      'The output can be used before strategy, content, or ads work.',
      'No publishing, scheduling, spending, n8n execution, external browsing, or provider action is triggered.',
    ],
  },
  {
    id: 'competitor-analysis-agent',
    name: 'Competitor Analysis Agent',
    category: 'Research & Strategy',
    source_inspiration:
      'Inspired by competitor research, market intelligence, positioning analysis, and AI research agent use cases.',
    description:
      'Analyzes known competitors, their positioning, offers, content angles, strengths, weaknesses, messaging, and opportunities to help build stronger campaigns and strategies.',
    recommended_for: ['Alex', 'Reports', 'Campaigns', 'Workflow Builder', 'Tasks', 'Playbooks', 'Content Studio'],
    inputs: [
      'Product or service name',
      'Industry or niche',
      'Target audience',
      'Competitor names or links if available',
      'Region or country',
      'Campaign goal',
      'Main offer',
      'Platform to analyze',
      'Known competitor notes',
      'Language',
      'Comparison criteria',
    ],
    outputs: [
      'Competitor overview',
      'Positioning comparison',
      'Strengths and weaknesses',
      'Offer comparison',
      'Messaging analysis',
      'Content angle analysis',
      'Social media/content notes',
      'Pricing or value perception notes',
      'Market gaps',
      'Differentiation opportunities',
      'Strategic recommendations',
      'Review checklist',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    suggested_prompt:
      'Act as a senior competitor analysis agent for an AI agency.\n\nAnalyze the provided competitors, product, niche, target audience, platform, region, offer, and campaign goal.\n\nReturn the result in this structure:\n\n1. Competitor Overview\n2. Positioning Comparison\n3. Strengths and Weaknesses\n4. Offer Comparison\n5. Messaging Analysis\n6. Content Angle Analysis\n7. Social Media or Platform Notes\n8. Pricing or Value Perception Notes\n9. Market Gaps\n10. Differentiation Opportunities\n11. Strategic Recommendations\n12. Final Review Checklist\n\nKeep the analysis practical, clear, and useful for marketing strategy, content planning, and campaign decisions.\nIf live web research is not available, clearly state that the analysis is based only on the provided competitor notes and should be verified before important business decisions.\nDo not scrape websites, publish, schedule, run n8n, create live ads, spend money, browse externally without approval, or execute any external action.',
    review_checklist: [
      'Competitors are clearly identified.',
      'Positioning differences are explained.',
      'Strengths and weaknesses are practical.',
      'Offer comparison is useful.',
      'Messaging analysis is clear.',
      'Content angles are relevant.',
      'Market gaps are realistic.',
      'Differentiation opportunities are actionable.',
      'Recommendations can support marketing strategy and content planning.',
      'Assumptions are clearly separated from verified facts.',
      'No scraping, publishing, scheduling, spending, n8n execution, external browsing, or provider action is triggered.',
    ],
  },
  {
    id: 'competitive-landscape-analysis',
    name: 'Competitive Landscape Analysis',
    category: 'Research & Strategy',
    source_inspiration:
      'Inspired by structured market intelligence patterns in "500 AI Agents Projects" — competitor matrix, feature gap, and positioning analysis.',
    description:
      'Analyse competitors across feature sets, pricing, positioning, and market presence. Produces a ranked competitive matrix with gap analysis and strategic recommendations.',
    recommended_for: ['Product strategy', 'Go-to-market planning', 'Quarterly reviews'],
    inputs: ['Competitor URLs or names (3–8)', 'Your product description', 'Target market / ICP notes'],
    outputs: ['Competitive feature matrix', 'Gap analysis report', 'Positioning recommendations', 'Risk flags'],
    safety_level: 'requires_review',
    execution_mode: 'supervised',
    suggested_prompt:
      'Analyse the following competitors: [list]. My product is [description] targeting [market]. Produce a feature comparison matrix, identify 3 capability gaps, and recommend positioning angles.',
    review_checklist: [
      'Verify competitor claims against public sources',
      'Check recency of market data',
      'Review recommendations for bias',
      'Remove any confidential information before sharing',
    ],
  },
  {
    id: 'market-trend-intelligence',
    name: 'Market Trend Intelligence Report',
    category: 'Research & Strategy',
    source_inspiration:
      'Adapted from trend-scraping agent patterns — combines signal detection from multiple feeds into a structured briefing.',
    description:
      'Aggregates signals from industry news, social sentiment, and search trends to produce a weekly or monthly intelligence briefing with actionable takeaways.',
    recommended_for: ['Marketing teams', 'Product owners', 'Executive review'],
    inputs: ['Industry keywords (3–5)', 'Source preferences', 'Time range (week / month / quarter)'],
    outputs: ['Trend summary with signal strength', 'Sentiment shifts', 'Emerging topic alerts', 'Recommended actions'],
    safety_level: 'requires_review',
    execution_mode: 'supervised',
    suggested_prompt:
      'Scan [industry] trends over the past [time range]. Sources: news, social, search. Flag rising topics, shifting sentiment, and 3 actions we should consider.',
    review_checklist: [
      'Cross-check trend strength with primary sources',
      'Remove speculative or low-confidence signals',
      'Tailor recommendations to current roadmap',
    ],
  },
  {
    id: 'swot-analysis-generator',
    name: 'SWOT Analysis Generator',
    category: 'Research & Strategy',
    source_inspiration:
      'Inspired by structured reasoning agents that decompose strategic positions into strengths, weaknesses, opportunities, and threats.',
    description:
      'Generates a comprehensive SWOT analysis from your business profile, competitive context, and market notes. Outputs prioritised action items for each quadrant.',
    recommended_for: ['Strategic planning', 'Pitch preparation', 'Annual reviews'],
    inputs: ['Business / product description', 'Competitor context', 'Market observations', 'Internal capability notes'],
    outputs: ['SWOT matrix with scored items', 'Priority-ranked actions per quadrant', 'Cross-quadrant strategies'],
    safety_level: 'safe',
    execution_mode: 'supervised',
    suggested_prompt:
      'Based on my business [description] operating in [context], generate a SWOT analysis. Score each item by impact and likelihood. Suggest 3 cross-quadrant strategies.',
    review_checklist: [
      'Validate strengths and weaknesses internally',
      'Confirm opportunity and threat assumptions',
      'Ensure actions are specific and measurable',
    ],
  },
  {
    id: 'audience-persona-builder',
    name: 'Audience Persona Builder',
    category: 'Research & Strategy',
    source_inspiration:
      'Based on buyer persona synthesis agents — combines demographic, behavioural, and psychographic inputs into structured personas.',
    description:
      'Builds detailed audience personas from product, market, and customer data. Includes demographics, goals, pain points, decision criteria, and channel preferences.',
    recommended_for: ['Content marketing', 'Ad targeting', 'Product positioning'],
    inputs: ['Product / service description', 'Existing customer notes (optional)', 'Target market description', 'Interview snippets (optional)'],
    outputs: ['3–5 persona profiles', 'Per-persona messaging guidance', 'Channel fit scores', "Do's and don'ts per persona"],
    safety_level: 'safe',
    execution_mode: 'autonomous',
    suggested_prompt:
      'Create 3–5 audience personas for [product] targeting [market]. For each: demographics, goals, pain points, decision criteria, preferred channels. Base on [provided context].',
    review_checklist: [
      'Compare personas against real customer data',
      'Verify pain points with support or sales teams',
      'Adjust channel assumptions per actual analytics',
    ],
  },

  // ── Content & Growth ─────────────────────────────────────────────────
  {
    id: 'marketing-strategy-agent',
    name: 'Marketing Strategy Agent',
    category: 'Content & Growth',
    source_inspiration:
      'Inspired by marketing strategy generator AI agent use cases.',
    description:
      'Builds a practical marketing campaign strategy from a product, audience, platform, offer, and campaign goal.',
    recommended_for: ['Alex', 'Content Studio', 'Campaigns', 'Workflow Builder', 'Tasks', 'Playbooks'],
    inputs: [
      'Product or service name',
      'Target audience',
      'Campaign goal',
      'Platform',
      'Brand tone',
      'Offer',
      'Language',
      'Main customer pain point',
    ],
    outputs: [
      'Campaign strategy',
      'Audience insight',
      'Campaign angle',
      'Messaging pillars',
      'Content ideas',
      'Ad copy direction',
      'CTA suggestions',
      'Funnel recommendation',
      'Review checklist',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    suggested_prompt:
      'Act as a senior marketing strategy agent for an AI agency.\n\nBuild a clear marketing campaign strategy using the provided product, audience, platform, offer, and goal.\n\nReturn the result in this structure:\n\n1. Campaign Summary\n2. Target Audience\n3. Main Pain Points\n4. Campaign Angle\n5. Messaging Pillars\n6. Content Ideas\n7. Ad Copy Direction\n8. CTA Suggestions\n9. Funnel Recommendation\n10. Review Checklist\n\nKeep the strategy practical, clear, and ready to use inside a content and ads workflow.\nDo not publish, spend money, schedule, run n8n, create live ads, or execute any external action.',
    review_checklist: [
      'The target audience is clearly defined.',
      'The campaign goal is specific.',
      'The main pain points are included.',
      'The campaign angle is practical.',
      'Messaging pillars are clear.',
      'Content ideas match the selected platform.',
      'CTA suggestions are relevant.',
      'The strategy can be used inside Content Studio.',
      'The result is ready for review before any execution.',
      'No publishing, spending, scheduling, n8n execution, or external provider action is triggered.',
    ],
  },
  {
    id: 'instagram-content-agent',
    name: 'Instagram Content Agent',
    category: 'Content & Growth',
    source_inspiration:
      'Inspired by Instagram post generator and social media content AI agent use cases.',
    description:
      'Creates Instagram content ideas, reel scripts, captions, hooks, CTAs, hashtags, and content variations from a product, campaign goal, audience, and brand tone.',
    recommended_for: ['Alex', 'Content Studio', 'Campaigns', 'Workflow Builder', 'Creative Assets', 'Tasks', 'Playbooks'],
    inputs: [
      'Product or service name',
      'Target audience',
      'Campaign goal',
      'Content type',
      'Brand tone',
      'Language',
      'Offer',
      'Visual style',
      'Main message',
      'Platform: Instagram',
    ],
    outputs: [
      'Instagram post ideas',
      'Reel hooks',
      'Reel script',
      'Caption options',
      'CTA suggestions',
      'Hashtag sets',
      'Story ideas',
      'Carousel structure',
      'Creative direction notes',
      'Review checklist',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    suggested_prompt:
      'Act as a senior Instagram content agent for an AI agency.\n\nCreate high-quality Instagram content for the provided product, audience, campaign goal, brand tone, offer, and language.\n\nReturn the result in this structure:\n\n1. Content Strategy Summary\n2. 5 Instagram Post Ideas\n3. 3 Reel Hooks\n4. Reel Script\n5. 3 Caption Options\n6. CTA Suggestions\n7. Hashtag Sets\n8. Story Ideas\n9. Carousel Structure\n10. Creative Direction Notes\n11. Review Checklist\n\nKeep the content clear, engaging, platform-friendly, and ready to review inside Content Studio.\nDo not publish, schedule, run n8n, create live ads, spend money, or execute any external action.',
    review_checklist: [
      'The content matches the campaign goal.',
      'The target audience is clear.',
      'Hooks are strong and attention-grabbing.',
      'Captions are readable and platform-friendly.',
      'CTA is clear and relevant.',
      'Hashtags are not excessive or spammy.',
      'Reel script is practical and easy to produce.',
      'Creative direction is useful for design or video creation.',
      'The content can be sent to Content Studio safely.',
      'No publishing, scheduling, spending, n8n execution, or external provider action is triggered.',
    ],
  },
  {
    id: 'ad-copy-agent',
    name: 'Ad Copy Agent',
    category: 'Content & Growth',
    source_inspiration:
      'Inspired by ad copy generation, campaign messaging, and paid ads AI agent use cases.',
    description:
      'Creates persuasive ad copy variations for Meta, Google Ads, LinkedIn, TikTok, or other platforms using campaign goal, audience, offer, tone, and product details.',
    recommended_for: ['Alex', 'Content Studio', 'Campaigns', 'Workflow Builder', 'Google Ads Drafts', 'Meta Ads Drafts', 'Tasks', 'Playbooks'],
    inputs: [
      'Product or service name',
      'Target audience',
      'Campaign goal',
      'Platform',
      'Offer',
      'Brand tone',
      'Language',
      'Main pain point',
      'Key benefit',
      'CTA',
      'Character limit if needed',
    ],
    outputs: [
      'Primary ad copy variations',
      'Short ad copy variations',
      'Headlines',
      'Descriptions',
      'CTA options',
      'Hook options',
      'Platform-specific copy notes',
      'A/B test angles',
      'Compliance review checklist',
      'Review checklist',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    suggested_prompt:
      'Act as a senior paid ads copywriting agent for an AI agency.\n\nCreate high-converting ad copy for the provided product, audience, platform, campaign goal, offer, tone, and language.\n\nReturn the result in this structure:\n\n1. Campaign Message Summary\n2. 5 Primary Ad Copy Variations\n3. 5 Short Ad Copy Variations\n4. 10 Headline Options\n5. 5 Description Options\n6. CTA Options\n7. Hook Options\n8. A/B Test Angles\n9. Platform-Specific Notes\n10. Compliance & Safety Review\n11. Final Review Checklist\n\nKeep the copy clear, persuasive, platform-friendly, and ready for review inside Content Studio.\nDo not publish ads, create live campaigns, schedule, run n8n, spend money, or execute any external action.',
    review_checklist: [
      'The ad copy matches the campaign goal.',
      'The target audience is clear.',
      'The offer is easy to understand.',
      'The key benefit is visible.',
      'Headlines are short and persuasive.',
      'CTAs are clear and relevant.',
      'Copy is adapted to the selected platform.',
      'No exaggerated or misleading claims are included.',
      'The result can be reviewed before sending to any ad platform.',
      'No publishing, scheduling, spending, n8n execution, or external provider action is triggered.',
    ],
  },
  {
    id: 'creative-brief-agent',
    name: 'Creative Brief Agent',
    category: 'Content & Growth',
    source_inspiration:
      'Inspired by creative brief generation, campaign design planning, and AI creative direction agent use cases.',
    description:
      'Turns a campaign idea, product, audience, platform, and marketing message into a clear creative brief for visuals, ads, social posts, reels, landing pages, and creative assets.',
    recommended_for: ['Alex', 'Creative Assets', 'Content Studio', 'Campaigns', 'Workflow Builder', 'Tasks', 'Playbooks'],
    inputs: [
      'Product or service name',
      'Campaign goal',
      'Target audience',
      'Platform',
      'Brand tone',
      'Main message',
      'Offer',
      'Visual style',
      'Colors or brand palette',
      'Format',
      'CTA',
      'Language',
      'Design references if available',
    ],
    outputs: [
      'Creative brief summary',
      'Visual concept',
      'Key message',
      'Layout direction',
      'Image/video direction',
      'Design elements',
      'Color and style guidance',
      'Copy placement notes',
      'CTA placement notes',
      'Asset format recommendations',
      'Designer checklist',
      'Review checklist',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    suggested_prompt:
      'Act as a senior creative brief agent for an AI agency.\n\nCreate a clear and practical creative brief using the provided product, audience, campaign goal, platform, brand tone, visual style, offer, and main message.\n\nReturn the result in this structure:\n\n1. Creative Brief Summary\n2. Campaign Goal\n3. Target Audience\n4. Key Message\n5. Visual Concept\n6. Layout Direction\n7. Image or Video Direction\n8. Design Elements\n9. Color and Style Guidance\n10. Copy Placement Notes\n11. CTA Placement Notes\n12. Recommended Asset Formats\n13. Designer Checklist\n14. Final Review Checklist\n\nKeep the brief clear, useful for designers, and ready to use inside Creative Assets or Content Studio.\nDo not publish, schedule, run n8n, create live ads, spend money, or execute any external action.',
    review_checklist: [
      'The creative goal is clear.',
      'The target audience is defined.',
      'The key message is easy to understand.',
      'The visual concept matches the brand tone.',
      'Layout direction is practical.',
      'Image or video direction is specific.',
      'CTA placement is clear.',
      'Asset formats are suitable for the selected platform.',
      'The brief is useful for a designer or creative asset generator.',
      'The result can be reviewed before any publishing or generation.',
      'No publishing, scheduling, spending, n8n execution, or external provider action is triggered.',
    ],
  },
  {
    id: 'seo-content-cluster-planner',
    name: 'SEO Content Cluster Planner',
    category: 'Content & Growth',
    source_inspiration:
      'Inspired by topical authority agents that map pillar–cluster structures from keyword research and competitor content gaps.',
    description:
      'Plans a topical content cluster around a core pillar topic. Produces keyword maps, cluster outlines, internal linking suggestions, and a publishing sequence.',
    recommended_for: ['SEO content strategies', 'Blog roadmapping', 'Website authority building'],
    inputs: ['Pillar topic', 'Target keywords (or auto-suggest seed)', 'Competitor content URLs (optional)', 'Target audience'],
    outputs: ['Pillar page outline', '5–10 sub-topic cluster articles', 'Keyword mapping per page', 'Internal link plan', 'Publishing sequence'],
    safety_level: 'safe',
    execution_mode: 'supervised',
    suggested_prompt:
      'Plan an SEO content cluster around [pillar topic]. Target keywords: [list]. Suggest a pillar page outline, 5–10 cluster articles with keyword targets, internal linking, and a publish order.',
    review_checklist: [
      'Review keyword intent alignment',
      'Check cluster coverage against search competitors',
      'Ensure no keyword cannibalisation',
    ],
  },
  {
    id: 'social-media-content-calendar',
    name: 'Social Media Content Calendar',
    category: 'Content & Growth',
    source_inspiration:
      'Adapted from calendar-scheduling agents — combines content themes, platform best practices, and scheduling logic.',
    description:
      'Generates a 2-week content calendar across Instagram, LinkedIn, Facebook, and Pinterest. Includes post ideas, hooks, hashtags, and optimal posting windows.',
    recommended_for: ['Social media managers', 'Content teams', 'Freelancers'],
    inputs: ['Brand / product context', 'Target platforms', 'Content themes (3–5)', 'Key dates or campaigns'],
    outputs: ['14-day content plan', 'Per-post: hook, caption, hashtags', 'Platform-specific format notes', 'Suggested posting schedule'],
    safety_level: 'safe',
    execution_mode: 'autonomous',
    suggested_prompt:
      'Create a 14-day social media content calendar for [brand] across [platforms]. Themes: [list]. Include hooks, captions, hashtags, and format guidance per post.',
    review_checklist: [
      'Verify brand voice consistency across posts',
      'Check for timely relevance of content',
      'Ensure platform format specs are correct',
    ],
  },
  {
    id: 'newsletter-campaign-builder',
    name: 'Newsletter Campaign Builder',
    category: 'Content & Growth',
    source_inspiration:
      'Based on email marketing agent patterns — combines subject-line optimisation, body drafting, and segmentation logic.',
    description:
      'Drafts a complete newsletter campaign from topic input. Includes subject lines, preview text, body sections, CTA variants, and audience segment recommendations.',
    recommended_for: ['Email marketing', 'Audience nurturing', 'Product updates'],
    inputs: ['Campaign topic / goal', 'Target segment description', 'Key message points (3–5)', 'Desired CTA'],
    outputs: ['3 subject line variants', 'Preview text options', 'Body draft with sections', '2–3 CTA variants', 'Segment fit notes'],
    safety_level: 'safe',
    execution_mode: 'supervised',
    suggested_prompt:
      'Draft a newsletter about [topic/goal] for [segment]. Key points: [list]. Include 3 subject lines, preview text, body draft, and CTA variants. Keep tone [brand tone].',
    review_checklist: [
      'A/B test subject lines before send',
      'Verify all links and tracking are functional',
      'Check segmentation rules match audience list',
    ],
  },
  {
    id: 'viral-content-hook-generator',
    name: 'Viral Content Hook Generator',
    category: 'Content & Growth',
    source_inspiration:
      'Inspired by hook-optimisation agents that analyse viral patterns across platforms and generate variations.',
    description:
      'Generates 10 attention-grabbing hooks for short-form content across Instagram Reels, TikTok, and YouTube Shorts. Each hook includes format notes and expected engagement angle.',
    recommended_for: ['Short-form content creators', 'Social media growth', 'Brand awareness'],
    inputs: ['Topic / offer', 'Target audience', 'Platform (Reels / TikTok / Shorts)', 'Brand voice notes'],
    outputs: ['10 hook variants with engagement angle', 'Format guidance per hook', 'Hook scoring (attention / retention)'],
    safety_level: 'safe',
    execution_mode: 'autonomous',
    suggested_prompt:
      'Generate 10 viral hooks for [topic] targeting [audience] on [platform]. For each: the hook line, why it works, and format notes. Brand voice: [notes].',
    review_checklist: [
      'Test hooks with a small audience first',
      'Remove any misleading or clickbait variants',
      'Align hooks with actual content value',
    ],
  },

  // ── Sales & Operations ───────────────────────────────────────────────
  {
    id: 'sales-outreach-sequence',
    name: 'Sales Outreach Sequence',
    category: 'Sales & Operations',
    source_inspiration:
      'Derived from multi-step sales engagement agents that sequence touches across email, LinkedIn, and calls.',
    description:
      'Builds a multi-channel outreach sequence for a target prospect list. Includes email drafts, LinkedIn message variants, call scripts, and follow-up timing.',
    recommended_for: ['SDR teams', 'Founder-led sales', 'Account-based marketing'],
    inputs: ['Target prospect profile / ICP', 'Value proposition', 'Sequence length (touches)', 'Channels (email / LinkedIn / call)'],
    outputs: ['Step-by-step outreach sequence', 'Per-step: channel, message variant, timing', 'Follow-up escalation rules', 'Reply handling guidelines'],
    safety_level: 'requires_review',
    execution_mode: 'supervised',
    suggested_prompt:
      'Design a [N]-touch outreach sequence for [prospect profile] with value prop [message]. Channels: [list]. Include email drafts, LinkedIn messages, call scripts, and follow-up timing.',
    review_checklist: [
      'Review all messages for compliance (CAN-SPAM, GDPR)',
      'Personalise placeholders before sending',
      'Set frequency caps to avoid fatigue',
      'Do not auto-send — always require human review',
    ],
  },
  {
    id: 'crm-enrichment-scoring',
    name: 'CRM Enrichment & Lead Scoring',
    category: 'Sales & Operations',
    source_inspiration:
      'Based on lead-scoring agents that enrich CRM records and score prospects from public signals and engagement data.',
    description:
      'Enriches existing CRM records with firmographic, technographic, and intent signals. Scores leads by fit and engagement, and suggests prioritised follow-up actions.',
    recommended_for: ['Sales ops', 'CRM hygiene', 'Pipeline prioritisation'],
    inputs: ['CRM export (CSV or key fields)', 'Enrichment sources to check', 'Scoring criteria (fit + behaviour)'],
    outputs: ['Enriched CRM records', 'Lead scores (0–100)', 'Priority queue', 'Suggested next actions per lead'],
    safety_level: 'requires_review',
    execution_mode: 'supervised',
    suggested_prompt:
      'Enrich these CRM records: [data]. Check [sources] for firmographic and intent signals. Score each lead 0–100 based on [criteria]. Return enriched rows sorted by score.',
    review_checklist: [
      'Verify enrichment accuracy against known data',
      'Review scoring criteria with sales team',
      'Do not overwrite CRM without backup',
    ],
  },
  {
    id: 'operational-sop-writer',
    name: 'Operational SOP Writer',
    category: 'Sales & Operations',
    source_inspiration:
      'Inspired by process-documentation agents that translate workflow descriptions into structured standard operating procedures.',
    description:
      'Converts a described workflow or process into a clear, structured SOP document. Includes purpose, prerequisites, step-by-step instructions, decision points, and escalation rules.',
    recommended_for: ['Process documentation', 'Onboarding', 'Compliance'],
    inputs: ['Process name and purpose', 'Step-by-step description', 'Roles involved', 'Tools / systems used'],
    outputs: ['SOP document with sections', 'Prerequisite checklist', 'Decision tree for edge cases', 'Escalation rules'],
    safety_level: 'safe',
    execution_mode: 'supervised',
    suggested_prompt:
      'Write an SOP for [process name]. Purpose: [description]. Steps: [list]. Roles: [list]. Include prerequisites, decision points, escalation rules, and a quick-reference checklist.',
    review_checklist: [
      'Validate accuracy with process owner',
      'Test SOP against a real scenario',
      'Keep version history for updates',
    ],
  },
  {
    id: 'lead-score-agent',
    name: 'Lead Score Agent',
    category: 'Sales & Operations',
    source_inspiration:
      'Inspired by lead qualification, CRM scoring, sales operations triage, and founder-led agency sales workflows.',
    description:
      'Evaluates a potential lead and gives a reviewable score based on fit, urgency, budget signals, business need, and the safest next action.',
    recommended_for: ['Alex', 'Agent Library', 'Tasks', 'Workflow Builder', 'Playbooks', 'Knowledge Base', 'Reports'],
    inputs: [
      'Lead name',
      'Business type',
      'Industry',
      'Website or social link if available',
      'Lead message',
      'Budget signal',
      'Service interest',
      'Urgency',
      'Location',
      'Notes',
    ],
    outputs: [
      'Lead score from 0 to 100',
      'Fit level',
      'Urgency level',
      'Budget signal',
      'Main need',
      'Recommended offer',
      'Follow-up priority',
      'Suggested next action',
      'Review checklist',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    suggested_prompt:
      'Act as a senior sales qualification agent for my internal AI agency manager.\n\nEvaluate the lead using the provided lead name, business type, industry, website or social link, message, budget signal, service interest, urgency, location, and notes.\n\nReturn the result in this structure:\n\n1. Lead Summary\n2. Lead Score from 0 to 100\n3. Fit Level\n4. Urgency Level\n5. Budget Signal\n6. Main Need\n7. Recommended Offer\n8. Follow-Up Priority\n9. Suggested Next Action\n10. Missing Information\n11. Review Checklist\n\nKeep the score practical and explain the reasoning briefly. If data is missing, say what must be confirmed before outreach.\nDo not send messages, contact clients, run n8n, spend money, publish, schedule, delete data, or execute external actions.',
    review_checklist: [
      'The lead score is explained.',
      'Fit level is based on the provided business context.',
      'Urgency is separated from assumptions.',
      'Budget signal is clearly marked as strong, weak, unknown, or missing.',
      'Recommended offer matches the stated need.',
      'Suggested next action is manual and review-first.',
      'Missing information is listed.',
      'No email, client contact, n8n execution, publishing, scheduling, spending, deletion, or external action is triggered.',
    ],
  },
  {
    id: 'follow-up-email-agent',
    name: 'Follow-up Email Agent',
    category: 'Sales & Operations',
    source_inspiration:
      'Inspired by sales follow-up drafting, client communication assistants, and review-first outreach workflows.',
    description:
      'Drafts professional follow-up emails or messages for leads and clients without sending anything automatically.',
    recommended_for: ['Alex', 'Agent Library', 'Tasks', 'Workflow Builder', 'Playbooks', 'Knowledge Base', 'Reports'],
    inputs: [
      'Client or lead name',
      'Previous conversation summary',
      'Service discussed',
      'Goal of follow-up',
      'Tone',
      'Language',
      'Offer',
      'Deadline or urgency',
      'CTA',
    ],
    outputs: [
      'Follow-up email draft',
      'Short message version',
      'WhatsApp/DM version',
      'Subject line options',
      'CTA options',
      'Review checklist',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    suggested_prompt:
      'Act as a professional sales follow-up drafting agent for my internal AI agency manager.\n\nDraft follow-up communication using the client or lead name, previous conversation summary, service discussed, follow-up goal, tone, language, offer, deadline or urgency, and CTA.\n\nReturn the result in this structure:\n\n1. Follow-Up Context Summary\n2. Follow-Up Email Draft\n3. Short Message Version\n4. WhatsApp / DM Version\n5. Subject Line Options\n6. CTA Options\n7. Personalization Notes\n8. Review Checklist\n\nKeep the message professional, specific, and easy to review before sending. Do not invent private details.\nDo not send messages, contact clients, run n8n, spend money, publish, schedule, delete data, or execute external actions.',
    review_checklist: [
      'The draft matches the previous conversation.',
      'The tone and language are appropriate.',
      'The CTA is clear and low-friction.',
      'No private or invented client details are included.',
      'Subject lines are professional.',
      'WhatsApp/DM version is concise.',
      'Message remains draft-only for manual sending.',
      'No email, client contact, n8n execution, publishing, scheduling, spending, deletion, or external action is triggered.',
    ],
  },
  {
    id: 'client-proposal-agent',
    name: 'Client Proposal Agent',
    category: 'Sales & Operations',
    source_inspiration:
      'Inspired by service proposal assistants, agency sales proposal workflows, and structured offer drafting.',
    description:
      'Creates a professional service proposal draft for a client based on their needs, scope, timeline, deliverables, and agency offer.',
    recommended_for: ['Alex', 'Agent Library', 'Tasks', 'Workflow Builder', 'Playbooks', 'Knowledge Base', 'Reports'],
    inputs: [
      'Client name',
      'Client business',
      'Problem or need',
      'Proposed service',
      'Scope of work',
      'Timeline',
      'Deliverables',
      'Price or package if provided',
      'Language',
      'Tone',
    ],
    outputs: [
      'Proposal summary',
      'Client problem',
      'Proposed solution',
      'Scope of work',
      'Deliverables',
      'Timeline',
      'Pricing/package section',
      'Why choose us',
      'CTA',
      'Review checklist',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    suggested_prompt:
      'Act as a senior client proposal agent for my internal AI agency manager.\n\nCreate a proposal draft using the client name, client business, problem or need, proposed service, scope of work, timeline, deliverables, price or package if provided, language, and tone.\n\nReturn the result in this structure:\n\n1. Proposal Summary\n2. Client Problem\n3. Proposed Solution\n4. Scope of Work\n5. Deliverables\n6. Timeline\n7. Pricing / Package Section\n8. Why Choose Us\n9. CTA\n10. Assumptions and Missing Details\n11. Review Checklist\n\nKeep the proposal professional, practical, and clearly marked as a draft for manual review.\nDo not send messages, contact clients, run n8n, spend money, publish, schedule, delete data, or execute external actions.',
    review_checklist: [
      'The proposal matches the client need.',
      'Scope of work is clear.',
      'Deliverables are specific.',
      'Timeline is realistic.',
      'Pricing/package section does not invent prices unless provided.',
      'CTA is clear.',
      'Assumptions and missing details are listed.',
      'Proposal remains draft-only for manual review.',
      'No email, client contact, n8n execution, publishing, scheduling, spending, deletion, or external action is triggered.',
    ],
  },
  {
    id: 'client-onboarding-agent',
    name: 'Client Onboarding Agent',
    category: 'Sales & Operations',
    source_inspiration:
      'Inspired by client onboarding operations, agency project kickoff workflows, and account management checklists.',
    description:
      'Turns a new client into an organized onboarding plan with tasks, required assets, access needs, questions, first steps, and review notes.',
    recommended_for: ['Alex', 'Agent Library', 'Tasks', 'Workflow Builder', 'Playbooks', 'Knowledge Base', 'Reports'],
    inputs: [
      'Client name',
      'Business type',
      'Service purchased',
      'Project goal',
      'Required assets',
      'Access needed',
      'Timeline',
      'Communication channel',
      'Notes',
    ],
    outputs: [
      'Onboarding checklist',
      'Required client information',
      'Required assets/access',
      'First tasks',
      'Timeline',
      'Questions to ask',
      'Internal notes',
      'Review checklist',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    suggested_prompt:
      'Act as a client onboarding agent for my internal AI agency manager.\n\nCreate an onboarding plan using the client name, business type, service purchased, project goal, required assets, access needed, timeline, communication channel, and notes.\n\nReturn the result in this structure:\n\n1. Onboarding Summary\n2. Onboarding Checklist\n3. Required Client Information\n4. Required Assets / Access\n5. First Internal Tasks\n6. Timeline\n7. Questions to Ask\n8. Internal Notes\n9. Risks or Missing Inputs\n10. Review Checklist\n\nKeep the plan practical and review-first. Do not request or expose passwords; ask for secure access-sharing methods instead.\nDo not send messages, contact clients, run n8n, spend money, publish, schedule, delete data, or execute external actions.',
    review_checklist: [
      'Onboarding checklist is actionable.',
      'Required client information is clear.',
      'Access requests avoid passwords and secrets.',
      'First tasks are draft/internal only.',
      'Timeline is realistic.',
      'Questions to ask are useful for kickoff.',
      'Internal notes separate assumptions from facts.',
      'No email, client contact, n8n execution, publishing, scheduling, spending, deletion, or external action is triggered.',
    ],
  },
  {
    id: 'meeting-prep-agent',
    name: 'Meeting Prep Agent',
    category: 'Sales & Operations',
    source_inspiration:
      'Inspired by meeting preparation assistants, sales discovery planning, objection handling, and account management workflows.',
    description:
      'Prepares agendas, questions, talking points, objection handling, and follow-up plans for client or lead meetings.',
    recommended_for: ['Alex', 'Agent Library', 'Tasks', 'Workflow Builder', 'Playbooks', 'Knowledge Base', 'Reports'],
    inputs: [
      'Meeting goal',
      'Client or lead name',
      'Business context',
      'Previous notes',
      'Services discussed',
      'Questions to ask',
      'Desired outcome',
      'Time available',
      'Language',
    ],
    outputs: [
      'Meeting agenda',
      'Key talking points',
      'Questions to ask',
      'Possible objections',
      'Suggested answers',
      'Next-step options',
      'Follow-up checklist',
      'Review checklist',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    suggested_prompt:
      'Act as a meeting preparation agent for my internal AI agency manager.\n\nPrepare for the meeting using the meeting goal, client or lead name, business context, previous notes, services discussed, questions to ask, desired outcome, time available, and language.\n\nReturn the result in this structure:\n\n1. Meeting Summary\n2. Meeting Agenda\n3. Key Talking Points\n4. Questions to Ask\n5. Possible Objections\n6. Suggested Answers\n7. Next-Step Options\n8. Follow-Up Checklist\n9. Missing Context\n10. Review Checklist\n\nKeep the prep clear, practical, and easy to use during the meeting.\nDo not send messages, contact clients, run n8n, spend money, publish, schedule, delete data, or execute external actions.',
    review_checklist: [
      'Agenda matches the meeting goal.',
      'Talking points are specific.',
      'Questions are useful for discovery or decision-making.',
      'Objections and suggested answers are realistic.',
      'Next-step options are manual and review-first.',
      'Follow-up checklist is clear.',
      'Missing context is listed.',
      'No email, client contact, n8n execution, publishing, scheduling, spending, deletion, or external action is triggered.',
    ],
  },

  // ── Reports & Analytics ─────────────────────────────────────────────
  {
    id: 'campaign-report-agent',
    name: 'Campaign Report Agent',
    category: 'Reports & Analytics',
    source_inspiration:
      'Inspired by campaign operations reviews, launch readiness reports, content handoff audits, and provider blocker summaries.',
    description:
      'Summarizes campaign status, content readiness, ad draft status, blockers, next actions, and review needs without publishing or scheduling anything.',
    recommended_for: ['Alex', 'Reports', 'Dashboard', 'Agent Library', 'Tasks', 'Campaigns', 'Content Studio', 'System Health', 'Workflow Builder', 'Playbooks', 'Knowledge Base'],
    inputs: [
      'Campaign name',
      'Campaign goal',
      'Content items',
      'Ad copy drafts',
      'Creative assets',
      'Review status',
      'Provider status',
      'Publishing/scheduling status',
      'Notes',
    ],
    outputs: [
      'Campaign summary',
      'Progress status',
      'Ready items',
      'Blocked items',
      'Missing assets',
      'Review needs',
      'Provider blockers',
      'Recommended next actions',
      'Final checklist',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    suggested_prompt:
      'Act as a campaign reporting agent for my internal AI agency manager.\n\nReview the provided campaign name, campaign goal, content items, ad copy drafts, creative assets, review status, provider status, publishing/scheduling status, and notes.\n\nReturn the report in this structure:\n\n1. Campaign Summary\n2. Progress Status\n3. Ready Items\n4. Blocked Items\n5. Missing Assets\n6. Review Needs\n7. Provider Blockers\n8. Recommended Next Actions\n9. Final Checklist\n\nKeep the report practical, concise, and easy to act on. Use safe summaries only; do not expose secrets or raw provider logs.\nDo not run n8n, publish, schedule, spend money, change provider settings, delete data, contact clients, or execute external actions.',
    review_checklist: [
      'Campaign goal is clear.',
      'Ready items are separated from blocked items.',
      'Missing assets are listed.',
      'Provider blockers are summarized without secrets.',
      'Publishing and scheduling are treated as manual review states only.',
      'Recommended next actions are safe and operator-controlled.',
      'Final checklist is short enough to use.',
      'No n8n execution, publishing, scheduling, spending, provider changes, deletion, client contact, or external action is triggered.',
    ],
  },
  {
    id: 'task-performance-agent',
    name: 'Task Performance Agent',
    category: 'Reports & Analytics',
    source_inspiration:
      'Inspired by task operations reports, backlog triage, priority reviews, and internal agency productivity summaries.',
    description:
      'Analyzes tasks by status, priority, agent type, blockers, completion progress, and safe next actions.',
    recommended_for: ['Alex', 'Reports', 'Dashboard', 'Agent Library', 'Tasks', 'Campaigns', 'Content Studio', 'System Health', 'Workflow Builder', 'Playbooks', 'Knowledge Base'],
    inputs: [
      'Task list',
      'Status counts',
      'Priorities',
      'Agent types',
      'Due dates',
      'Blockers',
      'Completed tasks',
      'Pending tasks',
      'Notes',
    ],
    outputs: [
      'Task performance summary',
      'Completed work',
      'Pending work',
      'Blockers',
      'High-priority tasks',
      'Delayed tasks',
      'Recommended task order',
      'Safe next actions',
      'Review checklist',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    suggested_prompt:
      'Act as a task performance reporting agent for my internal AI agency manager.\n\nAnalyze the provided task list, status counts, priorities, agent types, due dates, blockers, completed tasks, pending tasks, and notes.\n\nReturn the report in this structure:\n\n1. Task Performance Summary\n2. Completed Work\n3. Pending Work\n4. Blockers\n5. High-Priority Tasks\n6. Delayed Tasks\n7. Recommended Task Order\n8. Safe Next Actions\n9. Review Checklist\n\nKeep the report practical and short enough to act on today. Do not invent task data that was not provided.\nDo not run n8n, publish, schedule, spend money, change provider settings, delete data, contact clients, or execute external actions.',
    review_checklist: [
      'Task counts and statuses are summarized accurately.',
      'Completed and pending work are separated.',
      'Blockers are clear.',
      'High-priority and delayed tasks are identified.',
      'Recommended order is realistic.',
      'Safe next actions are manual and review-first.',
      'No task is executed automatically.',
      'No n8n execution, publishing, scheduling, spending, provider changes, deletion, client contact, or external action is triggered.',
    ],
  },
  {
    id: 'content-performance-agent',
    name: 'Content Performance Agent',
    category: 'Reports & Analytics',
    source_inspiration:
      'Inspired by content readiness audits, platform-fit reviews, creative quality checks, and repurposing strategy reports.',
    description:
      'Reviews content output quality, platform fit, readiness, missing pieces, and improvement opportunities before use.',
    recommended_for: ['Alex', 'Reports', 'Dashboard', 'Agent Library', 'Tasks', 'Campaigns', 'Content Studio', 'System Health', 'Workflow Builder', 'Playbooks', 'Knowledge Base'],
    inputs: [
      'Content items',
      'Platform',
      'Content type',
      'Captions',
      'Scripts',
      'Ad copy',
      'Creative briefs',
      'Quality review results',
      'Brand tone',
      'Notes',
    ],
    outputs: [
      'Content summary',
      'Quality observations',
      'Platform fit',
      'Missing elements',
      'Strongest content pieces',
      'Weak content pieces',
      'Suggested improvements',
      'Repurposing ideas',
      'Review checklist',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    suggested_prompt:
      'Act as a content performance reporting agent for my internal AI agency manager.\n\nReview the provided content items, platform, content type, captions, scripts, ad copy, creative briefs, quality review results, brand tone, and notes.\n\nReturn the report in this structure:\n\n1. Content Summary\n2. Quality Observations\n3. Platform Fit\n4. Missing Elements\n5. Strongest Content Pieces\n6. Weak Content Pieces\n7. Suggested Improvements\n8. Repurposing Ideas\n9. Review Checklist\n\nKeep recommendations practical and review-first. Do not claim real performance metrics unless they were provided.\nDo not run n8n, publish, schedule, spend money, change provider settings, delete data, contact clients, or execute external actions.',
    review_checklist: [
      'Content items are summarized without inventing performance data.',
      'Platform fit is explained.',
      'Missing elements are listed.',
      'Strong and weak pieces are identified constructively.',
      'Suggested improvements are safe drafts.',
      'Repurposing ideas do not schedule or publish content.',
      'Review checklist is actionable.',
      'No n8n execution, publishing, scheduling, spending, provider changes, deletion, client contact, or external action is triggered.',
    ],
  },
  {
    id: 'provider-health-report-agent',
    name: 'Provider Health Report Agent',
    category: 'Reports & Analytics',
    source_inspiration:
      'Inspired by system readiness dashboards, provider setup audits, deployment health checks, and blocker summaries.',
    description:
      'Summarizes provider readiness, blockers, setup requirements, approval status, and safe next actions for OpenAI, Google Ads, Meta, Pinterest, LinkedIn, n8n, Supabase, and Vercel.',
    recommended_for: ['Alex', 'Reports', 'Dashboard', 'Agent Library', 'Tasks', 'Campaigns', 'Content Studio', 'System Health', 'Workflow Builder', 'Playbooks', 'Knowledge Base'],
    inputs: [
      'Provider readiness data',
      'System health status',
      'Missing env warnings',
      'Approval status',
      'Setup requirements',
      'Last errors',
      'Notes',
    ],
    outputs: [
      'Provider health summary',
      'Ready providers',
      'Blocked providers',
      'Setup-required providers',
      'Approval-pending providers',
      'Risk notes',
      'Recommended safe fixes',
      'Deployment notes',
      'Review checklist',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    suggested_prompt:
      'Act as a provider health reporting agent for my internal AI agency manager.\n\nSummarize the provided provider readiness data, system health status, missing env warnings, approval status, setup requirements, last errors, and notes for OpenAI, Google Ads, Meta, Pinterest, LinkedIn, n8n, Supabase, and Vercel.\n\nReturn the report in this structure:\n\n1. Provider Health Summary\n2. Ready Providers\n3. Blocked Providers\n4. Setup-Required Providers\n5. Approval-Pending Providers\n6. Risk Notes\n7. Recommended Safe Fixes\n8. Deployment Notes\n9. Review Checklist\n\nUse safe summaries only. Do not include API keys, OAuth tokens, refresh tokens, webhook secrets, env values, or raw provider logs.\nDo not run n8n, publish, schedule, spend money, change provider settings, delete data, contact clients, or execute external actions.',
    review_checklist: [
      'Ready, blocked, setup-required, and approval-pending providers are separated.',
      'Risk notes avoid secrets and raw logs.',
      'Recommended fixes are safe and manual.',
      'Deployment notes do not change settings automatically.',
      'n8n is treated as a status/source only.',
      'No env values, tokens, webhook secrets, or private credentials are exposed.',
      'Review checklist is clear.',
      'No n8n execution, publishing, scheduling, spending, provider changes, deletion, client contact, or external action is triggered.',
    ],
  },
  {
    id: 'workflow-usage-report-agent',
    name: 'Workflow Usage Report Agent',
    category: 'Reports & Analytics',
    source_inspiration:
      'Inspired by workflow analytics, playbook usage summaries, template adoption reports, and automation improvement reviews.',
    description:
      'Analyzes workflow, playbook, automation blueprint, and template usage to identify useful workflows and safe improvements.',
    recommended_for: ['Alex', 'Reports', 'Dashboard', 'Agent Library', 'Tasks', 'Campaigns', 'Content Studio', 'System Health', 'Workflow Builder', 'Playbooks', 'Knowledge Base'],
    inputs: [
      'Workflow usage events',
      'Template usage analytics',
      'Saved playbooks',
      'Automation blueprints',
      'Created tasks from workflows',
      'Exported plans',
      'Notes',
    ],
    outputs: [
      'Workflow usage summary',
      'Most used workflows',
      'Most useful templates',
      'Underused workflows',
      'Repeated actions',
      'Improvement opportunities',
      'Recommended next playbooks',
      'Safe next actions',
      'Review checklist',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    suggested_prompt:
      'Act as a workflow usage reporting agent for my internal AI agency manager.\n\nAnalyze the provided workflow usage events, template usage analytics, saved playbooks, automation blueprints, created tasks from workflows, exported plans, and notes.\n\nReturn the report in this structure:\n\n1. Workflow Usage Summary\n2. Most Used Workflows\n3. Most Useful Templates\n4. Underused Workflows\n5. Repeated Actions\n6. Improvement Opportunities\n7. Recommended Next Playbooks\n8. Safe Next Actions\n9. Review Checklist\n\nKeep the report practical and focused on improving planning, templates, and review-first operations. Treat automation blueprints as planning artifacts only.\nDo not run n8n, publish, schedule, spend money, change provider settings, delete data, contact clients, or execute external actions.',
    review_checklist: [
      'Workflow usage summary is based only on provided data.',
      'Most used and underused workflows are clearly separated.',
      'Repeated actions are identified.',
      'Improvement opportunities are practical.',
      'Recommended playbooks remain draft-only.',
      'Automation blueprints are treated as planning-only.',
      'Safe next actions are review-first.',
      'No n8n execution, publishing, scheduling, spending, provider changes, deletion, client contact, or external action is triggered.',
    ],
  },

  // ── Alex Assistant Skills ────────────────────────────────────────────
  {
    id: 'daily-planning-agent',
    name: 'Daily Planning Agent',
    category: 'Alex Assistant Skills',
    source_inspiration:
      'Inspired by daily planning, productivity assistant, task prioritization, and AI operations assistant use cases.',
    description:
      'Creates a clear daily action plan for the agency operator by organizing tasks, priorities, blockers, follow-ups, content work, workflow work, and safe next actions.',
    recommended_for: ['Alex', 'Dashboard', 'Tasks', 'Calendar', 'Reports', 'Workflow Builder', 'Playbooks', 'System Health'],
    inputs: [
      'Today’s date',
      'Current tasks',
      'Pending tasks',
      'High-priority work',
      'Projects in progress',
      'Blockers',
      'Provider issues',
      'Content or campaign goals',
      'Meetings or reminders',
      'Available time',
      'Personal notes',
      'Preferred language',
    ],
    outputs: [
      'Daily summary',
      'Top priorities',
      'Time-blocked plan',
      'Task order',
      'Blockers to resolve',
      'Suggested safe actions',
      'Follow-up reminders',
      'Content/campaign focus',
      'Workflow focus',
      'End-of-day checklist',
      'Review checklist',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    suggested_prompt:
      'Act as my personal daily planning agent for my AI agency dashboard.\n\nCreate a clear daily plan using the provided tasks, projects, blockers, campaign goals, provider issues, calendar notes, and available time.\n\nReturn the result in this structure:\n\n1. Daily Summary\n2. Top 3 Priorities\n3. Recommended Task Order\n4. Time-Blocked Plan\n5. Blockers to Resolve\n6. Content or Campaign Focus\n7. Workflow / Automation Focus\n8. Follow-Up Reminders\n9. Safe Next Actions\n10. End-of-Day Checklist\n11. Final Review Checklist\n\nKeep the plan practical, short enough to follow, and focused on safe operator actions.\nDo not run n8n, execute tasks, publish, schedule, create live ads, spend money, delete data, or perform any external action automatically.',
    review_checklist: [
      'The daily priorities are clear.',
      'The task order is realistic.',
      'Blockers are clearly identified.',
      'The plan separates urgent work from optional work.',
      'The plan includes safe next actions only.',
      'Provider issues are listed as blockers, not automatically fixed.',
      'Content and workflow tasks are organized.',
      'The plan is easy to follow during the day.',
      'No n8n execution, publishing, scheduling, spending, deletion, or external provider action is triggered.',
    ],
  },
  {
    id: 'workflow-review-agent',
    name: 'Workflow Review Agent',
    category: 'Alex Assistant Skills',
    source_inspiration:
      'Inspired by workflow validation, multi-agent review, approval gates, readiness scoring, and safe automation review use cases.',
    description:
      'Reviews AgentFlow workflows before task creation, Content Studio handoff, n8n plan export, or playbook saving. It checks missing inputs, duplicate steps, risky actions, provider blockers, required approvals, readiness score, and safe next actions.',
    recommended_for: ['Alex', 'Workflow Builder', 'Workflow Review', 'Visual Workflow Diagrams', 'Saved Playbooks', 'Tasks', 'n8n Workflow Plans', 'Reports', 'System Health'],
    inputs: [
      'Workflow name',
      'Workflow goal',
      'Selected templates',
      'Workflow steps',
      'Step order',
      'Required inputs',
      'Expected outputs',
      'User notes',
      'Provider requirements',
      'Approval requirements',
      'Safety constraints',
      'Execution mode',
      'Missing context if known',
    ],
    outputs: [
      'Workflow review summary',
      'Readiness score',
      'Overall status',
      'Missing inputs',
      'Duplicate or weak steps',
      'Risk warnings',
      'Provider blockers',
      'Required approvals',
      'Recommended fixes',
      'Safe next actions',
      'Task creation readiness',
      'n8n planning readiness',
      'Final review checklist',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    suggested_prompt:
      'Act as a senior workflow review agent for my AgentFlow AI agency dashboard.\n\nReview the provided workflow name, goal, selected agent templates, workflow steps, required inputs, expected outputs, provider requirements, approval requirements, user notes, and safety constraints.\n\nReturn the result in this structure:\n\n1. Workflow Review Summary\n2. Overall Status\n3. Readiness Score\n4. Missing Inputs\n5. Duplicate or Weak Steps\n6. Risk Warnings\n7. Provider Blockers\n8. Required Approvals\n9. Recommended Fixes\n10. Safe Next Actions\n11. Task Creation Readiness\n12. n8n Planning Readiness\n13. Final Review Checklist\n\nUse these statuses:\n- ready\n- needs_inputs\n- review_required\n- blocked\n\nKeep the review practical, clear, and safety-focused.\nDo not run n8n, create workflows, change webhooks, execute tasks, publish, schedule, create live ads, spend money, delete data, perform GitHub writes, or execute any external action.',
    review_checklist: [
      'The workflow goal is clear.',
      'The selected templates match the workflow goal.',
      'The step order is logical.',
      'Missing inputs are listed clearly.',
      'Duplicate or weak steps are detected.',
      'Risk warnings are explained.',
      'Provider blockers are listed as blockers, not automatically fixed.',
      'Required approvals are clear.',
      'Recommended fixes are practical.',
      'Safe next actions do not execute anything automatically.',
      'Task creation readiness only means pending task creation.',
      'n8n planning readiness only means blueprint/export readiness.',
      'No n8n execution, publishing, scheduling, spending, deletion, GitHub write, webhook change, or external provider action is triggered.',
    ],
  },
  {
    id: 'context-aware-task-delegation',
    name: 'Context-Aware Task Delegation',
    category: 'Alex Assistant Skills',
    source_inspiration:
      'Adapted from meta-cognition agents that evaluate task requirements and route work to the best-fit agent or human.',
    description:
      'Analyses an incoming task description, extracts capability requirements, and recommends which agent or team member should handle it based on workload, expertise, and availability.',
    recommended_for: ['Task routing', 'Workload management', 'Alex assistant enhancement'],
    inputs: ['Task description', 'Available agents / team members', 'Current workload data', 'Capability matrix'],
    outputs: ['Recommended assignee', 'Rationale with fit score', 'Estimated effort', 'Suggested task breakdown'],
    safety_level: 'safe',
    execution_mode: 'autonomous',
    suggested_prompt:
      'Analyse this task: [description]. Available: [agents/team]. Current workloads: [data]. Recommend the best assignee with fit score, effort estimate, and a suggested task breakdown.',
    review_checklist: [
      'Confirm assignee availability before dispatching',
      'Review effort estimate against past similar tasks',
      'Adjust capability matrix as agents change',
    ],
  },
  {
    id: 'daily-briefing-generator',
    name: 'Daily Briefing Generator',
    category: 'Alex Assistant Skills',
    source_inspiration:
      'Derived from executive-summary agents that consolidate notifications, task updates, and system health into a single briefing.',
    description:
      'Produces a daily operations briefing from connected data sources: overdue tasks, recent completions, campaign status, system health, and flagged items.',
    recommended_for: ['Daily stand-ups', 'Operations review', 'Alex morning briefing'],
    inputs: ['Connected data sources (tasks, campaigns, health)', 'User role / focus area', 'Briefing date'],
    outputs: ['Executive summary (3–5 bullets)', 'Section: tasks overdue / at risk', 'Section: recent completions', 'Section: system health', 'Section: flagged items'],
    safety_level: 'safe',
    execution_mode: 'autonomous',
    suggested_prompt:
      'Generate today\'s operations briefing. Sources: tasks, campaigns, system health. Include: overdue items, completions since yesterday, campaign status, health flags, and 3 recommended focus areas.',
    review_checklist: [
      'Verify data freshness before distributing',
      'Remove stale or irrelevant notifications',
      'Ensure no sensitive data in shared briefing',
    ],
  },
  {
    id: 'cross-project-dependency-mapper',
    name: 'Cross-Project Dependency Mapper',
    category: 'Alex Assistant Skills',
    source_inspiration:
      'Based on project-graph agents that detect and visualise dependencies across multiple active projects.',
    description:
      'Analyses active projects, releases, and tasks to identify cross-project dependencies, shared resources, blocking chains, and scheduling conflicts.',
    recommended_for: ['Program management', 'Release coordination', 'Resource planning'],
    inputs: ['Active project list', 'Release timelines', 'Task assignments', 'Resource pool'],
    outputs: ['Dependency graph (text or visualisable)', 'Blocking chain analysis', 'Shared resource conflicts', 'Recommended sequencing adjustments'],
    safety_level: 'safe',
    execution_mode: 'supervised',
    suggested_prompt:
      'Analyse these active projects: [list]. Identify cross-project dependencies, blocking chains, shared resource conflicts, and recommend sequencing adjustments.',
    review_checklist: [
      'Validate dependencies with project leads',
      'Review resource conflict resolution',
      'Update dependency graph as timelines shift',
    ],
  },

  // ── Developer / Code Agents ─────────────────────────────────────────
  {
    id: 'code-review-agent',
    name: 'Code Review Agent',
    category: 'Developer/Code Agents',
    source_inspiration:
      'Inspired by code review, debugging, software quality analysis, pull request review, and AI developer assistant use cases.',
    description:
      'Reviews code changes, files, features, or implementation plans to identify bugs, TypeScript issues, security risks, performance problems, UX issues, missing tests, and safe improvement recommendations.',
    recommended_for: ['Alex', 'Safe Patch Planner', 'Code Fix Proposals', 'Reports', 'Workflow Builder', 'Tasks', 'Playbooks', 'Developer Tools'],
    inputs: [
      'Feature or bug description',
      'Changed files',
      'Code snippet or diff',
      'Expected behavior',
      'Current behavior',
      'Error message if available',
      'Framework or stack context',
      'Security concerns',
      'Performance concerns',
      'Testing notes',
      'Deployment target',
      'Review scope',
    ],
    outputs: [
      'Code review summary',
      'Issues found',
      'Risk level',
      'Affected files',
      'TypeScript or lint concerns',
      'Security notes',
      'Performance notes',
      'UX notes',
      'Suggested fixes',
      'Testing checklist',
      'Deployment checklist',
      'Final review checklist',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    suggested_prompt:
      'Act as a senior code review agent for my AgentFlow AI project.\n\nReview the provided feature, code snippet, changed files, diff, bug description, expected behavior, current behavior, error message, stack context, and testing notes.\n\nReturn the result in this structure:\n\n1. Code Review Summary\n2. Files or Areas Reviewed\n3. Issues Found\n4. Risk Level\n5. TypeScript / Lint Concerns\n6. Security Notes\n7. Performance Notes\n8. UX / Product Notes\n9. Suggested Fixes\n10. Testing Checklist\n11. Deployment Checklist\n12. Final Review Checklist\n\nKeep the review practical, specific, and safe.\nDo not modify files, commit code, push code, open pull requests, run n8n, publish, schedule, create live ads, spend money, delete data, or execute any external action.',
    review_checklist: [
      'The reviewed scope is clear.',
      'Issues are specific and actionable.',
      'Risk level is explained.',
      'Affected files or areas are listed.',
      'TypeScript and lint concerns are checked.',
      'Security risks are clearly separated from normal bugs.',
      'Performance concerns are included if relevant.',
      'Suggested fixes are safe and practical.',
      'Testing checklist is included.',
      'Deployment checklist is included.',
      'No GitHub write, file modification, n8n execution, publishing, scheduling, spending, deletion, or external provider action is triggered.',
    ],
  },
  {
    id: 'pr-review-checklist-generator',
    name: 'PR Review Checklist Generator',
    category: 'Developer/Code Agents',
    source_inspiration:
      'Inspired by code-review agents that produce custom checklists based on repo conventions, language patterns, and PR diff analysis.',
    description:
      'Analyses a pull request diff and generates a tailored review checklist covering security, performance, style, test coverage, and domain-specific concerns.',
    recommended_for: ['Code review', 'Team PR standards', 'Onboarding reviewers'],
    inputs: ['PR diff or branch name', 'Repository context (language, framework)', 'Team conventions file (optional)'],
    outputs: ['Categorised review checklist', 'Security-specific items', 'Performance notes', 'Test coverage gaps', 'Style / convention flags'],
    safety_level: 'safe',
    execution_mode: 'supervised',
    suggested_prompt:
      'Analyse this PR: [diff/url]. Repo uses [language/framework]. Generate a review checklist covering: security, performance, code style, test coverage, and domain logic. Flag any potential issues.',
    review_checklist: [
      'Do not auto-approve based on checklist alone',
      'Verify flagged issues manually',
      'Update checklist rules as team conventions evolve',
      'Keep reviewed checklist attached to PR',
    ],
  },
  {
    id: 'api-integration-scaffolder',
    name: 'API Integration Scaffolder',
    category: 'Developer/Code Agents',
    source_inspiration:
      'Based on API-client generator agents that produce typed integration code from API specs or documentation.',
    description:
      'Generates a scaffold for integrating with an external API: typed client, request builders, response parsers, error handling, and basic tests.',
    recommended_for: ['Backend development', 'Third-party integrations', 'Rapid prototyping'],
    inputs: ['API base URL', 'Auth method (API key / OAuth / none)', 'Endpoints to integrate (3–10)', 'Target language / framework'],
    outputs: ['Typed API client module', 'Request/response types', 'Error handling wrapper', 'Example usage', 'Basic integration tests'],
    safety_level: 'safe',
    execution_mode: 'supervised',
    suggested_prompt:
      'Scaffold an API client for [base URL] with [auth]. Endpoints: [list]. Language: [language/framework]. Include typed request/response types, error handling, and basic tests.',
    review_checklist: [
      'Verify endpoint paths and methods are correct',
      'Test auth flow end-to-end before merging',
      'Review error handling for all HTTP status ranges',
      'Do not commit real API keys',
    ],
  },
  {
    id: 'database-migration-planner',
    name: 'Database Migration Planner',
    category: 'Developer/Code Agents',
    source_inspiration:
      'Adapted from schema-migration agents that generate safe migration scripts from schema change descriptions.',
    description:
      'Generates a migration plan from a description of schema changes. Includes up/down SQL scripts, data backfill considerations, rollback steps, and a safety checklist.',
    recommended_for: ['Database changes', 'Schema evolution', 'Release preparation'],
    inputs: ['Current schema description', 'Desired schema changes', 'Database type (PostgreSQL / MySQL)', 'Existing data notes'],
    outputs: ['Up migration SQL', 'Down (rollback) migration SQL', 'Data backfill notes', 'Rollback procedure', 'Safety checklist'],
    safety_level: 'requires_review',
    execution_mode: 'supervised',
    suggested_prompt:
      'Plan a migration from [current schema] to [new schema] on [db type]. Existing data: [notes]. Generate up/down SQL, backfill guidance, rollback steps, and a safety checklist.',
    review_checklist: [
      'Review SQL in a staging environment first',
      'Test rollback procedure before production',
      'Verify data integrity after migration',
      'Schedule during low-traffic window',
      'Keep a database backup before applying',
    ],
  },
  {
    id: 'bug-diagnosis-agent',
    name: 'Bug Diagnosis Agent',
    category: 'Developer/Code Agents',
    source_inspiration:
      'Inspired by production debugging, failed build triage, runtime exception analysis, API diagnostics, and safe incident investigation workflows.',
    description:
      'Analyzes errors, failed builds, broken UI behavior, TypeScript issues, runtime exceptions, API failures, and deployment problems before any code changes.',
    recommended_for: ['Alex', 'Agent Library', 'Safe Patch Planner', 'Code Fix Proposals', 'Reports', 'Tasks', 'Workflow Builder', 'Playbooks', 'Knowledge Base', 'Releases'],
    inputs: [
      'Error message',
      'Screenshot description',
      'Affected page/route',
      'Recent changes',
      'Expected behavior',
      'Current behavior',
      'Logs if safe',
      'Stack trace if safe',
      'Environment: local / preview / production',
      'Related files if known',
    ],
    outputs: [
      'Bug summary',
      'Likely causes',
      'Affected areas',
      'Reproduction steps',
      'Risk level',
      'Suggested investigation steps',
      'Suggested fix plan',
      'Testing checklist',
      'Safe next actions',
      'Review checklist',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    suggested_prompt:
      'Act as a senior bug diagnosis agent for my AgentFlow AI project.\n\nAnalyze the provided error message, screenshot description, affected page or route, recent changes, expected behavior, current behavior, safe logs, safe stack trace, environment, and related files.\n\nReturn the result in this structure:\n\n1. Bug Summary\n2. Likely Causes\n3. Affected Areas\n4. Reproduction Steps\n5. Risk Level\n6. Suggested Investigation Steps\n7. Suggested Fix Plan\n8. Testing Checklist\n9. Verification Commands\n10. Safe Next Actions\n11. Review Checklist\n\nFor verification commands, include these when relevant:\n- npm run lint\n- npx tsc --noEmit\n- npm run build\n\nUse safe summaries of logs only. Do not ask for .env files, tokens, API keys, OAuth secrets, webhook secrets, or private credentials.\nDo not edit files, commit, push, open PRs, delete data, run n8n, change providers, expose secrets, or execute external actions.',
    review_checklist: [
      'The bug summary is specific.',
      'Likely causes are separated from confirmed facts.',
      'Affected route, feature, or files are listed when known.',
      'Reproduction steps are practical.',
      'Risk level is explained.',
      'Investigation steps are safe and read-only.',
      'Suggested fix plan is review-first.',
      'Testing checklist includes lint, typecheck, and build where relevant.',
      'No secrets, raw private logs, env values, tokens, or credentials are included.',
      'No file edits, commits, pushes, PRs, destructive commands, n8n execution, provider changes, deletion, or external actions are triggered.',
    ],
  },
  {
    id: 'patch-planner-agent',
    name: 'Patch Planner Agent',
    category: 'Developer/Code Agents',
    source_inspiration:
      'Inspired by safe patch planning, implementation scoping, code fix proposals, rollback planning, and review-first engineering workflows.',
    description:
      'Turns a bug, feature request, or review finding into a safe implementation plan before code changes.',
    recommended_for: ['Alex', 'Agent Library', 'Safe Patch Planner', 'Code Fix Proposals', 'Reports', 'Tasks', 'Workflow Builder', 'Playbooks', 'Knowledge Base', 'Releases'],
    inputs: [
      'Problem description',
      'Goal',
      'Affected files',
      'Current behavior',
      'Desired behavior',
      'Constraints',
      'Safety rules',
      'Testing requirements',
      'Deployment target',
    ],
    outputs: [
      'Patch summary',
      'Files likely to change',
      'Step-by-step implementation plan',
      'Risk notes',
      'Rollback notes',
      'Testing checklist',
      'Verification commands',
      'Deployment notes',
      'Review checklist',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    suggested_prompt:
      'Act as a senior safe patch planner for my AgentFlow AI project.\n\nTurn the provided problem description, goal, affected files, current behavior, desired behavior, constraints, safety rules, testing requirements, and deployment target into a review-first implementation plan.\n\nReturn the result in this structure:\n\n1. Patch Summary\n2. Files Likely to Change\n3. Step-by-Step Implementation Plan\n4. Risk Notes\n5. Rollback Notes\n6. Testing Checklist\n7. Verification Commands\n8. Deployment Notes\n9. Review Checklist\n\nInclude these verification commands exactly when relevant:\n- npm run lint\n- npx tsc --noEmit\n- npm run build\n\nKeep deployment commands as planning notes only. Do not ask for full .env files or private credentials.\nDo not edit files, commit, push, open PRs, delete data, run n8n, change providers, expose secrets, or execute external actions.',
    review_checklist: [
      'Patch summary matches the stated goal.',
      'Likely changed files are scoped and justified.',
      'Implementation plan is step-by-step.',
      'Constraints and safety rules are preserved.',
      'Risk notes include impacted systems.',
      'Rollback notes are realistic.',
      'Verification commands include lint, typecheck, and build where relevant.',
      'Deployment notes are planning-only.',
      'No secrets, env values, tokens, webhook secrets, or credentials are requested.',
      'No file edits, commits, pushes, PRs, destructive commands, n8n execution, provider changes, deletion, or external actions are triggered.',
    ],
  },
  {
    id: 'release-notes-agent',
    name: 'Release Notes Agent',
    category: 'Developer/Code Agents',
    source_inspiration:
      'Inspired by release management assistants, changelog writers, deployment summaries, and internal engineering update workflows.',
    description:
      'Creates clean release notes from changed files, completed phases, fixes, features, UI changes, migrations, verification results, and safety notes.',
    recommended_for: ['Alex', 'Agent Library', 'Safe Patch Planner', 'Code Fix Proposals', 'Reports', 'Tasks', 'Workflow Builder', 'Playbooks', 'Knowledge Base', 'Releases'],
    inputs: [
      'Changed files',
      'Feature summary',
      'Bug fixes',
      'UI changes',
      'Migrations',
      'Verification results',
      'Deployment URL if available',
      'Known warnings',
      'Version/date',
    ],
    outputs: [
      'Release summary',
      'New features',
      'Improvements',
      'Bug fixes',
      'Safety notes',
      'Migrations',
      'Verification results',
      'Deployment notes',
      'Known issues',
      'Next steps',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    suggested_prompt:
      'Act as a release notes agent for my AgentFlow AI project.\n\nCreate clean internal release notes from the provided changed files, feature summary, bug fixes, UI changes, migrations, verification results, deployment URL if available, known warnings, and version/date.\n\nReturn the release notes in this structure:\n\n1. Release Summary\n2. New Features\n3. Improvements\n4. Bug Fixes\n5. Safety Notes\n6. Migrations\n7. Verification Results\n8. Deployment Notes\n9. Known Issues\n10. Next Steps\n\nWhen verification is missing, list these commands as unchecked items:\n- npm run lint\n- npx tsc --noEmit\n- npm run build\n\nKeep the notes factual and do not invent commits, URLs, migrations, or test results.\nDo not edit files, commit, push, open PRs, delete data, run n8n, change providers, expose secrets, or execute external actions.',
    review_checklist: [
      'Release summary is concise.',
      'Features, improvements, and bug fixes are separated.',
      'Safety notes call out protected systems.',
      'Migrations are listed only if provided.',
      'Verification results are factual.',
      'Known warnings are preserved.',
      'Deployment notes do not execute deployment.',
      'Next steps are safe and manual.',
      'No secrets, env values, tokens, webhook secrets, or credentials are included.',
      'No file edits, commits, pushes, PRs, destructive commands, n8n execution, provider changes, deletion, or external actions are triggered.',
    ],
  },
  {
    id: 'deployment-review-agent',
    name: 'Deployment Review Agent',
    category: 'Developer/Code Agents',
    source_inspiration:
      'Inspired by Vercel deployment readiness reviews, release gates, pre-flight checklists, provider guardrails, and rollback planning.',
    description:
      'Reviews whether the project is ready for deployment by checking build status, migrations, env safety, provider guardrails, and deployment risks.',
    recommended_for: ['Alex', 'Agent Library', 'Safe Patch Planner', 'Code Fix Proposals', 'Reports', 'Tasks', 'Workflow Builder', 'Playbooks', 'Knowledge Base', 'Releases'],
    inputs: [
      'git status summary',
      'changed files',
      'migrations',
      'lint result',
      'TypeScript result',
      'build result',
      'Vercel deployment plan',
      'env/provider notes',
      'known warnings',
    ],
    outputs: [
      'Deployment readiness summary',
      'Ready / blocked status',
      'Required pre-deploy actions',
      'Migration checklist',
      'Env safety checklist',
      'Provider safety notes',
      'Build verification checklist',
      'Deployment command plan',
      'Rollback notes',
      'Final approval checklist',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    suggested_prompt:
      'Act as a deployment review agent for my AgentFlow AI project on Vercel.\n\nReview the provided git status summary, changed files, migrations, lint result, TypeScript result, build result, Vercel deployment plan, env/provider notes, and known warnings.\n\nReturn the result in this structure:\n\n1. Deployment Readiness Summary\n2. Ready / Blocked Status\n3. Required Pre-Deploy Actions\n4. Migration Checklist\n5. Env Safety Checklist\n6. Provider Safety Notes\n7. Build Verification Checklist\n8. Deployment Command Plan\n9. Rollback Notes\n10. Final Approval Checklist\n\nInclude these verification commands exactly:\n- npm run lint\n- npx tsc --noEmit\n- npm run build\n\nKeep deployment commands as review/planning only. Never include real env values or secrets; use placeholders and safe summaries only.\nDo not edit files, commit, push, open PRs, delete data, run n8n, change providers, expose secrets, or execute external actions.',
    review_checklist: [
      'Ready/blocked status is explicit.',
      'Pre-deploy actions are clear.',
      'Migration checklist is included when migrations exist.',
      'Env safety checklist avoids exposing values.',
      'Provider safety notes preserve existing guardrails.',
      'Build verification checklist includes lint, typecheck, and build.',
      'Deployment command plan is planning-only.',
      'Rollback notes are practical.',
      'No secrets, env values, tokens, webhook secrets, or credentials are included.',
      'No file edits, commits, pushes, PRs, destructive commands, n8n execution, provider changes, deletion, or external actions are triggered.',
    ],
  },
  {
    id: 'supabase-migration-review-agent',
    name: 'Supabase Migration Review Agent',
    category: 'Developer/Code Agents',
    source_inspiration:
      'Inspired by Supabase schema reviews, PostgreSQL migration audits, RLS policy checks, index reviews, and production database readiness gates.',
    description:
      'Reviews Supabase migrations for safety, RLS, indexes, table changes, rollback risk, and production readiness.',
    recommended_for: ['Alex', 'Agent Library', 'Safe Patch Planner', 'Code Fix Proposals', 'Reports', 'Tasks', 'Workflow Builder', 'Playbooks', 'Knowledge Base', 'Releases'],
    inputs: [
      'Migration file name',
      'SQL content',
      'Tables affected',
      'RLS policies',
      'Indexes',
      'Existing schema context',
      'Data migration risk',
      'Deployment plan',
    ],
    outputs: [
      'Migration summary',
      'Tables affected',
      'RLS review',
      'Index review',
      'Data safety notes',
      'Breaking change risks',
      'Apply order',
      'Rollback considerations',
      'Testing checklist',
      'Production readiness checklist',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    suggested_prompt:
      'Act as a Supabase migration review agent for my AgentFlow AI project.\n\nReview the provided migration file name, SQL content, tables affected, RLS policies, indexes, existing schema context, data migration risk, and deployment plan.\n\nReturn the result in this structure:\n\n1. Migration Summary\n2. Tables Affected\n3. RLS Review\n4. Index Review\n5. Data Safety Notes\n6. Breaking Change Risks\n7. Apply Order\n8. Rollback Considerations\n9. Testing Checklist\n10. Production Readiness Checklist\n\nFor app verification after migration review, include these commands when relevant:\n- npm run lint\n- npx tsc --noEmit\n- npm run build\n\nUse safe summaries only. Do not ask for Supabase service role keys, connection strings, JWT secrets, full .env files, or private credentials.\nDo not edit files, commit, push, open PRs, delete data, run n8n, change providers, expose secrets, or execute external actions.',
    review_checklist: [
      'Migration purpose is clear.',
      'Affected tables are listed.',
      'RLS policies are reviewed for least privilege.',
      'Indexes are checked for query and write impact.',
      'Data safety notes include nullable/default/backfill concerns.',
      'Breaking change risks are identified.',
      'Apply order is explicit.',
      'Rollback considerations are honest about irreversible changes.',
      'Testing and production readiness checklists are included.',
      'No secrets, env values, tokens, service role keys, connection strings, webhook secrets, or credentials are included.',
      'No file edits, commits, pushes, PRs, destructive commands, n8n execution, provider changes, deletion, or external actions are triggered.',
    ],
  },

  // ── n8n Workflow Ideas ───────────────────────────────────────────────
  {
    id: 'n8n-workflow-planner-agent',
    name: 'n8n Workflow Planner Agent',
    category: 'n8n Workflow Ideas',
    source_inspiration:
      'Inspired by automation workflow planning, webhook orchestration, tool-calling, callback design, and AI agent workflow use cases.',
    description:
      'Creates a safe n8n workflow blueprint from an automation idea, including trigger, nodes, payload validation, prompt preparation, result normalization, callback structure, error handling, and testing checklist.',
    recommended_for: ['Alex', 'Workflow Builder', 'n8n Workflow Plans', 'Tasks', 'Playbooks', 'System Health', 'Developer Tools'],
    inputs: [
      'Workflow goal',
      'Trigger type',
      'Input payload',
      'Required data fields',
      'AgentFlow task context',
      'Expected output',
      'Callback requirements',
      'Provider requirements',
      'Error handling needs',
      'Approval requirements',
      'Testing environment',
      'Notes or constraints',
    ],
    outputs: [
      'Workflow overview',
      'Recommended trigger',
      'Suggested n8n nodes',
      'Step-by-step workflow',
      'Data mapping',
      'Payload validation plan',
      'Prompt preparation plan',
      'Result normalization plan',
      'Callback payload example',
      'Error handling plan',
      'Testing checklist',
      'Safety rules',
      'Deployment notes',
    ],
    safety_level: 'safe',
    execution_mode: 'draft_only',
    suggested_prompt:
      'Act as a senior n8n workflow planner for my AgentFlow AI agency dashboard.\n\nCreate a safe n8n workflow blueprint using the provided workflow goal, trigger, input payload, expected output, provider requirements, callback requirements, and safety constraints.\n\nReturn the result in this structure:\n\n1. Workflow Overview\n2. Recommended Trigger\n3. Required Inputs\n4. Suggested n8n Nodes\n5. Step-by-Step Workflow\n6. Data Mapping\n7. Payload Validation Plan\n8. Prompt Preparation Plan\n9. Result Normalization Plan\n10. Callback Payload Example\n11. Error Handling Plan\n12. Testing Checklist\n13. Safety Rules\n14. Deployment Notes\n15. Final Review Checklist\n\nUse placeholder values only for secrets, credentials, webhook URLs, and environment variables.\nDo not run n8n, create workflows through API, change webhooks, publish, schedule, create live ads, spend money, delete data, or execute any external action.',
    review_checklist: [
      'The workflow goal is clear.',
      'The trigger is appropriate.',
      'Required inputs are listed.',
      'Suggested nodes are realistic for n8n.',
      'Data mapping is understandable.',
      'Payload validation is included.',
      'Callback payload example is safe and does not contain secrets.',
      'Error handling is included.',
      'Testing checklist is practical.',
      'Safety rules are explicit.',
      'The plan is clearly marked as draft-only.',
      'No n8n execution, webhook change, publishing, scheduling, spending, deletion, or external provider action is triggered.',
    ],
  },
  {
    id: 'lead-capture-enrichment-workflow',
    name: 'Lead Capture & Enrichment Workflow',
    category: 'n8n Workflow Ideas',
    source_inspiration:
      'Inspired by common n8n marketing automation patterns — webhook capture, enrichment API calls, and CRM insertion.',
    description:
      'Reference plan for an n8n workflow that captures leads from a webhook, enriches and scores them, then prepares a CRM or sheet handoff after manual setup.',
    recommended_for: ['Marketing automation', 'Lead processing', 'Sales ops automation'],
    inputs: ['Webhook endpoint', 'Enrichment API key', 'CRM / Sheet destination', 'Scoring rules'],
    outputs: ['Reference workflow blueprint', 'Node-by-node explanation', 'Error handling notes', 'Webhook test payload'],
    safety_level: 'safe',
    execution_mode: 'manual',
    suggested_prompt:
      'Design an n8n workflow: webhook receives lead data, pass through enrichment API (Clearbit / Hunter), score by [rules], insert into [destination]. Include error handling and a test payload.',
    review_checklist: [
      'Mask enrichment API keys in n8n credentials',
      'Test with sample payload before activating webhook',
      'Set rate-limit handling on enrichment node',
    ],
  },
  {
    id: 'content-publishing-pipeline-workflow',
    name: 'Content Publishing Pipeline Workflow',
    category: 'n8n Workflow Ideas',
    source_inspiration:
      'Based on multi-platform publishing workflows — draft capture, platform formatting, scheduled posting, and confirmation logging.',
    description:
      'Reference plan for an n8n pipeline that accepts a content draft, formats it for selected platforms, keeps posting/scheduling manual, and logs draft handoff results.',
    recommended_for: ['Content automation', 'Cross-posting', 'Scheduled publishing'],
    inputs: ['Content draft (text + media URLs)', 'Platform selection', 'API credentials for each platform', 'Posting schedule (now / scheduled)'],
    outputs: ['Reference workflow blueprint', 'Formatting rules per platform', 'API auth setup notes', 'Draft handoff log schema'],
    safety_level: 'requires_review',
    execution_mode: 'manual',
    suggested_prompt:
      'Design an n8n pipeline: accept a content draft, format for [platforms], post or schedule via each platform\'s API, log results to a sheet. Include retry logic.',
    review_checklist: [
      'Start with draft-only mode before live posting',
      'Verify API rate limits per platform',
      'Test formatting output for each platform',
      'Keep API tokens in n8n credential store',
    ],
  },
  {
    id: 'monitoring-alerting-workflow',
    name: 'Monitoring & Alerting Workflow',
    category: 'n8n Workflow Ideas',
    source_inspiration:
      'Adapted from observability workflows — health-check polling, metric aggregation, and multi-channel alert dispatch.',
    description:
      'Reference plan for an n8n monitoring workflow that checks health endpoints, compares thresholds, and prepares alert routing after manual setup.',
    recommended_for: ['System monitoring', 'DevOps automation', 'Incident response'],
    inputs: ['Health check endpoints (HTTP)', 'Threshold rules', 'Alert channels (Slack / email / Telegram)', 'Check interval'],
    outputs: ['Reference workflow blueprint', 'Threshold config template', 'Alert message templates', 'Escalation rules'],
    safety_level: 'safe',
    execution_mode: 'manual',
    suggested_prompt:
      'Design an n8n monitoring workflow: every [interval] check [endpoints], compare against [thresholds], send alerts to [channels] on breach. Include escalation if no response.',
    review_checklist: [
      'Set realistic thresholds to avoid alert fatigue',
      'Test alert delivery to each channel',
      'Add debounce to prevent repeated alerts',
      'Document escalation contacts',
    ],
  },
];

const recommendationKeywords: Array<{
  pattern: RegExp;
  categories?: TemplateCategory[];
  ids?: string[];
}> = [
  { pattern: /campaign|content|social|social media|growth|seo|newsletter|hook|ads?|ad copy|copywriting|headlines?|google ads|meta ads|facebook ads|linkedin ads|tiktok ads|creative brief|design brief|creative assets|visual concept|design|campaign creative|brand style|marketing|strategy|instagram|reels?|posts?|captions?|اعلان|إعلان|إعلانات|محتوى|حملة|نسخ|كتابة إعلانية|موجز إبداعي|تصميم|أصول إبداعية|مفهوم بصري|هوية|انستغرام|إنستغرام|ريلز|réseaux|contenu|campagne|publicit|rédaction|titres|brief créatif|design|concept visuel|style de marque/i, categories: ['Content & Growth'], ids: ['marketing-strategy-agent', 'instagram-content-agent', 'ad-copy-agent', 'creative-brief-agent', 'social-media-content-calendar', 'seo-content-cluster-planner', 'newsletter-campaign-builder', 'viral-content-hook-generator'] },
  { pattern: /market research|competitor analysis|competition|research|audience|niche|competitors?|positioning|market gaps?|differentiation|strengths?|weaknesses?|pain points?|opportunities|strategy|market|competitor|persona|swot|بحث|استراتيجية|تحليل|سوق|جمهور|منافس|منافسين|تموضع|فجوات السوق|تمييز|نقاط القوة|نقاط الضعف|فرص|نقاط الألم|marché|stratégie|concurrent|concurrence|positionnement|différenciation|forces|faiblesses|recherche|audience|opportunités/i, categories: ['Research & Strategy'], ids: ['market-research-agent', 'competitor-analysis-agent', 'competitive-landscape-analysis', 'audience-persona-builder', 'swot-analysis-generator'] },
  { pattern: /lead score|lead scoring|score lead|lead|عميل محتمل|prospect/i, categories: ['Sales & Operations'], ids: ['lead-score-agent', 'crm-enrichment-scoring'] },
  { pattern: /follow[- ]?up|email|message|رسالة للعميل|متابعة|واتساب|whatsapp|dm/i, categories: ['Sales & Operations'], ids: ['follow-up-email-agent', 'sales-outreach-sequence'] },
  { pattern: /proposal|service proposal|عرض خدمة|عرض للعميل|devis|proposition/i, categories: ['Sales & Operations'], ids: ['client-proposal-agent'] },
  { pattern: /onboarding|new client|client onboarding|عميل جديد|زبون جديد|بداية مشروع|kickoff/i, categories: ['Sales & Operations'], ids: ['client-onboarding-agent', 'meeting-prep-agent'] },
  { pattern: /meeting|call|agenda|اجتماع|مكالمة|réunion/i, categories: ['Sales & Operations'], ids: ['meeting-prep-agent', 'follow-up-email-agent'] },
  { pattern: /sales|operation|crm|lead|outreach|sop|مبيعات|عمليات|prospect|vente|opérations/i, categories: ['Sales & Operations'], ids: ['lead-score-agent', 'follow-up-email-agent', 'client-proposal-agent', 'client-onboarding-agent', 'meeting-prep-agent'] },
  { pattern: /campaign report|تقرير حملة|حالة الحملة|campaign status|rapport campagne/i, categories: ['Reports & Analytics'], ids: ['campaign-report-agent'] },
  { pattern: /tasks? report|task performance|تقرير المهام|شنو باقي فالمهام|remaining tasks|rapport tâches/i, categories: ['Reports & Analytics'], ids: ['task-performance-agent'] },
  { pattern: /content report|content performance|تقرير المحتوى|راجع المحتوى|rapport contenu/i, categories: ['Reports & Analytics'], ids: ['content-performance-agent'] },
  { pattern: /provider health|system health|blockers|google ads status|openai status|صحة النظام|حالة Google Ads|حالة OpenAI|bloqueurs|santé système/i, categories: ['Reports & Analytics'], ids: ['provider-health-report-agent'] },
  { pattern: /workflow usage|playbooks?|template analytics|شنو أكثر workflow كنستعمل|workflow analytics|usage workflow/i, categories: ['Reports & Analytics'], ids: ['workflow-usage-report-agent'] },
  { pattern: /reports?|rapport|تقرير|تقارير|لخص|summary|summarize|analytics|تحليلات|ملخص/i, categories: ['Reports & Analytics'], ids: ['task-performance-agent', 'campaign-report-agent', 'content-performance-agent', 'provider-health-report-agent', 'workflow-usage-report-agent'] },
  { pattern: /alex|assistant|brief|dependency|delegate|task|daily|planning|today|priorities|schedule|blockers|operator|workflow review|review workflow|readiness|approval|missing inputs?|risks?|safe next actions?|workflow validation|approval gate|safe workflow|what should i do today|plan my day|راجع ليا هاد workflow|واش هاد workflow آمن|شوف واش خاص شي inputs|شنو خاصني ندير اليوم|إجراءات اليوم|خطط ليا نهاري|مهام|مهمة|مساعد|اليوم|أولويات|خطة|خطط|عراقيل|موافقات|مدخلات ناقصة|briefing|délég|quotidien|priorités|blocages|validation workflow/i, categories: ['Alex Assistant Skills'], ids: ['workflow-review-agent', 'daily-planning-agent', 'daily-briefing-generator', 'context-aware-task-delegation', 'cross-project-dependency-mapper'] },
  { pattern: /bug|error|مشكل|غلط|typescript error|runtime error|build failed|failed build|deployment failed|exception|api failure|عندي bug|شنو المشكل فهاد error|خطأ|مشكلة|débog|erreur/i, categories: ['Developer/Code Agents'], ids: ['bug-diagnosis-agent', 'patch-planner-agent', 'code-review-agent'] },
  { pattern: /patch|fix plan|خطة إصلاح|implementation plan|safe patch|code fix proposal|تصحيح|plan de correction/i, categories: ['Developer/Code Agents'], ids: ['patch-planner-agent', 'bug-diagnosis-agent', 'code-review-agent'] },
  { pattern: /release notes|شنو تبدل|ملخص التغييرات|changelog|release summary|notes de version/i, categories: ['Developer/Code Agents'], ids: ['release-notes-agent', 'deployment-review-agent'] },
  { pattern: /deploy|deployment|إعادة النشر|vercel|production|pre[- ]?deploy|déploiement/i, categories: ['Developer/Code Agents'], ids: ['deployment-review-agent', 'release-notes-agent', 'bug-diagnosis-agent'] },
  { pattern: /migration|supabase migration|rls|sql|postgres|database migration|سيكوال|قاعدة البيانات/i, categories: ['Developer/Code Agents'], ids: ['supabase-migration-review-agent', 'deployment-review-agent', 'database-migration-planner'] },
  { pattern: /code review|review code|code|debug|bug|typescript|typeScript|lint|security|performance|patch|fix|pull request|github|deployment failed|build failed|api|database|migration|pr|build|راجع ليا الكود|كود|برمجة|revue de code/i, categories: ['Developer/Code Agents'], ids: ['bug-diagnosis-agent', 'patch-planner-agent', 'code-review-agent', 'deployment-review-agent', 'supabase-migration-review-agent', 'release-notes-agent', 'pr-review-checklist-generator', 'database-migration-planner', 'api-integration-scaffolder'] },
  { pattern: /n8n|workflow|automation|webhook|callback|payload|nodes?|error handling|workflow plan|workflow blueprint|automation plan|alert|monitor|بغيت workflow ديال n8n|بغيت نخطط automation|أتمتة|سير العمل|ويبهوك|كالباك|automatisation|flux|plan de workflow/i, categories: ['n8n Workflow Ideas'], ids: ['n8n-workflow-planner-agent', 'lead-capture-enrichment-workflow', 'content-publishing-pipeline-workflow', 'monitoring-alerting-workflow'] },
  { pattern: /report|reports|تقرير|تقارير|rapport/i, ids: ['daily-briefing-generator', 'market-trend-intelligence', 'monitoring-alerting-workflow'] },
  { pattern: /client|customer|agency|عميل|زبون|client/i, ids: ['lead-score-agent', 'follow-up-email-agent', 'client-proposal-agent', 'client-onboarding-agent', 'meeting-prep-agent', 'operational-sop-writer'] },
  { pattern: /planning|plan|خطة|خطط|planification/i, ids: ['daily-planning-agent', 'swot-analysis-generator', 'cross-project-dependency-mapper', 'database-migration-planner'] },
];

function toAlexTemplateContext(template: AgentTemplate): AlexAgentTemplateContext {
  return {
    id: template.id,
    name: template.name,
    category: template.category,
    description: template.description,
    recommended_for: template.recommended_for,
    inputs: template.inputs,
    outputs: template.outputs,
    safety_level: template.safety_level,
    execution_mode: template.execution_mode,
    suggested_prompt: template.suggested_prompt,
    review_checklist: template.review_checklist,
  };
}

export function getAgentTemplateById(id: string | null | undefined) {
  if (!id) return null;
  return templates.find((template) => template.id === id) ?? null;
}

export function getRelevantAgentTemplates(query: string, selectedTemplateId?: string | null, limit = 4): AlexAgentTemplateContext[] {
  const normalizedQuery = query.trim();
  const selectedTemplate = getAgentTemplateById(selectedTemplateId);
  const scores = new Map<string, number>();

  if (selectedTemplate) {
    scores.set(selectedTemplate.id, 100);
  }

  for (const template of templates) {
    const searchable = [
      template.name,
      template.category,
      template.description,
      template.recommended_for.join(' '),
      template.inputs.join(' '),
      template.outputs.join(' '),
    ].join(' ');

    let score = scores.get(template.id) ?? 0;
    const lowerQuery = normalizedQuery.toLowerCase();
    if (lowerQuery && searchable.toLowerCase().includes(lowerQuery)) {
      score += 20;
    }

    for (const rule of recommendationKeywords) {
      if (!rule.pattern.test(normalizedQuery)) continue;
      if (rule.categories?.includes(template.category)) score += 12;
      if (rule.ids?.includes(template.id)) score += 18;
    }

    if (score > 0) {
      scores.set(template.id, score);
    }
  }

  if (scores.size === 0) {
    for (const template of templates.filter((item) => item.category === 'Alex Assistant Skills').slice(0, 2)) {
      scores.set(template.id, 3);
    }
    scores.set('daily-planning-agent', 6);
    scores.set('daily-briefing-generator', 5);
  }

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => getAgentTemplateById(id))
    .filter((template): template is AgentTemplate => Boolean(template))
    .map(toAlexTemplateContext);
}
