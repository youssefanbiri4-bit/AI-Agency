import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { MarketingNavbar } from '@/components/marketing/MarketingNavbar';
import { buttonStyles } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Terms of Service | AgentFlow AI',
  description: 'Terms of Service for AgentFlow AI.',
};

export default function TermsPage() {
  return (
    <div className="premium-page min-h-screen text-black">
      <MarketingNavbar />
      <main className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
        <Link href="/" className={buttonStyles({ variant: 'outline', size: 'sm', className: 'mb-8' })}>
          <ArrowLeft className="h-4 w-4" />
          Back Home
        </Link>

        <div className="rounded-lg border border-black/8 bg-white p-5 shadow-[0_18px_48px_rgba(0,0,0,0.06)] sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#F7CBCA]">Legal</p>
          <h1 className="mt-3 break-words text-3xl font-black text-black sm:text-4xl">Terms of Service</h1>
          <p className="mt-3 text-sm leading-6 text-black/58">Last updated: May 2, 2026</p>

          <div className="mt-8 space-y-6 text-sm leading-7 text-black/66">
            <p>
              These placeholder Terms of Service are included to avoid broken or misleading legal
              links during production preparation. They should be reviewed and replaced with
              counsel-approved terms before public launch.
            </p>

            <section>
              <h2 className="text-lg font-bold text-black">Product Status</h2>
              <p className="mt-2">
                AgentFlow AI is currently a production-candidate workspace for managing AI agents,
                tasks, reviews, reports, and integration readiness. n8n execution should be treated
                as unavailable until it is fully configured server-side.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-black">Acceptable Use</h2>
              <p className="mt-2">
                Users are responsible for submitting lawful task content, protecting workspace
                access, and reviewing AI-assisted outputs before client or public use.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-black">No Production Warranty</h2>
              <p className="mt-2">
                Until final legal, security, monitoring, and integration reviews are complete, this
                project should not be represented as a fully production-ready SaaS service.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
