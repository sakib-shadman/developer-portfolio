/**
 * Open Graph card layouts (1200x630, Midnight Teal) as satori element trees. Pure data: rendering
 * lives in og-render.ts. Colours mirror src/styles/tokens.css (dark theme).
 */
import { OG_SIZE } from './text';

export interface OgNode {
  type: string;
  props: { style?: Record<string, unknown>; children?: OgChild | OgChild[]; [k: string]: unknown };
}
type OgChild = OgNode | string;

const C = {
  bg: '#0B0F1A',
  surface: '#131A2A',
  border: '#243049',
  text: '#E8ECF5',
  muted: '#9AA4BC',
  acc: '#5EEAD4',
  onAcc: '#04201C',
} as const;

const el = (type: string, style: Record<string, unknown>, children?: OgChild | OgChild[]): OgNode => ({
  type,
  props: { style: { display: 'flex', ...style }, ...(children !== undefined ? { children } : {}) },
});

/** Display size that keeps a title within ~3 lines on the card. */
export function titleSize(text: string): number {
  const n = text.length;
  if (n <= 24) return 96;
  if (n <= 44) return 76;
  if (n <= 72) return 60;
  return 48;
}

/** First letter for the logo chip (matches the header logo). */
const initial = (name: string): string => Array.from(name.trim())[0]?.toUpperCase() ?? '';

export interface OgCard {
  /** Small teal label above the title ("Case study"); omitted when empty. */
  eyebrow?: string | undefined;
  title: string;
  /** Muted line under the title. */
  subtitle?: string | undefined;
  /** Name shown bottom-left next to the logo chip. */
  name: string;
  /** Host shown bottom-right, e.g. "shadman-portfolio-96097.web.app". */
  host: string;
}

export function ogTree(card: OgCard): OgNode {
  const logo = el(
    'div',
    {
      width: 56,
      height: 56,
      borderRadius: 16,
      background: C.acc,
      color: C.onAcc,
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 30,
      fontWeight: 700,
      fontFamily: 'Space Grotesk',
    },
    initial(card.name),
  );
  const body = el('div', { flexDirection: 'column', gap: 24, flex: 1, justifyContent: 'center' }, [
    ...(card.eyebrow
      ? [
          el(
            'div',
            {
              fontFamily: 'Inter',
              fontWeight: 600,
              fontSize: 28,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: C.acc,
            },
            card.eyebrow,
          ),
        ]
      : []),
    el(
      'div',
      {
        fontFamily: 'Space Grotesk',
        fontWeight: 700,
        fontSize: titleSize(card.title),
        lineHeight: 1.08,
        letterSpacing: -2,
        color: C.text,
      },
      card.title,
    ),
    ...(card.subtitle
      ? [
          el(
            'div',
            { fontFamily: 'Inter', fontWeight: 400, fontSize: 36, lineHeight: 1.3, color: C.muted },
            card.subtitle,
          ),
        ]
      : []),
  ]);
  const footer = el(
    'div',
    {
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 28,
      borderTop: `2px solid ${C.border}`,
      fontFamily: 'Inter',
      fontSize: 28,
      color: C.muted,
    },
    [
      el('div', { alignItems: 'center', gap: 16, color: C.text, fontWeight: 600 }, [logo, card.name]),
      el('div', {}, card.host),
    ],
  );
  return el(
    'div',
    {
      width: OG_SIZE.width,
      height: OG_SIZE.height,
      flexDirection: 'column',
      boxSizing: 'border-box',
      padding: 72,
      background: C.bg,
      // Teal glow in the corner, as on the site's hero.
      backgroundImage: `radial-gradient(circle at 100% 0%, rgba(94,234,212,0.18) 0%, rgba(94,234,212,0) 55%)`,
    },
    [body, footer],
  );
}

/** Default card: the person (name + title). */
export const defaultCard = (p: { name: string; title: string }, host: string): OgCard => ({
  title: p.name,
  subtitle: p.title,
  name: p.name,
  host,
});

/** Alt text of the default card, as the card reads: "<name>, <title>". */
export const defaultCardAlt = (p: { name: string; title: string }): string => `${p.name}, ${p.title}`;

/** Project card: name + its own label, tagged as a case study. */
export const projectCard = (
  project: { name: string; label: string },
  owner: string,
  host: string,
): OgCard => ({
  eyebrow: 'Case study',
  title: project.name,
  subtitle: project.label,
  name: owner,
  host,
});
