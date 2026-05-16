import dynamic from 'next/dynamic';
import { LoadingState } from '@/components/ui/LoadingState';
import { getAlexOpenAIStatus } from '@/lib/alex/alex-context';
import { getAgentTemplateById } from '@/lib/agent-library/templates';
import { recommendAgentTemplates } from '@/lib/agent-library/recommendations';
import { getIndustryPackById } from '@/lib/industry-packs/packs';
import { getTemplateUsageSummaryAction } from '@/app/(dashboard)/dashboard/agent-library/usage-actions';

export const metadata = {
  title: 'Alex Assistant - AgentFlow AI',
  description: 'Personal AI assistant for your agency workspace',
};

const AlexChatClient = dynamic(
  () => import('./AlexChatClient').then((mod) => mod.AlexChatClient),
  {
    loading: () => (
      <LoadingState
        title="Loading Alex"
        description="Connecting to your AI assistant."
      />
    ),
  }
);

export default async function AlexPage({
  searchParams,
}: {
  searchParams?: Promise<{ template?: string | string[] | undefined; knowledgeQuery?: string | string[] | undefined; industryPack?: string | string[] | undefined }>;
}) {
  const openAIStatus = getAlexOpenAIStatus();
  const query = await searchParams;
  const templateParam = Array.isArray(query?.template) ? query?.template[0] : query?.template;
  const knowledgeQuery = Array.isArray(query?.knowledgeQuery) ? query?.knowledgeQuery[0] : query?.knowledgeQuery;
  const industryPackParam = Array.isArray(query?.industryPack) ? query?.industryPack[0] : query?.industryPack;
  const selectedTemplate = getAgentTemplateById(templateParam);
  const selectedIndustryPack = getIndustryPackById(industryPackParam);
  const usageResult = await getTemplateUsageSummaryAction();
  const recommendations = recommendAgentTemplates({
    selectedTemplateId: selectedTemplate?.id ?? null,
    usageSummary: usageResult.data,
    maxResults: 5,
  });

  return (
    <AlexChatClient
      openAIStatus={openAIStatus}
      selectedTemplate={selectedTemplate}
      initialRecommendations={recommendations}
      recommendationNotice={usageResult.error}
      initialKnowledgeQuery={knowledgeQuery ?? null}
      initialIndustryPackPrompt={selectedIndustryPack
        ? `Use the ${selectedIndustryPack.name} safely. Recommend why it fits, the workflow, suggested agents, prompt ideas, and the safest next action. Keep everything planning-only and draft-only.`
        : null}
    />
  );
}
