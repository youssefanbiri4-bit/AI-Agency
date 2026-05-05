'use client';

import { useActionState, useEffect, useState } from 'react';
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
  const [isRequestingChanges, setIsRequestingChanges] = useState(false);
  const [feedback, setFeedback] = useState('');
  const hasRevisionNotes = feedback.trim().length > 0;

  useEffect(() => {
    if (isRequestingChanges) {
      document.getElementById(`feedback-${taskId}`)?.focus();
    }
  }, [isRequestingChanges, taskId]);

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

      <div
        className={
          isRequestingChanges
            ? 'rounded-lg border border-[#F55477]/18 bg-[#F0DBEF]/38 p-4'
            : undefined
        }
      >
        <Label htmlFor={`feedback-${taskId}`}>
          {isRequestingChanges ? 'What should the agent change?' : 'Feedback'}
        </Label>
        <Textarea
          id={`feedback-${taskId}`}
          name="feedback"
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          rows={5}
          disabled={isPending}
          placeholder={
            isRequestingChanges
              ? 'Describe the specific revisions the agent should make next.'
              : 'Optional review notes. Required when requesting changes.'
          }
          aria-describedby={isRequestingChanges ? `revision-help-${taskId}` : undefined}
        />
        {isRequestingChanges && (
          <p id={`revision-help-${taskId}`} className="mt-2 text-xs font-semibold text-black/48">
            Revision notes are required before sending this task back.
          </p>
        )}
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
        {isRequestingChanges ? (
          <Button
            type="submit"
            name="intent"
            value="request_changes"
            variant="outline"
            className="flex-1"
            disabled={isPending || !hasRevisionNotes}
          >
            <RotateCcw className="h-5 w-5" />
            Submit Request
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={isPending}
            aria-expanded={isRequestingChanges}
            onClick={() => setIsRequestingChanges(true)}
          >
            <RotateCcw className="h-5 w-5" />
            Request Changes
          </Button>
        )}
      </div>
    </form>
  );
}
