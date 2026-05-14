import { LoadingState } from '@/components/ui/LoadingState';

export default function CalendarLoading() {
  return (
    <LoadingState
      title="Loading calendar"
      description="Preparing scheduled content and events."
    />
  );
}
