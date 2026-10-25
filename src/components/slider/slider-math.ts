/** Pure slider maths (HANDOFF §6.1, plan §2.6) — the DOM glue in slider.client.ts only measures and calls these. */

/**
 * Active card from scroll position: round(scrollLeft / (cardW + gap)); at the end of the track the
 * last card is active. When nothing scrolls (everything fits) the first card is active.
 */
export function activeIndex(
  scrollLeft: number,
  maxScroll: number,
  cardW: number,
  gap: number,
  count: number,
): number {
  if (count <= 0 || maxScroll <= 1) return 0;
  if (scrollLeft >= maxScroll - 1) return count - 1;
  const step = cardW + gap;
  return Math.max(0, Math.min(count - 1, Math.round(scrollLeft / step)));
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

/** Auto-advance only when nothing (pointer, focus, user, OS, tab visibility) asks it to hold. */
export const shouldAutoAdvance = (s: AutoAdvanceState): boolean =>
  !(s.hovered || s.focusWithin || s.paused || s.reducedMotion || s.hidden);

/** Zero-padded "01" for the counter. */
export const pad2 = (n: number): string => String(n).padStart(2, '0');
