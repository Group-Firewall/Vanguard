/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'severity-low': '#10b981',
        'severity-medium': '#f59e0b',
        'severity-high': '#ef4444',
        'severity-critical': '#dc2626',
      }
    },
  },
  plugins: [],
}

