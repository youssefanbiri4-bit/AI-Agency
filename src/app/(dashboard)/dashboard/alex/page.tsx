import dynamic from 'next/dynamic';
import { LoadingState } from '@/components/ui/LoadingState';
import { getAlexOpenAIStatus } from '@/lib/alex/alex-context';

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

export default function AlexPage() {
  const openAIStatus = getAlexOpenAIStatus();
  return <AlexChatClient openAIStatus={openAIStatus} />;
}
