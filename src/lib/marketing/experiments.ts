/**
 * Marketing Events & A/B Experiments (W16-T2)
 *
 * Server-only tracking functions. Pure constants and variant assignment live
 * in experiments-shared.ts so client components can import them without pulling
 * in server-only code.
 */

import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import type { JsonObject } from '@/types';

export { AB_COOKIE_PREFIX, EXPERIMENTS, assignVariant, getExperimentVariant } from './experiments-shared';
export type { ExperimentDefinition } from './experiments-shared';

export interface MarketingEventMeta {
  [key: string]: unknown;
}

export async function trackMarketingEvent(
  eventType: string,
  metadata: MarketingEventMeta = {},
  extra?: { experiment?: string; variant?: string; workspaceId?: string; anonymousId?: string }
): Promise<void> {
  const { client: supabase } = getSupabaseAdmin();
  if (!supabase) return;

  const mktLog = logger.child('marketing:events');

  const { error } = await supabase.from('marketing_events').insert({
    event_type: eventType,
    experiment: extra?.experiment ?? null,
    variant: extra?.variant ?? null,
    workspace_id: extra?.workspaceId ?? null,
    anonymous_id: extra?.anonymousId ?? null,
    metadata: metadata as JsonObject,
  });

  if (error) {
    mktLog.warn('Failed to record marketing event', { error: error.message, eventType });
  }
}

/**
 * Record an experiment exposure (a visitor was shown a variant).
 */
export async function trackExperimentExposure(
  experimentId: string,
  variant: string,
  anonymousId?: string,
  workspaceId?: string
): Promise<void> {
  await trackMarketingEvent('experiment_exposure', {}, {
    experiment: experimentId,
    variant,
    anonymousId,
    workspaceId,
  });
}

/**
 * Record an experiment conversion (e.g. signup / CTA click).
 */
export async function trackExperimentConversion(
  experimentId: string,
  variant: string,
  anonymousId?: string,
  workspaceId?: string
): Promise<void> {
  await trackMarketingEvent('experiment_conversion', {}, {
    experiment: experimentId,
    variant,
    anonymousId,
    workspaceId,
  });
}
