export type QualityReviewType =
  | 'marketing_content'
  | 'ad_copy'
  | 'creative_brief'
  | 'ai_studio_image_prompt'
  | 'ai_studio_video_prompt'
  | 'prompt_template'
  | 'workflow_plan'
  | 'automation_blueprint'
  | 'alex_draft';

export type QualityReviewPlatform =
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'linkedin'
  | 'google_ads'
  | 'website'
  | 'generic';

export type QualityReviewStatus = 'excellent' | 'good' | 'needs_improvement' | 'risky' | 'blocked';

export interface QualityReviewInput {
  content: string;
  reviewType: QualityReviewType;
  platform: QualityReviewPlatform;
  brandTone?: string;
  useAiAssist?: boolean;
}

export interface QualityReviewResult {
  overall_score: number;
  status: QualityReviewStatus;
  summary: string;
  strengths: string[];
  issues: string[];
  missing_inputs: string[];
  safety_warnings: string[];
  platform_fit: string;
  brand_fit: string;
  clarity_score: number;
  conversion_score: number;
  safety_score: number;
  recommended_fixes: string[];
  improved_version: string | null;
  review_checklist: string[];
  safe_next_actions: string[];
  review_type: QualityReviewType;
  platform: QualityReviewPlatform;
  brand_tone: string | null;
  ai_assisted: boolean;
  ai_assist_note: string | null;
}

export const qualityReviewTypes: Array<{ value: QualityReviewType; label: string }> = [
  { value: 'marketing_content', label: 'Marketing Content' },
  { value: 'ad_copy', label: 'Ad Copy' },
  { value: 'creative_brief', label: 'Creative Brief' },
  { value: 'ai_studio_image_prompt', label: 'AI Studio Image Prompt' },
  { value: 'ai_studio_video_prompt', label: 'AI Studio Video Prompt' },
  { value: 'prompt_template', label: 'Prompt Template' },
  { value: 'workflow_plan', label: 'Workflow Plan' },
  { value: 'automation_blueprint', label: 'Automation Blueprint' },
  { value: 'alex_draft', label: 'Alex Draft' },
];

export const qualityReviewPlatforms: Array<{ value: QualityReviewPlatform; label: string }> = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'website', label: 'Website' },
  { value: 'generic', label: 'Generic' },
];

export const brandToneOptions = [
  'Clear and practical',
  'Warm and expert',
  'Premium SaaS',
  'Bold direct response',
  'Calm professional',
  'Playful but safe',
  'Arabic/RTL friendly',
];
