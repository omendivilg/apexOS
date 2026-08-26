/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: {
          bg: '#09090b',
          card: '#18181b',
          text: '#f4f4f5',
          accent: '#39FF14',
        },
      },
      boxShadow: {
        glow: '0 0 24px rgba(57, 255, 20, 0.18)',
      },
    },
  },
  plugins: [],
};
