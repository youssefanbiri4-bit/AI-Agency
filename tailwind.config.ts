import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Official brand palette
        background: '#FFFFFF',
        foreground: '#000000',
        surface: '#F0DBEF',
        ink: '#000000',
        primary: '#8B3CDE',
        'primary-light': '#F0DBEF',
        'primary-dark': '#000000',
        secondary: '#F55477',
        'secondary-light': '#F0DBEF',
        'secondary-dark': '#000000',
        accent: '#F55477',
        'accent-light': '#F0DBEF',
        'accent-dark': '#000000',
        success: '#000000',
        'success-light': '#F0DBEF',
        'success-dark': '#000000',
        warning: '#F55477',
        'warning-light': '#F0DBEF',
        'warning-dark': '#000000',
        error: '#F55477',
        'error-light': '#F0DBEF',
        'error-dark': '#000000',
      },
      backgroundColor: {
        'primary-subtle': '#F0DBEF',
        'secondary-subtle': '#F0DBEF',
        'accent-subtle': '#F0DBEF',
      },
      borderColor: {
        'default': '#F0DBEF',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'base': '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px 0 rgb(0 0 0 / 0.04)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -1px rgb(0 0 0 / 0.04)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -2px rgb(0 0 0 / 0.04)',
        'xl': '0 20px 25px -5px rgb(0 0 0 / 0.08), 0 10px 10px -5px rgb(0 0 0 / 0.04)',
      },
      spacing: {
        'xs': '0.25rem',
        'sm': '0.5rem',
        'md': '1rem',
        'lg': '1.5rem',
        'xl': '2rem',
        '2xl': '3rem',
        '3xl': '4rem',
      },
      borderRadius: {
        'none': '0px',
        'sm': '0.375rem',
        'md': '0.5rem',
        'lg': '0.75rem',
        'xl': '1rem',
        '2xl': '1.5rem',
      },
      fontFamily: {
        'sans': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        'mono': ['Fira Code', 'Menlo', 'monospace'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
    },
  },
  plugins: [],
}

export default config
