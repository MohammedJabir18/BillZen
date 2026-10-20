/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg-canvas)',
        surface: {
          DEFAULT: 'var(--bg-surface)',
          subtle: 'var(--bg-surface-subtle)',
          overlay: 'var(--bg-overlay)',
        },
        'border-subtle': 'var(--border-subtle)',
        'border-medium': 'var(--border-medium)',
        'border-focus': 'var(--border-focus)',
        'text-main': 'var(--text-main)',
        'text-muted': 'var(--text-muted)',
        'text-subtle': 'var(--text-subtle)',
        'text-on-accent': 'var(--text-on-accent)',
        brand: {
          primary: 'var(--brand-primary)',
          'primary-hover': 'var(--brand-primary-hover)',
          lime: 'var(--brand-lime)',
          'lime-muted': 'var(--brand-lime-muted)',
          emerald: 'var(--brand-emerald)',
          'emerald-subtle': 'var(--brand-emerald-subtle)',
          coral: 'var(--brand-coral)',
          'coral-subtle': 'var(--brand-coral-subtle)',
        },
        background: '#F9FAFB',
        border: '#E5E7EB',
        primary: {
          DEFAULT: '#0F172A',
          hover: '#1E293B',
        },
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        pill: 'var(--radius-pill)',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      zIndex: {
        '60': '60',
        '70': '70',
      },
    },
  },
  plugins: [],
}
