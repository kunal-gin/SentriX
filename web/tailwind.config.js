/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#090b10',
        canvas: '#090b10',
        surface: '#111520',
        'surface-elevated': '#171c2c',
        'surface-highlight': '#1f263b',
        border: 'rgba(255, 255, 255, 0.08)',
        'border-strong': 'rgba(255, 255, 255, 0.15)',
        text: '#f1f5f9',
        muted: '#94a3b8',
        'text-dim': '#64748b',
        primary: {
          DEFAULT: '#6366f1',
          hover: '#4f46e5',
          light: '#818cf8',
        },
        cyan: {
          DEFAULT: '#06b6d4',
          hover: '#0891b2',
        },
        healthy: '#10b981',
        warning: '#f59e0b',
        critical: '#f43f5e',
        offline: '#64748b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
        'glow-primary': '0 0 25px -5px rgba(99, 102, 241, 0.35)',
        'glow-healthy': '0 0 25px -5px rgba(16, 185, 129, 0.35)',
        'glow-warning': '0 0 25px -5px rgba(245, 158, 11, 0.35)',
        'glow-critical': '0 0 25px -5px rgba(244, 63, 94, 0.35)',
        'glow-cyan': '0 0 25px -5px rgba(6, 182, 212, 0.35)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'mesh-glow': 'radial-gradient(at 10% 10%, rgba(99, 102, 241, 0.12) 0px, transparent 50%), radial-gradient(at 90% 90%, rgba(6, 182, 212, 0.08) 0px, transparent 50%)',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.6, transform: 'scale(1.15)' },
        },
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
