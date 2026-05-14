export const BRAND_NAME = 'AgentFlow AI';

export const BRAND_COLORS = {
  white: '#FFFFFF',
  surface: '#FFE3B3',
  primary: '#CA2851',
  accent: '#FF6766',
  ink: '#171717',
} as const;

const legacyColorMap: Record<string, string> = {
  '#3B82F6': BRAND_COLORS.primary,
  '#8B5CF6': BRAND_COLORS.primary,
  '#06B6D4': BRAND_COLORS.accent,
  '#F59E0B': BRAND_COLORS.accent,
  '#10B981': BRAND_COLORS.ink,
  '#EF4444': BRAND_COLORS.accent,
};

export function normalizeBrandColor(color?: string) {
  if (!color) return BRAND_COLORS.primary;

  const normalized = color.toUpperCase();

  return legacyColorMap[normalized] ?? normalized;
}

export function getDepartmentBrandColor(department?: string) {
  if (department === 'Content & Growth') return BRAND_COLORS.accent;
  if (department === 'Sales & Operations') return BRAND_COLORS.ink;

  return BRAND_COLORS.primary;
}

export function getAgentBrandColor({
  color,
  department,
}: {
  color?: string;
  department?: string;
}) {
  return department ? getDepartmentBrandColor(department) : normalizeBrandColor(color);
}
