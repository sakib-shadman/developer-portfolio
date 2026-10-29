import { test, expect } from '@playwright/test';

// ADR-0006: CLS < 0.05. The filter/search controls on /blog and /projects are revealed by script; their
// space is reserved (PF-43), so revealing them must not move the cards. Needs populated lists, hence
// @fixtures (the shipped build has none).
const ROUTES = ['/', '/projects', '/blog', '/about', '/contact'];

for (const route of ROUTES) {
  test(`@fixtures ${route} has no layout shift after load (CLS < 0.05)`, async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[])
          if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(route, { waitUntil: 'load' });
    await page.waitForTimeout(1000); // fonts and script reveal settle
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    expect(cls).toBeLessThan(0.05);
  });
}
