'use client';

import { useState, useMemo } from 'react';
import { Download, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button, buttonStyles } from '@/components/ui/Button';
import type { TeamUsageData, TeamMemberUsage } from './team-usage';

const QUOTA_COLUMNS: Array<{ key: string; label: string }> = [
  { key: 'ai_generations', label: 'AI Gen' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'creative_assets', label: 'Assets' },
  { key: 'content_items', label: 'Content' },
  { key: 'content_publishes', label: 'Publishes' },
  { key: 'reels_publishes', label: 'Reels' },
];

type SortKey = 'name-asc' | 'name-desc' | 'usage-desc' | 'usage-asc';

function totalUsage(usage: Partial<Record<string, number>>): number {
  return Object.values(usage).reduce<number>((sum, v) => sum + (v ?? 0), 0);
}

function formatCsvValue(val: string | number | null | undefined): string {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(
  members: TeamMemberUsage[],
  perUserEvents: Record<string, Partial<Record<string, number>>>,
  hasPerUserData: boolean
): string {
  const header = ['Member', 'Email', 'Role', ...QUOTA_COLUMNS.map((c) => c.label), 'Total'].join(',');
  const rows = members.map((m) => {
    const usage = perUserEvents[m.userId] ?? {};
    const cols = [
      formatCsvValue(m.fullName ?? m.email ?? 'Unknown'),
      formatCsvValue(m.email),
      formatCsvValue(m.role),
      ...QUOTA_COLUMNS.map((c) => (hasPerUserData ? (usage[c.key] ?? 0) : '—')),
      hasPerUserData ? totalUsage(usage) : '—',
    ];
    return cols.join(',');
  });
  return [header, ...rows].join('\n');
}

export function TeamUsageSection({ data }: { data: TeamUsageData }) {
  const { members, perUserEvents, hasPerUserData } = data;
  const [sortKey, setSortKey] = useState<SortKey>('name-asc');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter((m) => {
      const name = (m.fullName ?? m.email ?? '').toLowerCase();
      const email = (m.email ?? '').toLowerCase();
      const role = m.role.toLowerCase();
      return name.includes(q) || email.includes(q) || role.includes(q);
    });
  }, [members, search]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sortKey) {
      case 'name-asc':
        list.sort((a, b) => (a.fullName ?? a.email ?? '').localeCompare(b.fullName ?? b.email ?? ''));
        break;
      case 'name-desc':
        list.sort((a, b) => (b.fullName ?? b.email ?? '').localeCompare(a.fullName ?? a.email ?? ''));
        break;
      case 'usage-desc': {
        if (!hasPerUserData) break;
        list.sort((a, b) => {
          const ta = totalUsage(perUserEvents[a.userId] ?? {});
          const tb = totalUsage(perUserEvents[b.userId] ?? {});
          return tb - ta;
        });
        break;
      }
      case 'usage-asc': {
        if (!hasPerUserData) break;
        list.sort((a, b) => {
          const ta = totalUsage(perUserEvents[a.userId] ?? {});
          const tb = totalUsage(perUserEvents[b.userId] ?? {});
          return ta - tb;
        });
        break;
      }
    }
    return list;
  }, [filtered, sortKey, perUserEvents, hasPerUserData]);

  function cycleSort() {
    const order: SortKey[] = ['name-asc', 'name-desc', 'usage-desc', 'usage-asc'];
    const idx = order.indexOf(sortKey);
    setSortKey(order[(idx + 1) % order.length]);
  }

  function handleExport() {
    const csv = buildCsv(members, perUserEvents, hasPerUserData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team-usage-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const sortIcon =
    sortKey === 'name-asc' || sortKey === 'usage-asc' ? (
      <ArrowUp className="h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5" />
    );
  const sortLabel =
    sortKey.startsWith('name') ? 'Name' : 'Usage';

  return (
    <Card>
      <CardHeader
        title="Usage by Team Member"
        description="Per-member usage tracked from workspace events this month."
      />
      <div className="space-y-4 p-4 pt-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
            <input
              type="text"
              placeholder="Search by name, email, or role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-white pl-10 pr-3 text-sm text-foreground-muted placeholder-foreground-muted focus:border-[#F7CBCA] focus:outline-none focus:ring-2 focus:ring-[#F7CBCA]/18"
            />
          </div>
          <button
            type="button"
            onClick={cycleSort}
            className={buttonStyles({ variant: 'outline', size: 'sm' })}
          >
            <ArrowUpDown className="h-4 w-4" />
            Sort: {sortLabel}
            {sortIcon}
          </button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-divider text-xs font-black uppercase tracking-[0.13em] text-foreground-muted">
                <th className="pb-2 pr-4">Member</th>
                <th className="pb-2 pr-4">Role</th>
                {QUOTA_COLUMNS.map((col) => (
                  <th key={col.key} className="pb-2 pr-4 text-right tabular-nums">{col.label}</th>
                ))}
                {hasPerUserData ? (
                  <th className="pb-2 text-right tabular-nums">Total</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={QUOTA_COLUMNS.length + 3 + (hasPerUserData ? 1 : 0)} className="py-8 text-center text-sm text-foreground-muted">
                    {search.trim()
                      ? 'No members match your search.'
                      : 'No workspace members found.'}
                  </td>
                </tr>
              ) : sorted.map((member) => (
                <MemberRow
                  key={member.userId}
                  member={member}
                  usage={perUserEvents[member.userId] ?? {}}
                  hasPerUserData={hasPerUserData}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-divider bg-surface/60 p-3 text-xs leading-5 text-foreground-muted">
          {hasPerUserData ? (
            <p>Per-user usage is based on tracked usage events. Some actions may not be attributed to a specific user yet.</p>
          ) : (
            <p>
              No per-user usage events have been recorded yet this month. Usage will appear here as team members
              create tasks, generate AI content, and use other tracked features.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

function MemberRow({
  member,
  usage,
  hasPerUserData,
}: {
  member: TeamMemberUsage;
  usage: Partial<Record<string, number>>;
  hasPerUserData: boolean;
}) {
  return (
    <tr className="border-b border-divider last:border-0">
      <td className="py-2.5 pr-4">
        <p className="font-bold text-foreground-muted">{member.fullName ?? member.email ?? 'Unknown'}</p>
        {member.fullName && member.email ? (
          <p className="text-xs text-foreground-muted">{member.email}</p>
        ) : null}
      </td>
      <td className="py-2.5 pr-4">
        <span className="rounded-md bg-surface px-2 py-0.5 text-xs font-semibold text-foreground-muted">
          {member.role}
        </span>
      </td>
      {QUOTA_COLUMNS.map((col) => (
        <td key={col.key} className="py-2.5 pr-4 text-right font-mono text-sm font-bold text-foreground-muted">
          {hasPerUserData ? (usage[col.key] ?? 0) : '—'}
        </td>
      ))}
      {hasPerUserData ? (
        <td className="py-2.5 text-right font-mono text-sm font-bold text-black/70">
          {Object.values(usage).reduce<number>((s, v) => s + (v ?? 0), 0)}
        </td>
      ) : null}
    </tr>
  );
}
