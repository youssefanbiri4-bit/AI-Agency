import { LoadingState } from '@/components/ui/LoadingState';

export default function CampaignsLoading() {
  return (
    <LoadingState
      title="Loading campaigns"
      description="Preparing campaign data and provider status."
    />
  );
}
