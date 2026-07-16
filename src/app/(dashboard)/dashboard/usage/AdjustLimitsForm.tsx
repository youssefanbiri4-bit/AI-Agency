'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { LoaderCircle, Save } from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { useToast } from '@/components/ui/toast';
import { updateUsageLimits } from './actions';

interface AdjustLimitsFormProps {
  current: {
    max_ai_generations_per_month: number | null;
    max_tasks: number | null;
    max_creative_assets: number | null;
    max_content_items: number | null;
    max_reels_publishes_per_month: number | null;
  };
}

export function AdjustLimitsForm({ current }: AdjustLimitsFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateUsageLimits(formData);
      if (result.success) {
        toast.success('Limits updated', {
          description: 'New quota limits are saved. The page will refresh to reflect changes.',
        });
        router.refresh();
      } else {
        setError(result.error);
        toast.error('Update failed', {
          description: result.error ?? 'An unexpected error occurred.',
        });
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title="Adjust Limits"
        description="Override plan defaults for this workspace. Empty fields = unlimited."
      />
      <form onSubmit={handleSubmit} className="space-y-5 p-4 pt-0">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="max_ai_generations_per_month"
            label="AI Generations / month"
            defaultValue={current.max_ai_generations_per_month}
          />
          <Field
            name="max_tasks"
            label="Tasks"
            defaultValue={current.max_tasks}
          />
          <Field
            name="max_creative_assets"
            label="Creative Assets"
            defaultValue={current.max_creative_assets}
          />
          <Field
            name="max_content_items"
            label="Content Items"
            defaultValue={current.max_content_items}
          />
          <Field
            name="max_reels_publishes_per_month"
            label="Reel Publishes / month"
            defaultValue={current.max_reels_publishes_per_month}
          />
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={isPending}
            className={buttonStyles()}
          >
            {isPending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isPending ? 'Saving…' : 'Save Limits'}
          </button>
        </div>
      </form>
    </Card>
  );
}

function Field({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: number | null;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-black uppercase tracking-[0.13em] text-foreground-muted">{label}</span>
      <input
        type="number"
        name={name}
        defaultValue={defaultValue ?? ''}
        placeholder="Unlimited"
        min={0}
        className="h-10 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-foreground-muted placeholder:text-foreground-muted focus:border-[#F7CBCA] focus:outline-none focus:ring-2 focus:ring-[#F7CBCA]/30"
      />
    </label>
  );
}
