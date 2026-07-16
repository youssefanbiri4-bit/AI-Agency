'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/i18n/context';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Ticket, Plus, Trash2 } from 'lucide-react';
import { createSupportTicketAction, updateTicketStatusAction, deleteTicketAction } from '@/actions/customer-success/actions';
import type { SupportTicketRecord } from '@/types/database';

const STATUSES = ['open', 'in_progress', 'pending', 'resolved', 'closed'] as const;
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'resolved':
    case 'closed':
      return 'success';
    case 'in_progress':
      return 'info';
    case 'pending':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function CSTickets({ tickets }: { tickets: SupportTicketRecord[] }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<string>('normal');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await createSupportTicketAction({ subject, description, priority });
      if (!res.ok) {
        setError(res.error ?? 'Failed to create ticket.');
        return;
      }
      setSubject('');
      setDescription('');
      setShowForm(false);
      router.refresh();
    });
  };

  const changeStatus = (id: string, status: string) => {
    startTransition(async () => {
      await updateTicketStatusAction({ id, status });
      router.refresh();
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      await deleteTicketAction(id);
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
          {t('cs.newTicket', 'New ticket')}
        </button>
      </div>

      {showForm && (
        <Card>
          <CardHeader title={t('cs.createTicket', 'Create support ticket')} />
          <div className="space-y-3 p-4">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('cs.subject', 'Subject')}
              className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('cs.description', 'Describe the issue')}
              rows={4}
              className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
            />
            <div className="flex items-center gap-3">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="rounded-md border border-gray-300 bg-transparent px-2 py-1.5 text-sm dark:border-gray-700"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={pending || !subject.trim() || !description.trim()}
                onClick={submit}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {t('cs.submit', 'Submit')}
              </button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        </Card>
      )}

      {tickets.length === 0 ? (
        <EmptyState title={t('cs.noTickets', 'No support tickets')} icon={Ticket} variant="first-visit" />
      ) : (
        <div className="space-y-2">
          {tickets.map((tk) => (
            <div key={tk.id} className="rounded-md border border-gray-200 p-3 dark:border-gray-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{tk.subject}</span>
                    <Badge tone={statusTone(tk.status)}>{tk.status}</Badge>
                    <Badge tone="neutral">{tk.priority}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-gray-500">{tk.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <select
                    value={tk.status}
                    disabled={pending}
                    onChange={(e) => changeStatus(tk.id, e.target.value)}
                    className="rounded-md border border-gray-300 bg-transparent px-2 py-1 text-xs dark:border-gray-700"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remove(tk.id)}
                    className="rounded-md border border-gray-300 p-1.5 text-gray-500 hover:text-red-600 dark:border-gray-700"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
