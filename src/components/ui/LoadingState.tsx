import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  title?: string;
  description?: string;
  className?: string;
}

export function LoadingState({
  title = 'Loading workspace',
  description = 'Preparing the latest dashboard state.',
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn('flex min-h-[360px] items-center justify-center p-6', className)}
      aria-busy="true"
      aria-live="polite"
    >
      <div className="w-full max-w-md rounded-lg border border-[#F7CBCA]/10 bg-white/70 p-6 text-center shadow-[0_18px_42px_rgba(93,107,107,0.06)] backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[#D5E5E5] text-[#F7CBCA] shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
        <h2 className="mt-4 text-base font-bold text-black">{title}</h2>
        <p className="mt-1 text-sm text-black/58">{description}</p>
        <div className="mt-6 space-y-3">
          <div className="skeleton-block mx-auto h-3 w-3/4" />
          <div className="skeleton-block mx-auto h-3 w-1/2" />
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="skeleton-block h-12" />
            <div className="skeleton-block h-12" />
            <div className="skeleton-block h-12" />
          </div>
        </div>
      </div>
    </div>
  );
}
