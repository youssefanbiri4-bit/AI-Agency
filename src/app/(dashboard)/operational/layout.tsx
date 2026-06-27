import { reportAppError } from '@/lib/logger';
import { getWorkspaceAccessContext } from '@/lib/workspace-permissions';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

export default async function OperationalDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  let allowed = false;
  let failureMessage: string | null = null;

  try {
    const access = await getWorkspaceAccessContext();

    if ('error' in access && access.error) {
      failureMessage = 'Operational dashboard unavailable.';
      allowed = false;
    } else if (!access.data) {
      failureMessage = 'Operational dashboard unavailable.';
      allowed = false;
    } else {
      const { role } = access.data;

      // Admin-only enforcement (owner/admin). No role-system changes.
      allowed = role === 'owner' || role === 'admin';
      if (!allowed) failureMessage = 'Forbidden: admin access required.';
    }
  } catch (error) {
    reportAppError('Operational dashboard layout error', error);
    failureMessage = 'Error loading operational dashboard. Please try again later.';
    allowed = false;
  }

  if (!allowed) {
    return (
      <div className="-mx-4 -my-6 min-h-screen bg-[var(--theme-background,#F1F7F7)] px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <section className="mx-auto max-w-2xl rounded-2xl border border-black/7 bg-white/90 p-8 shadow-[0_24px_70px_rgba(93,107,107,0.08)]">
          <h1 className="text-xl font-black text-[#5D6B6B]">
            {failureMessage === 'Forbidden: admin access required.' ? 'Access Restricted' : 'Operational Dashboard'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-black/58">
            {failureMessage ?? 'Forbidden'}
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-[#F7CBCA]/15 bg-white/78 px-4 py-2 text-sm font-bold text-black shadow-sm transition-colors hover:bg-[#F7CBCA]/10"
            >
              ← Go to Dashboard
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return <>{children}</>;
}
