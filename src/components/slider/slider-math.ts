/** Pure slider maths (HANDOFF §6.1, plan §2.6) — the DOM glue in slider.client.ts only measures and calls these. */

/** Scroll-position tolerance in px: Gecko/WebKit report fractional or rounded scroll metrics. */
export const EPS = 2;

/**
 * Active card.
 *  - With an explicit `target` (the user clicked a dot, or autoplay stepped to a card) that card is
 *    active, so e.g. dot 2 stays active even when card 2's offset equals the end of the track.
 *  - Otherwise (free scrolling: swipe, wheel, keys) it follows the scroll position:
 *    round(scrollLeft / (cardW + gap)), and the last card is active at the end of the track.
 *  - When nothing scrolls (everything fits) the first card is active.
 */
export function activeIndex(
  scrollLeft: number,
  maxScroll: number,
  cardW: number,
  gap: number,
  count: number,
  target?: number,
): number {
  if (count <= 0 || maxScroll <= EPS) return 0;
  if (target !== undefined) return Math.max(0, Math.min(count - 1, target));
  if (scrollLeft >= maxScroll - EPS) return count - 1;
  const step = cardW + gap;
  return Math.max(0, Math.min(count - 1, Math.round(scrollLeft / step)));
}

/**
 * Autoplay step, derived from the live scroll position (no remembered state): the first card
 * whose reachable offset (clamped to the end of the track) is beyond where we are now, else wrap
 * to the first card. Cards that cannot scroll any further are skipped instead of burning a tick.
 */
export function nextStop(
  scrollLeft: number,
  maxScroll: number,
  cardW: number,
  gap: number,
  count: number,
): number {
  const step = cardW + gap;
  for (let i = 1; i < count; i++) {
    if (Math.min(i * step, maxScroll) > scrollLeft + EPS) return i;
  }
  return 0;
}

/** One card per tick; wraps to the first card after the last. */
export const nextIndex = (i: number, count: number): number => (count <= 0 ? 0 : (i + 1) % count);

/** scrollLeft that puts card `i` at the start of the track. */
export const scrollTarget = (i: number, cardW: number, gap: number): number => i * (cardW + gap);

export interface AutoAdvanceState {
  hovered: boolean;
  focusWithin: boolean;
  paused: boolean;
  reducedMotion: boolean;
  hidden: boolean;
}

export type Hold = 'hover' | 'focus' | 'paused' | 'reduced' | 'hidden';

/** Every reason autoplay is currently held (empty = running). Order is stable for diagnostics. */
export function holdReasons(s: AutoAdvanceState): Hold[] {
  const out: Hold[] = [];
  if (s.hovered) out.push('hover');
  if (s.focusWithin) out.push('focus');
  if (s.paused) out.push('paused');
  if (s.reducedMotion) out.push('reduced');
  if (s.hidden) out.push('hidden');
  return out;
}

/** Auto-advance only when nothing (pointer, focus, user, OS, tab visibility) asks it to hold. */
export const shouldAutoAdvance = (s: AutoAdvanceState): boolean => holdReasons(s).length === 0;

/** Where a programmatic scroll to card `i` should land: its offset, clamped to the track end. */
export const destination = (i: number, cardW: number, gap: number, maxScroll: number): number =>
  Math.max(0, Math.min(scrollTarget(i, cardW, gap), maxScroll));

/** True when a smooth scroll was cut short (e.g. by scroll-snap) and must be finished instantly. */
export const needsSettle = (current: number, dest: number): boolean => Math.abs(current - dest) > EPS;

/** Zero-padded "01" for the counter. */
export const pad2 = (n: number): string => String(n).padStart(2, '0');
