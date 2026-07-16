'use client';

import { AlertCircle, Check, Clock, RotateCw } from 'lucide-react';
import type { AgentStatus, TaskStatus } from '@/types';
import { cn } from '@/lib/utils';
import { useOptionalLanguage } from '@/i18n/context';

interface StatusBadgeProps {
  className?: string;
  status:
    | AgentStatus
    | TaskStatus
    | 'Active'
    | 'Prepared'
    | 'Disabled'
    | 'Ready'
    | 'Not Connected'
    | 'Setup Required'
    | 'Draft-only'
    | 'Manual Mode'
    | 'External Approval Pending'
    | 'ready'
    | 'scheduled'
    | 'published'
    | 'succeeded'
    | 'success'
    | 'pending'
    | 'processing'
    | 'failed'
    | 'approval_pending'
    | 'setup_required'
    | 'token_missing'
    | 'quota_limit'
    | 'billing_required'
    | 'manual_only'
    | 'unsupported'
    | 'needs_fix'
    | 'error'
    | 'No Data'
    | 'Awaiting Data';
  type?: 'agent' | 'task' | 'system';
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig = {
  Active: {
    label: 'Active',
    labelKey: 'status.active',
    className: 'border-status-success-bg bg-status-success-bg text-status-success-text',
    dot: 'bg-status-success-text',
    icon: Check,
  },
  Idle: {
    label: 'Idle',
    labelKey: 'status.idle',
    className: 'border-status-neutral-bg bg-status-neutral-bg text-status-neutral-text',
    dot: 'bg-status-neutral-text',
    icon: Clock,
  },
  Processing: {
    label: 'Processing',
    labelKey: 'status.processing',
    className: 'border-status-info-bg bg-status-info-bg text-status-info-text',
    dot: 'bg-status-info-text',
    icon: RotateCw,
  },
  'Needs Review': {
    label: 'Needs Review',
    labelKey: 'status.needsReview',
    className: 'border-status-warning-bg bg-status-warning-bg text-status-warning-text',
    dot: 'bg-status-warning-text',
    icon: AlertCircle,
  },
  'Not Connected': {
    label: 'Not Connected',
    labelKey: 'status.notConnected',
    className: 'border-status-neutral-bg bg-status-neutral-bg text-status-neutral-text',
    dot: 'bg-status-neutral-text',
    icon: Clock,
  },
  draft: {
    label: 'Draft',
    labelKey: 'status.draft',
    className: 'border-status-neutral-bg bg-status-neutral-bg text-status-neutral-text',
    dot: 'bg-status-neutral-text',
    icon: Clock,
  },
  pending: {
    label: 'Pending',
    labelKey: 'status.pending',
    className: 'border-status-warning-bg bg-status-warning-bg text-status-warning-text',
    dot: 'bg-status-warning-text',
    icon: Clock,
  },
  ready: {
    label: 'Ready',
    labelKey: 'status.ready',
    className: 'border-status-success-bg bg-status-success-bg text-status-success-text',
    dot: 'bg-status-success-text',
    icon: Check,
  },
  processing: {
    label: 'Processing',
    labelKey: 'status.processing',
    className: 'border-status-info-bg bg-status-info-bg text-status-info-text',
    dot: 'bg-status-info-text',
    icon: RotateCw,
  },
  needs_review: {
    label: 'Needs Review',
    labelKey: 'status.needsReview',
    className: 'border-status-warning-bg bg-status-warning-bg text-status-warning-text',
    dot: 'bg-status-warning-text',
    icon: AlertCircle,
  },
  completed: {
    label: 'Completed',
    labelKey: 'status.completed',
    className: 'border-status-success-bg bg-status-success-bg text-status-success-text',
    dot: 'bg-status-success-text',
    icon: Check,
  },
  succeeded: {
    label: 'Succeeded',
    labelKey: 'status.succeeded',
    className: 'border-status-success-bg bg-status-success-bg text-status-success-text',
    dot: 'bg-status-success-text',
    icon: Check,
  },
  success: {
    label: 'Success',
    labelKey: 'status.success',
    className: 'border-status-success-bg bg-status-success-bg text-status-success-text',
    dot: 'bg-status-success-text',
    icon: Check,
  },
  failed: {
    label: 'Failed',
    labelKey: 'status.failed',
    className: 'border-status-danger-bg bg-status-danger-bg text-status-danger-text',
    dot: 'bg-status-danger-text',
    icon: AlertCircle,
  },
  scheduled: {
    label: 'Scheduled',
    labelKey: 'status.scheduled',
    className: 'border-status-warning-bg bg-status-warning-bg text-status-warning-text',
    dot: 'bg-status-warning-text',
    icon: Clock,
  },
  published: {
    label: 'Published',
    labelKey: 'status.published',
    className: 'border-status-success-bg bg-status-success-bg text-status-success-text',
    dot: 'bg-status-success-text',
    icon: Check,
  },
  approval_pending: {
    label: 'Approval Pending',
    labelKey: 'status.approvalPending',
    className: 'border-status-warning-bg bg-status-warning-bg text-status-warning-text',
    dot: 'bg-status-warning-text',
    icon: AlertCircle,
  },
  setup_required: {
    label: 'Setup Required',
    labelKey: 'status.setupRequired',
    className: 'border-status-warning-bg bg-status-warning-bg text-status-warning-text',
    dot: 'bg-status-warning-text',
    icon: AlertCircle,
  },
  token_missing: {
    label: 'Token missing',
    labelKey: 'status.tokenMissing',
    className: 'border-status-danger-bg bg-status-danger-bg text-status-danger-text',
    dot: 'bg-status-danger-text',
    icon: AlertCircle,
  },
  quota_limit: {
    label: 'Quota Limit',
    labelKey: 'status.quotaLimit',
    className: 'border-status-warning-bg bg-status-warning-bg text-status-warning-text',
    dot: 'bg-status-warning-text',
    icon: AlertCircle,
  },
  billing_required: {
    label: 'Billing Required',
    labelKey: 'status.billingRequired',
    className: 'border-status-danger-bg bg-status-danger-bg text-status-danger-text',
    dot: 'bg-status-danger-text',
    icon: AlertCircle,
  },
  manual_only: {
    label: 'Manual only',
    labelKey: 'status.manualOnly',
    className: 'border-status-neutral-bg bg-status-neutral-bg text-status-neutral-text',
    dot: 'bg-status-neutral-text',
    icon: Clock,
  },
  unsupported: {
    label: 'Unsupported',
    labelKey: 'status.unsupported',
    className: 'border-status-neutral-bg bg-status-neutral-bg text-status-neutral-text',
    dot: 'bg-status-neutral-text',
    icon: Clock,
  },
  needs_fix: {
    label: 'Needs Fix',
    labelKey: 'status.needsFix',
    className: 'border-status-danger-bg bg-status-danger-bg text-status-danger-text',
    dot: 'bg-status-danger-text',
    icon: AlertCircle,
  },
  error: {
    label: 'Error',
    labelKey: 'status.error',
    className: 'border-status-danger-bg bg-status-danger-bg text-status-danger-text',
    dot: 'bg-status-danger-text',
    icon: AlertCircle,
  },
  cancelled: {
    label: 'Cancelled',
    labelKey: 'status.cancelled',
    className: 'border-status-neutral-bg bg-status-neutral-bg text-status-neutral-text',
    dot: 'bg-status-neutral-text',
    icon: Clock,
  },
  Prepared: {
    label: 'Prepared',
    labelKey: 'common.prepared',
    className: 'border-status-success-bg bg-status-success-bg text-status-success-text',
    dot: 'bg-status-success-text',
    icon: Check,
  },
  Disabled: {
    label: 'Disabled',
    labelKey: 'status.disabled',
    className: 'border-status-neutral-bg bg-status-neutral-bg text-status-neutral-text',
    dot: 'bg-status-neutral-text',
    icon: Clock,
  },
  Ready: {
    label: 'Ready',
    labelKey: 'status.ready',
    className: 'border-status-success-bg bg-status-success-bg text-status-success-text',
    dot: 'bg-status-success-text',
    icon: Check,
  },
  'Setup Required': {
    label: 'Setup Required',
    labelKey: 'status.setupRequired',
    className: 'border-status-warning-bg bg-status-warning-bg text-status-warning-text',
    dot: 'bg-status-warning-text',
    icon: AlertCircle,
  },
  'Draft-only': {
    label: 'Draft-only',
    labelKey: 'status.draftOnly',
    className: 'border-status-neutral-bg bg-status-neutral-bg text-status-neutral-text',
    dot: 'bg-status-neutral-text',
    icon: Clock,
  },
  'Manual Mode': {
    label: 'Manual Mode',
    labelKey: 'status.manualMode',
    className: 'border-status-neutral-bg bg-status-neutral-bg text-status-neutral-text',
    dot: 'bg-status-neutral-text',
    icon: Clock,
  },
  'External Approval Pending': {
    label: 'External Approval Pending',
    labelKey: 'status.externalApprovalPending',
    className: 'border-status-warning-bg bg-status-warning-bg text-status-warning-text',
    dot: 'bg-status-warning-text',
    icon: AlertCircle,
  },
  'No Data': {
    label: 'No Data',
    labelKey: 'status.noData',
    className: 'border-status-neutral-bg bg-status-neutral-bg text-status-neutral-text',
    dot: 'bg-status-neutral-text',
    icon: Clock,
  },
  'Awaiting Data': {
    label: 'Awaiting Data',
    labelKey: 'status.awaitingData',
    className: 'border-status-neutral-bg bg-status-neutral-bg text-status-neutral-text',
    dot: 'bg-status-neutral-text',
    icon: Clock,
  },
} as const;

const sizeConfig = {
  sm: 'gap-1.5 px-2.5 py-1 text-xs',
  md: 'gap-1.5 px-3 py-1.5 text-xs',
  lg: 'gap-2 px-3 py-2 text-sm',
};

export function StatusBadge({ status, type = 'agent', size = 'md', className }: StatusBadgeProps) {
  const { t } = useOptionalLanguage();
  const config = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.Idle;
  const Icon = config.icon;
  const shouldSpin = status === 'processing';
  const label = t(config.labelKey, config.label);

  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full border font-bold leading-5',
        'max-w-full min-w-fit whitespace-normal text-start',
        sizeConfig[size],
        config.className,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', config.dot)} />
      <Icon
        className={cn(
          'shrink-0',
          size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5',
          shouldSpin && type !== 'system' && 'animate-spin'
        )}
      />
      <span className="min-w-0 break-words">{label}</span>
    </span>
  );
}