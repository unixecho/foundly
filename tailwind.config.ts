import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", 'sans-serif'],
        mono: ["'JetBrains Mono'", 'monospace'],
      },
      colors: {
        ink:          'var(--ink)',
        ink2:         'var(--ink2)',
        ink3:         'var(--ink3)',
        paper:        'var(--paper)',
        surface:      'var(--surface)',
        surface2:     'var(--surface2)',
        line:         'var(--line)',
        line2:        'var(--line2)',
        accent:       'var(--accent)',
        'accent-soft':  'var(--accent-soft)',
        'accent-soft2': 'var(--accent-soft2)',
        'accent-ink':   'var(--accent-ink)',
        'on-accent':    'var(--on-accent)',
        green:        'var(--green)',
        'green-ink':  'var(--green-ink)',
        'green-soft': 'var(--green-soft)',
        amber:        'var(--amber)',
        'amber-ink':  'var(--amber-ink)',
        'amber-soft': 'var(--amber-soft)',
        error:        'var(--error)',
        'error-soft': 'var(--error-soft)',
      },
      borderRadius: {
        sm:   '11px',
        md:   '14px',
        lg:   '18px',
        xl:   '24px',
        pill: '999px',
      },
      boxShadow: {
        card:   'var(--shadow-card)',
        raised: 'var(--shadow-raised)',
        accent: 'var(--shadow-accent)',
        modal:  'var(--shadow-modal)',
      },
      maxWidth: {
        owner: '480px',   // owner app single column cap
      },
    },
  },
  plugins: [],
}

export default config
