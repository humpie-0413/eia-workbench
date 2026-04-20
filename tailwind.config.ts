import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{astro,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--c-bg)',
        surface: 'var(--c-surface)',
        border: 'var(--c-border)',
        primary: { DEFAULT: 'var(--c-primary)', hover: 'var(--c-primary-hover)' },
        warning: { DEFAULT: 'var(--c-warning)', bg: 'var(--c-warning-bg)' },
        danger: { DEFAULT: 'var(--c-error)', bg: 'var(--c-error-bg)' },
        text: {
          primary: 'var(--c-text-primary)',
          secondary: 'var(--c-text-secondary)',
          tertiary: 'var(--c-text-tertiary)'
        }
      },
      fontFamily: {
        sans: ['Pretendard Variable', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace']
      },
      fontSize: {
        display: ['28px', { lineHeight: '36px', fontWeight: '600' }],
        h1: ['22px', { lineHeight: '30px', fontWeight: '600' }],
        h2: ['18px', { lineHeight: '26px', fontWeight: '600' }],
        body: ['15px', { lineHeight: '24px' }],
        small: ['13px', { lineHeight: '20px' }]
      },
      spacing: { '0.5': '2px', '18': '72px' },
      maxWidth: { content: '1200px' }
    }
  },
  plugins: []
} satisfies Config;
