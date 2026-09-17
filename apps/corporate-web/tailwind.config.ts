import type { Config } from 'tailwindcss';

/**
 * The Cheezious corporate design system.
 *
 * The premise: the consumer brand says "come eat with us"; the corporate brand
 * says "look at what we are building". So the palette is dominated by white and
 * charcoal, with yellow used sparingly enough that it still means something when
 * it appears. A page covered in yellow reads as a promotion, not as a company.
 *
 * Type is editorial and large. Sizes are a fluid scale rather than fixed values,
 * so a display headline is genuinely large on a 1440px screen without becoming
 * unreadable at 390px — and no one ever needs to hardcode a font size.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Off-white rather than pure white: large areas of #FFF glare, and the
        // slight warmth reads as considered rather than unfinished.
        paper: {
          DEFAULT: '#FBFAF7',
          raised: '#FFFFFF',
          sunken: '#F2F0EA',
        },
        // Charcoal rather than black: true black against off-white is harsh at
        // display sizes, and charcoal holds photographic detail in dark bands.
        ink: {
          DEFAULT: '#14140F',
          soft: '#3A3A33',
          muted: '#6B6B61',
          faint: '#9A9A90',
          line: '#E2DFD6',
        },
        // The Cheezious yellow, kept for accents and deliberate emphasis only.
        brand: {
          DEFAULT: '#F2C230',
          deep: '#C79A16',
          soft: '#FDF3D4',
          ink: '#14140F',
        },
        // Status colours for forms and system messaging, tuned to the palette.
        signal: {
          success: '#1F7A4D',
          warning: '#B26B00',
          danger: '#B3261E',
          info: '#1E5A8A',
        },
      },

      fontFamily: {
        // A single grotesque across display and body keeps the system coherent;
        // the distinction is made through size, weight and measure instead.
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        urdu: ['var(--font-urdu)', 'Noto Nastaliq Urdu', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },

      fontSize: {
        // Fluid scale: clamp(min, preferred, max). The middle term is viewport
        // relative, so headlines scale continuously instead of jumping at
        // breakpoints. Display tops out around 96px, as the brief calls for.
        'display-xl': [
          'clamp(2.75rem, 1.2rem + 6.4vw, 6rem)',
          { lineHeight: '0.98', letterSpacing: '-0.035em', fontWeight: '700' },
        ],
        'display-lg': [
          'clamp(2.25rem, 1.1rem + 5vw, 4.5rem)',
          { lineHeight: '1.02', letterSpacing: '-0.03em', fontWeight: '700' },
        ],
        'display-md': [
          'clamp(1.875rem, 1rem + 3.6vw, 3.5rem)',
          { lineHeight: '1.06', letterSpacing: '-0.025em', fontWeight: '600' },
        ],
        'display-sm': [
          'clamp(1.625rem, 0.95rem + 2.6vw, 2.5rem)',
          { lineHeight: '1.12', letterSpacing: '-0.02em', fontWeight: '600' },
        ],

        'heading-lg': [
          'clamp(1.375rem, 1rem + 1.4vw, 1.875rem)',
          { lineHeight: '1.2', letterSpacing: '-0.015em', fontWeight: '600' },
        ],
        'heading-md': [
          'clamp(1.1875rem, 1rem + 0.8vw, 1.5rem)',
          { lineHeight: '1.28', letterSpacing: '-0.01em', fontWeight: '600' },
        ],
        'heading-sm': [
          '1.125rem',
          { lineHeight: '1.35', letterSpacing: '-0.005em', fontWeight: '600' },
        ],

        // Body sits at 18–20px on desktop, as specified — comfortably above the
        // 16px default that makes corporate sites feel like documentation.
        'body-lg': ['clamp(1.0625rem, 1rem + 0.35vw, 1.25rem)', { lineHeight: '1.65' }],
        'body-md': ['clamp(1rem, 0.97rem + 0.18vw, 1.125rem)', { lineHeight: '1.65' }],
        'body-sm': ['0.9375rem', { lineHeight: '1.6' }],
        'body-xs': ['0.8125rem', { lineHeight: '1.5' }],

        // Eyebrows and labels: small, spaced, upper case.
        eyebrow: ['0.75rem', { lineHeight: '1.2', letterSpacing: '0.14em', fontWeight: '600' }],
        'stat-xl': [
          'clamp(2.75rem, 1.5rem + 5vw, 5rem)',
          { lineHeight: '0.95', letterSpacing: '-0.04em', fontWeight: '700' },
        ],
        'stat-lg': [
          'clamp(2rem, 1.2rem + 3.2vw, 3.25rem)',
          { lineHeight: '1', letterSpacing: '-0.03em', fontWeight: '700' },
        ],
      },

      spacing: {
        // Section rhythm. Named so a block declares intent rather than a number.
        'section-compact': 'clamp(2.5rem, 1.5rem + 4vw, 4rem)',
        section: 'clamp(4rem, 2rem + 7vw, 8rem)',
        'section-generous': 'clamp(5.5rem, 2.5rem + 10vw, 11rem)',
        gutter: 'clamp(1rem, 0.5rem + 2vw, 3rem)',
      },

      maxWidth: {
        // Reading measure caps around 68 characters; wider is measurably harder
        // to read, however much horizontal space a desktop offers.
        prose: '68ch',
        narrow: '46rem',
        standard: '78rem',
        wide: '96rem',
      },

      borderRadius: {
        // Restrained by design: a corporate site with 16px radii everywhere
        // reads as a SaaS dashboard.
        none: '0',
        sm: '2px',
        DEFAULT: '3px',
        md: '4px',
        lg: '6px',
        full: '9999px',
      },

      boxShadow: {
        // Shadows are for genuine elevation (menus, dialogs), not decoration.
        subtle: '0 1px 2px rgba(20, 20, 15, 0.06)',
        raised: '0 2px 8px rgba(20, 20, 15, 0.08)',
        menu: '0 12px 32px -8px rgba(20, 20, 15, 0.18)',
        dialog: '0 24px 64px -16px rgba(20, 20, 15, 0.28)',
      },

      transitionTimingFunction: {
        editorial: 'cubic-bezier(0.22, 1, 0.36, 1)',
        crisp: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },

      transitionDuration: {
        instant: '80ms',
        quick: '160ms',
        DEFAULT: '240ms',
        slow: '420ms',
        reveal: '700ms',
      },

      zIndex: {
        base: '0',
        raised: '10',
        sticky: '100',
        header: '200',
        megamenu: '250',
        overlay: '300',
        dialog: '400',
        toast: '500',
        skipLink: '600',
      },

      screens: {
        xs: '420px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1440px',
        '3xl': '1728px',
      },

      keyframes: {
        'fade-rise': {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'menu-in': {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'image-reveal': {
          from: { opacity: '0', transform: 'scale(1.04)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },

      animation: {
        'fade-rise': 'fade-rise 700ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 400ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'menu-in': 'menu-in 160ms cubic-bezier(0.4, 0, 0.2, 1) both',
        'image-reveal': 'image-reveal 900ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },

      gridTemplateColumns: {
        // The 12-column desktop grid the layout system is built on.
        corporate: 'repeat(12, minmax(0, 1fr))',
      },

      aspectRatio: {
        cinematic: '21 / 9',
        editorial: '3 / 2',
        portrait: '4 / 5',
      },
    },
  },
  plugins: [],
};

export default config;
