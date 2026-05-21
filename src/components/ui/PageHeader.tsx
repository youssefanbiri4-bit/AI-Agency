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
        'section-fade mb-8 rounded-lg border border-[#F7CBCA]/10 premium-surface px-4 py-5 shadow-[0_18px_48px_rgba(93,107,107,0.07)] sm:px-6 sm:py-6',
        className
      )}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-3">
          {eyebrow && (
            <p className="text-xs font-black uppercase leading-5 tracking-[0.12em] text-[#F7CBCA]">
              {eyebrow}
            </p>
          )}
          <h1 className="max-w-2xl text-2xl font-black leading-snug tracking-normal text-black sm:text-3xl md:text-4xl lg:max-w-lg">
            {title}
          </h1>
          {description && <p className="max-w-lg text-sm font-medium leading-6 text-black/62 sm:text-base">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:shrink-0 lg:justify-end">{actions}</div>}
      </div>
    </div>
  );
}
