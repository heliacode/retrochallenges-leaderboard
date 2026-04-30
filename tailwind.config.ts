import type { Config } from 'tailwindcss';

// NES-restricted palette mirrors the FlawlessNes desktop app: every
// slate/gray shade collapses to NES grays and every accent palette
// (indigo/fuchsia/sky/emerald/amber/orange) collapses to a 5-step NES
// red ramp. Existing Tailwind class names (bg-slate-900, text-indigo-300,
// etc.) keep working — they just paint NES colours.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Orbitron', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        slate: {
          50:  '#E0E0E0', 100: '#BCBCBC', 200: '#BCBCBC', 300: '#BCBCBC',
          400: '#7C7C7C', 500: '#545454', 600: '#545454',
          700: '#3D3D3D', 800: '#2C2C2C', 900: '#1A1A1A', 925: '#0F0F0F', 950: '#0F0F0F',
        },
        gray: {
          50:  '#E0E0E0', 100: '#BCBCBC', 200: '#BCBCBC', 300: '#BCBCBC',
          400: '#7C7C7C', 500: '#545454', 600: '#545454',
          700: '#3D3D3D', 800: '#2C2C2C', 900: '#1A1A1A',
        },
        indigo:  { 100: '#FFB0B0', 200: '#FF8688', 300: '#E40058', 400: '#B53120', 500: '#B53120', 600: '#7E0000', 700: '#7E0000' },
        fuchsia: { 100: '#FFB0B0', 200: '#FF8688', 300: '#FF6058', 400: '#FF6058', 500: '#E40058', 600: '#B53120' },
        sky:     { 100: '#FFB0B0', 200: '#E40058', 300: '#B53120', 400: '#B53120', 500: '#7E0000', 600: '#7E0000' },
        emerald: { 100: '#FFB0B0', 200: '#E40058', 300: '#B53120', 400: '#B53120', 500: '#B53120', 600: '#7E0000' },
        amber:   { 100: '#FFB0B0', 200: '#FF6058', 300: '#E40058', 400: '#E40058', 500: '#B53120', 600: '#7E0000' },
        orange:  { 100: '#FFB0B0', 200: '#FF8688', 300: '#E40058', 400: '#B53120', 500: '#B53120', 600: '#7E0000' },
      },
    },
  },
  plugins: [],
};

export default config;
