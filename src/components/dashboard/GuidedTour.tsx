'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface TourStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  position?: 'bottom' | 'top' | 'left' | 'right';
}

interface GuidedTourProps {
  steps: TourStep[];
  onComplete: () => void;
  onDismiss: () => void;
  isOpen: boolean;
  storageKey?: string;
}

const STORAGE_PREFIX = 'af_guided_tour_';

export function GuidedTour({
  steps,
  onComplete,
  onDismiss,
  isOpen,
  storageKey = 'default',
}: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightedEl, setHighlightedEl] = useState<Element | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const dismissed = localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
    if (dismissed === 'completed') {
      onComplete();
      return;
    }
  }, [isOpen, storageKey, onComplete]);

  useEffect(() => {
    if (!isOpen) return;
    const step = steps[currentStep];
    if (step.targetSelector) {
      const el = document.querySelector(step.targetSelector);
      setHighlightedEl(el);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentStep, steps, isOpen]);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, steps.length]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, []);

  const handleComplete = useCallback(() => {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, 'completed');
    } catch {}
    onComplete();
  }, [storageKey, onComplete]);

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, 'dismissed');
    } catch {}
    onDismiss();
  }, [storageKey, onDismiss]);

  if (!isOpen || steps.length === 0) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <>
      {/* Overlay backdrop */}
      <div className="fixed inset-0 z-[100] bg-black/20 backdrop-blur-[2px]" />

      {/* Tooltip */}
      <div className="fixed bottom-8 left-1/2 z-[101] w-[90vw] max-w-lg -translate-x-1/2 animate-in slide-in-from-bottom-4">
        <div className="rounded-2xl border border-[#F7CBCA]/20 bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
          {/* Progress bar */}
          <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-black/8">
            <div
              className="h-full rounded-full bg-[#F7CBCA] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#F7CBCA]" />
              <span className="text-xs font-black uppercase tracking-[0.12em] text-black/40">
                Step {currentStep + 1} of {steps.length}
              </span>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-md p-1 text-black/30 hover:bg-black/5 hover:text-black transition-colors"
              aria-label="Dismiss tour"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="mt-3">
            <h3 className="text-lg font-bold text-black">{step.title}</h3>
            <p className="mt-1.5 text-sm leading-6 text-black/62">{step.description}</p>
          </div>

          {/* Actions */}
          <div className="mt-5 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-black/40"
            >
              Skip tour
            </Button>

            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <Button variant="outline" size="sm" onClick={handlePrev}>
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
              <Button size="sm" onClick={handleNext}>
                {isLast ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Done
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Default tour steps for onboarding
export function getDefaultOnboardingTourSteps(): TourStep[] {
  return [
    {
      id: 'welcome',
      title: 'Welcome to AgentFlow AI!',
      description:
        'This quick tour will show you around your new workspace. You can skip or dismiss at any time.',
    },
    {
      id: 'dashboard',
      title: 'Your Command Center',
      description:
        'The Dashboard shows your priorities, system health, provider status, and quick actions — all in one place.',
    },
    {
      id: 'tasks',
      title: 'Create Your First Task',
      description:
        'Head to Tasks to create structured briefs for your AI agents. Assign departments, set priorities, and track progress.',
      targetSelector: '[data-tour="tasks"]',
    },
    {
      id: 'agents',
      title: 'Explore the Agent Catalog',
      description:
        'Browse 27 specialized AI agents across research, content creation, sales operations, and engineering workflows.',
      targetSelector: '[data-tour="agents"]',
    },
    {
      id: 'settings',
      title: 'Configure Providers',
      description:
        'Connect your AI, social media, and ad platform providers in Settings. The provider wizard guides you through each setup.',
      targetSelector: '[data-tour="settings"]',
    },
    {
      id: 'done',
      title: "You're all set!",
      description:
        'Start exploring your workspace. Create a task, browse the agent library, or configure your first provider. Need help? Check the Docs or ask Alex.',
    },
  ];
}
