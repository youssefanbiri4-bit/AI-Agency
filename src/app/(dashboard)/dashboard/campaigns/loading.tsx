import { CardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';

export default function CampaignsLoading() {
  return (
    <div className="-mx-4 -my-6 min-h-screen bg-[var(--theme-background,#F1F7F7)] px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-[1540px] space-y-6">
        <div>
          <h1 className="text-2xl font-black text-foreground">Campaigns</h1>
          <p className="mt-1 text-sm text-foreground-muted">Preparing campaign data and provider status…</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} compact lines={1} showIcon={false} showBadge={false} />
          ))}
        </div>

        <TableSkeleton rows={6} columns={5} />
      </div>
    </div>
  );
}
