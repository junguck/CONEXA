/**
 * Preset Tailwind des jetons Convexa (voir docs/product/design/DESIGN_HANDOFF.md §3).
 * Les valeurs vivent dans `src/styles.css` sous forme de variables CSS ; les
 * univers (`s-core`, `s-foot`, `s-meet`, `s-pro`) et les thèmes (`dk`, `lt`)
 * remplacent ces variables sur une classe racine.
 */
module.exports = {
  darkMode: ['class', '.dk'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surf)',
        surface2: 'var(--surf2)',
        line: 'var(--line)',
        ink: 'var(--tx)',
        muted: 'var(--mu)',
        accent: 'var(--ac)',
        'accent-ink': 'var(--ac-ink)',
        'accent-text': 'var(--act)',
        live: 'var(--live)',
        ok: 'var(--ok)',
        bad: 'var(--bad)',
      },
      borderRadius: {
        token: 'var(--r)',
        panel: 'var(--rb)',
      },
      fontFamily: {
        display: 'var(--fd)',
        body: 'var(--fu)',
        mono: 'var(--fn)',
      },
      minHeight: {
        touch: '44px',
      },
      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to: { opacity: '1', transform: 'none' },
        },
        pop: {
          '0%': { opacity: '0', transform: 'scale(.5) rotate(-8deg)' },
          '60%': { transform: 'scale(1.1) rotate(2deg)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        grow: {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
        blinkdot: {
          '50%': { opacity: '.3' },
        },
      },
      animation: {
        rise: 'rise .7s cubic-bezier(.16,1,.3,1) both',
        pop: 'pop .8s cubic-bezier(.16,1,.3,1) both',
        grow: 'grow .5s cubic-bezier(.16,1,.3,1) both',
        blinkdot: 'blinkdot 1.4s infinite',
      },
    },
  },
  plugins: [],
};
