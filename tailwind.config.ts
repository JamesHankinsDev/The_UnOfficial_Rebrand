import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          black:  '#0a0a0f',
          dark:   '#111118',
          border: '#1e1e2a',
          gold:   '#fbbf24',
          orange: '#f97316',
          green:  '#10b981',
          gray:   '#8a8a94',
          muted:  '#5a5a64',
          dim:    '#3a3a44',
          white:  '#e8e6e3',
        },
      },
      fontFamily: {
        mono:  ['Space Mono', 'monospace'],
        sans:  ['DM Sans', 'sans-serif'],
      },
      typography: {
        DEFAULT: {
          css: {
            color: '#e8e6e3',
            a: { color: '#fbbf24', '&:hover': { color: '#f97316' } },
            h1: { color: '#e8e6e3', fontFamily: 'Space Mono, monospace' },
            h2: { color: '#e8e6e3', fontFamily: 'Space Mono, monospace' },
            h3: { color: '#e8e6e3', fontFamily: 'Space Mono, monospace' },
            h4: { color: '#e8e6e3', fontFamily: 'Space Mono, monospace' },
            strong: { color: '#e8e6e3' },
            code: { color: '#fbbf24', backgroundColor: '#1e1e2a', padding: '0.2em 0.4em', borderRadius: '4px' },
            pre: { backgroundColor: '#111118', border: '1px solid #1e1e2a' },
            blockquote: { borderLeftColor: '#fbbf24', color: '#8a8a94' },
            hr: { borderColor: '#1e1e2a' },
          },
        },
      },
    },
  },
  plugins: [typography],
}

export default config
