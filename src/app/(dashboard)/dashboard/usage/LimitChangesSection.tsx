import { Card, CardHeader } from '@/components/ui/Card';
import type { LimitChangeEvent } from './limit-changes';
import { formatChangeSummary } from './limit-changes';

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function eventLabel(type: string) {
  switch (type) {
    case 'quota_limits_updated':
      return { text: 'Limits Updated', color: 'text-blue-600' };
    case 'quota_limits_reset':
      return { text: 'Limits Reset', color: 'text-amber-600' };
    case 'usage_limits_updated':
      return { text: 'Limits Adjusted', color: 'text-emerald-600' };
    default:
      return { text: type, color: 'text-foreground-muted' };
  }
}

export function LimitChangesSection({ events }: { events: LimitChangeEvent[] }) {
  return (
    <Card>
      <CardHeader
        title="Limit Changes"
        description="Recent quota limit modifications by workspace admins."
      />
      <div className="overflow-x-auto p-4 pt-0">
        {events.length === 0 ? (
          <p className="text-xs text-foreground-muted py-4 text-center">
            No limit changes have been recorded yet.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-divider text-xs font-black uppercase tracking-[0.13em] text-foreground-muted">
                <th className="pb-2 pr-4">Who</th>
                <th className="pb-2 pr-4">Action</th>
                <th className="pb-2 pr-4">When</th>
                <th className="pb-2 pr-4">Summary</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const label = eventLabel(event.eventType);
                const summary = formatChangeSummary(event.metadata);
                return (
                  <tr key={event.id} className="border-b border-divider last:border-0">
                    <td className="py-2.5 pr-4 whitespace-nowrap">
                      <p className="font-bold text-foreground-muted text-xs">
                        {event.userName ?? event.userEmail ?? 'Unknown'}
                      </p>
                      {event.userName && event.userEmail ? (
                        <p className="text-[10px] text-foreground-muted">{event.userEmail}</p>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`text-xs font-semibold ${label.color}`}>
                        {label.text}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap font-mono text-xs text-foreground-muted">
                      {formatDateTime(event.createdAt)}
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-foreground-muted max-w-60">
                      {summary || (event.message ?? '—')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
