import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type StatTone = 'neutral' | 'brand' | 'accent' | 'dark';

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
  tone = 'brand',
  iconColor,
  iconBgColor,
  trend,
  subtitle,
  className,
}: StatCardProps) {
  const TrendIcon = trend?.isPositive ? ArrowUpRight : ArrowDownRight;
  const toneStyles: Record<StatTone, { icon: string; iconBg: string }> = {
    neutral: {
      icon: 'text-black/70',
      iconBg: 'bg-white',
    },
    brand: {
      icon: 'text-[#8B3CDE]',
      iconBg: 'bg-[#F0DBEF]',
    },
    accent: {
      icon: 'text-[#F55477]',
      iconBg: 'bg-[#F0DBEF]',
    },
    dark: {
      icon: 'text-white',
      iconBg: 'bg-black',
    },
  };
  const selectedTone = toneStyles[tone];

  return (
    <div
      className={cn(
        'group card-lift min-w-0 rounded-lg border border-black/8 bg-white p-5 shadow-[0_18px_48px_rgba(0,0,0,0.06)] hover:border-[#8B3CDE]/22 hover:shadow-[0_22px_54px_rgba(139,60,222,0.12)]',
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-black/52">{title}</p>
          <p className="mt-2 break-words text-3xl font-black tracking-normal text-black">{value}</p>
        </div>
        <div className={cn('shrink-0 rounded-lg border border-white p-3 shadow-sm', iconBgColor ?? selectedTone.iconBg)}>
          <Icon className={cn('h-5 w-5', iconColor ?? selectedTone.icon)} />
        </div>
      </div>
      {(subtitle || trend) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold',
                trend.isPositive ? 'bg-[#F0DBEF] text-[#8B3CDE]' : 'bg-[#F0DBEF] text-[#F55477]'
              )}
            >
              <TrendIcon className="h-3.5 w-3.5" />
              {trend.value}%
            </span>
          )}
          {trend && <span className="text-black/56">{trend.label}</span>}
          {!trend && subtitle && <span className="text-black/56">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
