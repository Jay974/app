/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FFF4E8',
          100: '#FFE6C8',
          400: '#FF9A3D',
          500: '#F7931E',
          600: '#E67E00',
          700: '#C46600',
        },
        ink: {
          900: '#14161A',
          700: '#3A3D44',
          500: '#6B6F76',
          300: '#B5B8BE',
          100: '#EEEFF1',
        },
      },
      boxShadow: {
        card: '0 2px 10px rgba(20,22,26,0.06)',
        nav: '0 -2px 16px rgba(20,22,26,0.08)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
};
