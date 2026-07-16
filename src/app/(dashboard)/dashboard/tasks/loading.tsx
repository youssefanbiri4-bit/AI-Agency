import { TableSkeleton } from '@/components/ui/Skeleton';

export default function TasksLoading() {
  return (
    <div className="-mx-4 -my-6 min-h-screen bg-[var(--theme-background,#F1F7F7)] px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-[1540px] space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-foreground">Tasks</h1>
            <p className="mt-1 text-sm text-foreground-muted">Preparing task list…</p>
          </div>
        </div>
        <TableSkeleton rows={8} columns={7} />
      </div>
    </div>
  );
}
