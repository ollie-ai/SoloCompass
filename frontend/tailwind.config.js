import daisyui from 'daisyui';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/**/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // Named breakpoints: xs (375) matches smallest phones, 2xl (1440) matches wide desktop
    screens: {
      xs:  '375px',
      sm:  '640px',
      md:  '768px',
      lg:  '1024px',
      xl:  '1280px',
      '2xl': '1440px',
    },
    extend: {
      colors: {
        primary: { 
          50: '#f0fdf4', 
          100: '#dcfce7', 
          200: '#bbf7d0', 
          300: '#86efac', 
          400: '#4ade80', 
          500: '#22c55e', 
          600: '#16a34a', 
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        brand: {
          deep: '#0f172a',
          vibrant: '#10b981',
          accent: '#8b5cf6',
          slate: '#475569',
          'status-blue': '#0ea5e9'
        },
        background: {
          main: '#f8fafc',
          card: '#ffffff',
          dark: '#0f172a'
        }
      },
      // Named type-scale — use as text-h1, text-body, etc.
      fontSize: {
        'h1':       ['2.5rem',  { lineHeight: '1.15', fontWeight: '900', letterSpacing: '-0.025em' }],
        'h2':       ['2rem',    { lineHeight: '1.2',  fontWeight: '800', letterSpacing: '-0.02em'  }],
        'h3':       ['1.5rem',  { lineHeight: '1.3',  fontWeight: '700'                             }],
        'h4':       ['1.25rem', { lineHeight: '1.4',  fontWeight: '700'                             }],
        'body-lg':  ['1.125rem',{ lineHeight: '1.75'                                                }],
        'body':     ['1rem',    { lineHeight: '1.625'                                               }],
        'body-sm':  ['0.875rem',{ lineHeight: '1.5'                                                 }],
        'caption':  ['0.75rem', { lineHeight: '1.4',  letterSpacing: '0.01em'                       }],
        'overline': ['0.6875rem',{ lineHeight: '1.3', fontWeight: '700', letterSpacing: '0.1em',
                                   textTransform: 'uppercase'                                       }],
      },
      fontFamily: {
        heading: ['Outfit', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      // Named elevation/shadow tokens
      boxShadow: {
        'elevation-1': '0 1px 2px 0 rgba(0,0,0,0.05)',
        'elevation-2': '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
        'elevation-3': '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
        'elevation-4': '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
        'elevation-5': '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
        'brand':       '0 4px 14px 0 rgba(16,185,129,0.25)',
        'brand-lg':    '0 8px 24px 0 rgba(16,185,129,0.3)',
        'inner-sm':    'inset 0 1px 2px 0 rgba(0,0,0,0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'float': 'float 3s ease-in-out infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' }
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        "solocompass": {
          "primary": "#10b981",
          "primary-content": "#ffffff",
          "secondary": "#0ea5e9",
          "secondary-content": "#ffffff",
          "accent": "#8b5cf6",
          "accent-content": "#ffffff",
          "neutral": "#0f172a",
          "neutral-content": "#f8fafc",
          "base-100": "#ffffff",
          "base-200": "#f1f5f9",
          "base-300": "#e2e8f0",
          "base-content": "#0f172a",
          "info": "#0ea5e9",
          "info-content": "#ffffff",
          "success": "#22c55e",
          "success-content": "#ffffff",
          "warning": "#f59e0b",
          "warning-content": "#ffffff",
          "error": "#ef4444",
          "error-content": "#ffffff",
        }
      },
      {
        "solocompass-dark": {
          "primary": "#10b981",
          "primary-content": "#ffffff",
          "secondary": "#0ea5e9",
          "secondary-content": "#ffffff",
          "accent": "#8b5cf6",
          "accent-content": "#ffffff",
          "neutral": "#1e293b",
          "neutral-content": "#f8fafc",
          "base-100": "#0f172a",
          "base-200": "#1e293b",
          "base-300": "#334155",
          "base-content": "#f8fafc",
          "info": "#0ea5e9",
          "info-content": "#ffffff",
          "success": "#22c55e",
          "success-content": "#ffffff",
          "warning": "#f59e0b",
          "warning-content": "#ffffff",
          "error": "#ef4444",
          "error-content": "#ffffff",
        }
      }
    ],
  },
}
