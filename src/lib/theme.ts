import type { JsonObject, JsonValue } from '@/types';

export type ThemeBackgroundMode = 'solid' | 'gradient' | 'image' | 'glassmorphism';
export type ThemeCardStyle = 'solid' | 'soft' | 'glass';

export interface WorkspaceTheme {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  card_background_style: ThemeCardStyle;
  background_mode: ThemeBackgroundMode;
  background_image_url: string | null;
  background_image_storage_path: string | null;
  background_opacity: number;
  card_opacity: number;
  glass_enabled: boolean;
  updated_at: string | null;
}

export const defaultWorkspaceTheme: WorkspaceTheme = {
  primary_color: '#CA2851',
  secondary_color: '#FF6766',
  accent_color: '#FFB173',
  background_color: '#FFF8F2',
  text_color: '#171717',
  card_background_style: 'soft',
  background_mode: 'gradient',
  background_image_url: null,
  background_image_storage_path: null,
  background_opacity: 0.92,
  card_opacity: 0.9,
  glass_enabled: true,
  updated_at: null,
};

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const backgroundModes: ThemeBackgroundMode[] = ['solid', 'gradient', 'image', 'glassmorphism'];
const cardStyles: ThemeCardStyle[] = ['solid', 'soft', 'glass'];

function asObject(value: unknown): Record<string, JsonValue> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, JsonValue>)
    : {};
}

export function sanitizeHexColor(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;

  const normalized = value.trim();
  return HEX_COLOR_PATTERN.test(normalized) ? normalized.toUpperCase() : fallback;
}

export function sanitizeThemeNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseFloat(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function normalizeWorkspaceTheme(settings: unknown): WorkspaceTheme {
  const root = asObject(settings);
  const theme = asObject(root.theme);

  const backgroundMode = String(theme.background_mode ?? defaultWorkspaceTheme.background_mode);
  const cardStyle = String(theme.card_background_style ?? defaultWorkspaceTheme.card_background_style);
  const backgroundImageUrl =
    typeof theme.background_image_url === 'string' && theme.background_image_url.trim()
      ? theme.background_image_url.trim()
      : null;
  const backgroundImageStoragePath =
    typeof theme.background_image_storage_path === 'string' &&
    theme.background_image_storage_path.trim()
      ? theme.background_image_storage_path.trim()
      : null;

  return {
    primary_color: sanitizeHexColor(theme.primary_color, defaultWorkspaceTheme.primary_color),
    secondary_color: sanitizeHexColor(theme.secondary_color, defaultWorkspaceTheme.secondary_color),
    accent_color: sanitizeHexColor(theme.accent_color, defaultWorkspaceTheme.accent_color),
    background_color: sanitizeHexColor(theme.background_color, defaultWorkspaceTheme.background_color),
    text_color: sanitizeHexColor(theme.text_color, defaultWorkspaceTheme.text_color),
    card_background_style: cardStyles.includes(cardStyle as ThemeCardStyle)
      ? (cardStyle as ThemeCardStyle)
      : defaultWorkspaceTheme.card_background_style,
    background_mode: backgroundModes.includes(backgroundMode as ThemeBackgroundMode)
      ? (backgroundMode as ThemeBackgroundMode)
      : defaultWorkspaceTheme.background_mode,
    background_image_url: backgroundImageUrl,
    background_image_storage_path: backgroundImageStoragePath,
    background_opacity: sanitizeThemeNumber(
      theme.background_opacity,
      defaultWorkspaceTheme.background_opacity,
      0.35,
      1
    ),
    card_opacity: sanitizeThemeNumber(theme.card_opacity, defaultWorkspaceTheme.card_opacity, 0.68, 1),
    glass_enabled:
      typeof theme.glass_enabled === 'boolean'
        ? theme.glass_enabled
        : defaultWorkspaceTheme.glass_enabled,
    updated_at: typeof theme.updated_at === 'string' ? theme.updated_at : null,
  };
}

export function themeToSettingsJson(theme: WorkspaceTheme): JsonObject {
  return {
    primary_color: theme.primary_color,
    secondary_color: theme.secondary_color,
    accent_color: theme.accent_color,
    background_color: theme.background_color,
    text_color: theme.text_color,
    card_background_style: theme.card_background_style,
    background_mode: theme.background_mode,
    background_image_url: theme.background_image_url,
    background_image_storage_path: theme.background_image_storage_path,
    background_opacity: theme.background_opacity,
    card_opacity: theme.card_opacity,
    glass_enabled: theme.glass_enabled,
    updated_at: theme.updated_at,
  };
}
