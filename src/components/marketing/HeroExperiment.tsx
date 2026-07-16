'use client';

import { useEffect } from 'react';
import { AB_COOKIE_PREFIX } from '@/lib/marketing/experiments-shared';

const HERO_COPY: Record<string, { headline: string; sub: string }> = {
  A: {
    headline: 'Run AI agency work from one disciplined workspace',
    sub: 'AgentFlow AI brings your configured agents, task briefs, review flow, and reporting foundation into a product surface that stays honest about live data and integration readiness.',
  },
  B: {
    headline: 'The operations layer your AI agency actually needs',
    sub: 'Stop stitching tools together. AgentFlow AI unifies agents, tasks, reviews, and client reporting into one calm, auditable workspace.',
  },
};

export interface HeroExperimentProps {
  experimentId: string;
  variant: string;
  anonymousId: string;
  /** When true, fire a conversion event (signup CTA click) instead of exposure. */
  trackOnMount?: 'exposure' | 'conversion';
}

/**
 * Renders the A/B hero copy for the assigned variant, persists the sticky
 * cookie, and reports the exposure (or conversion) to the marketing tracker.
 */
export function HeroExperiment({ experimentId, variant, anonymousId, trackOnMount = 'exposure' }: HeroExperimentProps) {
  useEffect(() => {
    const cookieName = `${AB_COOKIE_PREFIX}${experimentId}`;
    try {
      document.cookie = `${cookieName}=${variant};path=/;max-age=${60 * 60 * 24 * 30};samesite=lax`;
    } catch {
      // cookie write is best-effort
    }
    void fetch('/api/marketing/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: trackOnMount === 'conversion' ? 'experiment_conversion' : 'experiment_exposure',
        experiment: experimentId,
        variant,
        anonymousId,
      }),
      keepalive: true,
    }).catch(() => {});
  }, [experimentId, variant, anonymousId, trackOnMount]);

  const copy = HERO_COPY[variant] ?? HERO_COPY.A;

  return (
    <>
      <h1 className="max-w-full break-words text-3xl font-black leading-tight tracking-normal text-black sm:text-5xl lg:text-6xl">
        {copy.headline}
      </h1>
      <p className="mt-6 max-w-2xl text-base leading-7 text-black/62 sm:text-lg sm:leading-8">
        {copy.sub}
      </p>
    </>
  );
}
