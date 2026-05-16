import { getValidWorkflowTemplates } from '@/lib/agent-library/workflow-builder';
import { getWorkflowPresetById } from '@/lib/agent-library/workflow-presets';
import { getWorkflowPlaybookAction } from '../playbooks/actions';
import { WorkflowBuilderClient } from './WorkflowBuilderClient';

export const metadata = {
  title: 'Agent Workflow Builder - AgentFlow AI',
  description: 'Build safe draft workflows from Agent Library templates.',
};

function readParam(params: Record<string, string | string[] | undefined> | undefined, key: string) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function AgentWorkflowBuilderPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const templateParam = readParam(params, 'templates') ?? '';
  const presetParam = readParam(params, 'preset');
  const playbookParam = readParam(params, 'playbook');
  const from = readParam(params, 'from');
  const playbookResult = playbookParam ? await getWorkflowPlaybookAction(playbookParam) : null;
  const openedPlaybook = playbookResult?.data ?? null;
  const preset = getWorkflowPresetById(presetParam);
  const requestedIds = templateParam
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const sourceTemplateIds = openedPlaybook?.templateIds
    ?? (requestedIds.length > 0 ? requestedIds : preset?.steps ?? []);
  const initialTemplateIds = getValidWorkflowTemplates(sourceTemplateIds).map((template) => template.id);

  return (
    <WorkflowBuilderClient
      initialTemplateIds={initialTemplateIds}
      initialPresetId={preset?.id ?? null}
      initialPlaybook={openedPlaybook}
      initialPlaybookError={playbookResult?.error ?? null}
      openedFrom={from === 'alex' ? 'alex' : 'agent_library'}
    />
  );
}
