import type { Config } from 'tailwindcss';

/**
 * The CMS design system.
 *
 * Deliberately a different system from the public site. The corporate site is
 * editorial: large type, generous space, photography. The CMS is an operational
 * tool people use for hours, so it follows IBM Carbon's principles instead —
 * productive density, a disciplined 8px rhythm, restrained colour, and status
 * conveyed by more than hue.
 *
 * Carbon's *principles*, not its component library: the tokens below follow
 * Carbon's greyscale ramp and spacing scale, which is what makes a dense data
 * table readable, without taking on a large runtime dependency.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Carbon's Gray 10 ramp: a neutral, slightly cool scale that keeps
        // dense tables legible without vibrating.
        gray: {
          10: '#F4F4F4',
          20: '#E0E0E0',
          30: '#C6C6C6',
          40: '#A8A8A8',
          50: '#8D8D8D',
          60: '#6F6F6F',
          70: '#525252',
          80: '#393939',
          90: '#262626',
          100: '#161616',
        },
        surface: {
          // Layered surfaces rather than shadows: Carbon separates planes by
          // background, which stays legible at high information density.
          base: '#FFFFFF',
          subtle: '#F4F4F4',
          raised: '#FFFFFF',
          inverse: '#393939',
          hover: '#E8E8E8',
          selected: '#E0E0E0',
        },
        content: {
          primary: '#161616',
          secondary: '#525252',
          tertiary: '#6F6F6F',
          placeholder: '#A8A8A8',
          inverse: '#FFFFFF',
          disabled: '#C6C6C6',
        },
        border: {
          subtle: '#E0E0E0',
          strong: '#8D8D8D',
          inverse: '#161616',
          focus: '#0F62FE',
        },
        // Interaction colour is Carbon's blue, not the brand yellow: in an
        // operational tool, "clickable" must never be confused with "warning".
        interactive: {
          DEFAULT: '#0F62FE',
          hover: '#0353E9',
          active: '#002D9C',
          subtle: '#EDF5FF',
        },
        // Status colours carry meaning, so they are never used decoratively.
        status: {
          danger: '#DA1E28',
          dangerSubtle: '#FFF1F1',
          warning: '#F1C21B',
          warningSubtle: '#FCF4D6',
          success: '#24A148',
          successSubtle: '#DEFBE6',
          info: '#0043CE',
          infoSubtle: '#EDF5FF',
        },
        // The one place Cheezious yellow appears: brand moments, never status.
        brand: { DEFAULT: '#F2C230', ink: '#161616' },
      },

      fontFamily: {
        // IBM Plex is Carbon's typeface; the stack degrades to system fonts so
        // the CMS is never blocked on a webfont.
        sans: ['IBM Plex Sans', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },

      fontSize: {
        // Carbon's productive type scale: fixed sizes, not fluid. An operational
        // tool should look identical on every screen so muscle memory holds.
        'label-01': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.32px' }],
        'helper-01': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.32px' }],
        'body-compact': ['0.875rem', { lineHeight: '1.125rem', letterSpacing: '0.16px' }],
        'body-01': ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.16px' }],
        'body-02': ['1rem', { lineHeight: '1.5rem' }],
        'heading-compact': [
          '0.875rem',
          { lineHeight: '1.125rem', letterSpacing: '0.16px', fontWeight: '600' },
        ],
        'heading-01': [
          '0.875rem',
          { lineHeight: '1.125rem', letterSpacing: '0.16px', fontWeight: '600' },
        ],
        'heading-02': ['1rem', { lineHeight: '1.375rem', letterSpacing: '0px', fontWeight: '600' }],
        'heading-03': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '400' }],
        'heading-04': ['1.75rem', { lineHeight: '2.25rem', fontWeight: '400' }],
        'heading-05': ['2rem', { lineHeight: '2.5rem', fontWeight: '400' }],
      },

      spacing: {
        // Carbon's 8px-based spacing tokens.
        '01': '0.125rem',
        '02': '0.25rem',
        '03': '0.5rem',
        '04': '0.75rem',
        '05': '1rem',
        '06': '1.5rem',
        '07': '2rem',
        '08': '2.5rem',
        '09': '3rem',
        '10': '4rem',
        '11': '5rem',
        '12': '6rem',
        // Fixed shell dimensions.
        header: '3rem',
        sidebar: '16rem',
        'sidebar-collapsed': '3rem',
      },

      borderRadius: {
        // Carbon is essentially square. Rounded corners in a dense table read
        // as noise and cost horizontal space.
        none: '0',
        DEFAULT: '0',
        sm: '2px',
        md: '4px',
        full: '9999px',
      },

      boxShadow: {
        // Overlays only. Elevation in Carbon is carried by surface colour.
        menu: '0 2px 6px rgba(0, 0, 0, 0.2)',
        modal: '0 8px 24px rgba(0, 0, 0, 0.25)',
      },

      transitionDuration: {
        fast: '70ms',
        moderate: '110ms',
        slow: '240ms',
      },

      transitionTimingFunction: {
        // Carbon's standard easing: quick to respond, settles smoothly.
        productive: 'cubic-bezier(0.2, 0, 0.38, 0.9)',
        entrance: 'cubic-bezier(0, 0, 0.38, 0.9)',
        exit: 'cubic-bezier(0.2, 0, 1, 0.9)',
      },

      zIndex: {
        base: '0',
        sticky: '100',
        header: '200',
        sidebar: '150',
        dropdown: '300',
        overlay: '400',
        modal: '500',
        toast: '600',
      },

      gridTemplateColumns: {
        // Editor: content workspace beside a fixed inspector.
        editor: 'minmax(0, 1fr) 20rem',
        'editor-wide': 'minmax(0, 1fr) 24rem',
      },
    },
  },
  plugins: [],
};

export default config;
