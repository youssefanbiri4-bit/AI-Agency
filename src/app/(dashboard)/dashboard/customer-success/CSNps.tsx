'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/i18n/context';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Star, Plus } from 'lucide-react';
import { createNpsAction } from '@/actions/customer-success/actions';
import type { NpsResponseRecord } from '@/types/database';
import type { NpsSummary } from '@/lib/data/customer-success';

export function CSNps({ nps, summary }: { nps: NpsResponseRecord[]; summary: NpsSummary }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [score, setScore] = useState(7);
  const [comment, setComment] = useState('');

  const submit = () => {
    startTransition(async () => {
      const res = await createNpsAction({ score, comment: comment || null });
      if (res.ok) {
        setComment('');
        setShowForm(false);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader title={t('cs.npsScore', 'NPS')} />
          <div className="p-4 text-3xl font-semibold">{summary.nps}</div>
        </Card>
        <Card>
          <CardHeader title={t('cs.promoters', 'Promoters')} />
          <div className="p-4 text-3xl font-semibold text-green-600">{summary.promoters}</div>
        </Card>
        <Card>
          <CardHeader title={t('cs.passives', 'Passives')} />
          <div className="p-4 text-3xl font-semibold text-amber-600">{summary.passives}</div>
        </Card>
        <Card>
          <CardHeader title={t('cs.detractors', 'Detractors')} />
          <div className="p-4 text-3xl font-semibold text-red-600">{summary.detractors}</div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={t('cs.npsTrend', 'NPS trend')}
          action={
            <button
              type="button"
              onClick={() => setShowForm((s) => !s)}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              {t('cs.addNps', 'Add response')}
            </button>
          }
        />
        <div className="p-4">
          {summary.trend.length === 0 ? (
            <EmptyState title={t('cs.noNps', 'No NPS responses')} icon={<Star className="h-6 w-6" />} variant="first-visit" />
          ) : (
            <div className="space-y-1">
              {summary.trend.map((tr) => (
                <div key={tr.period} className="flex items-center gap-3 text-sm">
                  <span className="w-16 text-gray-500">{tr.period}</span>
                  <div className="h-2 flex-1 rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${Math.min(100, Math.abs(tr.nps))}%` }}
                    />
                  </div>
                  <span className="w-16 text-right font-medium">{tr.nps}</span>
                  <span className="w-12 text-right text-xs text-gray-400">{tr.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {showForm && (
        <Card>
          <CardHeader title={t('cs.rateUs', 'How likely are you to recommend us? (0-10)')} />
          <div className="space-y-3 p-4">
            <input
              type="range"
              min={0}
              max={10}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="w-full"
            />
            <div className="text-center text-2xl font-semibold">{score}</div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('cs.npsComment', 'Comment (optional)')}
              rows={2}
              className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
            />
            <button
              type="button"
              disabled={pending}
              onClick={submit}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {t('cs.submit', 'Submit')}
            </button>
          </div>
        </Card>
      )}

      {nps.length > 0 && (
        <Card>
          <CardHeader title={t('cs.recentNps', 'Recent responses')} />
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {nps.slice(0, 10).map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 text-sm">
                <span className="font-medium">{r.score}/10</span>
                <span className="flex-1 px-3 text-gray-500">{r.comment || '—'}</span>
                <Badge tone={r.score >= 9 ? 'success' : r.score <= 6 ? 'danger' : 'warning'}>
                  {r.score >= 9 ? 'promoter' : r.score <= 6 ? 'detractor' : 'passive'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
