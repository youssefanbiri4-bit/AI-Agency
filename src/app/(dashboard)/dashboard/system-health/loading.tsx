import { LoadingState } from '@/components/ui/LoadingState';

export default function SystemHealthLoading() {
  return (
    <LoadingState
      title="Loading system health"
      description="Checking provider status and integration readiness."
    />
  );
}
