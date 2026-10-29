import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeFallbacks } from '../../scripts/font-fallbacks.mjs';

interface Row {
  family: string;
  sizeAdjust: number;
  ascent: number;
  descent: number;
  lineGap: number;
}
const css = readFileSync('src/styles/global.css', 'utf8');

function declared(family: string, prop: string): number {
  const block = css.match(new RegExp(`font-family: '${family}';[^}]*}`))?.[0] ?? '';
  const m = block.match(new RegExp(`${prop}: ([0-9.]+)%`));
  if (!m) throw new Error(`${family}: ${prop} missing in global.css`);
  return Number(m[1]);
}

describe('fallback font faces (PF-43)', () => {
  it('global.css matches scripts/font-fallbacks.mjs (re-run it and paste on drift)', async () => {
    const rows = (await computeFallbacks()) as Row[];
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(declared(r.family, 'size-adjust'), `${r.family} size-adjust`).toBeCloseTo(r.sizeAdjust, 1);
      expect(declared(r.family, 'ascent-override'), `${r.family} ascent`).toBeCloseTo(r.ascent, 1);
      expect(declared(r.family, 'descent-override'), `${r.family} descent`).toBeCloseTo(r.descent, 1);
      expect(declared(r.family, 'line-gap-override'), `${r.family} line-gap`).toBeCloseTo(r.lineGap, 1);
    }
  });
});
