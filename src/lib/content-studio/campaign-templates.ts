import type { BrandKit } from '@/types/brand-kit';
import type { ContentStudioPlatform, ContentStudioType } from '@/types/database';

export type CampaignTemplateCategory =
  | 'Instagram'
  | 'Facebook'
  | 'Google Ads'
  | 'Pinterest'
  | 'LinkedIn'
  | 'Multi-platform'
  | 'Lead generation'
  | 'Product launch';

export interface CampaignTemplateFieldSet {
  title?: string;
  objective?: string;
  target_audience?: string;
  offer?: string;
  destination_url?: string;
  prompt?: string;
  hook?: string;
  primary_text?: string;
  caption?: string;
  script?: string;
  scene_breakdown?: string;
  on_screen_text?: string;
  voiceover_script?: string;
  headlines?: string;
  descriptions?: string;
  keywords?: string;
  ad_copy?: string;
  cta?: string;
  hashtags?: string;
  creative_brief?: string;
  platform_package?: string;
}

export interface CampaignTemplate {
  id: string;
  name: string;
  platform: ContentStudioPlatform;
  platformLabel: string;
  contentType: ContentStudioType;
  goal: string;
  bestFor: string;
  fieldsIncluded: string[];
  categories: CampaignTemplateCategory[];
  buildFields: (brandKit: BrandKit) => CampaignTemplateFieldSet;
}

export const campaignTemplateCategories: Array<CampaignTemplateCategory | 'All'> = [
  'All',
  'Instagram',
  'Facebook',
  'Google Ads',
  'Pinterest',
  'LinkedIn',
  'Multi-platform',
  'Lead generation',
  'Product launch',
];

function clean(value: string | null | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function lines(values: Array<string | null | undefined>) {
  return values.map((value) => clean(value, '')).filter(Boolean).join('\n');
}

function brandName(brandKit: BrandKit) {
  return clean(brandKit.brandName, 'your brand');
}

function offer(brandKit: BrandKit) {
  return clean(
    brandKit.campaignDefaults.defaultOffer ?? brandKit.offer,
    'your core offer'
  );
}

function audience(brandKit: BrandKit) {
  return clean(brandKit.targetAudience, 'your best-fit audience');
}

function cta(brandKit: BrandKit) {
  return clean(brandKit.defaultCta, 'Learn more');
}

function destinationUrl(brandKit: BrandKit) {
  return clean(
    brandKit.campaignDefaults.defaultDestinationUrl ?? brandKit.websiteUrl,
    ''
  );
}

function hashtags(brandKit: BrandKit, fallback: string) {
  return clean(brandKit.defaultHashtags, fallback)
    .split(/[\s,\n]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .join('\n');
}

function tone(brandKit: BrandKit) {
  return clean(brandKit.toneOfVoice, 'clear, professional, and conversion-focused');
}

function visualStyle(brandKit: BrandKit) {
  return clean(
    [
      brandKit.visualStyle,
      brandKit.imageStyleNotes,
      brandKit.primaryColor ? `Primary color: ${brandKit.primaryColor}` : null,
      brandKit.secondaryColor ? `Secondary color: ${brandKit.secondaryColor}` : null,
      brandKit.accentColor ? `Accent color: ${brandKit.accentColor}` : null,
    ].filter(Boolean).join('\n'),
    'Clean branded creative with a clear focal point and readable text.'
  );
}

function brandContext(brandKit: BrandKit) {
  return [
    `Brand: ${brandName(brandKit)}`,
    `Offer: ${offer(brandKit)}`,
    `Audience: ${audience(brandKit)}`,
    `Tone: ${tone(brandKit)}`,
  ].join('\n');
}

export const campaignTemplates: CampaignTemplate[] = [
  {
    id: 'instagram-awareness-post',
    name: 'Instagram Awareness Post',
    platform: 'instagram',
    platformLabel: 'Instagram',
    contentType: 'instagram_post',
    goal: 'Introduce the brand and explain the main value.',
    bestFor: 'Top-of-funnel awareness and first-touch education.',
    fieldsIncluded: ['Objective', 'Audience', 'Offer', 'Hook', 'Caption', 'CTA', 'Hashtags', 'Creative brief'],
    categories: ['Instagram'],
    buildFields: (brandKit) => ({
      title: `${brandName(brandKit)} awareness post`,
      objective: `Introduce ${brandName(brandKit)} to ${audience(brandKit)} and explain the main value of ${offer(brandKit)}.`,
      target_audience: audience(brandKit),
      offer: offer(brandKit),
      hook: `Most ${audience(brandKit)} do not need more noise. They need a clearer way to get ${offer(brandKit)} working.`,
      primary_text: `${brandName(brandKit)} helps ${audience(brandKit)} move from scattered ideas to focused execution with ${offer(brandKit)}.`,
      caption: `Meet ${brandName(brandKit)}.\n\n${offer(brandKit)}\n\nBuilt for ${audience(brandKit)} who want clearer planning, sharper creative, and a calmer way to ship campaigns.`,
      cta: cta(brandKit),
      hashtags: hashtags(brandKit, '#Marketing #ContentMarketing #AIAgency #Automation #SaaS'),
      creative_brief: `${brandContext(brandKit)}\nVisual direction: ${visualStyle(brandKit)}\nLinked asset guidance: Use a branded image that makes the product, service, or main outcome immediately visible.`,
    }),
  },
  {
    id: 'instagram-reel-promo',
    name: 'Instagram Reel Promo',
    platform: 'instagram',
    platformLabel: 'Instagram',
    contentType: 'instagram_reel',
    goal: 'Create a short promotional reel script.',
    bestFor: 'Short-form promotion, retargeting warm audiences, and offer explainers.',
    fieldsIncluded: ['Hook', 'Reel script', 'Scenes', 'On-screen text', 'Voiceover', 'Caption', 'CTA'],
    categories: ['Instagram'],
    buildFields: (brandKit) => ({
      title: `${brandName(brandKit)} reel promo`,
      objective: `Promote ${offer(brandKit)} with a short reel that quickly connects the audience pain to the outcome.`,
      hook: `If ${audience(brandKit)} could fix one bottleneck this week, it would be this.`,
      script: `Open with the problem.\nShow the simpler workflow.\nName ${brandName(brandKit)} as the solution.\nClose with ${cta(brandKit)}.`,
      scene_breakdown: lines([
        'Scene 1: Fast visual of the current messy workflow.',
        `Scene 2: Show the promised outcome from ${offer(brandKit)}.`,
        `Scene 3: Show ${brandName(brandKit)} or a branded result in action.`,
        `Scene 4: End card with ${cta(brandKit)}.`,
      ]),
      on_screen_text: lines([
        'Stop rebuilding every campaign from scratch',
        `Plan faster with ${brandName(brandKit)}`,
        cta(brandKit),
      ]),
      voiceover_script: `You do not need a bigger content backlog. You need a faster path from idea to campaign. ${brandName(brandKit)} helps ${audience(brandKit)} turn ${offer(brandKit)} into ready-to-review campaign drafts.`,
      caption: `${offer(brandKit)} for ${audience(brandKit)}.\n\n${cta(brandKit)}`,
      hashtags: hashtags(brandKit, '#InstagramReels #Marketing #AIAgency #ContentCreation #Automation'),
      cta: cta(brandKit),
      creative_brief: `${brandContext(brandKit)}\nVideo asset guidance: Use a vertical 9:16 video, quick cuts, readable overlays, and a branded end card.\nVisual direction: ${visualStyle(brandKit)}`,
    }),
  },
  {
    id: 'facebook-page-post',
    name: 'Facebook Page Post',
    platform: 'facebook',
    platformLabel: 'Facebook',
    contentType: 'facebook_post',
    goal: 'Create a professional Facebook Page post.',
    bestFor: 'Business page updates, trust-building posts, and service education.',
    fieldsIncluded: ['Objective', 'Primary text', 'Description', 'Headline', 'CTA', 'Creative brief'],
    categories: ['Facebook'],
    buildFields: (brandKit) => ({
      title: `${brandName(brandKit)} Facebook page post`,
      objective: `Explain how ${brandName(brandKit)} helps ${audience(brandKit)} get value from ${offer(brandKit)}.`,
      primary_text: `${brandName(brandKit)} gives ${audience(brandKit)} a practical way to plan, draft, and review campaigns without starting from a blank page.`,
      caption: `${offer(brandKit)}\n\nIf your team needs clearer campaign execution, this is built for you.`,
      headlines: `${brandName(brandKit)} helps teams plan campaigns faster`,
      cta: cta(brandKit),
      creative_brief: `${brandContext(brandKit)}\nImage asset guidance: Use a clean branded image, product screenshot, or outcome-focused visual with minimal text.`,
    }),
  },
  {
    id: 'google-ads-search-campaign-draft',
    name: 'Google Ads Search Campaign Draft',
    platform: 'google_ads',
    platformLabel: 'Google Ads',
    contentType: 'google_ads_campaign_draft',
    goal: 'Create a safe paused Google Ads search campaign draft.',
    bestFor: 'Search intent capture and review-ready campaign copy.',
    fieldsIncluded: ['Objective', 'Destination URL', 'Keywords', 'Headlines', 'Descriptions', 'Budget notes', 'Ad copy'],
    categories: ['Google Ads'],
    buildFields: (brandKit) => ({
      title: `${brandName(brandKit)} search campaign draft`,
      objective: `Create a paused search campaign draft for people actively looking for ${offer(brandKit)}.`,
      destination_url: destinationUrl(brandKit),
      offer: `Budget notes: Start conservative, review search terms, and keep this campaign paused until approved.\nValue proposition: ${offer(brandKit)}`,
      keywords: lines([
        brandName(brandKit),
        offer(brandKit),
        `${clean(brandKit.industry, 'AI agency')} software`,
        `${clean(brandKit.industry, 'marketing')} automation`,
        `best tools for ${audience(brandKit)}`,
      ]),
      headlines: lines([
        `${brandName(brandKit)} Campaigns`,
        'Plan Better Campaigns',
        'Launch Drafts Faster',
        'AI Agency Workflow',
        cta(brandKit),
      ]),
      descriptions: lines([
        `${offer(brandKit)} for ${audience(brandKit)}.`,
        `Use ${brandName(brandKit)} to plan, draft, and review campaigns before launch.`,
        'Create safer campaign drafts with brand context and provider readiness checks.',
      ]),
      ad_copy: `Search ad angle: ${offer(brandKit)} for ${audience(brandKit)}.\nKeep campaign paused for review. Confirm keywords, landing page, budget, and compliance before activation.`,
      cta: cta(brandKit),
      creative_brief: `${brandContext(brandKit)}\nThis is copy-only search campaign planning. Do not create active campaigns from this template.`,
    }),
  },
  {
    id: 'pinterest-traffic-pin',
    name: 'Pinterest Traffic Pin',
    platform: 'pinterest',
    platformLabel: 'Pinterest',
    contentType: 'pinterest_pin',
    goal: 'Create a Pinterest Pin to drive traffic.',
    bestFor: 'Evergreen traffic, idea discovery, and visual search.',
    fieldsIncluded: ['Pin title', 'Pin description', 'Destination URL', 'CTA', 'Creative brief'],
    categories: ['Pinterest'],
    buildFields: (brandKit) => ({
      title: `${brandName(brandKit)} traffic pin`,
      headlines: `${offer(brandKit)} for ${audience(brandKit)}`,
      caption: `Discover how ${brandName(brandKit)} helps ${audience(brandKit)} plan better campaigns with ${offer(brandKit)}.`,
      descriptions: `Save this idea if you want a clearer way to turn campaign ideas into organized drafts and creative direction.`,
      destination_url: destinationUrl(brandKit),
      cta: cta(brandKit),
      creative_brief: `${brandContext(brandKit)}\nImage asset guidance: Use a vertical 2:3 pin image with a clear headline, branded colors, and one visible outcome.`,
    }),
  },
  {
    id: 'linkedin-authority-post',
    name: 'LinkedIn Authority Post',
    platform: 'linkedin',
    platformLabel: 'LinkedIn',
    contentType: 'linkedin_post_planner',
    goal: 'Create a professional LinkedIn post for authority and credibility.',
    bestFor: 'Founder posts, operator insight, and copy-ready manual LinkedIn publishing.',
    fieldsIncluded: ['Hook', 'Post body', 'CTA', 'Hashtags', 'Creative brief'],
    categories: ['LinkedIn'],
    buildFields: (brandKit) => ({
      title: `${brandName(brandKit)} LinkedIn authority post`,
      objective: `Build authority with ${audience(brandKit)} by explaining the operational value behind ${offer(brandKit)}.`,
      hook: `The best campaigns usually do not start with more ideas. They start with a clearer operating system.`,
      caption: `For ${audience(brandKit)}, campaign execution often gets slowed down by scattered briefs, disconnected assets, and unclear next steps.\n\n${brandName(brandKit)} is built around a simpler premise: keep strategy, content drafts, creative assets, provider readiness, and scheduling in one operating view.\n\nThat means less rebuilding from scratch and more time spent reviewing work that is already moving in the right direction.`,
      cta: cta(brandKit),
      hashtags: hashtags(brandKit, '#AIAgency #MarketingOperations #ContentStrategy #Automation #SaaS'),
      creative_brief: `${brandContext(brandKit)}\nLinkedIn remains manual_only / copy-ready unless real LinkedIn OAuth is implemented.`,
    }),
  },
  {
    id: 'ai-agency-lead-generation-campaign',
    name: 'AI Agency Lead Generation Campaign',
    platform: 'instagram',
    platformLabel: 'Multi-platform',
    contentType: 'instagram_post',
    goal: 'Generate a complete lead generation campaign package.',
    bestFor: 'Agency service promotion, booked-call campaigns, and cross-channel planning.',
    fieldsIncluded: ['Instagram post', 'Reel concept', 'Facebook post', 'Google Ads copy', 'Pinterest copy', 'LinkedIn post'],
    categories: ['Multi-platform', 'Lead generation'],
    buildFields: (brandKit) => ({
      title: `${brandName(brandKit)} lead generation campaign`,
      objective: `Generate qualified leads from ${audience(brandKit)} for ${offer(brandKit)}.`,
      target_audience: audience(brandKit),
      offer: offer(brandKit),
      destination_url: destinationUrl(brandKit),
      hook: `Your next client does not need another vague AI promise. They need a clear path to execution.`,
      caption: `${brandName(brandKit)} helps ${audience(brandKit)} turn campaign ideas into ready-to-review assets, drafts, and action plans.`,
      cta: cta(brandKit),
      hashtags: hashtags(brandKit, '#LeadGeneration #AIAgency #MarketingAutomation #SaaS #DigitalMarketing'),
      creative_brief: `${brandContext(brandKit)}\nCreative direction: Lead with clarity, business outcomes, and trustworthy proof. Use branded visuals and direct offer framing.`,
      platform_package: lines([
        'Full Campaign Package',
        '',
        'Instagram post:',
        `Hook: Your next client needs a clearer path from idea to execution.`,
        `Caption: ${brandName(brandKit)} helps ${audience(brandKit)} plan, draft, and review campaigns faster.`,
        '',
        'Instagram reel concept:',
        'Show the before state, the organized workflow, and the final draft package.',
        '',
        'Facebook post:',
        `${offer(brandKit)} for teams that want campaign execution to feel organized and review-ready.`,
        '',
        'Google Ads draft copy:',
        `Headlines: ${brandName(brandKit)} Campaigns; AI Agency Workflow; Plan Drafts Faster`,
        `Descriptions: ${offer(brandKit)} for ${audience(brandKit)}. Keep campaign paused until approved.`,
        '',
        'Pinterest pin copy:',
        `Title: ${offer(brandKit)} for ${audience(brandKit)}`,
        'Description: Save this workflow for a clearer way to plan campaign drafts.',
        '',
        'LinkedIn post:',
        `Campaign execution improves when strategy, assets, and draft creation live in one operating view. ${brandName(brandKit)} is built for that.`,
      ]),
    }),
  },
  {
    id: 'product-launch-campaign',
    name: 'Product Launch Campaign',
    platform: 'instagram',
    platformLabel: 'Multi-platform',
    contentType: 'instagram_post',
    goal: 'Launch or promote a product or service.',
    bestFor: 'New offers, feature launches, service launches, and announcement campaigns.',
    fieldsIncluded: ['Campaign name', 'Objective', 'Offer', 'Audience', 'Hook', 'Ad copy', 'Google Ads', 'Pinterest', 'LinkedIn'],
    categories: ['Multi-platform', 'Product launch'],
    buildFields: (brandKit) => ({
      title: `${brandName(brandKit)} product launch campaign`,
      objective: `Launch ${offer(brandKit)} to ${audience(brandKit)} with a cross-platform draft package.`,
      offer: offer(brandKit),
      target_audience: audience(brandKit),
      hook: `${brandName(brandKit)} is built for the moment when a good idea needs to become a campaign people can actually review and ship.`,
      caption: `New from ${brandName(brandKit)}: ${offer(brandKit)}.\n\nBuilt for ${audience(brandKit)} who want clearer planning, better creative direction, and faster campaign drafts.`,
      ad_copy: `Launch angle: ${offer(brandKit)} gives ${audience(brandKit)} a practical way to move from blank page to organized campaign draft.`,
      headlines: lines([
        `${brandName(brandKit)} Launch`,
        'Plan Campaigns Faster',
        'Turn Ideas Into Drafts',
        cta(brandKit),
      ]),
      descriptions: lines([
        `${offer(brandKit)} for ${audience(brandKit)}.`,
        'Create review-ready campaign drafts with brand context and platform-specific fields.',
      ]),
      cta: cta(brandKit),
      hashtags: hashtags(brandKit, '#ProductLaunch #Marketing #SaaS #AIAgency #Automation'),
      creative_brief: `${brandContext(brandKit)}\nCreative direction: Launch announcement visual, strong product or service signal, branded colors, and one clear next step.`,
      platform_package: lines([
        'Product Launch Campaign Package',
        '',
        `Google Ads headlines: ${brandName(brandKit)} Launch; Plan Campaigns Faster; Turn Ideas Into Drafts`,
        `Google Ads descriptions: ${offer(brandKit)} for ${audience(brandKit)}.`,
        '',
        `Pinterest title: ${offer(brandKit)} for ${audience(brandKit)}`,
        'Pinterest description: Save this launch workflow for your next campaign.',
        '',
        `LinkedIn post: Today we are launching ${offer(brandKit)} for ${audience(brandKit)}. The goal is simple: make campaign creation more organized, review-ready, and easier to execute.`,
      ]),
    }),
  },
  {
    id: 'weekly-content-pack',
    name: 'Weekly Content Pack',
    platform: 'instagram',
    platformLabel: 'Multi-platform',
    contentType: 'instagram_post',
    goal: 'Plan one week of content.',
    bestFor: 'Weekly planning, operator workflows, and consistent multi-channel posting.',
    fieldsIncluded: ['5 ideas', 'Suggested platform per day', 'Captions', 'Hooks', 'CTA', 'Creative directions'],
    categories: ['Multi-platform'],
    buildFields: (brandKit) => ({
      title: `${brandName(brandKit)} weekly content pack`,
      objective: `Plan five days of content for ${audience(brandKit)} around ${offer(brandKit)}.`,
      target_audience: audience(brandKit),
      offer: offer(brandKit),
      cta: cta(brandKit),
      hashtags: hashtags(brandKit, '#ContentPlan #Marketing #AIAgency #SaaS #Automation'),
      creative_brief: `${brandContext(brandKit)}\nCreative direction: Keep each post visually distinct while maintaining brand colors, readable text, and a clear content theme.`,
      platform_package: lines([
        'Weekly Content Pack',
        '',
        `Monday - LinkedIn: Authority post about why ${audience(brandKit)} need a clearer campaign operating system.`,
        `Hook: Campaign bottlenecks rarely come from lack of ideas.`,
        `Caption: Explain the workflow problem and connect it to ${offer(brandKit)}.`,
        '',
        `Tuesday - Instagram post: Awareness post for ${brandName(brandKit)}.`,
        `Hook: Stop starting every campaign from zero.`,
        `Caption: Introduce ${offer(brandKit)} and invite people to ${cta(brandKit)}.`,
        '',
        'Wednesday - Instagram Reel: Quick before/after workflow.',
        'Hook: This is what campaign planning looks like when it is organized.',
        'Creative direction: 9:16 screen recording or fast visual sequence.',
        '',
        'Thursday - Pinterest Pin: Evergreen traffic pin.',
        `Title: ${offer(brandKit)} for ${audience(brandKit)}`,
        'Creative direction: Vertical branded image with one strong outcome.',
        '',
        'Friday - Facebook Page Post: Professional recap and offer reminder.',
        `Caption: This week, focus on turning campaign ideas into review-ready drafts with ${brandName(brandKit)}.`,
        '',
        `CTA for all posts: ${cta(brandKit)}`,
      ]),
    }),
  },
];
