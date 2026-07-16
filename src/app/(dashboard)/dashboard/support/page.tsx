import { requireWorkspaceAccessWithRBAC } from '@/lib/auth/rbac';
import { listSupportTickets } from '@/lib/data/customer-success';
import SupportTicketsClient from '@/components/customer-success/SupportTicketsClient';

export default async function SupportPage() {
  const rbac = await requireWorkspaceAccessWithRBAC({ minRole: 'viewer' });
  if (!rbac.ok || !rbac.context) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-sm text-foreground-muted">
        Authentication required.
      </div>
    );
  }

  const result = await listSupportTickets(rbac.context.workspace.id, rbac.context.supabase, { limit: 100 });
  const tickets = (result.data ?? []).map((t) => ({
    id: t.id,
    subject: t.subject,
    description: t.description,
    status: t.status,
    priority: t.priority,
    category: t.category,
    created_at: t.created_at,
    resolved_at: t.resolved_at,
  }));

  return <SupportTicketsClient initialTickets={tickets} />;
}
