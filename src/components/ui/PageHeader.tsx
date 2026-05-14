import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'section-fade mb-8 min-w-0 rounded-lg border border-[#F7CBCA]/10 premium-surface px-4 py-5 shadow-[0_18px_48px_rgba(93,107,107,0.07)] sm:px-6 sm:py-6',
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          {eyebrow && (
            <p className="mb-2 text-xs font-black uppercase leading-5 tracking-[0.12em] text-[#F7CBCA]">
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl font-black leading-tight tracking-normal text-black sm:text-3xl">
            {title}
          </h1>
          {description && <p className="mt-2 max-w-4xl text-sm font-medium leading-6 text-black/62 sm:text-base">{description}</p>}
        </div>
        {actions && <div className="flex w-full max-w-full flex-wrap items-center gap-3 lg:w-auto lg:shrink-0 lg:justify-end">{actions}</div>}
      </div>
    </div>
  );
}
