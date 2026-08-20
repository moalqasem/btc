/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Dark Background Palette ──────────────────────────────
        bg: {
          base: '#0F172A',     // Deep Navy — main background
          surface: '#1E293B', // Slate surface — cards, panels
          elevated: '#263348', // Slightly lighter — hover states
          border: '#334155',  // Subtle border
        },
        // ── Accent Colors ────────────────────────────────────────
        accent: {
          blue: '#3B82F6',    // Trust Blue — primary actions
          'blue-dim': '#1D4ED8',
          'blue-glow': 'rgba(59,130,246,0.15)',
        },
        // ── Trading Colors ───────────────────────────────────────
        bull: {
          DEFAULT: '#10B981', // Muted Emerald — buy / positive
          dim: '#065F46',
          glow: 'rgba(16,185,129,0.15)',
        },
        bear: {
          DEFAULT: '#F43F5E', // Soft Rose — sell / negative
          dim: '#881337',
          glow: 'rgba(244,63,94,0.15)',
        },
        // ── Text ─────────────────────────────────────────────────
        text: {
          primary: '#F1F5F9',   // Off-white
          secondary: '#94A3B8', // Muted gray
          muted: '#475569',     // Very muted
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'price-pulse': 'pricePulse 0.6s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        pricePulse: {
          '0%': { opacity: '0.6' },
          '50%': { opacity: '1', transform: 'scale(1.01)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.6)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.5)',
        glow: '0 0 20px rgba(59,130,246,0.2)',
      },
    },
  },
  plugins: [],
}
