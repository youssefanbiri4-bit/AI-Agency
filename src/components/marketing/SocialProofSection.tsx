'use client';

import {
  Star,
  Users,
  TrendingUp,
  Quote,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Testimonial {
  name: string;
  role: string;
  company: string;
  content: string;
  rating: number;
}

interface SocialProofSectionProps {
  className?: string;
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

const TRUSTED_BY = [
  'GrowthFlow',
  'ContentScale',
  'SynthMedia',
  'AgencyPro',
  'AI Ventures',
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

export function SocialProofSection({ className }: SocialProofSectionProps) {
  return (
    <section className={cn('py-20 sm:py-28', className)}>
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        {/* Trusted by */}
        <div className="text-center">
          <p className="mb-8 text-sm font-bold uppercase tracking-wider text-foreground-muted">
            Trusted by forward-thinking teams
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 opacity-60">
            {TRUSTED_BY.map((company) => (
              <div
                key={company}
                className="text-xl font-black text-foreground-muted"
              >
                {company}
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-16 grid gap-8 sm:grid-cols-3">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <p className="mt-4 text-4xl font-black text-foreground">1,000+</p>
            <p className="mt-2 text-sm text-foreground-muted">Active Users</p>
          </div>
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Star className="h-8 w-8 text-primary" />
            </div>
            <p className="mt-4 text-4xl font-black text-foreground">4.9/5</p>
            <p className="mt-2 text-sm text-foreground-muted">Average Rating</p>
          </div>
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
            <p className="mt-4 text-4xl font-black text-foreground">300%</p>
            <p className="mt-2 text-sm text-foreground-muted">Growth in 6 Months</p>
          </div>
        </div>

        {/* Testimonials */}
        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <div
              key={testimonial.name}
              className="relative rounded-lg border border-border bg-surface p-6"
            >
              <Quote className="absolute top-4 right-4 h-8 w-8 text-foreground/10" />
              <StarRating rating={testimonial.rating} />
              <p className="mt-4 text-sm leading-6 text-foreground">
                &ldquo;{testimonial.content}&rdquo;
              </p>
              <div className="mt-6 flex items-center gap-3">
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
      </div>
    </section>
  );
}
