/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#16181d',
        panel: '#f5f6f8',
        line: '#d9dde5',
        brand: '#1f7a68',
        coral: '#d9553f',
        amber: '#c88922'
      },
      boxShadow: {
        soft: '0 12px 28px rgba(20, 24, 32, 0.10)'
      }
    }
  },
  plugins: []
};
