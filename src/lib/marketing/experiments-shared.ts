/**
 * Marketing A/B Experiments — shared constants & pure functions.
 *
 * This file is safe for both server and client bundles (no server-only imports).
 */

export const AB_COOKIE_PREFIX = 'af_ab_';

export interface ExperimentDefinition {
  id: string;
  label: string;
  variants: string[];
  weights?: number[];
}

export const EXPERIMENTS: Record<string, ExperimentDefinition> = {
  'landing-hero': {
    id: 'landing-hero',
    label: 'Landing hero headline',
    variants: ['A', 'B'],
    weights: [50, 50],
  },
  'pricing-cta': {
    id: 'pricing-cta',
    label: 'Pricing page CTA text',
    variants: ['control', 'urgency', 'social-proof'],
    weights: [34, 33, 33],
  },
  'features-layout': {
    id: 'features-layout',
    label: 'Features section layout',
    variants: ['grid', 'cards'],
    weights: [50, 50],
  },
  'footer-cta': {
    id: 'footer-cta',
    label: 'Footer CTA copy',
    variants: ['standard', 'urgency'],
    weights: [50, 50],
  },
};

/**
 * Deterministically assign a variant from a stable seed so the same visitor
 * always gets the same variant.
 */
export function assignVariant(exp: ExperimentDefinition, seed: string): string {
  const weights = exp.weights ?? exp.variants.map(() => 1);
  const total = weights.reduce((a, b) => a + b, 0) || 1;

  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const bucket = (Math.abs(h) % 1000) / 1000;

  let accum = 0;
  for (let i = 0; i < exp.variants.length; i++) {
    accum += weights[i] / total;
    if (bucket <= accum) return exp.variants[i];
  }
  return exp.variants[exp.variants.length - 1];
}

/**
 * Server-side variant resolution for a given experiment.
 * Reads an existing cookie value if present (sticky), otherwise assigns.
 */
export function getExperimentVariant(
  experimentId: string,
  existingCookie: string | undefined,
  seed: string
): { variant: string; isNew: boolean } {
  const exp = EXPERIMENTS[experimentId];
  if (!exp) return { variant: 'A', isNew: false };

  if (existingCookie && exp.variants.includes(existingCookie)) {
    return { variant: existingCookie, isNew: false };
  }
  return { variant: assignVariant(exp, seed), isNew: true };
}
