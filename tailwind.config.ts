import type { Config } from 'tailwindcss'
import { tokenMap } from './src/styles/tokens'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ===== NEW WCAG AA TOKENS =====
        // Core foreground
        foreground: tokenMap.colors.foreground,
        'foreground-muted': tokenMap.colors['foreground-muted'],
        'foreground-inverse': tokenMap.colors['foreground-inverse'],

        // Backgrounds
        background: tokenMap.colors.background,
        surface: tokenMap.colors.surface,
        'surface-elevated': tokenMap.colors['surface-elevated'],
        'surface-overlay': tokenMap.colors['surface-overlay'],

        // Brand primary (accessible)
        primary: tokenMap.colors.primary,
        'primary-hover': tokenMap.colors['primary-hover'],
        'primary-light': tokenMap.colors['primary-light'],
        'primary-foreground': tokenMap.colors['primary-foreground'],

        // Semantic
        success: tokenMap.colors.success,
        'success-light': tokenMap.colors['success-light'],
        'success-foreground': tokenMap.colors['success-foreground'],
        warning: tokenMap.colors.warning,
        'warning-light': tokenMap.colors['warning-light'],
        'warning-foreground': tokenMap.colors['warning-foreground'],
        danger: tokenMap.colors.danger,
        'danger-light': tokenMap.colors['danger-light'],
        'danger-foreground': tokenMap.colors['danger-foreground'],
        info: tokenMap.colors.info,
        'info-light': tokenMap.colors['info-light'],
        'info-foreground': tokenMap.colors['info-foreground'],

        // Borders
        border: tokenMap.colors.border,
        'border-strong': tokenMap.colors['border-strong'],
        divider: tokenMap.colors.divider,

        // Focus
        ring: tokenMap.colors.ring,
        'ring-offset': tokenMap.colors['ring-offset'],

        // Overlay
        overlay: tokenMap.colors.overlay,
        'overlay-strong': tokenMap.colors['overlay-strong'],

        // Status chips (for Badge/StatusBadge)
        'status-success-bg': tokenMap.colors['status-success-bg'],
        'status-success-text': tokenMap.colors['status-success-text'],
        'status-warning-bg': tokenMap.colors['status-warning-bg'],
        'status-warning-text': tokenMap.colors['status-warning-text'],
        'status-danger-bg': tokenMap.colors['status-danger-bg'],
        'status-danger-text': tokenMap.colors['status-danger-text'],
        'status-info-bg': tokenMap.colors['status-info-bg'],
        'status-info-text': tokenMap.colors['status-info-text'],
        'status-neutral-bg': tokenMap.colors['status-neutral-bg'],
        'status-neutral-text': tokenMap.colors['status-neutral-text'],

        // ===== LEGACY ALIASES (DEPRECATED — for gradual migration) =====
        // These map to closest new token but may not meet WCAG AA
        'brand-ink': '#5D6B6B',
        'brand-rose': '#F7CBCA',
        'brand-ice': '#F1F7F7',
        'brand-teal': '#D8E6E5',
        'brand-sage': '#BFDADB',
        'brand-warm': '#E6DDDA',
        'primary-subtle': '#F7CBCA',
        'secondary-subtle': '#BFDADB',
        'accent-subtle': '#E6DDDA',
      },
      backgroundColor: {
        'primary-subtle': '#F7CBCA',
        'secondary-subtle': '#BFDADB',
        'accent-subtle': '#E6DDDA',
      },
      borderColor: {
        default: '#D8E6E5',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        base: '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px 0 rgb(0 0 0 / 0.04)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -1px rgb(0 0 0 / 0.04)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -2px rgb(0 0 0 / 0.04)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.08), 0 10px 10px -5px rgb(0 0 0 / 0.04)',
        'focus-ring': '0 0 0 2px var(--color-ring)',
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '3rem',
        '3xl': '4rem',
      },
      borderRadius: {
        none: '0px',
        sm: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['Fira Code', 'Menlo', 'monospace'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
    },
  },
  plugins: [],
}

export default config