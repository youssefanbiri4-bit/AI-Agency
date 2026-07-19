'use client';

import { useState } from 'react';
import { useLanguage } from '@/i18n/context';
import { Card, CardHeader } from '@/components/ui/Card';
import { LifeBuoy, Ticket, MessageSquare, Star, BarChart3, ShieldAlert } from 'lucide-react';
import { CSOverview } from './CSOverview';
import { CSTickets } from './CSTickets';
import { CSFeedback } from './CSFeedback';
import { CSNps } from './CSNps';
import { CSReports } from './CSReports';
import type { CsPageData } from './types';

type Tab = 'overview' | 'tickets' | 'feedback' | 'nps' | 'reports';

const TABS: { id: Tab; labelKey: string; icon: typeof LifeBuoy }[] = [
  { id: 'overview', labelKey: 'cs.tabOverview', icon: LifeBuoy },
  { id: 'tickets', labelKey: 'cs.tabTickets', icon: Ticket },
  { id: 'feedback', labelKey: 'cs.tabFeedback', icon: MessageSquare },
  { id: 'nps', labelKey: 'cs.tabNps', icon: Star },
  { id: 'reports', labelKey: 'cs.tabReports', icon: BarChart3 },
];

export function CustomerSuccessClient({ data }: { data: CsPageData }) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('overview');

  if (!data.isConfigured) {
    return (
      <div className="space-y-6">
        <PageTitle t={t} />
        <Card>
          <CardHeader title={t('cs.notConfigured', 'Customer Success unavailable')} />
          <p className="p-4 text-sm text-foreground-muted">
            {t('cs.notConfiguredHelp', 'Database connection is not configured.')}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle t={t} />

      <div className="flex flex-wrap gap-2 border-b border-border">
        {TABS.map((tb) => {
          const Icon = tb.icon;
          const active = tab === tb.id;
          return (
            <button
              key={tb.id}
              type="button"
              onClick={() => setTab(tb.id)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-foreground-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t(tb.labelKey, defaultLabel(tb.id))}
              {tb.id === 'tickets' && data.tickets.length > 0 && (
                <span className="ml-1 rounded-full bg-surface px-1.5 text-xs">
                  {data.tickets.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && <CSOverview data={data} />}
      {tab === 'tickets' && <CSTickets tickets={data.tickets} />}
      {tab === 'feedback' && <CSFeedback feedback={data.feedback} />}
      {tab === 'nps' && <CSNps nps={data.nps} summary={data.npsSummary} />}
      {tab === 'reports' && <CSReports data={data} />}
    </div>
  );
}

function PageTitle({ t }: { t: (k: string, f: string) => string }) {
  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-semibold">
        <ShieldAlert className="h-6 w-6 text-primary" />
        {t('cs.title', 'Customer Success')}
      </h1>
      <p className="mt-1 text-sm text-foreground-muted">
        {t('cs.subtitle', 'Retention, churn prevention, support and feedback.')}
      </p>
    </div>
  );
}

function defaultLabel(id: Tab): string {
  switch (id) {
    case 'overview':
      return 'Overview';
    case 'tickets':
      return 'Support Tickets';
    case 'feedback':
      return 'Feedback';
    case 'nps':
      return 'NPS';
    case 'reports':
      return 'Reports & Export';
  }
}
