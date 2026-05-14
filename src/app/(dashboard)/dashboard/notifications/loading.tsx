import { LoadingState } from '@/components/ui/LoadingState';

export default function NotificationsLoading() {
  return (
    <LoadingState
      title="Loading notifications"
      description="Preparing notification history."
    />
  );
}
