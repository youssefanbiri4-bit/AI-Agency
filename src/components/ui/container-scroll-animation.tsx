'use client';

import { useRef, type ReactNode } from 'react';
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
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
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 24,
    mass: 0.35,
  });

  const rotateX = useTransform(progress, [0.05, 0.45, 0.8], [18, 8, 0]);
  const scale = useTransform(progress, [0.05, 0.45, 0.8], [0.94, 0.97, 1]);
  const translateY = useTransform(progress, [0.05, 0.45, 0.8], [48, 16, 0]);
  const opacity = useTransform(progress, [0.05, 0.25, 0.8], [0.55, 0.85, 1]);

  const motionStyle = shouldReduceMotion
    ? undefined
    : {
        rotateX,
        scale,
        y: translateY,
        opacity,
      };

  return (
    <section
      ref={sectionRef}
      className={cn('relative py-16 sm:py-20', containerClassName)}
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
          whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-3xl text-center"
        >
          {titleComponent}
        </motion.div>

        <div className="relative mx-auto mt-10 max-w-6xl [perspective:1400px] sm:mt-14">
          <div className="pointer-events-none absolute inset-x-8 top-8 h-32 rounded-full bg-[#F7CBCA]/14 blur-3xl sm:inset-x-20 sm:h-40" />
          <motion.div
            style={motionStyle}
            className={cn(
              'relative origin-top rounded-[2rem] border border-black/10 bg-white/72 p-2 shadow-[0_35px_100px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-3',
              className
            )}
          >
            <div className="overflow-hidden rounded-[1.5rem] border border-black/8 bg-[#05030B] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              {children}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
