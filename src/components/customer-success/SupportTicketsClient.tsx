'use client';

import { useState, useCallback } from 'react';
import { LifeBuoy, Plus, Search, Filter, Clock, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { buttonStyles } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { CreateTicketForm } from '@/components/customer-success/CreateTicketForm';
import {
  updateTicketStatusAction,
  deleteTicketAction,
} from '@/actions/customer-success/actions';
import { toast } from '@/components/ui/toast';

type Ticket = {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  resolved_at: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; tone: 'info' | 'warning' | 'success' | 'danger' | 'neutral'; icon: typeof Clock }> = {
  open: { label: 'Open', tone: 'info', icon: Clock },
  in_progress: { label: 'In Progress', tone: 'warning', icon: AlertTriangle },
  resolved: { label: 'Resolved', tone: 'success', icon: CheckCircle2 },
  closed: { label: 'Closed', tone: 'neutral', icon: CheckCircle2 },
};

const PRIORITY_TONE: Record<string, 'info' | 'warning' | 'danger' | 'neutral'> = {
  low: 'neutral',
  normal: 'info',
  high: 'warning',
  urgent: 'danger',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SupportTicketsClient({ initialTickets }: { initialTickets: Ticket[] }) {
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = tickets.filter((t) => {
    const matchSearch = !search || t.subject.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleStatusChange = useCallback(async (id: string, status: string) => {
    const result = await updateTicketStatusAction({ id, status });
    if (result.ok) {
      setTickets((prev) => prev.map((t) => t.id === id ? { ...t, status, resolved_at: status === 'resolved' ? new Date().toISOString() : t.resolved_at } : t));
      toast.success(`Ticket ${status}`);
    } else {
      toast.error(result.error || 'Failed to update');
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    const result = await deleteTicketAction(id);
    if (result.ok) {
      setTickets((prev) => prev.filter((t) => t.id !== id));
      toast.success('Ticket deleted');
    } else {
      toast.error(result.error || 'Failed to delete');
    }
  }, []);

  return (
    <div>
      <PageHeader
        title="Support Tickets"
        description="Create and track support requests"
        eyebrow="Support"
        actions={
          <button type="button" onClick={() => setShowCreate(true)} className={buttonStyles({ variant: 'primary', size: 'sm' })}>
            <Plus className="h-4 w-4" /> New ticket
          </button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets..."
            className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-foreground-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-foreground-muted" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          variant="first-visit"
          icon={LifeBuoy}
          title="No tickets yet"
          description="Create a support ticket when you need help."
          action={
            <button type="button" onClick={() => setShowCreate(true)} className={buttonStyles({ variant: 'primary', size: 'sm' })}>
              <Plus className="h-4 w-4" /> Create ticket
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((ticket) => {
            const statusConf = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
            const StatusIcon = statusConf.icon;
            const isExpanded = expandedId === ticket.id;

            return (
              <Card key={ticket.id} className="!p-0">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-start"
                >
                  <StatusIcon className={cn('h-4 w-4 shrink-0', `text-${statusConf.tone}`)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground">{ticket.subject}</p>
                    <p className="text-[10px] text-foreground-muted">{formatDate(ticket.created_at)} · {ticket.category}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge tone={PRIORITY_TONE[ticket.priority] ?? 'neutral'}>{ticket.priority}</Badge>
                    <Badge tone={statusConf.tone}>{statusConf.label}</Badge>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-divider px-4 py-3">
                    <p className="text-sm text-foreground-muted whitespace-pre-wrap">{ticket.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {ticket.status === 'open' && (
                        <button type="button" onClick={() => handleStatusChange(ticket.id, 'in_progress')} className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
                          Mark in progress
                        </button>
                      )}
                      {ticket.status === 'in_progress' && (
                        <button type="button" onClick={() => handleStatusChange(ticket.id, 'resolved')} className={buttonStyles({ variant: 'success', size: 'sm' })}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                        </button>
                      )}
                      {ticket.status === 'resolved' && (
                        <button type="button" onClick={() => handleStatusChange(ticket.id, 'closed')} className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
                          Close
                        </button>
                      )}
                      <div className="flex-1" />
                      <button type="button" onClick={() => handleDelete(ticket.id)} className={buttonStyles({ variant: 'ghost', size: 'sm' })}>
                        <Trash2 className="h-3.5 w-3.5 text-danger" />
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <CreateTicketForm
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          window.location.reload();
        }}
      />
    </div>
  );
}
