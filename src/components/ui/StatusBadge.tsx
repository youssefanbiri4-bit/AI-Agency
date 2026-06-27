'use client';

import { AlertCircle, Check, Clock, RotateCw } from 'lucide-react';
import type { AgentStatus, TaskStatus } from '@/types';
import { cn } from '@/lib/utils';
import { useOptionalLanguage } from '@/i18n/context';

interface StatusBadgeProps {
  status:
    | AgentStatus
    | TaskStatus
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
    className: 'border-[#F7CBCA]/18 bg-[#D5E5E5]/65 text-[#F7CBCA]',
    dot: 'bg-[#F7CBCA]',
    icon: Check,
  },
  Idle: {
    label: 'Idle',
    labelKey: 'status.idle',
    className: 'border-black/10 bg-white text-black/58',
    dot: 'bg-black/35',
    icon: Clock,
  },
  Processing: {
    label: 'Processing',
    labelKey: 'status.processing',
    className: 'border-[#F7CBCA]/18 bg-[#D5E5E5]/65 text-[#F7CBCA]',
    dot: 'bg-[#F7CBCA]',
    icon: RotateCw,
  },
  'Needs Review': {
    label: 'Needs Review',
    labelKey: 'status.needsReview',
    className: 'border-[#F7CBCA]/20 bg-[#D5E5E5]/65 text-[#F7CBCA]',
    dot: 'bg-[#F7CBCA]',
    icon: AlertCircle,
  },
  'Not Connected': {
    label: 'Not Connected',
    labelKey: 'status.notConnected',
    className: 'border-black/10 bg-white text-black/58',
    dot: 'bg-black/35',
    icon: Clock,
  },
  draft: {
    label: 'Draft',
    labelKey: 'status.draft',
    className: 'border-black/10 bg-white text-black/64',
    dot: 'bg-black/35',
    icon: Clock,
  },
  pending: {
    label: 'Pending',
    labelKey: 'status.pending',
    className: 'border-[#F7CBCA]/20 bg-[#D5E5E5]/65 text-[#F7CBCA]',
    dot: 'bg-[#F7CBCA]',
    icon: Clock,
  },
  ready: {
    label: 'Ready',
    labelKey: 'status.ready',
    className: 'border-[#F7CBCA]/18 bg-[#D5E5E5]/70 text-[#7A3A00]',
    dot: 'bg-[#F7CBCA]',
    icon: Check,
  },
  processing: {
    label: 'Processing',
    labelKey: 'status.processing',
    className: 'border-[#F7CBCA]/18 bg-[#D5E5E5]/65 text-[#F7CBCA]',
    dot: 'bg-[#F7CBCA]',
    icon: RotateCw,
  },
  needs_review: {
    label: 'Needs Review',
    labelKey: 'status.needsReview',
    className: 'border-[#F7CBCA]/20 bg-[#D5E5E5]/65 text-[#F7CBCA]',
    dot: 'bg-[#F7CBCA]',
    icon: AlertCircle,
  },
  completed: {
    label: 'Completed',
    labelKey: 'status.completed',
    className: 'border-[#5D6B6B]/12 bg-[#5D6B6B] text-[#D5E5E5]',
    dot: 'bg-[#D5E5E5]',
    icon: Check,
  },
  succeeded: {
    label: 'Succeeded',
    labelKey: 'status.succeeded',
    className: 'border-[#5D6B6B]/12 bg-[#5D6B6B] text-[#D5E5E5]',
    dot: 'bg-[#D5E5E5]',
    icon: Check,
  },
  success: {
    label: 'Success',
    labelKey: 'status.success',
    className: 'border-[#5D6B6B]/12 bg-[#5D6B6B] text-[#D5E5E5]',
    dot: 'bg-[#D5E5E5]',
    icon: Check,
  },
  failed: {
    label: 'Failed',
    labelKey: 'status.failed',
    className: 'border-[#F7CBCA]/26 bg-[#F1F7F7] text-[#B51F30]',
    dot: 'bg-[#F7CBCA]',
    icon: AlertCircle,
  },
  scheduled: {
    label: 'Scheduled',
    labelKey: 'status.scheduled',
    className: 'border-[#E7F5DC]/32 bg-[#E7F5DC]/24 text-[#8A4300]',
    dot: 'bg-[#E7F5DC]',
    icon: Clock,
  },
  published: {
    label: 'Published',
    labelKey: 'status.published',
    className: 'border-[#5D6B6B]/12 bg-[#5D6B6B] text-[#D5E5E5]',
    dot: 'bg-[#D5E5E5]',
    icon: Check,
  },
  approval_pending: {
    label: 'Approval Pending',
    labelKey: 'status.approvalPending',
    className: 'border-[#D5E5E5] bg-[#D5E5E5]/64 text-[#5D6B6B]',
    dot: 'bg-[#E7F5DC]',
    icon: AlertCircle,
  },
  setup_required: {
    label: 'الإعداد مطلوب',
    labelKey: 'status.setupRequired',
    className: 'border-[#F7CBCA]/24 bg-[#D5E5E5]/72 text-[#F7CBCA]',
    dot: 'bg-[#F7CBCA]',
    icon: AlertCircle,
  },
  token_missing: {
    label: 'Token missing',
    labelKey: 'status.tokenMissing',
    className: 'border-[#F7CBCA]/20 bg-[#D5E5E5]/65 text-[#F7CBCA]',
    dot: 'bg-[#F7CBCA]',
    icon: AlertCircle,
  },
  quota_limit: {
    label: 'Provider Quota Required',
    labelKey: 'status.quotaLimit',
    className: 'border-[#D5E5E5] bg-[#D5E5E5]/64 text-[#5D6B6B]',
    dot: 'bg-[#E7F5DC]',
    icon: AlertCircle,
  },
  billing_required: {
    label: 'Billing Required',
    labelKey: 'status.billingRequired',
    className: 'border-[#D5E5E5] bg-[#D5E5E5]/64 text-[#5D6B6B]',
    dot: 'bg-[#E7F5DC]',
    icon: AlertCircle,
  },
  manual_only: {
    label: 'Manual only',
    labelKey: 'status.manualOnly',
    className: 'border-black/10 bg-white text-black/64',
    dot: 'bg-black/35',
    icon: Clock,
  },
  unsupported: {
    label: 'Unsupported',
    labelKey: 'status.unsupported',
    className: 'border-black/10 bg-white text-black/58',
    dot: 'bg-black/35',
    icon: Clock,
  },
  needs_fix: {
    label: 'يحتاج إلى إصلاح',
    labelKey: 'status.needsFix',
    className: 'border-[#F7CBCA]/26 bg-[#F1F7F7] text-[#B51F30]',
    dot: 'bg-[#F7CBCA]',
    icon: AlertCircle,
  },
  error: {
    label: 'Error',
    labelKey: 'status.error',
    className: 'border-[#F7CBCA]/20 bg-[#D5E5E5]/65 text-[#F7CBCA]',
    dot: 'bg-[#F7CBCA]',
    icon: AlertCircle,
  },
  cancelled: {
    label: 'Cancelled',
    labelKey: 'status.cancelled',
    className: 'border-black/10 bg-white text-black/58',
    dot: 'bg-black/35',
    icon: Clock,
  },
  Prepared: {
    label: 'Prepared',
    labelKey: 'common.prepared',
    className: 'border-[#E7F5DC]/32 bg-[#D5E5E5]/65 text-[#7A3A00]',
    dot: 'bg-[#E7F5DC]',
    icon: Check,
  },
  Disabled: {
    label: 'Disabled',
    labelKey: 'status.disabled',
    className: 'border-black/10 bg-white text-black/58',
    dot: 'bg-black/35',
    icon: Clock,
  },
  Ready: {
    label: 'Ready',
    labelKey: 'status.ready',
    className: 'border-[#E7F5DC]/32 bg-[#D5E5E5]/65 text-[#7A3A00]',
    dot: 'bg-[#E7F5DC]',
    icon: Check,
  },
  'Setup Required': {
    label: 'الإعداد مطلوب',
    labelKey: 'status.setupRequired',
    className: 'border-[#F7CBCA]/24 bg-[#D5E5E5]/65 text-[#F7CBCA]',
    dot: 'bg-[#F7CBCA]',
    icon: AlertCircle,
  },
  'Draft-only': {
    label: 'Draft-only',
    labelKey: 'status.draftOnly',
    className: 'border-[#E7F5DC]/32 bg-[#E7F5DC]/24 text-[#8A4300]',
    dot: 'bg-[#E7F5DC]',
    icon: Clock,
  },
  'Manual Mode': {
    label: 'Manual Mode',
    labelKey: 'status.manualMode',
    className: 'border-black/10 bg-white text-black/58',
    dot: 'bg-black/35',
    icon: Clock,
  },
  'External Approval Pending': {
    label: 'قيد المراجعة',
    labelKey: 'status.externalApprovalPending',
    className: 'border-[#F7CBCA]/20 bg-[#D5E5E5]/65 text-[#F7CBCA]',
    dot: 'bg-[#F7CBCA]',
    icon: AlertCircle,
  },
  'No Data': {
    label: 'No Data',
    labelKey: 'status.noData',
    className: 'border-black/10 bg-white text-black/58',
    dot: 'bg-black/25',
    icon: Clock,
  },
  'Awaiting Data': {
    label: 'Awaiting Data',
    labelKey: 'status.awaitingData',
    className: 'border-[#D5E5E5] bg-[#D5E5E5]/64 text-[#5D6B6B]',
    dot: 'bg-[#E7F5DC]',
    icon: Clock,
  },
} as const;

const sizeConfig = {
  sm: 'gap-1.5 px-2.5 py-1 text-xs',
  md: 'gap-1.5 px-3 py-1.5 text-xs',
  lg: 'gap-2 px-3 py-2 text-sm',
};

export function StatusBadge({ status, type = 'agent', size = 'md' }: StatusBadgeProps) {
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
        config.className
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
