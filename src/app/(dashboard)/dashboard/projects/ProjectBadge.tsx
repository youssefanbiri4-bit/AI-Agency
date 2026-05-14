import type { ProjectPriority, ProjectStatus, ProjectType } from '@/types/database';
import { cn } from '@/lib/utils';
import { formatProjectStatus, formatProjectType } from '@/lib/data/projects';

type BadgeTone = 'berry' | 'coral' | 'peach' | 'dark' | 'neutral';

const toneStyles: Record<BadgeTone, string> = {
  berry: 'border-[#F7CBCA]/18 bg-[#D5E5E5]/72 text-[#F7CBCA]',
  coral: 'border-[#F7CBCA]/22 bg-[#D5E5E5]/72 text-[#B51F30]',
  peach: 'border-[#E7F5DC]/32 bg-[#E7F5DC]/24 text-[#8A4300]',
  dark: 'border-[#5D6B6B]/12 bg-[#5D6B6B] text-[#D5E5E5]',
  neutral: 'border-black/10 bg-white text-black/62',
};

const statusTone: Record<ProjectStatus, BadgeTone> = {
  planning: 'peach',
  active: 'berry',
  paused: 'neutral',
  needs_review: 'coral',
  ready_to_deploy: 'peach',
  deployed: 'dark',
  maintenance: 'neutral',
  archived: 'neutral',
};

const priorityTone: Record<ProjectPriority, BadgeTone> = {
  low: 'neutral',
  medium: 'peach',
  high: 'berry',
  urgent: 'coral',
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={cn('inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-black leading-none', toneStyles[statusTone[status]])}>
      {formatProjectStatus(status)}
    </span>
  );
}

export function ProjectTypeBadge({ type }: { type: ProjectType }) {
  return (
    <span className={cn('inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-black leading-none', toneStyles.berry)}>
      {formatProjectType(type)}
    </span>
  );
}

export function ProjectPriorityBadge({ priority }: { priority: ProjectPriority }) {
  return (
    <span className={cn('inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-black leading-none', toneStyles[priorityTone[priority]])}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}
