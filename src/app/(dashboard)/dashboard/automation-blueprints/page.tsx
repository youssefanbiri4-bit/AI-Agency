import { AutomationBlueprintsClient } from './AutomationBlueprintsClient';

export const metadata = {
  title: 'Automation Blueprints - AgentFlow AI',
  description: 'Planning-only reusable automation workflow blueprints.',
};

export default function AutomationBlueprintsPage() {
  return <AutomationBlueprintsClient />;
}
