/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0a0f1a', // Deep dark space background
          surface: '#121822', // Slightly lighter for cards
          panel: '#1a2230', // Floating panel background
          border: '#2a3547', // Subtle border
          text: '#e2e8f0', // Gray-200 text
          muted: '#94a3b8', // Gray-400 muted
        },
        primary: {
          DEFAULT: '#3b82f6', // Fiber blue
          glow: '#60a5fa', // Neon glow
        },
        accent: {
          DEFAULT: '#10b981', // Emerald green
        },
        danger: {
          DEFAULT: '#ef4444', // Red for broken cores
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'], // Professional font
        mono: ['Fira Code', 'monospace'], // For tech data like MAC addresses
      },
      boxShadow: {
        'glow-primary': '0 0 15px -3px rgba(59, 130, 246, 0.4)',
        'glow-accent': '0 0 15px -3px rgba(16, 185, 129, 0.4)',
        'floating': '0 10px 40px -10px rgba(0,0,0,0.5)',
      }
    },
  },
  plugins: [],
}
