import { LoadingState } from '@/components/ui/LoadingState';

export default function SettingsLoading() {
  return (
    <LoadingState
      title="Loading settings"
      description="Preparing workspace settings and preferences."
    />
  );
}
