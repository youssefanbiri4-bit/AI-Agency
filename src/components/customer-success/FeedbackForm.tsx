'use client';

import { useState, useCallback } from 'react';
import { MessageSquarePlus, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { inputStyles } from '@/components/ui/FormControls';
import { buttonStyles } from '@/components/ui/Button';
import { createFeedbackAction } from '@/actions/customer-success/actions';
import { toast } from '@/components/ui/toast';

interface FeedbackFormProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = ['general', 'bug', 'feature', 'ux', 'performance', 'other'];

export function FeedbackForm({ isOpen, onClose }: FeedbackFormProps) {
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [category, setCategory] = useState('general');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      const result = await createFeedbackAction({
        message: message.trim(),
        rating,
        category,
      });
      if (result.ok) {
        toast.success('Feedback submitted', { description: 'Thank you for helping us improve.' });
        setMessage('');
        setRating(null);
        setCategory('general');
        onClose();
      } else {
        toast.error(result.error || 'Failed to submit feedback');
      }
    } finally {
      setSubmitting(false);
    }
  }, [message, rating, category, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-[0_24px_60px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between border-b border-divider px-5 py-4">
          <div className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">Send Feedback</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-foreground-muted/50 hover:bg-foreground-muted/10 hover:text-foreground-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-foreground-muted">Rating (optional)</label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setRating(rating === v ? null : v)}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-bold transition-all',
                    rating === v
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-surface text-foreground-muted hover:border-primary/50'
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-foreground-muted">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={cn(inputStyles(), 'w-full')}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-foreground-muted">Your feedback</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what you think, found a bug, or have a feature idea..."
              rows={4}
              className={cn(inputStyles(), 'w-full resize-none')}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-divider px-5 py-3">
          <button type="button" onClick={onClose} className={buttonStyles({ variant: 'ghost', size: 'sm' })}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !message.trim()}
            className={buttonStyles({ variant: 'primary', size: 'sm' })}
          >
            <Send className="h-3.5 w-3.5" />
            {submitting ? 'Sending...' : 'Send feedback'}
          </button>
        </div>
      </div>
    </div>
  );
}
