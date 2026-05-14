import { LoadingState } from '@/components/ui/LoadingState';

export default function AgentsLoading() {
  return (
    <LoadingState
      title="Loading agents"
      description="Preparing agent catalog and department views."
    />
  );
}
