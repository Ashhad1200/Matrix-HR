import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#effaf4',
          100: '#d8f2e3',
          200: '#b3e5cb',
          300: '#81d0ac',
          400: '#4cb588',
          500: '#2a9a6d',
          600: '#1c7e57',
          700: '#166548',
          800: '#13513b',
          900: '#114231',
          950: '#08251c',
        },
        accent: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-body)', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(8, 37, 28, 0.04), 0 4px 16px -4px rgba(8, 37, 28, 0.06)',
        lifted: '0 2px 4px rgba(8, 37, 28, 0.06), 0 12px 32px -8px rgba(8, 37, 28, 0.14)',
        glow: '0 0 0 1px rgba(42, 154, 109, 0.25), 0 8px 24px -6px rgba(42, 154, 109, 0.35)',
      },
      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        rise: 'rise 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 0.18s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.25s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
