'use client';

import { useActionState } from 'react';
import { CheckCircle2, ChevronDown, RotateCcw, Star } from 'lucide-react';
import { reviewTaskAction, type ReviewTaskState } from './actions';
import { Button } from '@/components/ui/Button';
import { Label, Select, Textarea } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';

interface ReviewFormProps {
  taskId: string;
}

const initialState: ReviewTaskState = {
  error: null,
};

export function ReviewForm({ taskId }: ReviewFormProps) {
  const [state, formAction, isPending] = useActionState(reviewTaskAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="taskId" value={taskId} />

      {state?.error && (
        <Notice tone="danger" title="Review was not saved">
          {state.error}
        </Notice>
      )}

      <div className="relative">
        <Label htmlFor={`rating-${taskId}`}>Rating</Label>
        <ChevronDown className="pointer-events-none absolute bottom-3 right-3.5 h-4 w-4 text-black/34" />
        <Select id={`rating-${taskId}`} name="rating" defaultValue="5" disabled={isPending}>
          <option value="5">5 - Excellent</option>
          <option value="4">4 - Good</option>
          <option value="3">3 - Acceptable</option>
          <option value="2">2 - Needs work</option>
          <option value="1">1 - Major changes</option>
        </Select>
      </div>

      <div>
        <Label htmlFor={`feedback-${taskId}`}>Feedback</Label>
        <Textarea
          id={`feedback-${taskId}`}
          name="feedback"
          rows={5}
          disabled={isPending}
          placeholder="Add review notes. Feedback is required when requesting changes."
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="submit"
          name="intent"
          value="approve"
          variant="success"
          className="flex-1"
          disabled={isPending}
        >
          {isPending ? <Star className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
          Approve
        </Button>
        <Button
          type="submit"
          name="intent"
          value="request_changes"
          variant="outline"
          className="flex-1"
          disabled={isPending}
        >
          <RotateCcw className="h-5 w-5" />
          Request Changes
        </Button>
      </div>
    </form>
  );
}
