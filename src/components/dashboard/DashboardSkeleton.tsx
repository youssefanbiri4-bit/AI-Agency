import { cn } from '@/lib/utils';

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-black/[0.06]', className)} />;
}

export function DashboardSkeleton({ variant = 'personalized' }: { variant?: 'personalized' | 'command_center' }) {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-black/7 bg-white/90 p-6 sm:p-8">
        <SkeletonBlock className="mb-3 h-6 w-40" />
        <SkeletonBlock className="h-10 w-2/3 max-w-lg" />
        <SkeletonBlock className="mt-3 h-4 w-full max-w-2xl" />
        <div className="mt-5 flex gap-2">
          <SkeletonBlock className="h-11 w-32" />
          <SkeletonBlock className="h-11 w-36" />
        </div>
      </section>

      {variant === 'personalized' ? (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-5">
            <SkeletonBlock className="h-5 w-28" />
            <SkeletonBlock className="h-44 w-full" />
          </div>
          <div className="space-y-3 lg:col-span-4">
            <SkeletonBlock className="h-5 w-36" />
            <div className="space-y-3">
              <SkeletonBlock className="h-20 w-full" />
              <SkeletonBlock className="h-20 w-full" />
              <SkeletonBlock className="h-20 w-full" />
            </div>
          </div>
          <div className="space-y-3 lg:col-span-3">
            <SkeletonBlock className="h-5 w-32" />
            <SkeletonBlock className="h-10 w-full" />
            <SkeletonBlock className="h-10 w-full" />
            <SkeletonBlock className="h-10 w-full" />
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-28 w-full" />
            ))}
          </div>
          <SkeletonBlock className="h-56 w-full" />
          <SkeletonBlock className="h-72 w-full" />
        </>
      )}
    </div>
  );
}