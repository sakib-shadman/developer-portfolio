import { test, expect } from '@playwright/test';

// PF-43: the metric-matched fallback faces must size text like the web fonts, otherwise the font swap
// re-flows the page (CLS) on slow connections, which Lighthouse on localhost cannot see.
const PARAGRAPH =
  "I'm Shadman, a Software Engineer building production mobile apps with Flutter and Dart, backed by native iOS and Android experience. Currently building an iOS SDK for an adtech company. Technical articles I've published on Medium. Each card opens the original post.";
const HEADING = 'Sample apps and SDKs, built for tests.';

interface Measure {
  width: number;
  height: number;
}

test('@any-content fallback fonts match the web fonts (Inter width within 1%, heading wrap identical)', async ({
  page,
}) => {
  await page.goto('/');
  const r = await page.evaluate(
    async ({ paragraph, heading }) => {
      await Promise.all([
        document.fonts.load('16px "Inter Variable"', paragraph),
        document.fonts.load('32px "Space Grotesk Variable"', heading),
      ]);
      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;';
      document.body.append(probe);
      const measure = (family: string, size: number, text: string, boxWidth?: number): Measure => {
        probe.style.fontFamily = family;
        probe.style.fontSize = `${size}px`;
        probe.style.lineHeight = 'normal';
        probe.style.whiteSpace = boxWidth ? 'normal' : 'nowrap';
        probe.style.width = boxWidth ? `${boxWidth}px` : 'auto';
        probe.textContent = text;
        const box = probe.getBoundingClientRect();
        return { width: box.width, height: box.height };
      };
      return {
        interWeb: measure('"Inter Variable"', 16, paragraph),
        interFb: measure('"Inter Fallback"', 16, paragraph),
        groteskWeb: measure('"Space Grotesk Variable"', 32, paragraph),
        groteskFb: measure('"Space Grotesk Fallback"', 32, paragraph),
        headWebW: measure('"Space Grotesk Variable"', 32, heading),
        headFbW: measure('"Space Grotesk Fallback"', 32, heading),
        headWeb: measure('"Space Grotesk Variable"', 32, heading, 340),
        headFb: measure('"Space Grotesk Fallback"', 32, heading, 340),
        loaded: [
          document.fonts.check('16px "Inter Variable"'),
          document.fonts.check('32px "Space Grotesk Variable"'),
        ],
      };
    },
    { paragraph: PARAGRAPH, heading: HEADING },
  );
  expect(r.loaded).toEqual([true, true]);
  expect(Math.abs(r.interFb.width / r.interWeb.width - 1)).toBeLessThan(0.01);
  // Space Grotesk: the Capsize average (letter-frequency weighted) overshoots this font's headings by
  // 1.5-2.3%, so a looser bound; the wrap check below is what protects layout.
  expect(Math.abs(r.groteskFb.width / r.groteskWeb.width - 1)).toBeLessThan(0.025);
  expect(Math.abs(r.headFbW.width / r.headWebW.width - 1)).toBeLessThan(0.025);
  expect(r.headFb.height).toBe(r.headWeb.height);
});
