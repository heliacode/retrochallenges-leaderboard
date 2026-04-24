import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Orbitron', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Mirrors the desktop app's palette so the two products read as one.
        slate: {
          925: '#0b1322',
        },
      },
    },
  },
  plugins: [],
};

export default config;
