'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/i18n/context';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Activity, AlertTriangle, Star, RefreshCw, CheckCircle2, Send } from 'lucide-react';
import {
  runChurnAnalysisAction,
  acknowledgeChurnAlertAction,
  triggerWinBackFlowAction,
} from '@/actions/customer-success/actions';
import type { CsPageData } from './types';

function Sparkline({ values, height = 48 }: { values: number[]; height?: number }) {
  if (values.length === 0) return null;
  const w = 240;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = w / Math.max(values.length - 1, 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={w} height={height} className="overflow-visible">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={2} className="text-primary" />
    </svg>
  );
}

export function CSOverview({ data }: { data: CsPageData }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState('');

  const runAnalysis = () => {
    startTransition(async () => {
      await runChurnAnalysisAction();
      router.refresh();
    });
  };
  const acknowledge = (id: string) => {
    startTransition(async () => {
      await acknowledgeChurnAlertAction(id);
      router.refresh();
    });
  };
  const launchWinBack = (alertId?: string) => {
    startTransition(async () => {
      await triggerWinBackFlowAction({ alertId: alertId ?? null, note: note || undefined });
      setNote('');
      router.refresh();
    });
  };

  const riskStatTone =
    data.churn.level === 'critical' ? 'danger' : data.churn.level === 'high' ? 'warning' : 'success';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t('cs.riskScore', 'Churn Risk')}
          value={`${data.churn.riskScore}`}
          icon={AlertTriangle}
          tone={riskStatTone}
          subtitle={data.churn.level.toUpperCase()}
        />
        <StatCard
          title={t('cs.openAlerts', 'Open Alerts')}
          value={data.churn.openAlerts}
          icon={AlertTriangle}
          tone={data.churn.openAlerts > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          title={t('cs.activeMembers', 'Active Members')}
          value={`${data.retention.activeMembers30d}/${data.retention.totalMembers}`}
          icon={Activity}
          tone="primary"
          subtitle={`${data.retention.activeRate}% active (30d)`}
        />
        <StatCard
          title={t('cs.nps', 'NPS')}
          value={data.npsSummary.nps}
          icon={Star}
          tone={data.npsSummary.nps >= 0 ? 'success' : 'danger'}
          subtitle={`${data.npsSummary.count} responses`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t('cs.retention', 'Retention (30d)')}
            description={t('cs.dailyActive', 'Daily active users')}
            action={
              <span className={`text-sm font-medium ${data.retention.eventChangePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.retention.eventChangePercent >= 0 ? '+' : ''}
                {data.retention.eventChangePercent}% MoM
              </span>
            }
          />
          <div className="p-4">
            <Sparkline values={data.retention.dailyActive.map((d) => d.activeUsers)} />
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-gray-500">
              <div>
                <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  {data.retention.thisMonthEvents}
                </div>
                {t('cs.thisMonth', 'This month')}
              </div>
              <div>
                <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  {data.retention.lastMonthEvents}
                </div>
                {t('cs.lastMonth', 'Last month')}
              </div>
              <div>
                <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  {data.retention.activeRate}%
                </div>
                {t('cs.activeRateShort', 'Active')}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title={t('cs.churnSignals', 'Churn Signals')}
            action={
              <button
                type="button"
                disabled={pending}
                onClick={runAnalysis}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} />
                {t('cs.runAnalysis', 'Run analysis')}
              </button>
            }
          />
          <div className="max-h-80 space-y-2 overflow-auto p-4">
            {data.churn.signals.length === 0 ? (
              <EmptyState title={t('cs.noSignals', 'No active churn signals')} variant="first-visit" />
            ) : (
              data.churn.signals.map((s, i) => (
                <div key={i} className="rounded-md border border-gray-200 p-3 dark:border-gray-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{s.title}</span>
                    <Badge tone={s.severity === 'critical' ? 'danger' : 'warning'}>{s.severity}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{s.message}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={t('cs.alerts', 'Churn Alerts')}
          description={t('cs.alertsDesc', 'Acknowledge or launch a win-back flow.')}
          action={
            <button
              type="button"
              disabled={pending}
              onClick={() => launchWinBack()}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {t('cs.launchWinBack', 'Launch win-back')}
            </button>
          }
        />
        <div className="space-y-2 p-4">
          {data.churnAlerts.length === 0 ? (
            <EmptyState title={t('cs.noAlerts', 'No churn alerts yet')} variant="first-visit" />
          ) : (
            data.churnAlerts.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border border-gray-200 p-3 dark:border-gray-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{a.title}</span>
                    {a.acknowledged ? <Badge tone="success">{t('cs.ack', 'Acknowledged')}</Badge> : <Badge tone="warning">{t('cs.open', 'Open')}</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">{a.message}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {!a.acknowledged && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => acknowledge(a.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium disabled:opacity-50 dark:border-gray-700"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t('cs.ackBtn', 'Acknowledge')}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => launchWinBack(a.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 disabled:opacity-50 dark:border-blue-800 dark:text-blue-300"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {t('cs.winBack', 'Win-back')}
                  </button>
                </div>
              </div>
            ))
          )}
          <div className="pt-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('cs.winBackNote', 'Optional win-back note…')}
              className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-1.5 text-sm dark:border-gray-700"
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
