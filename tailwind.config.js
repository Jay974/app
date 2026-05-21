/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './app/**/*.{js,jsx}',
    './src/**/*.{js,jsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1400px' }
    },
    extend: {
      fontFamily: {
        sans: ['Nunito', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        // TiKréol brand palette
        teal: { DEFAULT: '#3ECDB5', dark: '#1E9E8A', light: '#E6F9F5' },
        coral: '#FF6B6B',
        amber: '#FFA726',
        violet: '#8B6BE8',
        sky: '#42A5F5',
        lime: '#66BB6A',
        rose: '#F06292',
        surface: '#FFFFFF',
        ink: '#2D3748',
        'ink-muted': '#718096',
        bgsoft: '#F5F7F9'
      },
      borderRadius: {
        lg: '24px',
        md: '16px',
        sm: '12px',
        pill: '40px'
      },
      boxShadow: {
        soft: '0 4px 20px -2px rgba(45, 55, 72, 0.08)',
        softer: '0 2px 10px -1px rgba(45, 55, 72, 0.06)',
        hover: '0 12px 30px -6px rgba(62, 205, 181, 0.25)'
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'bounce-dot': { '0%,80%,100%': { transform: 'scale(0)' }, '40%': { transform: 'scale(1)' } },
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'slide-in-left': { '0%': { opacity: '0', transform: 'translateX(-16px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        'wave-shift': { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'bounce-dot': 'bounce-dot 1.4s infinite ease-in-out both',
        'fade-up': 'fade-up 0.28s ease-out',
        'slide-in-left': 'slide-in-left 0.3s ease-out',
        'wave-shift': 'wave-shift 8s ease-in-out infinite'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
}
