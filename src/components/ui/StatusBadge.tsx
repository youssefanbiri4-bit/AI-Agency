import { AlertCircle, Check, Clock, RotateCw } from 'lucide-react';
import type { AgentStatus, TaskStatus } from '@/types';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status:
    | AgentStatus
    | TaskStatus
    | 'Prepared'
    | 'Disabled'
    | 'Ready'
    | 'Not Connected'
    | 'Setup Required'
    | 'No Data'
    | 'Awaiting Data';
  type?: 'agent' | 'task' | 'system';
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig = {
  Active: {
    label: 'Active',
    className: 'border-[#8B3CDE]/18 bg-[#F0DBEF]/65 text-[#8B3CDE]',
    dot: 'bg-[#8B3CDE]',
    icon: Check,
  },
  Idle: {
    label: 'Idle',
    className: 'border-black/10 bg-white text-black/58',
    dot: 'bg-black/35',
    icon: Clock,
  },
  Processing: {
    label: 'Processing',
    className: 'border-[#8B3CDE]/18 bg-[#F0DBEF]/65 text-[#8B3CDE]',
    dot: 'bg-[#8B3CDE]',
    icon: RotateCw,
  },
  'Needs Review': {
    label: 'Needs Review',
    className: 'border-[#F55477]/20 bg-[#F0DBEF]/65 text-[#F55477]',
    dot: 'bg-[#F55477]',
    icon: AlertCircle,
  },
  'Not Connected': {
    label: 'Not Connected',
    className: 'border-black/10 bg-white text-black/58',
    dot: 'bg-black/35',
    icon: Clock,
  },
  draft: {
    label: 'Draft',
    className: 'border-black/10 bg-white text-black/58',
    dot: 'bg-black/35',
    icon: Clock,
  },
  pending: {
    label: 'Pending',
    className: 'border-[#F55477]/20 bg-[#F0DBEF]/65 text-[#F55477]',
    dot: 'bg-[#F55477]',
    icon: Clock,
  },
  processing: {
    label: 'Processing',
    className: 'border-[#8B3CDE]/18 bg-[#F0DBEF]/65 text-[#8B3CDE]',
    dot: 'bg-[#8B3CDE]',
    icon: RotateCw,
  },
  needs_review: {
    label: 'Needs Review',
    className: 'border-[#F55477]/20 bg-[#F0DBEF]/65 text-[#F55477]',
    dot: 'bg-[#F55477]',
    icon: AlertCircle,
  },
  completed: {
    label: 'Completed',
    className: 'border-black/12 bg-black text-white',
    dot: 'bg-white',
    icon: Check,
  },
  failed: {
    label: 'Failed',
    className: 'border-[#F55477]/20 bg-[#F0DBEF]/65 text-[#F55477]',
    dot: 'bg-[#F55477]',
    icon: AlertCircle,
  },
  cancelled: {
    label: 'Cancelled',
    className: 'border-black/10 bg-white text-black/58',
    dot: 'bg-black/35',
    icon: Clock,
  },
  Prepared: {
    label: 'Prepared',
    className: 'border-[#8B3CDE]/18 bg-[#F0DBEF]/65 text-[#8B3CDE]',
    dot: 'bg-[#8B3CDE]',
    icon: Check,
  },
  Disabled: {
    label: 'Disabled',
    className: 'border-black/10 bg-white text-black/58',
    dot: 'bg-black/35',
    icon: Clock,
  },
  Ready: {
    label: 'Ready',
    className: 'border-[#8B3CDE]/18 bg-[#F0DBEF]/65 text-[#8B3CDE]',
    dot: 'bg-[#8B3CDE]',
    icon: Check,
  },
  'Setup Required': {
    label: 'Setup Required',
    className: 'border-[#F55477]/20 bg-[#F0DBEF]/65 text-[#F55477]',
    dot: 'bg-[#F55477]',
    icon: AlertCircle,
  },
  'No Data': {
    label: 'No Data',
    className: 'border-black/10 bg-white text-black/58',
    dot: 'bg-black/25',
    icon: Clock,
  },
  'Awaiting Data': {
    label: 'Awaiting Data',
    className: 'border-[#F55477]/20 bg-[#F0DBEF]/65 text-[#F55477]',
    dot: 'bg-[#F55477]',
    icon: Clock,
  },
} as const;

const sizeConfig = {
  sm: 'gap-1.5 px-2 py-1 text-xs',
  md: 'gap-1.5 px-2.5 py-1.5 text-xs',
  lg: 'gap-2 px-3 py-2 text-sm',
};

export function StatusBadge({ status, type = 'agent', size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.Idle;
  const Icon = config.icon;
  const shouldSpin = status === 'processing';

  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full border font-bold',
        'max-w-full min-w-0',
        sizeConfig[size],
        config.className
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', config.dot)} />
      <Icon
        className={cn(
          'shrink-0',
          size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5',
          shouldSpin && type !== 'system' && 'animate-spin'
        )}
      />
      <span className="truncate">{config.label}</span>
    </span>
  );
}
