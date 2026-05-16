import { QualityReviewClient } from './QualityReviewClient';
import type { QualityReviewPlatform, QualityReviewType } from '@/lib/quality-review/review-types';

export const metadata = {
  title: 'Quality Review - AgentFlow AI',
  description: 'Review and score drafts before use.',
};

const reviewTypes: QualityReviewType[] = [
  'marketing_content',
  'ad_copy',
  'creative_brief',
  'ai_studio_image_prompt',
  'ai_studio_video_prompt',
  'prompt_template',
  'workflow_plan',
  'automation_blueprint',
  'alex_draft',
];

const platforms: QualityReviewPlatform[] = ['instagram', 'tiktok', 'facebook', 'linkedin', 'google_ads', 'website', 'generic'];

function readParam(params: Record<string, string | string[] | undefined> | undefined, key: string) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function QualityReviewPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const typeParam = readParam(params, 'type') as QualityReviewType | undefined;
  const platformParam = readParam(params, 'platform') as QualityReviewPlatform | undefined;
  const contentParam = readParam(params, 'content') ?? '';
  const toneParam = readParam(params, 'tone') ?? '';

  return (
    <QualityReviewClient
      initialContent={contentParam.slice(0, 12000)}
      initialReviewType={typeParam && reviewTypes.includes(typeParam) ? typeParam : 'marketing_content'}
      initialPlatform={platformParam && platforms.includes(platformParam) ? platformParam : 'generic'}
      initialBrandTone={toneParam || ''}
    />
  );
}
