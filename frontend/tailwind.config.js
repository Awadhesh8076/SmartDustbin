/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b'
        },
        waste: {
          plastic: '#3b82f6',
          metal: '#f59e0b',
          wet: '#10b981',
          dry: '#8b5cf6',
          unknown: '#6b7280'
        }
      }
    },
  },
  plugins: [],
}
