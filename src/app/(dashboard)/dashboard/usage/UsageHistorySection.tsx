import { Card, CardHeader } from '@/components/ui/Card';
import type { DailyUsageRow } from './usage-history';

type NumericKey = Exclude<keyof DailyUsageRow, 'date'>;

const QUOTA_COLUMNS: Array<{ key: NumericKey; label: string; color: string }> = [
  { key: 'ai_generations', label: 'AI Gen', color: 'bg-violet-500' },
  { key: 'tasks', label: 'Tasks', color: 'bg-blue-500' },
  { key: 'creative_assets', label: 'Assets', color: 'bg-teal-500' },
  { key: 'content_items', label: 'Content', color: 'bg-amber-500' },
  { key: 'content_publishes', label: 'Publishes', color: 'bg-orange-500' },
  { key: 'reels_publishes', label: 'Reels', color: 'bg-pink-500' },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function UsageHistorySection({
  data,
  days,
}: {
  data: DailyUsageRow[];
  days: number;
}) {
  const maxPerColumn: Record<NumericKey, number> = {} as Record<NumericKey, number>;
  for (const col of QUOTA_COLUMNS) {
    maxPerColumn[col.key] = Math.max(...data.map((r) => r[col.key]), 1);
  }

  return (
    <Card>
      <CardHeader
        title={`Usage History (Last ${days} Days)`}
        description="Daily totals per quota type. Bar widths are relative to each column's daily max."
      />
      <div className="overflow-x-auto p-4 pt-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-divider text-xs font-black uppercase tracking-[0.13em] text-foreground-muted">
              <th className="pb-2 pr-4">Date</th>
              {QUOTA_COLUMNS.map((col) => (
                <th key={col.key} className="pb-2 pr-4 text-right tabular-nums">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={QUOTA_COLUMNS.length + 1} className="py-6 text-center text-xs text-foreground-muted">
                  No usage events recorded in the last {days} days.
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={row.date} className="border-b border-divider last:border-0">
                  <td className="py-2.5 pr-4 whitespace-nowrap font-semibold text-foreground-muted text-xs">
                    {formatDate(row.date)}
                  </td>
                  {QUOTA_COLUMNS.map((col) => {
                    const value = row[col.key];
                    const max = maxPerColumn[col.key];
                    const pct = max > 0 ? (value / max) * 100 : 0;
                    return (
                      <td key={col.key} className="py-2.5 pr-4">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="h-5 w-16 sm:w-20 rounded bg-black/6 overflow-hidden">
                            <div
                              className={`h-5 rounded ${col.color}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs font-bold text-foreground-muted tabular-nums w-6 text-right">
                            {value}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
