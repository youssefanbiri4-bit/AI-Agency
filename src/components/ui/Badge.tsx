import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type BadgeTone =
  | 'neutral'
  | 'brand'
  | 'accent'
  | 'success'
  | 'warning'
  | 'dark'
  | 'slate'
  | 'blue'
  | 'violet'
  | 'cyan'
  | 'emerald'
  | 'amber';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneStyles: Record<BadgeTone, string> = {
  neutral: 'border-black/10 bg-white text-black/70',
  brand: 'border-[#8B3CDE]/18 bg-[#F0DBEF]/70 text-[#8B3CDE]',
  accent: 'border-[#F55477]/18 bg-[#F0DBEF]/70 text-[#F55477]',
  success: 'border-black/12 bg-black text-white',
  warning: 'border-[#F55477]/18 bg-[#F0DBEF]/70 text-[#F55477]',
  dark: 'border-black bg-black text-white',
  slate: 'border-black/10 bg-white text-black/70',
  blue: 'border-[#8B3CDE]/18 bg-[#F0DBEF]/70 text-[#8B3CDE]',
  violet: 'border-[#8B3CDE]/18 bg-[#F0DBEF]/70 text-[#8B3CDE]',
  cyan: 'border-[#F55477]/18 bg-[#F0DBEF]/70 text-[#F55477]',
  emerald: 'border-black/10 bg-[#F0DBEF]/55 text-black',
  amber: 'border-[#F55477]/18 bg-[#F0DBEF]/70 text-[#F55477]',
};

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black',
        toneStyles[tone],
        className
      )}
      {...props}
    />
  );
}
