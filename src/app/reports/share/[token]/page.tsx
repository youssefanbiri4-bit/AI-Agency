import { accessSharedReportAction } from '@/actions/reports/actions';
import { SharedReportClient } from '@/components/reports/SharedReportClient';

export const dynamic = 'force-dynamic';

interface ShareReportPageProps {
  params: Promise<{ token: string }>;
}

export default async function ShareReportPage({ params }: ShareReportPageProps) {
  const { token } = await params;
  const result = await accessSharedReportAction(token);

  if (!result.ok && !result.requiresPassword) {
    return (
      <main className="min-h-screen bg-background px-4 py-10">
        <SharedReportClient
          token={token}
          initialError={result.error || 'This share link is unavailable.'}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <SharedReportClient
        token={token}
        title={result.title}
        expiresAt={result.expiresAt}
        requiresPassword={result.requiresPassword}
      />
    </main>
  );
}