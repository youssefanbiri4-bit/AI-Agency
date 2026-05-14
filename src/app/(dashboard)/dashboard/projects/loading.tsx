import { LoadingState } from '@/components/ui/LoadingState';

export default function ProjectsLoading() {
  return (
    <LoadingState
      title="Loading projects"
      description="Preparing project data and repositories."
    />
  );
}
