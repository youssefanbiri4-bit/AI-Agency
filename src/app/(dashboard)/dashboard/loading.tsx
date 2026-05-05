import { LoadingState } from '@/components/ui/LoadingState';

export default function DashboardLoading() {
  return (
    <LoadingState
      title="Loading dashboard"
      description="Preparing workspace data, catalog status, and task views."
    />
  );
}
