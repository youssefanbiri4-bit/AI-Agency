import { LoadingState } from '@/components/ui/LoadingState';

export default function ReportsLoading() {
  return (
    <LoadingState
      title="Loading reports"
      description="Preparing analytics and report data."
    />
  );
}
