import type { MetaCampaignInsights } from './meta';

export interface MetaPerformanceDiagnosis {
  findings: string[];
  nextActions: string[];
}

function numericValue(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function hasPositiveValue(value: number | null | undefined) {
  const numeric = numericValue(value);
  return numeric !== null && numeric > 0;
}

function hasNoConversions(insights: MetaCampaignInsights) {
  return !hasPositiveValue(insights.leads) && !hasPositiveValue(insights.conversions);
}

function buildNextActions(insights: MetaCampaignInsights | null): string[] {
  if (!insights?.hasData || !hasPositiveValue(insights.impressions)) {
    return [
      'Review budget allocation.',
      'Refine audience targeting.',
      'Test creative variations.',
      'Improve the hook.',
    ];
  }

  if (hasPositiveValue(insights.spend) && hasNoConversions(insights)) {
    return [
      'Improve the hook.',
      'Test creative variations.',
      'Improve the offer and landing page.',
      'Review budget allocation.',
    ];
  }

  return [
    'Improve the hook.',
    'Test creative variations.',
    'Refine audience targeting.',
    'Review budget allocation.',
  ];
}

export function buildMetaPerformanceDiagnosis(
  insights: MetaCampaignInsights | null
): MetaPerformanceDiagnosis {
  const findings: string[] = [];

  if (!insights?.hasData || !hasPositiveValue(insights.impressions)) {
    findings.push('No delivery data yet.');

    return {
      findings,
      nextActions: buildNextActions(insights),
    };
  }

  const impressions = numericValue(insights.impressions) ?? 0;
  const clicks = numericValue(insights.clicks) ?? 0;
  const ctr = numericValue(insights.ctr);
  const cpc = numericValue(insights.cpc);

  if (impressions > 0 && clicks / impressions < 0.005) {
    findings.push('Low click engagement.');
  }

  if (ctr !== null && ctr < 1) {
    findings.push('Creative/hook or audience fit may need improvement.');
  }

  if (cpc !== null && cpc >= 5) {
    findings.push(
      'Cost per click may be high; consider narrowing audience or improving creative.'
    );
  }

  if (hasPositiveValue(insights.spend) && hasNoConversions(insights)) {
    findings.push('Traffic is not converting; review offer, landing page, and CTA.');
  }

  if (hasPositiveValue(insights.leads) || hasPositiveValue(insights.conversions)) {
    findings.push('Campaign has conversion signal; scale carefully and test variations.');
  }

  if (findings.length === 0) {
    findings.push('Campaign has delivery data; review efficiency before changing budget.');
  }

  return {
    findings,
    nextActions: buildNextActions(insights),
  };
}

export function formatMetaDiagnosisForBrief(diagnosis: MetaPerformanceDiagnosis) {
  return [
    ...diagnosis.findings,
    '',
    'Next actions:',
    ...diagnosis.nextActions.map((action) => `- ${action}`),
  ].join('\n');
}
