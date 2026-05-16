'use client';

import { useActionState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { SpendControlSettings } from '@/lib/production-readiness';
import {
  updateProductionOperationsSettingsAction,
  type ProductionSettingsState,
} from './actions';

const initialProductionSettingsState: ProductionSettingsState = {
  ok: false,
  message: null,
  error: null,
};

export function ProductionSettingsForm({
  settings,
  canSwitchToProduction,
  canEnablePaidAds,
}: {
  settings: SpendControlSettings;
  canSwitchToProduction: boolean;
  canEnablePaidAds: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateProductionOperationsSettingsAction,
    initialProductionSettingsState
  );

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? (
        <div className="rounded-lg border border-[#F7CBCA]/28 bg-[#F7CBCA]/10 p-4 text-sm font-semibold leading-6 text-[#A30D1D]">
          {state.error}
        </div>
      ) : null}
      {state.message ? (
        <div className="rounded-lg border border-[#0F7A4F]/20 bg-[#E8F8EF] p-4 text-sm font-semibold leading-6 text-[#0F5F3E]">
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-black text-[#5D6B6B]">Launch mode / وضع الإطلاق</span>
          <select
            name="launch_mode"
            defaultValue={settings.launch_mode}
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-black/72"
          >
            <option value="blocked">blocked</option>
            <option value="internal">internal</option>
            <option value="production" disabled={!canSwitchToProduction}>
              production
            </option>
          </select>
          {!canSwitchToProduction ? (
            <span className="block text-xs leading-5 text-[#A30D1D]">
              Production mode is disabled until all core gates are green.
            </span>
          ) : null}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-black text-[#5D6B6B]">Max daily ad spend</span>
          <input
            name="max_daily_ad_spend"
            type="number"
            min="0"
            step="1"
            defaultValue={settings.max_daily_ad_spend ?? ''}
            placeholder="Not set"
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-black/72"
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex items-start gap-3 rounded-lg border border-black/7 bg-white p-4">
          <input
            name="paid_ads_enabled"
            type="checkbox"
            defaultChecked={settings.paid_ads_enabled}
            disabled={!canEnablePaidAds}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-black text-[#5D6B6B]">Enable paid ads</span>
            <span className="mt-1 block text-xs leading-5 text-black/55">
              Disabled until persistent rate limits, providers, backups, and spend controls are green.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-lg border border-black/7 bg-white p-4">
          <input
            name="require_manual_confirmation"
            type="checkbox"
            defaultChecked={settings.require_manual_confirmation}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-black text-[#5D6B6B]">Require manual confirmation</span>
            <span className="mt-1 block text-xs leading-5 text-black/55">
              Required for paid ads. التأكيد اليدوي مطلوب.
            </span>
          </span>
        </label>
      </div>

      <fieldset className="rounded-lg border border-black/7 bg-[#F1F7F7]/70 p-4">
        <legend className="px-1 text-sm font-black text-[#5D6B6B]">Allowed providers</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {(['meta', 'google_ads', 'pinterest'] as const).map((provider) => (
            <label key={provider} className="flex items-center gap-2 rounded-lg border border-black/7 bg-white px-3 py-2 text-sm font-semibold text-black/68">
              <input
                name="allowed_providers"
                type="checkbox"
                value={provider}
                defaultChecked={settings.allowed_providers.includes(provider)}
              />
              {provider}
            </label>
          ))}
        </div>
      </fieldset>

      <Button type="submit" variant="primary" disabled={pending}>
        <Save className="h-4 w-4" />
        {pending ? 'Saving...' : 'Save production settings'}
      </Button>
    </form>
  );
}
