import { Layers3 } from 'lucide-react';

export type ReadinessState =
  | 'ready'
  | 'setup_required'
  | 'approval_pending'
  | 'quota_limit'
  | 'token_missing'
  | 'manual_only'
  | 'unsupported'
  | 'error';

export interface ProviderStatusRow {
  name: string;
  status: ReadinessState;
  missing: string[];
  nextAction: string;
}

export interface MetricCard {
  label: string;
  value: number;
  helper: string;
  icon: typeof Layers3;
  accent: string;
}

export type OptionalWorkspaceRow = Record<string, unknown>;
