// Prints (or, with --json, returns) the metric-matched fallback @font-face blocks for the self-hosted
// web fonts (PF-43). The numbers in src/styles/global.css come from here; tests/unit/font-fallbacks.test.ts
// fails if they drift. Method (Capsize): size-adjust = avg glyph width of the web font / avg glyph width
// of the local fallback (Arial for sans, Courier New for mono; Liberation Sans/Mono are metric-compatible);
// ascent/descent/line-gap overrides = the web font's metrics divided by size-adjust.
import { fromFile } from '@capsizecss/unpack/fs';
import arial from '@capsizecss/metrics/arial';
import courierNew from '@capsizecss/metrics/courierNew';
import { fileURLToPath } from 'node:url';

const fonts = (name) =>
  fileURLToPath(import.meta.resolve(`@fontsource-variable/${name}/package.json`)).replace(
    /package\.json$/,
    'files/',
  );

export const FALLBACKS = [
  {
    family: 'Inter Fallback',
    file: fonts('inter') + 'inter-latin-wght-normal.woff2',
    base: arial,
    local: ['Arial', 'Liberation Sans', 'Helvetica'],
  },
  {
    family: 'Space Grotesk Fallback',
    file: fonts('space-grotesk') + 'space-grotesk-latin-wght-normal.woff2',
    base: arial,
    local: ['Arial', 'Liberation Sans', 'Helvetica'],
  },
  {
    family: 'JetBrains Mono Fallback',
    file: fonts('jetbrains-mono') + 'jetbrains-mono-latin-wght-normal.woff2',
    base: courierNew,
    local: ['Courier New', 'Liberation Mono', 'Courier'],
  },
];

const pct = (n) => `${(n * 100).toFixed(2)}%`;

export async function computeFallbacks() {
  const out = [];
  for (const f of FALLBACKS) {
    const m = await fromFile(f.file);
    const sizeAdjust = m.xWidthAvg / m.unitsPerEm / (f.base.xWidthAvg / f.base.unitsPerEm);
    out.push({
      family: f.family,
      local: f.local,
      sizeAdjust: sizeAdjust * 100,
      ascent: (m.ascent / m.unitsPerEm / sizeAdjust) * 100,
      descent: (Math.abs(m.descent) / m.unitsPerEm / sizeAdjust) * 100,
      lineGap: (m.lineGap / m.unitsPerEm / sizeAdjust) * 100,
    });
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const r of await computeFallbacks()) {
    console.log(`@font-face {
  font-family: '${r.family}';
  src: ${r.local.map((l) => `local('${l}')`).join(', ')};
  size-adjust: ${pct(r.sizeAdjust / 100)};
  ascent-override: ${pct(r.ascent / 100)};
  descent-override: ${pct(r.descent / 100)};
  line-gap-override: ${pct(r.lineGap / 100)};
}`);
  }
}
