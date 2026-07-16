'use client';

import {
  Star,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SocialProofProps {
  type: 'users' | 'rating' | 'growth' | 'testimonials' | 'logos';
  value?: number;
  label?: string;
  className?: string;
}

interface Testimonial {
  name: string;
  role: string;
  company: string;
  content: string;
  rating: number;
  avatar?: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Sarah Chen',
    role: 'Head of Operations',
    company: 'GrowthFlow Agency',
    content: 'AgentFlow AI transformed how we manage 50+ AI agents. The task orchestration alone saves us 20 hours per week.',
    rating: 5,
  },
  {
    name: 'Marcus Rodriguez',
    role: 'Founder',
    company: 'ContentScale',
    content: 'Finally, a platform that treats AI agents like real team members. The review flow catches issues before they reach clients.',
    rating: 5,
  },
  {
    name: 'Elena Volkov',
    role: 'AI Operations Lead',
    company: 'SynthMedia',
    content: 'The analytics dashboard gives us visibility we never had before. We can now forecast costs and optimize agent performance.',
    rating: 5,
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'h-4 w-4',
            i < rating ? 'fill-warning text-warning' : 'text-foreground-muted'
          )}
        />
      ))}
    </div>
  );
}

export function SocialProof({
  type,
  value,
  label,
  className,
}: SocialProofProps) {
  if (type === 'users') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="flex -space-x-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-primary/10 text-xs font-bold text-primary"
            >
              {String.fromCharCode(64 + i)}
            </div>
          ))}
        </div>
        <div>
          <p className="font-bold text-foreground">{value?.toLocaleString() ?? '1,000+'} users</p>
          <p className="text-sm text-foreground-muted">{label ?? 'trust AgentFlow AI'}</p>
        </div>
      </div>
    );
  }

  if (type === 'rating') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <StarRating rating={value ?? 5} />
        <div>
          <p className="font-bold text-foreground">{value ?? 4.9}/5 rating</p>
          <p className="text-sm text-foreground-muted">{label ?? 'on G2 & Product Hunt'}</p>
        </div>
      </div>
    );
  }

  if (type === 'growth') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
          <TrendingUp className="h-5 w-5 text-success" />
        </div>
        <div>
          <p className="font-bold text-foreground">{value ?? 300}% growth</p>
          <p className="text-sm text-foreground-muted">{label ?? 'in the last 6 months'}</p>
        </div>
      </div>
    );
  }

  if (type === 'testimonials') {
    return (
      <div className={cn('grid gap-6 sm:grid-cols-3', className)}>
        {TESTIMONIALS.map((testimonial) => (
          <div
            key={testimonial.name}
            className="rounded-lg border border-border bg-surface p-6"
          >
            <StarRating rating={testimonial.rating} />
            <p className="mt-4 text-sm leading-6 text-foreground">
              &ldquo;{testimonial.content}&rdquo;
            </p>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {testimonial.name.split(' ').map((n) => n[0]).join('')}
            </div>

              <div>
                <p className="font-bold text-foreground">{testimonial.name}</p>
                <p className="text-sm text-foreground-muted">
                  {testimonial.role}, {testimonial.company}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'logos') {
    return (
      <div className={cn('flex flex-wrap items-center justify-center gap-8 opacity-60', className)}>
        {['GrowthFlow', 'ContentScale', 'SynthMedia', 'AgencyPro', 'AI Ventures'].map((company) => (
          <div
            key={company}
            className="text-lg font-bold text-foreground-muted"
          >
            {company}
          </div>
        ))}
      </div>
    );
  }

  return null;
}
