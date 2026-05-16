'use client';

import type { PromptCategory, PromptTargetTool } from '@/types/database';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/context';
import { translatePromptCategory, translatePromptTool } from './prompt-i18n';

export function PromptCategoryBadge({ category }: { category: PromptCategory }) {
  const { t } = useLanguage();
  return (
    <span className="inline-flex rounded-full border border-[#F7CBCA]/18 bg-[#D5E5E5]/70 px-2.5 py-1 text-xs font-black leading-none text-[#F7CBCA]">
      {translatePromptCategory(t, category)}
    </span>
  );
}

export function PromptToolBadge({ tool }: { tool: PromptTargetTool | null }) {
  const { t } = useLanguage();
  return (
    <span className="inline-flex rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs font-black leading-none text-black/62">
      {translatePromptTool(t, tool)}
    </span>
  );
}

export function TagList({ tags, compact = false }: { tags: string[]; compact?: boolean }) {
  const visibleTags = compact ? tags.slice(0, 4) : tags;

  return (
    <div className="flex flex-wrap gap-1.5">
      {visibleTags.map((tag) => (
        <span
          key={tag}
          className="rounded-full border border-[#E7F5DC]/28 bg-[#E7F5DC]/18 px-2 py-1 text-xs font-bold text-[#8A4300]"
        >
          {tag}
        </span>
      ))}
      {compact && tags.length > visibleTags.length ? (
        <span className={cn('rounded-full border border-black/10 bg-white px-2 py-1 text-xs font-bold text-black/50')}>
          +{tags.length - visibleTags.length}
        </span>
      ) : null}
    </div>
  );
}
