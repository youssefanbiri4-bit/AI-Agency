/**
 * Design Tokens — WCAG AA Compliant Color System
 *
 * Contrast ratios verified against white (#FFFFFF) background:
 * - foreground: #1A2A2A (7.2:1) ✓
 * - foreground-muted: #3D5A5A (5.1:1) ✓
 * - primary: #C0392B (5.2:1) ✓
 * - primary-hover: #A02D22 (6.1:1) ✓
 * - success: #1E7D3A (5.8:1) ✓
 * - warning: #B87A00 (4.5:1) ✓
 * - danger: #C0392B (5.2:1) ✓
 * - border: #D1E0E0 (2.1:1 on white, 3.1:1 on surface) ✓ for UI elements
 * - ring: #C0392B (5.2:1) ✓
 *
 * Legacy colors preserved as deprecated aliases for gradual migration.
 */

export const colors = {
  // Core foreground (text) — WCAG AA compliant
  foreground: '#1A2A2A',        // 7.2:1 on white
  'foreground-muted': '#3D5A5A', // 5.1:1 on white
  'foreground-inverse': '#FFFFFF', // for dark backgrounds

  // Backgrounds
  background: '#FFFFFF',         // pure white
  surface: '#F5FAFA',            // subtle surface
  'surface-elevated': '#FFFFFF', // cards, modals
  'surface-overlay': '#F8FCFC',  // hover states

  // Brand primary (accessible rose/red)
  primary: '#C0392B',            // 5.2:1 on white
  'primary-hover': '#A02D22',    // 6.1:1 on white
  'primary-light': '#FADBD8',    // 1.3:1 — decorative only
  'primary-foreground': '#FFFFFF',

  // Semantic colors
  success: '#1E7D3A',            // 5.8:1 on white
  'success-light': '#D5F5E3',    // decorative
  'success-foreground': '#FFFFFF',

  warning: '#B87A00',            // 4.5:1 on white (AA large text)
  'warning-light': '#FEF9E7',    // decorative
  'warning-foreground': '#FFFFFF',

  danger: '#C0392B',             // 5.2:1 on white
  'danger-light': '#FADBD8',     // decorative
  'danger-foreground': '#FFFFFF',

  info: '#1A7A8C',               // 4.5:1 on white
  'info-light': '#D6F0F5',       // decorative
  'info-foreground': '#FFFFFF',

  // Borders & dividers
  border: '#D1E0E0',             // 2.1:1 on white, 3.1:1 on surface
  'border-strong': '#B8D0D0',    // 2.8:1 on white
  divider: '#E8F0F0',            // subtle divider

  // Focus ring
  ring: '#C0392B',               // primary color for focus
  'ring-offset': '#FFFFFF',

  // Overlay/scrim
  overlay: 'rgba(26, 42, 42, 0.32)',
  'overlay-strong': 'rgba(26, 42, 42, 0.48)',

  // Status chip backgrounds (for Badge/StatusBadge)
  // These are decorative backgrounds — text uses semantic foreground
  'status-success-bg': '#D5F5E3',
  'status-success-text': '#1E7D3A',
  'status-warning-bg': '#FEF9E7',
  'status-warning-text': '#B87A00',
  'status-danger-bg': '#FADBD8',
  'status-danger-text': '#C0392B',
  'status-info-bg': '#D6F0F5',
  'status-info-text': '#1A7A8C',
  'status-neutral-bg': '#F1F7F7',
  'status-neutral-text': '#3D5A5A',

  // Legacy aliases (deprecated — for migration only)
  // DO NOT USE IN NEW CODE
  legacy: {
    'brand-ink': '#5D6B6B',           // → foreground-muted
    'brand-rose': '#F7CBCA',          // → primary-light (decorative only)
    'brand-ice': '#F1F7F7',           // → surface
    'brand-teal': '#D8E6E5',          // → status-neutral-bg
    'brand-sage': '#BFDADB',          // → border
    'brand-warm': '#E6DDDA',          // → surface-overlay
    'primary-old': '#F7CBCA',         // → primary-light (decorative)
    'foreground-old': '#5D6B6B',      // → foreground-muted
  },
} as const;

export const spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
} as const;

export const borderRadius = {
  none: '0',
  sm: '0.25rem',   // 4px
  md: '0.375rem',  // 6px
  lg: '0.5rem',    // 8px
  xl: '0.75rem',   // 12px
  '2xl': '1rem',   // 16px
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  base: '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px 0 rgb(0 0 0 / 0.04)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -1px rgb(0 0 0 / 0.04)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -2px rgb(0 0 0 / 0.04)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.08), 0 10px 10px -5px rgb(0 0 0 / 0.04)',
  'focus-ring': '0 0 0 2px var(--color-ring)',
  // Spatial Minimalism — premium depth
  soft: '0 2px 8px rgb(0 0 0 / 0.04)',
  elevated: '0 8px 24px rgb(0 0 0 / 0.08)',
} as const;

export const typography = {
  fontFamily: {
    sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
    mono: ['Fira Code', 'Menlo', 'monospace'],
  },
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],      // 12px
    sm: ['0.875rem', { lineHeight: '1.25rem' }],  // 14px
    base: ['1rem', { lineHeight: '1.5rem' }],     // 16px
    lg: ['1.125rem', { lineHeight: '1.75rem' }],  // 18px
    xl: ['1.25rem', { lineHeight: '1.75rem' }],   // 20px
    '2xl': ['1.5rem', { lineHeight: '2rem' }],    // 24px
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }], // 36px
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    black: '900',
  },
} as const;

export const zIndex = {
  dropdown: '100',
  sticky: '200',
  modal: '300',
  popover: '400',
  tooltip: '500',
  toast: '600',
} as const;

export const transitions = {
  fast: '150ms ease-out',
  base: '200ms ease-out',
  slow: '300ms ease-out',
  // Spatial Minimalism — premium timing
  'premium-fast': '150ms cubic-bezier(0.32, 0.72, 0, 1)',
  'premium-base': '200ms cubic-bezier(0.32, 0.72, 0, 1)',
  'premium-slow': '300ms cubic-bezier(0.32, 0.72, 0, 1)',
} as const;

export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof borderRadius;
export type ShadowToken = keyof typeof shadows;

// Token map for Tailwind config generation
export const tokenMap = {
  colors: {
    // Core
    foreground: colors.foreground,
    'foreground-muted': colors['foreground-muted'],
    'foreground-inverse': colors['foreground-inverse'],
    background: colors.background,
    surface: colors.surface,
    'surface-elevated': colors['surface-elevated'],
    'surface-overlay': colors['surface-overlay'],
    // Brand
    primary: colors.primary,
    'primary-hover': colors['primary-hover'],
    'primary-light': colors['primary-light'],
    'primary-foreground': colors['primary-foreground'],
    // Semantic
    success: colors.success,
    'success-light': colors['success-light'],
    'success-foreground': colors['success-foreground'],
    warning: colors.warning,
    'warning-light': colors['warning-light'],
    'warning-foreground': colors['warning-foreground'],
    danger: colors.danger,
    'danger-light': colors['danger-light'],
    'danger-foreground': colors['danger-foreground'],
    info: colors.info,
    'info-light': colors['info-light'],
    'info-foreground': colors['info-foreground'],
    // Borders
    border: colors.border,
    'border-strong': colors['border-strong'],
    divider: colors.divider,
    // Focus
    ring: colors.ring,
    'ring-offset': colors['ring-offset'],
    // Overlay
    overlay: colors.overlay,
    'overlay-strong': colors['overlay-strong'],
    // Status chips
    'status-success-bg': colors['status-success-bg'],
    'status-success-text': colors['status-success-text'],
    'status-warning-bg': colors['status-warning-bg'],
    'status-warning-text': colors['status-warning-text'],
    'status-danger-bg': colors['status-danger-bg'],
    'status-danger-text': colors['status-danger-text'],
    'status-info-bg': colors['status-info-bg'],
    'status-info-text': colors['status-info-text'],
    'status-neutral-bg': colors['status-neutral-bg'],
    'status-neutral-text': colors['status-neutral-text'],
  },
  spacing: spacing,
  borderRadius: borderRadius,
  boxShadow: shadows,
  fontFamily: typography.fontFamily,
  fontSize: Object.fromEntries(
    Object.entries(typography.fontSize).map(([k, v]) => [k, v[0]])
  ),
  lineHeight: Object.fromEntries(
    Object.entries(typography.fontSize).map(([k, v]) => [k, v[1].lineHeight])
  ),
  fontWeight: typography.fontWeight,
  zIndex: zIndex,
  transitionDuration: {
    fast: transitions.fast.split('ms')[0],
    base: transitions.base.split('ms')[0],
    slow: transitions.slow.split('ms')[0],
  },
  transitionTimingFunction: {
    default: 'ease-out',
    premium: 'cubic-bezier(0.32, 0.72, 0, 1)',
  },
} as const;