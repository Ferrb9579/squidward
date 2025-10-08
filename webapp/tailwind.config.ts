import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#020617',
        panel: 'rgba(15, 23, 42, 0.85)',
        accent: '#38bdf8',
        alert: '#f97316',
        success: '#22c55e',
        error: '#ef4444'
      },
      boxShadow: {
        panel: '0 20px 60px rgba(15, 23, 42, 0.35)',
        card: '0 15px 40px rgba(15, 23, 42, 0.35)'
      },
      borderRadius: {
        xl: '1rem',
        lg: '0.75rem'
      },
      fontFamily: {
        sans: [
          'Inter',
          'Segoe UI',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Helvetica Neue',
          'sans-serif'
        ]
      }
    }
  },
  plugins: []
}

export default config
