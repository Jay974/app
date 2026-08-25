/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Palette primaire — inspirée du logo néon
        amber: {
          DEFAULT: '#FF9B00',
          50: '#fff6e6',
          100: '#ffe8bf',
          400: '#ffb03d',
          500: '#FF9B00',
          600: '#e08600',
        },
        magenta: {
          DEFAULT: '#E8196B',
          50: '#fde6ef',
          100: '#fac0d9',
          400: '#ef3f89',
          500: '#E8196B',
          600: '#c11258',
        },
        cream: '#FAFAF8',
        // Palette secondaire — inspirée de la carte menu
        forest: {
          DEFAULT: '#2D6040',
          900: '#1A2F1A',
          700: '#234a30',
          500: '#2D6040',
        },
        sage: {
          DEFAULT: '#B8D4B0',
          100: '#eaf3e7',
          300: '#d3e6cc',
          500: '#B8D4B0',
        },
        bordeaux: {
          DEFAULT: '#B8294A',
          400: '#c94f6a',
          600: '#9a1f3c',
        },
      },
      fontFamily: {
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
        script: ['var(--font-dancing)', 'cursive'],
        label: ['var(--font-montserrat)', 'sans-serif'],
        dish: ['var(--font-cormorant)', 'Georgia', 'serif'],
        body: ['var(--font-eb-garamond)', 'Georgia', 'serif'],
      },
      borderRadius: {
        xl2: '1.5rem',
        xl3: '2rem',
      },
    },
  },
  plugins: [],
};
