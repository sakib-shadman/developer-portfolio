/** Pure helpers for the home page composition. */

export interface HomeSection {
  id: string;
  label: string;
  visible: boolean;
}

/**
 * Eyebrow text ("01 — Skills") numbered over the sections actually rendered, in order,
 * so hiding one never leaves a gap. Hidden sections get no entry.
 */
export function numberSections(sections: HomeSection[]): Record<string, string> {
  const out: Record<string, string> = {};
  let n = 0;
  for (const s of sections) {
    if (!s.visible) continue;
    n += 1;
    out[s.id] = `${String(n).padStart(2, '0')} — ${s.label}`;
  }
  return out;
}

/** Splits the headline around the first occurrence of the accent word; no match → no accent. */
export function splitHeadline(
  headline: string,
  accent?: string,
): { before: string; accent: string; after: string } | undefined {
  if (!accent) return undefined;
  const i = headline.indexOf(accent);
  if (i < 0) return undefined;
  return { before: headline.slice(0, i), accent, after: headline.slice(i + accent.length) };
}
