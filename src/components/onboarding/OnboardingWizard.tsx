'use client';

import { useState, useCallback } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Building2,
  CreditCard,
  Users,
  Rocket,
  Sparkles,
  Zap,
  Shield,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Notice } from '@/components/ui/Notice';
import { cn } from '@/lib/utils';

interface OnboardingWizardProps {
  workspaceName: string;
  workspaceSlug: string;
  onNameChange: (name: string) => void;
  onSlugChange: (slug: string) => void;
  onSubmit: (plan: string) => void;
  isPending: boolean;
  error?: string | null;
}

type PlanType = 'free' | 'pro' | 'enterprise';

const PLANS: Array<{
  id: PlanType;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlight?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Get started with essential AI agent orchestration.',
    features: ['2 team members', '20 AI generations/mo', '40 tasks/mo', 'Basic analytics'],
    icon: Zap,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$49',
    period: '/month',
    description: 'For growing teams that need more capacity and insights.',
    features: ['20 team members', '500 AI generations/mo', '1,000 tasks/mo', 'Advanced analytics', 'PDF reports'],
    highlight: true,
    icon: Sparkles,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$149',
    period: '/month',
    description: 'Unlimited capacity and dedicated support for large operations.',
    features: ['Unlimited members', '5,000 AI generations/mo', '10,000 tasks/mo', 'Real-time analytics', 'Custom branding'],
    icon: Shield,
  },
];

const ONBOARDING_STEPS = [
  { id: 'workspace', title: 'Workspace', icon: Building2 },
  { id: 'plan', title: 'Plan', icon: CreditCard },
  { id: 'team', title: 'Team', icon: Users },
  { id: 'launch', title: 'Launch', icon: Rocket },
];

export function OnboardingWizard({
  workspaceName,
  workspaceSlug,
  onNameChange,
  onSlugChange,
  onSubmit,
  isPending,
  error,
}: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('free');
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);

  const handleNext = useCallback(() => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onSubmit(selectedPlan);
    }
  }, [currentStep, selectedPlan, onSubmit]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const handleAddInvite = useCallback((email: string) => {
    if (email && !inviteEmails.includes(email)) {
      setInviteEmails((prev) => [...prev, email]);
    }
  }, [inviteEmails]);

  const handleRemoveInvite = useCallback((email: string) => {
    setInviteEmails((prev) => prev.filter((e) => e !== email));
  }, []);

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return workspaceName.length >= 2;
      case 1:
        return true;
      case 2:
        return true;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <label htmlFor="workspace-name" className="block text-sm font-bold text-foreground">
                Workspace Name
              </label>
              <input
                id="workspace-name"
                type="text"
                value={workspaceName}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Acme Growth Team"
                className="mt-2 block w-full rounded-lg border border-border bg-surface px-4 py-3 text-foreground placeholder-foreground-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                aria-required="true"
              />
            </div>
            <div>
              <label htmlFor="workspace-slug" className="block text-sm font-bold text-foreground">
                Workspace Slug
              </label>
              <input
                id="workspace-slug"
                type="text"
                value={workspaceSlug}
                onChange={(e) => onSlugChange(e.target.value)}
                placeholder="acme-growth-team"
                className="mt-2 block w-full rounded-lg border border-border bg-surface px-4 py-3 text-foreground placeholder-foreground-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="mt-2 text-xs text-foreground-muted">
                Leave blank to generate from workspace name.
              </p>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              {PLANS.map((plan) => {
                const Icon = plan.icon;
                const isSelected = selectedPlan === plan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlan(plan.id)}
                    className={cn(
                      'relative flex flex-col rounded-xl border-2 p-4 text-left transition-all',
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border bg-surface hover:border-border-strong hover:shadow-sm'
                    )}
                  >
                    {plan.highlight && (
                      <div className="absolute -top-2.5 left-4">
                        <Badge tone="primary">Most Popular</Badge>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg',
                        isSelected ? 'bg-primary/10 text-primary' : 'bg-surface-elevated text-foreground-muted'
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{plan.name}</p>
                        <p className="text-sm text-foreground-muted">
                          {plan.price}{plan.period}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-foreground-muted">{plan.description}</p>
                    <ul className="mt-4 space-y-2">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <p className="text-sm text-foreground-muted">
              Invite team members to collaborate in your workspace. You can add more later.
            </p>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="colleague@example.com"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddInvite((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                  className="flex-1 rounded-lg border border-border bg-surface px-4 py-3 text-foreground placeholder-foreground-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <Button
                  variant="secondary"
                  onClick={(e) => {
                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                    handleAddInvite(input.value);
                    input.value = '';
                  }}
                >
                  Add
                </Button>
              </div>
              {inviteEmails.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {inviteEmails.map((email) => (
                    <div
                      key={email}
                      className="flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1.5"
                    >
                      <span className="text-sm text-foreground">{email}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveInvite(email)}
                        className="text-foreground-muted hover:text-foreground"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Notice tone="info">
              Invitations will be sent after workspace creation.
            </Notice>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <Rocket className="h-8 w-8 text-success" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">Ready to Launch!</h3>
              <p className="mt-2 text-sm text-foreground-muted">
                Your workspace <span className="font-bold text-foreground">{workspaceName || 'Untitled'}</span> is
                ready. {selectedPlan !== 'free' && `You'll be on the ${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} plan.`}
              </p>
            </div>
            <div className="mx-auto grid max-w-sm gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-3">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span className="text-sm text-foreground">Analytics dashboard</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-3">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm text-foreground">{inviteEmails.length} team invite{inviteEmails.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader
        title="Set Up Your Workspace"
        description="Complete these steps to get started with AgentFlow AI."
      />

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {ONBOARDING_STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = idx === currentStep;
            const isCompleted = idx < currentStep;
            return (
              <div key={step.id} className="flex items-center">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
                    isCompleted
                      ? 'bg-success text-success-foreground'
                      : isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-surface-elevated text-foreground-muted'
                  )}>
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span className={cn(
                    'text-sm font-bold hidden sm:inline',
                    isActive ? 'text-foreground' : 'text-foreground-muted'
                  )}>
                    {step.title}
                  </span>
                </div>
                {idx < ONBOARDING_STEPS.length - 1 && (
                  <div className={cn(
                    'mx-2 h-0.5 w-8 sm:w-12',
                    idx < currentStep ? 'bg-success' : 'bg-border'
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <Notice tone="danger" title="Setup needs attention">
          {error}
        </Notice>
      )}

      {/* Step content */}
      <div className="min-h-[320px]">
        {renderStep()}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <Button
          variant="ghost"
          onClick={handlePrev}
          disabled={currentStep === 0 || isPending}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="text-sm text-foreground-muted">
          Step {currentStep + 1} of {ONBOARDING_STEPS.length}
        </div>

        <Button
          onClick={handleNext}
          disabled={!canProceed() || isPending}
        >
          {isPending ? (
            <>
              <Building2 className="h-4 w-4 animate-pulse" />
              Creating...
            </>
          ) : currentStep === ONBOARDING_STEPS.length - 1 ? (
            <>
              Launch Workspace
              <Rocket className="h-4 w-4" />
            </>
          ) : (
            <>
              Next
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
