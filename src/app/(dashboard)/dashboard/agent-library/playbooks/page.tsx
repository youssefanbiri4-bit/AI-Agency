import { listWorkflowPlaybooksAction } from './actions';
import { PlaybooksClient } from './PlaybooksClient';

export default async function AgentWorkflowPlaybooksPage() {
  const playbooksResult = await listWorkflowPlaybooksAction();

  return (
    <PlaybooksClient
      initialPlaybooks={playbooksResult.data}
      initialError={playbooksResult.error}
    />
  );
}
