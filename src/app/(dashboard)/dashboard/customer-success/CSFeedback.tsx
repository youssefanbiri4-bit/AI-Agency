'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/i18n/context';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { MessageSquare, Plus, Trash2, Star } from 'lucide-react';
import { createFeedbackAction, deleteFeedbackAction } from '@/actions/customer-success/actions';
import type { CustomerFeedbackRecord } from '@/types/database';

export function CSFeedback({ feedback }: { feedback: CustomerFeedbackRecord[] }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await createFeedbackAction({ rating, message });
      if (!res.ok) {
        setError(res.error ?? 'Failed to submit feedback.');
        return;
      }
      setMessage('');
      setRating(null);
      setShowForm(false);
      router.refresh();
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      await deleteFeedbackAction(id);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" />
          {t('cs.newFeedback', 'Add feedback')}
        </button>
      </div>

      {showForm && (
        <Card>
          <CardHeader title={t('cs.shareFeedback', 'Share feedback')} />
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={n <= (rating ?? 0) ? 'text-amber-400' : 'text-gray-300'}
                  aria-label={`${n}`}
                >
                  <Star className="h-5 w-5" fill={n <= (rating ?? 0) ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('cs.feedbackPlaceholder', 'What could we improve?')}
              rows={3}
              className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
            />
            <button
              type="button"
              disabled={pending || !message.trim()}
              onClick={submit}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {t('cs.submit', 'Submit')}
            </button>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        </Card>
      )}

      {feedback.length === 0 ? (
        <EmptyState title={t('cs.noFeedback', 'No feedback yet')} icon={<MessageSquare className="h-6 w-6" />} variant="first-visit" />
      ) : (
        <div className="space-y-2">
          {feedback.map((f) => (
            <div key={f.id} className="flex items-start justify-between gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-800">
              <div>
                <div className="flex items-center gap-2">
                  {f.rating && (
                    <span className="flex items-center gap-0.5 text-amber-400">
                      <Star className="h-3.5 w-3.5" fill="currentColor" />
                      {f.rating}
                    </span>
                  )}
                  <Badge tone="neutral">{f.category}</Badge>
                </div>
                <p className="mt-1 text-sm">{f.message}</p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => remove(f.id)}
                className="shrink-0 rounded-md border border-gray-300 p-1.5 text-gray-500 hover:text-red-600 dark:border-gray-700"
                aria-label="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
