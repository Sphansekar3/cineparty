/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cinema: {
          900: '#0a0d14',
          800: '#111622',
          700: '#1b2333',
          600: '#263147',
          accent: '#e50914', // Netflix/Cinema red accent
          accentHover: '#b80710',
          blue: '#3b82f6',
          purple: '#8b5cf6',
        }
      }
    },
  },
  plugins: [],
}
