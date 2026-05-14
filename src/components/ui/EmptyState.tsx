import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-dashed border-[#F7CBCA]/24 bg-white/86 p-6 text-center shadow-[0_14px_34px_rgba(93,107,107,0.05)] backdrop-blur-[16px] [-webkit-backdrop-filter:blur(16px)] sm:p-8',
        className
      )}
    >
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-[#F7CBCA]/12 bg-[#D5E5E5]/55 text-[#F7CBCA] shadow-sm">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-base font-black leading-snug text-black">{title}</h3>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-black/58">
          {description}
        </p>
      )}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
