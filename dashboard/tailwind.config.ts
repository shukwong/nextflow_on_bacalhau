import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0b1020',
          muted: '#111936',
          card: '#141d3b',
        },
        accent: {
          DEFAULT: '#6366f1',
          muted: '#4338ca',
        },
        state: {
          ok: '#22c55e',
          warn: '#f59e0b',
          err: '#ef4444',
          info: '#38bdf8',
          idle: '#64748b',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
