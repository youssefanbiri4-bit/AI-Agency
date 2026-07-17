import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type StatTone =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  // Legacy tones (deprecated - for migration only)
  | 'brand'
  | 'accent'
  | 'dark';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  tone?: StatTone;
  iconColor?: string;
  iconBgColor?: string;
  trend?: {
    value: number;
    label: string;
    isPositive: boolean;
  };
  subtitle?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  tone = 'primary',
  iconColor,
  iconBgColor,
  trend,
  subtitle,
  className,
}: StatCardProps) {
  const TrendIcon = trend?.isPositive ? ArrowUpRight : ArrowDownRight;

  const toneStyles: Record<StatTone, { icon: string; iconBg: string }> = {
    neutral: {
      icon: 'text-foreground-muted',
      iconBg: 'bg-surface',
    },
    primary: {
      icon: 'text-primary',
      iconBg: 'bg-primary-light',
    },
    success: {
      icon: 'text-success',
      iconBg: 'bg-success-light',
    },
    warning: {
      icon: 'text-warning',
      iconBg: 'bg-warning-light',
    },
    danger: {
      icon: 'text-danger',
      iconBg: 'bg-danger-light',
    },
    // Legacy tones (map to closest new semantic)
    brand: {
      icon: 'text-primary',
      iconBg: 'bg-primary-light',
    },
    accent: {
      icon: 'text-primary',
      iconBg: 'bg-primary-light',
    },
    dark: {
      icon: 'text-background',
      iconBg: 'bg-foreground',
    },
  };
  const selectedTone = toneStyles[tone];

  return (
    <div
      className={cn(
        'min-w-0 rounded-xl border border-border bg-surface-elevated p-4 shadow-sm',
        'transition-all duration-200 ease-out',
        'hover:-translate-y-1 hover:shadow-md hover:border-border-strong',
        className
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5 text-foreground-muted">{title}</p>
          <p className="mt-2 text-2xl font-black leading-none tracking-normal text-foreground sm:text-3xl">{value}</p>
        </div>
        <div className={cn('shrink-0 rounded-xl border border-border/60 p-2.5 shadow-sm transition-colors duration-200', iconBgColor ?? selectedTone.iconBg)}>
          <Icon className={cn('h-5 w-5', iconColor ?? selectedTone.icon)} />
        </div>
      </div>
      {(subtitle || trend) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold',
                trend.isPositive
                  ? 'bg-success-light text-success'
                  : 'bg-danger-light text-danger'
              )}
            >
              <TrendIcon className="h-3.5 w-3.5" />
              {trend.value}%
            </span>
          )}
          {trend && <span className="text-foreground-muted">{trend.label}</span>}
          {!trend && subtitle && <span className="text-foreground-muted">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}