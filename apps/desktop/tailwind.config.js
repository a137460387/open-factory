/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--color-text-primary)',
        panel: 'var(--color-bg-secondary)',
        line: 'var(--color-border)',
        brand: 'var(--color-accent)',
        coral: 'var(--color-accent-warm)',
        amber: 'var(--color-warning)'
      },
      boxShadow: {
        soft: 'var(--shadow-soft)'
      }
    }
  },
  plugins: []
};
