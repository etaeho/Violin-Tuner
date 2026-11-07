/** 색은 전부 테마 토큰(CSS 변수)으로 — src/ui/themes.css 참고 */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app: v('app'), panel: v('panel'), inset: v('inset'), chip: v('chip'),
        line: v('line'), ink: v('ink'), dim: v('dim'), faint: v('faint'),
        accent: v('accent'), good: v('good'), warn: v('warn'), sharp: v('sharp'), flat: v('flat'),
        onaccent: v('onaccent'),
      },
      borderRadius: { card: '1.5rem', pill: '999px' },
      fontFamily: { display: 'var(--font-display)', mono: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
      transitionDuration: { beat: '80ms' },
    },
  },
  plugins: [],
};
