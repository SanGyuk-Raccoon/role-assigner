import type { Config } from 'tailwindcss';
import type { PluginUtils } from 'tailwindcss/types/config';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Forest Cabin 색상 팔레트
        forest: {
          50: '#f4f7f4',
          100: '#e4ebe4',
          200: '#c9d7c9',
          300: '#a3b9a3',
          400: '#7a9a7a',
          500: '#5a7d5a',
          600: '#466446',
          700: '#3a5139',
          800: '#31422f',
          900: '#2a3728',
          950: '#141d14',
        },
        earth: {
          50: '#faf8f5',
          100: '#f3efe8',
          200: '#e6ddd0',
          300: '#d5c5b0',
          400: '#c2a88e',
          500: '#b39272',
          600: '#a67d5d',
          700: '#8a664e',
          800: '#715444',
          900: '#5d463a',
          950: '#31241e',
        },
        bark: {
          50: '#f9f7f5',
          100: '#f1ebe5',
          200: '#e2d5c9',
          300: '#cfb9a5',
          400: '#ba9a7e',
          500: '#ab8364',
          600: '#9e7258',
          700: '#835d4a',
          800: '#6b4d40',
          900: '#584136',
          950: '#2f211b',
        },
        cream: {
          50: '#fefdfb',
          100: '#fcf9f3',
          200: '#f9f3e7',
          300: '#f4e9d5',
          400: '#eddcbe',
          500: '#e5cda5',
          600: '#d6b37d',
          700: '#c4975d',
          800: '#a37a4d',
          900: '#866542',
          950: '#473321',
        },
        moss: {
          50: '#f5f8f5',
          100: '#e8f0e8',
          200: '#d2e1d2',
          300: '#aec9ae',
          400: '#84ab84',
          500: '#5f8c5f',
          600: '#4a714a',
          700: '#3d5b3d',
          800: '#344934',
          900: '#2c3d2c',
          950: '#152015',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'soft-lg': '0 4px 25px -5px rgba(0, 0, 0, 0.08), 0 15px 30px -5px rgba(0, 0, 0, 0.05)',
        'inner-soft': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.04)',
        'glow': '0 0 20px rgba(90, 125, 90, 0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'fade-in-up': 'fadeInUp 0.6s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'float': 'float 6s ease-in-out infinite',
        'wiggle': 'wiggle 0.5s ease-in-out',
        'bounce-in': 'bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'slide-up': 'slideUp 0.2s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'slot-spin': 'slotSpin 0.1s linear infinite',
        'reveal': 'reveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'shimmer': 'shimmer 2s linear infinite',
        'pop': 'pop 0.15s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        bounceIn: {
          '0%': { opacity: '0', transform: 'scale(0.3)' },
          '50%': { transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255, 107, 107, 0.4)' },
          '50%': { boxShadow: '0 0 40px rgba(255, 107, 107, 0.8)' },
        },
        slotSpin: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-100%)' },
        },
        reveal: {
          '0%': { opacity: '0', transform: 'scale(0.8) rotateX(-10deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pop: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      backgroundImage: {
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
        'forest-gradient': 'linear-gradient(135deg, var(--tw-gradient-stops))',
      },
      typography: ({ theme }: PluginUtils) => ({
        DEFAULT: {
          css: {
            '--tw-prose-body': theme('colors.bark.800'),
            '--tw-prose-headings': theme('colors.bark.900'),
            '--tw-prose-lead': theme('colors.bark.600'),
            '--tw-prose-links': theme('colors.forest.700'),
            '--tw-prose-bold': theme('colors.bark.900'),
            '--tw-prose-counters': theme('colors.bark.500'),
            '--tw-prose-bullets': theme('colors.bark.400'),
            '--tw-prose-hr': theme('colors.bark.200'),
            '--tw-prose-quotes': theme('colors.bark.700'),
            '--tw-prose-quote-borders': theme('colors.forest.300'),
            '--tw-prose-captions': theme('colors.bark.500'),
            '--tw-prose-code': theme('colors.pink.500'),
            '--tw-prose-pre-code': theme('colors.pink.300'),
            '--tw-prose-pre-bg': theme('colors.bark.900'),
            '--tw-prose-th-borders': theme('colors.bark.300'),
            '--tw-prose-td-borders': theme('colors.bark.200'),

            // 다크 모드용 변수 맵핑 추가
            '--tw-prose-invert-body': theme('colors.forest.100'),
            '--tw-prose-invert-headings': theme('colors.cream.50'),
            '--tw-prose-invert-lead': theme('colors.forest.300'),
            '--tw-prose-invert-links': theme('colors.forest.400'),
            '--tw-prose-invert-bold': theme('colors.cream.100'),
            '--tw-prose-invert-counters': theme('colors.forest.400'),
            '--tw-prose-invert-bullets': theme('colors.forest.500'),
            '--tw-prose-invert-hr': theme('colors.forest.700'),
            '--tw-prose-invert-quotes': theme('colors.forest.200'),
            '--tw-prose-invert-quote-borders': theme('colors.forest.600'),
            '--tw-prose-invert-captions': theme('colors.forest.400'),
            '--tw-prose-invert-code': theme('colors.pink.400'),
            '--tw-prose-invert-pre-code': theme('colors.pink.200'),
            '--tw-prose-invert-pre-bg': theme('colors.forest.950'),
            '--tw-prose-invert-th-borders': theme('colors.forest.600'),
            '--tw-prose-invert-td-borders': theme('colors.forest.700'),

            'a': {
              textDecorationColor: theme('colors.forest.300'),
              '&:hover': {
                color: theme('colors.forest.600'),
                textDecorationColor: theme('colors.forest.500'),
              },
            },
            '.dark a': {
              textDecorationColor: theme('colors.forest.600'),
              '&:hover': {
                color: theme('colors.forest.300'),
                textDecorationColor: theme('colors.forest.400'),
              },
            },
            'code': {
              backgroundColor: theme('colors.bark.100'),
              padding: '0.2em 0.4em',
              borderRadius: '0.375rem',
              fontWeight: '500',
              color: theme('colors.pink.600'), // Fix contrast
            },
            '.dark code': {
              backgroundColor: theme('colors.forest.800'),
              color: theme('colors.pink.300'), // Fix contrast
            },
            'code::before': { content: 'none' },
            'code::after': { content: 'none' },
            'blockquote': {
              borderLeftColor: theme('colors.forest.300'),
              color: theme('colors.bark.700'),
            },
            '.dark blockquote': {
              borderLeftColor: theme('colors.forest.600'),
              color: theme('colors.forest.200'),
            },
            'pre code': {
              color: '#d4d4d4', // VS Code dark default text color
            },
            '.dark pre code': {
              color: '#d4d4d4', // Force it to stay visible in night mode
            }
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};

export default config;
