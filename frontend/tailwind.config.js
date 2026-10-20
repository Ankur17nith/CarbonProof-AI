/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-bg)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          secondary: 'var(--color-surface-secondary)',
          hover: 'var(--color-surface-hover)',
        },
        border: 'var(--color-border)',
        fg: {
          DEFAULT: 'var(--color-fg-primary)',
          secondary: 'var(--color-fg-secondary)',
          muted: 'var(--color-fg-muted)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          soft: 'var(--color-accent-soft)',
          border: 'var(--color-accent-border)',
        },
        status: {
          success: {
            text: 'var(--status-success-text)',
            bg: 'var(--status-success-bg)',
            border: 'var(--status-success-border)',
          },
          warning: {
            text: 'var(--status-warning-text)',
            bg: 'var(--status-warning-bg)',
            border: 'var(--status-warning-border)',
          },
          error: {
            text: 'var(--status-error-text)',
            bg: 'var(--status-error-bg)',
            border: 'var(--status-error-border)',
          },
          info: {
            text: 'var(--status-info-text)',
            bg: 'var(--status-info-bg)',
            border: 'var(--status-info-border)',
          },
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        elevated: '0 4px 6px -1px rgba(0, 0, 0, 0.06), 0 2px 4px -2px rgba(0, 0, 0, 0.04)',
      },
    },
  },
  plugins: [],
};
