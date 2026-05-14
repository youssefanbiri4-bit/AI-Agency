import type { ReleaseStatus, ReleaseType } from '@/types/database';
import { formatReleaseStatus, formatReleaseType } from '@/lib/data/releases';
import { cn } from '@/lib/utils';

const statusStyles: Record<ReleaseStatus, string> = {
  draft: 'border-black/10 bg-white text-black/62',
  ready_for_test: 'border-[#E7F5DC]/32 bg-[#E7F5DC]/24 text-[#8A4300]',
  testing: 'border-[#F7CBCA]/18 bg-[#D5E5E5]/70 text-[#F7CBCA]',
  ready_to_deploy: 'border-[#E7F5DC]/32 bg-[#D5E5E5]/70 text-[#8A4300]',
  deployed: 'border-[#5D6B6B]/12 bg-[#5D6B6B] text-[#D5E5E5]',
  failed: 'border-[#F7CBCA]/24 bg-[#D5E5E5]/70 text-[#B51F30]',
  rolled_back: 'border-[#F7CBCA]/24 bg-white text-[#B51F30]',
  archived: 'border-black/10 bg-white text-black/50',
};

export function ReleaseStatusBadge({ status }: { status: ReleaseStatus }) {
  return <span className={cn('rounded-full border px-2.5 py-1 text-xs font-black leading-none', statusStyles[status])}>{formatReleaseStatus(status)}</span>;
}

export function ReleaseTypeBadge({ type }: { type: ReleaseType }) {
  return <span className="rounded-full border border-[#F7CBCA]/18 bg-[#D5E5E5]/70 px-2.5 py-1 text-xs font-black leading-none text-[#F7CBCA]">{formatReleaseType(type)}</span>;
}
