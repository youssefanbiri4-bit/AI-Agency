import { LoadingState } from '@/components/ui/LoadingState';

export default function TasksLoading() {
  return (
    <LoadingState
      title="Loading tasks"
      description="Preparing task list and status overview."
    />
  );
}
