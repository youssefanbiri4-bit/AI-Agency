import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { MarketingNavbar } from '@/components/marketing/MarketingNavbar';
import { buttonStyles } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Privacy Policy | AgentFlow AI',
  description: 'Privacy Policy for AgentFlow AI.',
};

export default function PrivacyPage() {
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
          <h1 className="mt-3 break-words text-3xl font-black text-black sm:text-4xl">Privacy Policy</h1>
          <p className="mt-3 text-sm leading-6 text-black/58">Last updated: May 2, 2026</p>

          <div className="mt-8 space-y-6 text-sm leading-7 text-black/66">
            <p>
              This placeholder Privacy Policy describes the intended privacy posture for AgentFlow AI
              while the product is being prepared for production. It should be reviewed and replaced
              with counsel-approved terms before public launch.
            </p>

            <section>
              <h2 className="text-lg font-bold text-black">Data We Expect To Process</h2>
              <p className="mt-2">
                AgentFlow AI is designed to store account, workspace, task, review, and integration
                readiness data needed to operate the dashboard. Secrets and private integration
                credentials should remain server-side and must not be stored in public client code.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-black">Use Of Data</h2>
              <p className="mt-2">
                Data should be used only to authenticate users, scope workspace access, create tasks,
                manage reviews, and prepare reports from real workspace records.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-black">Security</h2>
              <p className="mt-2">
                The application uses Supabase authentication and workspace-scoped access controls.
                Production release still requires a full legal, security, and monitoring review.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
