'use client';

import { useState } from 'react';
import { Star, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface AgentRating {
  id: string;
  userName: string;
  rating: number;
  review: string | null;
  createdAt: string;
}

interface RatingSectionProps {
  agentId: string;
  averageRating: number;
  ratingCount: number;
  ratings: AgentRating[];
  userRating?: number;
  onRate?: (rating: number, review?: string) => Promise<void>;
}

export function RatingSection({
  agentId: _agentId,
  averageRating,
  ratingCount,
  ratings,
  userRating,
  onRate,
}: RatingSectionProps) {
  const [selectedRating, setSelectedRating] = useState(userRating ?? 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (selectedRating === 0 || !onRate) return;
    setSubmitting(true);
    try {
      await onRate(selectedRating, review || undefined);
      setReview('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center gap-6">
        <div className="text-center">
          <p className="text-4xl font-black text-foreground">{averageRating.toFixed(1)}</p>
          <div className="mt-1 flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  'h-4 w-4',
                  i < Math.round(averageRating)
                    ? 'fill-warning text-warning'
                    : 'text-foreground-muted'
                )}
              />
            ))}
          </div>
          <p className="mt-1 text-sm text-foreground-muted">{ratingCount} reviews</p>
        </div>

        {/* Rating distribution */}
        <div className="flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = ratings.filter((r) => r.rating === stars).length;
            const percentage = ratingCount > 0 ? (count / ratingCount) * 100 : 0;
            return (
              <div key={stars} className="flex items-center gap-2">
                <span className="w-8 text-right text-xs text-foreground-muted">{stars}★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full rounded-full bg-warning"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="w-8 text-xs text-foreground-muted">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Write Review */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <h4 className="mb-3 font-bold text-foreground">Write a Review</h4>
        <div className="mb-3 flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setSelectedRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-0.5"
            >
              <Star
                className={cn(
                  'h-6 w-6 transition-colors',
                  (hoverRating || selectedRating) >= star
                    ? 'fill-warning text-warning'
                    : 'text-foreground-muted'
                )}
              />
            </button>
          ))}
          {selectedRating > 0 && (
            <span className="ml-2 text-sm text-foreground-muted">
              {selectedRating === 1 && 'Poor'}
              {selectedRating === 2 && 'Fair'}
              {selectedRating === 3 && 'Good'}
              {selectedRating === 4 && 'Very Good'}
              {selectedRating === 5 && 'Excellent'}
            </span>
          )}
        </div>
        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="Share your experience with this agent (optional)..."
          className="mb-3 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          rows={3}
        />
        <Button
          onClick={handleSubmit}
          disabled={selectedRating === 0 || submitting}
          size="sm"
        >
          <Send className="h-4 w-4" />
          {submitting ? 'Submitting...' : 'Submit Review'}
        </Button>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        <h4 className="font-bold text-foreground">Reviews</h4>
        {ratings.length === 0 && (
          <p className="text-sm text-foreground-muted">No reviews yet. Be the first to review!</p>
        )}
        {ratings.map((rating) => (
          <div key={rating.id} className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {rating.userName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-foreground">{rating.userName}</p>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          'h-3 w-3',
                          i < rating.rating ? 'fill-warning text-warning' : 'text-foreground-muted'
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <span className="text-xs text-foreground-muted">
                {new Date(rating.createdAt).toLocaleDateString()}
              </span>
            </div>
            {rating.review && (
              <p className="mt-3 text-sm text-foreground-muted">{rating.review}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
