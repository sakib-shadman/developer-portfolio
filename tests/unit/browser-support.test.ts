import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const doc = readFileSync('docs/browser-support.md', 'utf8');
const read = (p: string) => readFileSync(p, 'utf8');

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

describe('browser support matrix (NFR-06)', () => {
  it('Playwright covers Chromium, WebKit, Firefox and a mobile Chromium device', () => {
    const cfg = read('playwright.config.ts');
    for (const name of ['chromium', 'webkit', 'firefox', 'mobile'])
      expect(cfg, name).toMatch(new RegExp(`name: '${name}'`));
    expect(cfg).toContain("devices['Pixel 7']");
  });

  // The official Playwright image bakes in chromium, firefox and webkit; tests/unit/ci-parity.test.ts pins
  // its tag to the @playwright/test version. The real pass must not be narrowed to some projects.
  it('CI runs e2e in the Playwright image, which carries all three engines', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toMatch(/image: mcr\.microsoft\.com\/playwright:v\d+\.\d+\.\d+-noble/);
    expect(ci).not.toContain('E2E_PROJECTS');
  });

  it('every feature on the guard list that src/ uses is in docs/browser-support.md with its floor', () => {
    const FEATURES: [string, RegExp, string][] = [
      ['`:has()`', /:has\(/, ':has()'],
      ['`@media (scripting)`', /@media \(scripting/, '@media (scripting)'],
      ['`size-adjust`', /size-adjust/, 'size-adjust'],
      ['`scroll-snap`', /scroll-snap/, 'scroll-snap'],
      ['`scrollbar-width`', /scrollbar-width/, 'scrollbar-width'],
      ['`aspect-ratio`', /aspect-ratio/, 'aspect-ratio'],
      ['`clamp()`', /clamp\(/, 'clamp()'],
      ['`:focus-visible`', /:focus-visible/, ':focus-visible'],
      ['`inset`', /[\s{;]inset:/, 'inset'],
      ['`navigator.clipboard`', /navigator\.clipboard/, 'navigator.clipboard'],
      ['`ResizeObserver`', /ResizeObserver/, 'ResizeObserver'],
      ['`replaceAll`', /\.replaceAll\(/, 'replaceAll'],
      ['`prefers-reduced-motion`', /prefers-reduced-motion/, 'prefers-reduced-motion'],
      ['`forced-colors`', /forced-colors/, 'forced-colors'],
      ['font metric overrides', /(ascent|descent|line-gap)-override/, 'ascent-override'],
      ['flex/grid `gap`', /[\s;{]gap:/, 'flex/grid `gap`'],
      ['`min()`', /[\s(:,]min\(/, '`min()`'],
      ['`loading="lazy"`', /loading="lazy"/, 'loading="lazy"'],
      ['`fetchpriority`', /fetchpriority/, 'fetchpriority'],
      [
        '`MediaQueryList` listeners',
        /matchMedia\([^)]*\)[\s\S]{0,80}addEventListener|reduced\.addEventListener/,
        'MediaQueryList.addEventListener',
      ],
      ['`container queries`', /@container/, '@container'],
      ['`color-mix()`', /color-mix\(/, 'color-mix()'],
      ['`dvh/svh units`', /\d(dvh|svh|lvh)\b/, 'dvh'],
      ['`text-wrap`', /text-wrap/, 'text-wrap'],
      ['`@layer`', /@layer/, '@layer'],
      ['`subgrid`', /subgrid/, 'subgrid'],
      ['`light-dark()`', /light-dark\(/, 'light-dark()'],
      ['`backdrop-filter`', /backdrop-filter/, 'backdrop-filter'],
      ['`structuredClone`', /structuredClone/, 'structuredClone'],
      ['`View Transitions`', /startViewTransition|view-transition/, 'view-transition'],
    ];
    const sources = [...walk('src')].filter((f) => /\.(astro|css|ts)$/.test(f)).map((f) => read(f));
    const missing = FEATURES.filter(([, re]) => sources.some((s) => re.test(s)))
      .filter(([, , needle]) => !doc.includes(needle))
      .map(([label]) => label);
    expect(missing, 'add these to docs/browser-support.md (floor + fallback)').toEqual([]);
  });
});
