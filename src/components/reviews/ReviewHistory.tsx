import { Star } from 'lucide-react';
import type { TaskReview } from '@/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDateTime } from '@/lib/utils';

interface ReviewHistoryProps {
  reviews: TaskReview[];
  currentUserId?: string;
}

function reviewerLabel(review: TaskReview, currentUserId?: string) {
  if (currentUserId && review.reviewer_id === currentUserId) {
    return 'You';
  }

  if (review.reviewer_id) {
    return `Reviewer ${review.reviewer_id.slice(0, 8)}`;
  }

  return 'Reviewer unavailable';
}

export function ReviewHistory({ reviews, currentUserId }: ReviewHistoryProps) {
  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={Star}
        title="No reviews recorded"
        description="Review a task to save feedback here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <article key={review.id} className="muted-panel p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-black">
                Rating {review.rating} / 5
              </p>
              <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-black/38">
                {reviewerLabel(review, currentUserId)}
              </p>
            </div>
            <p className="text-sm text-black/52">{formatDateTime(review.created_at)}</p>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-black/68">
            {review.feedback.trim() || 'No feedback provided.'}
          </p>
        </article>
      ))}
    </div>
  );
}
