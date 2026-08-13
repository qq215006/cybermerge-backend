/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './main.js'
  ],
  theme: {
    extend: {
      colors: {
        // 温馨治愈猫系色调
        'cyber-black': '#fff3e0',
        'cyber-dark': '#ffe0b2',
        'cyber-card': '#fff8e1',
        'neon-cyan': '#ff8a65',
        'neon-purple': '#ff7043',
        'neon-pink': '#ffab91',
        'neon-green': '#81c784',
        'gold': '#ff6d00'
      },
      fontFamily: {
        'mono': ['"Segoe UI"', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        'neon-cyan': '0 0 8px rgba(255,138,101,0.3)',
        'neon-purple': '0 0 10px rgba(255,112,67,0.3)',
        'neon-gold': '0 0 8px rgba(255,109,0,0.4)',
        'grid-glow': '0 0 10px rgba(255,138,101,0.1), inset 0 0 6px rgba(0,0,0,0.04)'
      },
      animation: {
        'pulse-neon': 'pulseWarm 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'flicker': 'flicker 3s infinite'
      },
      keyframes: {
        pulseWarm: {
          '0%, 100%': { textShadow: '0 0 6px rgba(255,109,0,0.4)' },
          '50%': { textShadow: '0 0 14px rgba(255,109,0,0.7)' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-2px)' }
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '92%': { opacity: '1' },
          '93%': { opacity: '0.3' },
          '94%': { opacity: '1' },
          '96%': { opacity: '0.6' },
          '97%': { opacity: '1' }
        }
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(255,183,77,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,183,77,0.04) 1px, transparent 1px)'
      },
      backgroundSize: {
        'grid': '25% 25%'
      }
    }
  },
  plugins: []
};
