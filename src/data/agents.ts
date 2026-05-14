import type { Agent } from '@/types';

export const agentCatalog: Agent[] = [
  // Research & Strategy Department
  {
    id: 'market_research',
    name: 'Market Research Agent',
    role: 'Research & Strategy',
    department: 'Research & Strategy',
    description: 'Research market trends, analyze industry data, and generate insights about target markets.',
    capabilities: [
      'Market trend analysis',
      'Industry data collection',
      'Competitive intelligence',
      'Consumer behavior analysis',
      'Market sizing and forecasting'
    ],
    exampleTasks: [
      'Analyze the SaaS market in North America',
      'Research consumer trends in e-commerce',
      'Identify emerging market opportunities'
    ],
    status: 'Not Connected',
    icon: 'Search',
    color: '#8B3CDE',
  },
  {
    id: 'competitor_analysis',
    name: 'Competitor Analysis Agent',
    role: 'Research & Strategy',
    department: 'Research & Strategy',
    description: 'Analyze competitor strategies, strengths, weaknesses, and market positioning.',
    capabilities: [
      'Competitor profiling',
      'SWOT analysis',
      'Pricing strategy analysis',
      'Feature comparison',
      'Market positioning assessment'
    ],
    exampleTasks: [
      'Analyze top 5 competitors in fintech',
      'Compare pricing strategies',
      'Assess competitive threats'
    ],
    status: 'Not Connected',
    icon: 'Target',
    color: '#8B3CDE',
  },
  {
    id: 'audience_persona',
    name: 'Audience Persona Agent',
    role: 'Research & Strategy',
    department: 'Research & Strategy',
    description: 'Create detailed buyer personas and audience segments based on market research.',
    capabilities: [
      'Demographic analysis',
      'Psychographic profiling',
      'Buyer journey mapping',
      'Persona development',
      'Audience segmentation'
    ],
    exampleTasks: [
      'Create B2B buyer personas',
      'Segment target audience',
      'Map customer journey'
    ],
    status: 'Not Connected',
    icon: 'Users',
    color: '#8B3CDE',
  },
  {
    id: 'product_idea',
    name: 'Product Idea Agent',
    role: 'Research & Strategy',
    department: 'Research & Strategy',
    description: 'Generate innovative product concepts and validate market opportunities.',
    capabilities: [
      'Idea generation',
      'Market validation',
      'Feature prioritization',
      'Concept testing',
      'Innovation frameworks'
    ],
    exampleTasks: [
      'Generate 10 mobile app ideas',
      'Validate product-market fit',
      'Prioritize feature roadmap'
    ],
    status: 'Not Connected',
    icon: 'Lightbulb',
    color: '#8B3CDE',
  },
  {
    id: 'seo_keyword',
    name: 'SEO Keyword Agent',
    role: 'Research & Strategy',
    department: 'Research & Strategy',
    description: 'Discover high-value keywords and optimize content for search rankings.',
    capabilities: [
      'Keyword research',
      'Search intent analysis',
      'Competition analysis',
      'Content optimization',
      'Ranking prediction'
    ],
    exampleTasks: [
      'Find high-volume keywords',
      'Analyze keyword difficulty',
      'Optimize content for SEO'
    ],
    status: 'Not Connected',
    icon: 'Search',
    color: '#8B3CDE',
  },
  {
    id: 'strategy_planner',
    name: 'Strategy Planner Agent',
    role: 'Research & Strategy',
    department: 'Research & Strategy',
    description: 'Develop comprehensive business strategies and execution roadmaps.',
    capabilities: [
      'Strategic planning',
      'Goal setting',
      'Roadmap creation',
      'Resource allocation',
      'Risk assessment'
    ],
    exampleTasks: [
      'Create go-to-market strategy',
      'Develop quarterly roadmap',
      'Assess strategic risks'
    ],
    status: 'Not Connected',
    icon: 'BarChart3',
    color: '#8B3CDE',
  },

  // Content & Growth Department
  {
    id: 'social_media_content',
    name: 'Social Media Content Agent',
    role: 'Content & Growth',
    department: 'Content & Growth',
    description: 'Generate engaging social media posts and platform-specific content strategies.',
    capabilities: [
      'Content ideation',
      'Platform optimization',
      'Hashtag strategy',
      'Posting schedule',
      'Engagement analysis'
    ],
    exampleTasks: [
      'Create LinkedIn content calendar',
      'Generate Twitter thread series',
      'Plan Instagram campaign'
    ],
    status: 'Not Connected',
    icon: 'Megaphone',
    color: '#F55477',
  },
  {
    id: 'copywriting',
    name: 'Copywriting Agent',
    role: 'Content & Growth',
    department: 'Content & Growth',
    description: 'Create persuasive marketing copy for landing pages, ads, and promotional materials.',
    capabilities: [
      'Landing page copy',
      'Ad copy creation',
      'Email copywriting',
      'Brand voice consistency',
      'Conversion optimization'
    ],
    exampleTasks: [
      'Write landing page copy',
      'Create Facebook ad variations',
      'Draft email sequences'
    ],
    status: 'Not Connected',
    icon: 'FileText',
    color: '#F55477',
  },
  {
    id: 'ads_script',
    name: 'Ads Script Agent',
    role: 'Content & Growth',
    department: 'Content & Growth',
    description: 'Write compelling advertising scripts for video, display, and paid campaigns.',
    capabilities: [
      'Script writing',
      'Storyboarding',
      'A/B testing variations',
      'Call-to-action optimization',
      'Platform adaptation'
    ],
    exampleTasks: [
      'Create 30-second video ad',
      'Write display ad copy',
      'Develop YouTube script'
    ],
    status: 'Not Connected',
    icon: 'Megaphone',
    color: '#F55477',
  },
  {
    id: 'email_marketing',
    name: 'Email Marketing Agent',
    role: 'Content & Growth',
    department: 'Content & Growth',
    description: 'Design and write effective email campaigns and nurture sequences.',
    capabilities: [
      'Campaign creation',
      'Segmentation strategy',
      'A/B testing',
      'Automation sequences',
      'Performance tracking'
    ],
    exampleTasks: [
      'Create welcome email series',
      'Write promotional newsletter',
      'Design drip campaign'
    ],
    status: 'Not Connected',
    icon: 'Mail',
    color: '#F55477',
  },
  {
    id: 'blog_seo_article',
    name: 'Blog SEO Article Agent',
    role: 'Content & Growth',
    department: 'Content & Growth',
    description: 'Create SEO-optimized blog articles that rank and drive organic traffic.',
    capabilities: [
      'SEO optimization',
      'Content structuring',
      'Keyword integration',
      'Readability scoring',
      'Internal linking strategy'
    ],
    exampleTasks: [
      'Write 2000-word guide',
      'Optimize existing content',
      'Create content cluster'
    ],
    status: 'Not Connected',
    icon: 'FileText',
    color: '#F55477',
  },
  {
    id: 'visual_brief',
    name: 'Visual Brief Agent',
    role: 'Content & Growth',
    department: 'Content & Growth',
    description: 'Generate detailed creative briefs for designers, illustrators, and visual content creators.',
    capabilities: [
      'Brief creation',
      'Brand guideline adherence',
      'Creative direction',
      'Asset specification',
      'Quality control'
    ],
    exampleTasks: [
      'Create infographic brief',
      'Design social media template spec',
      'Develop style guide'
    ],
    status: 'Not Connected',
    icon: 'Image',
    color: '#F55477',
  },

  // Sales & Operations Department
  {
    id: 'lead_finder',
    name: 'Lead Finder Agent',
    role: 'Sales & Operations',
    department: 'Sales & Operations',
    description: 'Identify and qualify potential leads from various sources and databases.',
    capabilities: [
      'Lead sourcing',
      'Database mining',
      'Contact enrichment',
      'Intent detection',
      'Lead scoring'
    ],
    exampleTasks: [
      'Find 100 qualified leads',
      'Research target accounts',
      'Build prospect database'
    ],
    status: 'Not Connected',
    icon: 'UserPlus',
    color: '#000000',
  },
  {
    id: 'lead_qualifier',
    name: 'Lead Qualifier Agent',
    role: 'Sales & Operations',
    department: 'Sales & Operations',
    description: 'Score and qualify leads based on fit, interest, and buying signals.',
    capabilities: [
      'Lead scoring',
      'BANT analysis',
      'Fit assessment',
      'Priority ranking',
      'Disqualification filtering'
    ],
    exampleTasks: [
      'Score 50 incoming leads',
      'Qualify MQL to SQL',
      'Assess lead readiness'
    ],
    status: 'Not Connected',
    icon: 'UserCheck',
    color: '#000000',
  },
  {
    id: 'outreach_message',
    name: 'Outreach Message Agent',
    role: 'Sales & Operations',
    department: 'Sales & Operations',
    description: 'Craft personalized outreach messages for cold emails and prospecting campaigns.',
    capabilities: [
      'Message personalization',
      'Template creation',
      'Sequence design',
      'A/B test variants',
      'Response optimization'
    ],
    exampleTasks: [
      'Create email sequence',
      'Write LinkedIn outreach',
      'Draft sales pitch'
    ],
    status: 'Not Connected',
    icon: 'MessageCircle',
    color: '#000000',
  },
  {
    id: 'crm_update',
    name: 'CRM Update Agent',
    role: 'Sales & Operations',
    department: 'Sales & Operations',
    description: 'Automatically update and maintain CRM records with latest customer interactions.',
    capabilities: [
      'CRM synchronization',
      'Data validation',
      'Activity logging',
      'Report generation',
      'Integration management'
    ],
    exampleTasks: [
      'Sync Salesforce data',
      'Update deal stages',
      'Generate activity report'
    ],
    status: 'Not Connected',
    icon: 'Database',
    color: '#000000',
  },
  {
    id: 'customer_support',
    name: 'Customer Support Agent',
    role: 'Sales & Operations',
    department: 'Sales & Operations',
    description: 'Handle customer inquiries, provide solutions, and maintain support documentation.',
    capabilities: [
      'Ticket triage',
      'Knowledge base creation',
      'FAQ generation',
      'Response drafting',
      'Issue categorization'
    ],
    exampleTasks: [
      'Draft support response',
      'Create help documentation',
      'Analyze support tickets'
    ],
    status: 'Not Connected',
    icon: 'Headphones',
    color: '#000000',
  },
  {
    id: 'analytics_report',
    name: 'Analytics Report Agent',
    role: 'Sales & Operations',
    department: 'Sales & Operations',
    description: 'Generate comprehensive reports from sales data, metrics, and KPIs.',
    capabilities: [
      'Data analysis',
      'Report generation',
      'KPI tracking',
      'Trend identification',
      'Dashboard creation'
    ],
    exampleTasks: [
      'Create monthly report',
      'Analyze conversion funnel',
      'Generate performance dashboard'
    ],
    status: 'Not Connected',
    icon: 'PieChart',
    color: '#000000',
  },
  {
    id: 'code-review-agent',
    name: 'Code Review Agent',
    role: 'Development & Engineering',
    department: 'Development & Engineering',
    description: 'Reviews code quality, structure, readability, maintainability, and potential bugs.',
    capabilities: ['Code quality review', 'Changed-file review', 'Maintainability notes', 'Risk detection', 'Testing checklist'],
    exampleTasks: ['Review recent project changes', 'Review a pull request summary', 'Inspect a component for maintainability risks'],
    status: 'Not Connected',
    icon: 'Code',
    color: '#CA2851',
  },
  {
    id: 'bug-fix-agent',
    name: 'Bug Fix Agent',
    role: 'Development & Engineering',
    department: 'Development & Engineering',
    description: 'Analyzes errors, logs, screenshots, and failing behavior to propose a safe fix plan.',
    capabilities: ['Root-cause analysis', 'Build error triage', 'Runtime crash planning', 'Fix plan writing', 'Test steps'],
    exampleTasks: ['Analyze this TypeScript error', 'Create a fix plan for a broken dashboard route', 'Investigate a failed API call'],
    status: 'Not Connected',
    icon: 'Bug',
    color: '#CA2851',
  },
  {
    id: 'architecture-agent',
    name: 'Architecture Agent',
    role: 'Development & Engineering',
    department: 'Development & Engineering',
    description: 'Plans system architecture, project structure, data flow, and feature implementation phases.',
    capabilities: ['Architecture planning', 'Folder structure design', 'Data flow mapping', 'API/server action planning', 'Tradeoff analysis'],
    exampleTasks: ['Plan a new SaaS dashboard architecture', 'Design a provider integration flow', 'Split a large feature into phases'],
    status: 'Not Connected',
    icon: 'Workflow',
    color: '#CA2851',
  },
  {
    id: 'testing-agent',
    name: 'Testing Agent',
    role: 'Development & Engineering',
    department: 'Development & Engineering',
    description: 'Creates testing checklists, QA plans, edge cases, and acceptance criteria.',
    capabilities: ['Manual QA planning', 'Smoke test design', 'Edge case discovery', 'Acceptance criteria', 'Regression checklist'],
    exampleTasks: ['Create a final stabilization checklist', 'Write smoke tests for dashboard routes', 'Plan form validation tests'],
    status: 'Not Connected',
    icon: 'TestTube',
    color: '#CA2851',
  },
  {
    id: 'documentation-agent',
    name: 'Documentation Agent',
    role: 'Development & Engineering',
    department: 'Development & Engineering',
    description: 'Creates internal guides, user docs, technical reports, release notes, FAQs, and checklists.',
    capabilities: ['Internal documentation', 'Technical reports', 'Release notes', 'Setup guides', 'FAQ and checklist writing'],
    exampleTasks: ['Write a Development & Engineering agents guide', 'Create release notes from a project summary', 'Document a setup workflow'],
    status: 'Not Connected',
    icon: 'BookOpen',
    color: '#CA2851',
  },
  {
    id: 'deployment-agent',
    name: 'Deployment Agent',
    role: 'Development & Engineering',
    department: 'Development & Engineering',
    description: 'Prepares deployment plans, Vercel checks, environment checklists, smoke tests, and rollback notes.',
    capabilities: ['Vercel deployment planning', 'Environment checklist', 'Migration checklist', 'Smoke test report', 'Rollback plan'],
    exampleTasks: ['Prepare a production deployment checklist', 'Review a Vercel build error', 'Create rollback notes for this release'],
    status: 'Not Connected',
    icon: 'Rocket',
    color: '#CA2851',
  },
  {
    id: 'security-review-agent',
    name: 'Security Review Agent',
    role: 'Development & Engineering',
    department: 'Development & Engineering',
    description: 'Reviews security risks, secret exposure, RLS, file upload safety, and token handling.',
    capabilities: ['Secret exposure review', 'RLS review', 'OAuth/token storage review', 'Upload safety review', 'No-secrets checklist'],
    exampleTasks: ['Review env var safety', 'Audit Supabase RLS notes', 'Check file upload safety for creative assets'],
    status: 'Not Connected',
    icon: 'ShieldCheck',
    color: '#CA2851',
  },
  {
    id: 'database-agent',
    name: 'Database Agent',
    role: 'Development & Engineering',
    department: 'Development & Engineering',
    description: 'Plans and reviews Supabase schema, migrations, RLS, indexes, relationships, and storage policies.',
    capabilities: ['Migration planning', 'SQL review', 'RLS checklist', 'Relationship design', 'Storage policy review'],
    exampleTasks: ['Design a workspace-scoped table', 'Review a Supabase migration', 'Create an RLS testing checklist'],
    status: 'Not Connected',
    icon: 'Database',
    color: '#CA2851',
  },
  {
    id: 'ui-ux-review-agent',
    name: 'UI/UX Review Agent',
    role: 'Development & Engineering',
    department: 'Development & Engineering',
    description: 'Reviews interface layout, readability, flows, accessibility, and responsive behavior.',
    capabilities: ['UI audit', 'Responsive review', 'Accessibility notes', 'Flow review', 'Layout improvement plan'],
    exampleTasks: ['Review the Reports page layout', 'Audit mobile responsiveness', 'Suggest UI fixes for a crowded form'],
    status: 'Not Connected',
    icon: 'PanelsTopLeft',
    color: '#CA2851',
  },
];

// Legacy agents are preserved for backward compatibility, but they are not part
// of the primary department catalog.
export const legacyAgents: Agent[] = [
  {
    id: 'offer_builder',
    name: 'Offer Builder Agent',
    role: 'Content & Growth',
    department: 'Content & Growth',
    description: 'Create compelling product or service offers based on market research and customer needs.',
    capabilities: ['Offer creation', 'Value proposition', 'Pricing strategy', 'Feature bundling'],
    exampleTasks: ['Create product offer', 'Develop pricing tiers', 'Bundle features'],
    status: 'Not Connected',
    icon: 'Lightbulb',
    color: '#F55477',
  },
  {
    id: 'content_creator',
    name: 'Content Creator Agent',
    role: 'Content & Growth',
    department: 'Content & Growth',
    description: 'Generate high-quality marketing content, blog posts, and social media content.',
    capabilities: ['Content creation', 'Blog writing', 'Copy editing', 'Content optimization'],
    exampleTasks: ['Write blog post', 'Create social content', 'Edit marketing copy'],
    status: 'Not Connected',
    icon: 'FileText',
    color: '#F55477',
  },
  {
    id: 'outreach',
    name: 'Outreach Agent',
    role: 'Sales & Operations',
    department: 'Sales & Operations',
    description: 'Generate personalized outreach messages and manage outreach campaigns.',
    capabilities: ['Outreach personalization', 'Campaign management', 'Follow-up sequences'],
    exampleTasks: ['Create outreach campaign', 'Personalize cold emails', 'Draft follow-ups'],
    status: 'Not Connected',
    icon: 'Send',
    color: '#000000',
  },
  {
    id: 'report',
    name: 'Report Agent',
    role: 'Sales & Operations',
    department: 'Sales & Operations',
    description: 'Generate comprehensive reports from data, analysis, and insights.',
    capabilities: ['Report generation', 'Data visualization', 'KPI tracking', 'Insight extraction'],
    exampleTasks: ['Create performance report', 'Generate insight summary', 'Build dashboard'],
    status: 'Not Connected',
    icon: 'BarChart3',
    color: '#000000',
  },
];
