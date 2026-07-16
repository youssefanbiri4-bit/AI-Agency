'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSectionProps {
  title?: string;
  description?: string;
  faqs: FAQItem[];
  className?: string;
}

function FAQAccordion({ faqs }: { faqs: FAQItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = useCallback((idx: number) => {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  }, []);

  return (
    <div className="space-y-3">
      {faqs.map((faq, idx) => {
        const isOpen = openIndex === idx;

        return (
          <div
            key={idx}
            className="rounded-lg border border-border bg-surface overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggle(idx)}
              className="flex w-full items-center justify-between px-6 py-4 text-left"
            >
              <span className="font-bold text-foreground">{faq.question}</span>
              <ChevronDown
                className={cn(
                  'h-5 w-5 shrink-0 text-foreground-muted transition-transform',
                  isOpen && 'rotate-180'
                )}
              />
            </button>

            {isOpen && (
              <div className="px-6 pb-4">
                <p className="text-sm leading-6 text-foreground-muted">{faq.answer}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function FAQSection({
  title = 'Frequently Asked Questions',
  description,
  faqs,
  className,
}: FAQSectionProps) {
  return (
    <div className={cn('space-y-6', className)}>
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <HelpCircle className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-3xl font-black text-foreground">{title}</h2>
        {description && (
          <p className="mt-4 text-lg text-foreground-muted">{description}</p>
        )}
      </div>

      <div className="mx-auto max-w-3xl">
        <FAQAccordion faqs={faqs} />
      </div>
    </div>
  );
}

export const PRICING_FAQS: FAQItem[] = [
  {
    question: 'What is included in the Free plan?',
    answer: 'The Free plan includes up to 2 team members, 20 AI generations per month, 40 tasks, 50 creative assets, 30 content items, and 10 reels publishes. It\'s perfect for getting started and exploring the platform.',
  },
  {
    question: 'Can I upgrade or downgrade at any time?',
    answer: 'Yes! You can upgrade your plan at any time and the change takes effect immediately. Downgrades take effect at the end of your current billing cycle. No long-term contracts required.',
  },
  {
    question: 'What happens when I reach my plan limits?',
    answer: 'When you reach your plan limits, you\'ll receive a warning notification. On the Free plan, operations are blocked until the next billing cycle. On paid plans, you can continue using features with overage charges or upgrade for higher limits.',
  },
  {
    question: 'Do you offer annual billing discounts?',
    answer: 'Yes! Annual billing saves you approximately 18% compared to monthly billing. Pro plan is $490/year (vs $588 monthly) and Enterprise is $1,490/year (vs $1,788 monthly).',
  },
  {
    question: 'Is this platform available for external use?',
    answer: 'This is an internal platform for our team. Usage is tracked for cost awareness, but there is no external billing or payment processing.',
  },
  {
    question: 'Is there a free trial for paid plans?',
    answer: 'Yes! We offer a 14-day free trial of the Pro plan with no credit card required. You can explore all Pro features and decide if it\'s right for your team before committing.',
  },
];
