'use client';

import { useState, useCallback } from 'react';
import { Star, X, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonStyles } from '@/components/ui/Button';
import { createNpsAction } from '@/actions/customer-success/actions';
import { toast } from '@/components/ui/toast';

interface NpsSurveyProps {
  isOpen: boolean;
  onClose: () => void;
  storageKey?: string;
}

const SCORE_LABELS: Record<number, string> = {
  0: 'Not at all likely',
  1: 'Very unlikely',
  2: 'Unlikely',
  3: 'Somewhat unlikely',
  4: 'Slightly unlikely',
  5: 'Neutral',
  6: 'Slightly likely',
  7: 'Somewhat likely',
  8: 'Likely',
  9: 'Very likely',
  10: 'Extremely likely',
};

function scoreCategory(score: number): 'detractor' | 'passive' | 'promoter' {
  if (score >= 9) return 'promoter';
  if (score >= 7) return 'passive';
  return 'detractor';
}

const categoryColors: Record<string, string> = {
  detractor: 'bg-danger text-danger-foreground',
  passive: 'bg-warning text-warning-foreground',
  promoter: 'bg-success text-success-foreground',
};

export function NpsSurvey({ isOpen, onClose, storageKey = 'af-nps-dismissed' }: NpsSurveyProps) {
  const [step, setStep] = useState<'score' | 'comment'>('score');
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = useCallback(() => {
    try { window.localStorage.setItem(storageKey, Date.now().toString()); } catch { /* */ }
    setStep('score');
    setScore(null);
    setComment('');
    onClose();
  }, [onClose, storageKey]);

  const handleScoreSelect = (s: number) => {
    setScore(s);
    setStep('comment');
  };

  const handleSubmit = useCallback(async () => {
    if (score === null) return;
    setSubmitting(true);
    try {
      const result = await createNpsAction({ score, comment: comment.trim() || undefined });
      if (result.ok) {
        toast.success('Thanks for your feedback!');
        handleClose();
      } else {
        toast.error(result.error || 'Failed to submit');
      }
    } finally {
      setSubmitting(false);
    }
  }, [score, comment, handleClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-[0_24px_60px_rgba(0,0,0,0.2)]">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close survey"
          className="absolute right-3 top-3 rounded-lg p-1 text-foreground-muted/50 transition-colors hover:bg-foreground-muted/10 hover:text-foreground-muted"
        >
          <X className="h-4 w-4" />
        </button>

        {step === 'score' ? (
          <div className="p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Star className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-foreground">How likely are you to recommend AgentFlow AI?</h2>
            <p className="mt-1 text-sm text-foreground-muted">Rate on a scale of 0-10</p>

            <div className="mt-4 grid grid-cols-11 gap-1">
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleScoreSelect(i)}
                  className={cn(
                    'flex h-10 items-center justify-center rounded-lg border text-sm font-bold transition-all duration-150',
                    'hover:scale-105 active:scale-95',
                    'border-border bg-surface text-foreground hover:border-primary hover:bg-primary/5'
                  )}
                >
                  {i}
                </button>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-foreground-muted">
              <span>Not at all likely</span>
              <span>Extremely likely</span>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black', categoryColors[scoreCategory(score!)])}>
                {score}
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Tell us more</h2>
                <p className="text-xs text-foreground-muted">{SCORE_LABELS[score!]}</p>
              </div>
            </div>

            <div className="relative">
              <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-foreground-muted/40" />
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What can we improve? (optional)"
                rows={4}
                className="w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 pl-9 text-sm text-foreground placeholder:text-foreground-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep('score')}
                className={buttonStyles({ variant: 'ghost', size: 'sm' })}
              >
                Back
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className={buttonStyles({ variant: 'primary', size: 'sm' })}
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
