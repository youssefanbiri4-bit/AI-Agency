function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/70 ${className}`} />;
}

export default function ProductionOperationsLoading() {
  return (
    <div className="-mx-4 -my-6 min-h-screen bg-[#F1F7F7] px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-[1540px] space-y-6">
        <div className="space-y-3">
          <SkeletonBlock className="h-4 w-44" />
          <SkeletonBlock className="h-11 w-full max-w-xl" />
          <SkeletonBlock className="h-5 w-full max-w-3xl" />
        </div>
        <SkeletonBlock className="h-48 w-full rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-3">
          <SkeletonBlock className="h-32" />
          <SkeletonBlock className="h-32" />
          <SkeletonBlock className="h-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-36" />
          ))}
        </div>
      </div>
    </div>
  );
}
