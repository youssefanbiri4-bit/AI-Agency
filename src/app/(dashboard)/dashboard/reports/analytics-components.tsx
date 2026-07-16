import Link from 'next/link';
import { Layers3 } from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';
import { percent, topEntries, label, safeDashboardHref } from './analytics-utils';
import type { NextAction } from './analytics-types';

export function MetricTile({
  label: metricLabel,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  helper?: string;
  icon: typeof Layers3;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-black/7 bg-white p-4 shadow-[0_14px_36px_rgba(93,107,107,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.13em] text-black/42">{metricLabel}</p>
          <p className="mt-2 break-words text-2xl font-black tracking-normal text-[#5D6B6B]">{value}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D5E5E5]/72 text-[#F7CBCA]">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {helper ? <p className="mt-3 text-sm font-semibold leading-6 text-black/55">{helper}</p> : null}
    </div>
  );
}

export function AnalyticsSection({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-black/7 bg-white/92 p-5 shadow-[0_18px_48px_rgba(93,107,107,0.07)]">
      <div className="mb-5 flex min-w-0 flex-col gap-3 border-b border-black/6 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-black text-[#5D6B6B]">{title}</h3>
          {description ? <p className="mt-1 text-sm leading-6 text-black/58">{description}</p> : null}
        </div>
        {action ? <div className="flex max-w-full shrink-0 flex-wrap gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function ProgressRow({ name, value, total }: { name: string; value: number; total: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="min-w-0 whitespace-normal break-words text-sm font-bold text-black/70">{name}</span>
        <span className="font-mono text-sm font-black text-[#5D6B6B]">{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#F1F7F7] ring-1 ring-black/5">
        <div className="h-full rounded-full bg-[#F7CBCA]" style={{ width: `${percent(value, total)}%` }} />
      </div>
    </div>
  );
}

export function CountBars({ counts, total, emptyText }: { counts: Record<string, number>; total: number; emptyText: string }) {
  const entries = topEntries(counts, 8);

  if (entries.length === 0) {
    return <EmptyState title={emptyText} />;
  }

  return (
    <div className="space-y-4">
      {entries.map(([key, value]) => (
        <ProgressRow key={key} name={label(key)} value={value} total={total} />
      ))}
    </div>
  );
}

export function EmptyState({ title, helper }: { title: string; helper?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/12 bg-[#F1F7F7]/62 p-6 text-center">
      <p className="font-black text-[#5D6B6B]">{title}</p>
      {helper ? <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-black/56">{helper}</p> : null}
    </div>
  );
}

export function DataTable({
  headers,
  rows,
  emptyText,
}: {
  headers: string[];
  rows: string[][];
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyText} />;
  }

  return (
    <>
    <div className="grid gap-3 md:hidden">
      {rows.map((row) => (
        <article key={row.join('|')} className="rounded-2xl border border-black/7 bg-white p-4">
          <dl className="space-y-3">
            {row.map((cell, index) => (
              <div key={`${cell}-${index}`} className="min-w-0">
                <dt className="text-xs font-black uppercase tracking-[0.1em] text-black/42">{headers[index]}</dt>
                <dd className="mt-1 whitespace-normal break-words text-sm font-semibold leading-6 text-black/64">{cell}</dd>
              </div>
            ))}
          </dl>
        </article>
      ))}
    </div>
    <div className="hidden overflow-x-auto rounded-2xl border border-black/7 md:block">
      <table className="w-full min-w-[860px] table-auto divide-y divide-black/7 text-left text-sm">
        <thead className="bg-[#F1F7F7]">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-black/45">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-black/7 bg-white">
          {rows.map((row) => (
            <tr key={row.join('|')} className="align-top">
              {row.map((cell, index) => (
                <td key={`${cell}-${index}`} className="min-w-[9rem] max-w-[24rem] whitespace-normal break-words px-4 py-3 font-semibold leading-6 text-black/62">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}

export function NextActionsList({ actions }: { actions: NextAction[] }) {
  if (actions.length === 0) {
    return <EmptyState title="No urgent next actions detected" helper="The selected filters do not show urgent operational blockers." />;
  }

  return (
    <div className="space-y-3">
      {actions.map((action) => (
        <div key={`${action.priority}-${action.title}`} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-black/7 bg-[#F1F7F7]/55 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-black text-[#5D6B6B]">{action.title}</p>
            <p className="mt-1 text-sm leading-6 text-black/58">{action.reason}</p>
            <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-[#F7CBCA]">{action.priority}</p>
          </div>
          <Link href={safeDashboardHref(action.href)} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
            {action.cta}
          </Link>
        </div>
      ))}
    </div>
  );
}
