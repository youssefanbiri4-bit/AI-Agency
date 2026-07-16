import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

type NoticeTone = 'info' | 'success' | 'warning' | 'danger';

interface NoticeProps {
  tone?: NoticeTone;
  title?: string;
  children: ReactNode;
  className?: string;
}

const toneStyles = {
  info: {
    icon: Info,
    className: 'border-status-info-bg bg-status-info-bg text-foreground',
    iconClassName: 'text-status-info-text',
  },
  success: {
    icon: CheckCircle2,
    className: 'border-status-success-bg bg-status-success-bg text-status-success-text',
    iconClassName: 'text-status-success-text',
  },
  warning: {
    icon: ShieldAlert,
    className: 'border-status-warning-bg bg-status-warning-bg text-status-warning-text',
    iconClassName: 'text-status-warning-text',
  },
  danger: {
    icon: AlertCircle,
    className: 'border-status-danger-bg bg-status-danger-bg text-status-danger-text',
    iconClassName: 'text-status-danger-text',
  },
};

export function Notice({ tone = 'info', title, children, className }: NoticeProps) {
  const config = toneStyles[tone];
  const Icon = config.icon;

  return (
    <div className={cn('rounded-lg border p-4 shadow-sm', config.className, className)}>
      <div className="flex gap-3">
        <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', config.iconClassName)} />
        <div className="min-w-0">
          {title && <p className="font-bold">{title}</p>}
          <div className={cn('text-sm leading-6', title && 'mt-1')}>{children}</div>
        </div>
      </div>
    </div>
  );
}