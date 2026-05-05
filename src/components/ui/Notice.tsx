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
    className: 'border-[#8B3CDE]/18 bg-[#F0DBEF]/58 text-black',
    iconClassName: 'text-[#8B3CDE]',
  },
  success: {
    icon: CheckCircle2,
    className: 'border-black/12 bg-black text-white',
    iconClassName: 'text-white',
  },
  warning: {
    icon: ShieldAlert,
    className: 'border-[#F55477]/20 bg-[#F0DBEF]/62 text-black',
    iconClassName: 'text-[#F55477]',
  },
  danger: {
    icon: AlertCircle,
    className: 'border-[#F55477]/22 bg-[#F0DBEF]/70 text-black',
    iconClassName: 'text-[#F55477]',
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
