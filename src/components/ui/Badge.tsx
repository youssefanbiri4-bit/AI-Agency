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
  brand: 'border-[#F7CBCA]/18 bg-[#D5E5E5]/70 text-[#F7CBCA]',
  accent: 'border-[#F7CBCA]/18 bg-[#D5E5E5]/70 text-[#F7CBCA]',
  success: 'border-black/12 bg-black text-white',
  warning: 'border-[#F7CBCA]/18 bg-[#D5E5E5]/70 text-[#F7CBCA]',
  dark: 'border-black bg-black text-white',
  slate: 'border-black/10 bg-white text-black/70',
  blue: 'border-[#F7CBCA]/18 bg-[#D5E5E5]/70 text-[#F7CBCA]',
  violet: 'border-[#F7CBCA]/18 bg-[#D5E5E5]/70 text-[#F7CBCA]',
  cyan: 'border-[#F7CBCA]/18 bg-[#D5E5E5]/70 text-[#F7CBCA]',
  emerald: 'border-black/10 bg-[#D5E5E5]/55 text-black',
  amber: 'border-[#F7CBCA]/18 bg-[#D5E5E5]/70 text-[#F7CBCA]',
};

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex w-fit max-w-full min-w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black leading-5',
        'whitespace-normal break-words text-start',
        toneStyles[tone],
        className
      )}
      {...props}
    />
  );
}
