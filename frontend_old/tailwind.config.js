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
          bg: '#FFFFFF', // Migrated to Light
          surface: '#F8FAFC',
          panel: '#FFFFFF',
          border: '#E2E8F0', // slate-200
          text: '#1E293B', // slate-800
          muted: '#64748B', // slate-500
          card: '#F1F5F9', // slate-100
        },
        primary: {
          DEFAULT: '#0F4C81', // Primary Blue
          glow: '#2563EB', // Secondary Blue
        },
        accent: {
          DEFAULT: '#EFF6FF', // Soft Blue Background
        },
        orange: {
          DEFAULT: '#F97316',
          light: '#FB923C'
        },
        success: {
          DEFAULT: '#22C55E'
        },
        warning: {
          DEFAULT: '#F59E0B'
        },
        danger: {
          DEFAULT: '#EF4444', 
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      },
      boxShadow: {
        'glow-primary': '0 4px 14px 0 rgba(37, 99, 235, 0.2)',
        'floating': '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      }
    },
  },
  plugins: [],
}
