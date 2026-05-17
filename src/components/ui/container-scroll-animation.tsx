import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ContainerScrollAnimationProps {
  titleComponent: ReactNode;
  children: ReactNode;
  className?: string;
  containerClassName?: string;
}

export function ContainerScrollAnimation({
  titleComponent,
  children,
  className,
  containerClassName,
}: ContainerScrollAnimationProps) {
  return (
    <section
      className={cn('relative py-16 sm:py-20', containerClassName)}
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="section-fade mx-auto max-w-3xl text-center">
          {titleComponent}
        </div>

        <div className="relative mx-auto mt-10 max-w-6xl [perspective:1400px] sm:mt-14">
          <div className="pointer-events-none absolute inset-x-8 top-8 h-32 rounded-full bg-[#F7CBCA]/14 blur-3xl sm:inset-x-20 sm:h-40" />
          <div
            className={cn(
              'section-fade relative origin-top rounded-[2rem] border border-black/10 bg-white/72 p-2 shadow-[0_35px_100px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-3',
              className
            )}
          >
            <div className="overflow-hidden rounded-[1.5rem] border border-black/8 bg-[#05030B] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              {children}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
