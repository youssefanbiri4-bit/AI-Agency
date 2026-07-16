'use client';

import {
  CheckCircle2,
  FileText,
  Loader2,
  Send,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from './Skeleton';

// ---------------------------------------------------------------------------
// Variant & Props
// ---------------------------------------------------------------------------

type LoadingVariant =
  | 'page'         // Full-page centered loader (default)
  | 'card'         // Compact card-size loader
  | 'inline'       // Minimal inline spinner
  | 'ai-generating' // AI generation with step indicators
  | 'pdf'          // PDF generation progress
  | 'publishing';  // Publishing progress

interface LoadingStep {
  label: string;
  /** 0–100 progress. null = indeterminate */
  progress?: number | null;
  /** When true, shows a checkmark */
  complete?: boolean;
}

interface LoadingStateProps {
  title?: string;
  description?: string;
  variant?: LoadingVariant;
  className?: string;
  /** Steps to show progress through (variant: ai-generating | pdf | publishing) */
  steps?: LoadingStep[];
  /** Current step index (0-based) for progress variants */
  currentStep?: number;
  /** Total progress percentage (0–100) */
  progress?: number;
}

// ---------------------------------------------------------------------------
// Icons for each variant
// ---------------------------------------------------------------------------

const variantIcons: Record<LoadingVariant, typeof Loader2> = {
  page: Loader2,
  card: Loader2,
  inline: Loader2,
  'ai-generating': Sparkles,
  pdf: FileText,
  publishing: Send,
};

// ---------------------------------------------------------------------------
// Default descriptions
// ---------------------------------------------------------------------------

const variantDefaults: Record<LoadingVariant, { title: string; description: string }> = {
  page: { title: 'Loading', description: 'Preparing your content.' },
  card: { title: 'Loading', description: '' },
  inline: { title: 'Loading', description: '' },
  'ai-generating': { title: 'Generating with AI', description: 'Creating content using AI models.' },
  pdf: { title: 'Generating PDF', description: 'Building your report for download.' },
  publishing: { title: 'Publishing', description: 'Sending your content to the provider.' },
};

// ---------------------------------------------------------------------------
// Step indicator sub-component
// ---------------------------------------------------------------------------

function StepIndicator({ steps, currentStep }: { steps: LoadingStep[]; currentStep: number }) {
  return (
    <div className="mt-6 space-y-3 text-start">
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isComplete = step.complete ?? index < currentStep;
        const isPending = index > currentStep;

        return (
          <div
            key={step.label}
            className={cn(
              'flex items-center gap-3 rounded-lg border p-3 transition-all duration-300',
              isActive && 'border-primary/30 bg-primary/5 shadow-sm',
              isComplete && 'border-success/30 bg-success/5',
              isPending && 'border-border bg-transparent opacity-50'
            )}
          >
            {/* Icon */}
            <div
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-300',
                isActive && 'bg-primary text-primary-foreground',
                isComplete && 'bg-success text-success-foreground',
                isPending && 'bg-surface text-foreground-muted'
              )}
            >
              {isComplete ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : isActive ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-current" />
              )}
            </div>

            {/* Label */}
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-sm font-bold',
                  isActive && 'text-foreground',
                  isComplete && 'text-success',
                  isPending && 'text-foreground-muted'
                )}
              >
                {step.label}
              </p>
              {step.progress != null && isActive && (
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-foreground/5">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                    style={{ width: `${Math.min(100, Math.max(0, step.progress))}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LoadingState component
// ---------------------------------------------------------------------------

export function LoadingState({
  title,
  description,
  variant = 'page',
  className,
  steps,
  currentStep = 0,
  progress,
}: LoadingStateProps) {
  const Icon = variantIcons[variant];
  const defaults = variantDefaults[variant];

  // --- Inline variant ---
  if (variant === 'inline') {
    return (
      <div
        className={cn('flex items-center gap-3', className)}
        aria-busy="true"
        aria-live="polite"
      >
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm font-semibold text-foreground-muted">
          {title || defaults.title}…
        </span>
        {progress != null && (
          <div className="ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-foreground/5">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  // --- Page variant (default) ---
  if (variant === 'page') {
    return (
      <div
        className={cn(
          'flex min-h-[360px] items-center justify-center p-6',
          className
        )}
        aria-busy="true"
        aria-live="polite"
      >
        <div className="w-full max-w-md rounded-lg border border-primary-light/20 bg-background/70 p-6 text-center shadow-[0_18px_42px_rgba(61,90,90,0.06)] backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-status-neutral-bg text-primary-light shadow-sm">
            <Icon className="h-6 w-6 animate-spin" />
          </div>
          <h2 className="mt-4 text-base font-bold text-foreground">
            {title || defaults.title}
          </h2>
          <p className="mt-1 text-sm text-foreground-muted">
            {description || defaults.description}
          </p>

          {/* Progress bar */}
          {progress != null && (
            <div className="mt-6">
              <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/5">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
              <p className="mt-2 text-xs font-bold text-foreground-muted">
                {progress}%
              </p>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <div className="skeleton-block mx-auto h-3 w-3/4" />
            <div className="skeleton-block mx-auto h-3 w-1/2" />
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="skeleton-block h-12" />
              <div className="skeleton-block h-12" />
              <div className="skeleton-block h-12" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Card variant ---
  if (variant === 'card') {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border border-border bg-surface-elevated p-8 text-center shadow-sm',
          className
        )}
        aria-busy="true"
        aria-live="polite"
      >
        <div className="max-w-xs">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-surface text-primary shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <p className="mt-3 text-sm font-bold text-foreground">
            {title || defaults.title}
          </p>
          {description && (
            <p className="mt-1 text-xs text-foreground-muted">{description}</p>
          )}
        </div>
      </div>
    );
  }

  // --- Progress variants with steps (ai-generating, pdf, publishing) ---
  const iconSpin = progress == null;
  const StepIcon = steps?.[currentStep]?.complete ? CheckCircle2 : Icon;

  return (
    <div
      className={cn(
        'min-w-0 rounded-lg border border-border bg-surface-elevated p-6 shadow-sm',
        variant === 'ai-generating' && 'border-primary-light/20',
        variant === 'publishing' && 'border-success/20',
        className
      )}
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      {/* Header */}
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg shadow-sm',
            variant === 'ai-generating' && 'bg-primary-light text-primary',
            variant === 'pdf' && 'bg-surface text-primary',
            variant === 'publishing' && 'bg-success-light text-success'
          )}
        >
          <StepIcon
            className={cn(
              'h-6 w-6',
              iconSpin && 'animate-spin',
              progress != null && progress >= 100 && 'text-success'
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-foreground">
            {title || defaults.title}
          </h3>
          <p className="mt-1 text-sm text-foreground-muted">
            {description || defaults.description}
          </p>

          {/* Progress bar for indeterminate progress */}
          {progress != null && (
            <div className="mt-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/5">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.min(100, Math.max(0, progress))}%`,
                    backgroundColor:
                      progress >= 100
                        ? 'var(--color-success)'
                        : 'var(--color-primary)',
                  }}
                />
              </div>
              <p className="mt-1 text-xs font-bold text-foreground-muted">
                {progress >= 100 ? 'Complete' : `${Math.round(progress)}%`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Steps */}
      {steps && steps.length > 0 && (
        <StepIndicator steps={steps} currentStep={currentStep} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preset loading states for common long operations
// ---------------------------------------------------------------------------

export function AILoadingState({
  title = 'Generating with AI',
  description = 'Creating content using AI models. This may take a moment.',
  currentStep = 0,
  className,
}: {
  title?: string;
  description?: string;
  currentStep?: number;
  className?: string;
}) {
  const steps: LoadingStep[] = [
    { label: 'Analyzing your prompt', complete: currentStep > 0 },
    { label: 'Generating content', complete: currentStep > 1 },
    { label: 'Polishing output', complete: currentStep > 2 },
    { label: 'Finalizing result', complete: currentStep > 3 },
  ];

  return (
    <LoadingState
      variant="ai-generating"
      title={title}
      description={description}
      steps={steps}
      currentStep={Math.min(currentStep, steps.length - 1)}
      className={className}
    />
  );
}

export function PDFLoadingState({
  title = 'Generating PDF Report',
  description = 'Building your report for download. This usually takes a few seconds.',
  currentStep = 0,
  className,
}: {
  title?: string;
  description?: string;
  currentStep?: number;
  className?: string;
}) {
  const steps: LoadingStep[] = [
    { label: 'Compiling report data', complete: currentStep > 0 },
    { label: 'Rendering layout', complete: currentStep > 1 },
    { label: 'Generating PDF file', complete: currentStep > 2 },
    { label: 'Preparing download', complete: currentStep > 3 },
  ];

  return (
    <LoadingState
      variant="pdf"
      title={title}
      description={description}
      steps={steps}
      currentStep={Math.min(currentStep, steps.length - 1)}
      className={className}
    />
  );
}

export function PublishLoadingState({
  title = 'Publishing Content',
  description = 'Sending your content to the provider.',
  currentStep = 0,
  className,
}: {
  title?: string;
  description?: string;
  currentStep?: number;
  className?: string;
}) {
  const steps: LoadingStep[] = [
    { label: 'Validating content', complete: currentStep > 0 },
    { label: 'Connecting to provider', complete: currentStep > 1 },
    { label: 'Uploading assets', complete: currentStep > 2 },
    { label: 'Confirming publication', complete: currentStep > 3 },
  ];

  return (
    <LoadingState
      variant="publishing"
      title={title}
      description={description}
      steps={steps}
      currentStep={Math.min(currentStep, steps.length - 1)}
      className={className}
    />
  );
}
