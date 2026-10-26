import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const urls = ['/this-route-does-not-exist', '/projects/does-not-exist', '/a/b/c/deep'];

for (const url of urls) {
  test.describe(url, () => {
    test(`@smoke returns a real 404 with the designed page`, async ({ page }) => {
      const res = await page.goto(url);
      expect(res?.status()).toBe(404);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText("This page doesn't exist.");
      await expect(page.getByText('Error 404')).toBeVisible();
      const main = page.getByRole('main');
      await expect(main.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
      await expect(main.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/projects');
      await expect(main.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    });

    test('shows the requested path', async ({ page }) => {
      await page.goto(url);
      await expect(page.locator('[data-requested]')).toBeVisible();
      await expect(page.locator('[data-path]')).toHaveText(url);
    });

    test('has no axe violations', async ({ page }) => {
      await page.goto(url);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  });
}

test('no horizontal overflow at 320px, even with a very long path', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  // Several segments: the local emulator 500s on a single segment over the filesystem's 255-char limit.
  await page.goto(`/${'x'.repeat(100)}/${'y'.repeat(100)}/${'z'.repeat(100)}`);
  await expect(page.locator('[data-requested]')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('404 page is not in the sitemap', async ({ request }) => {
  const res = await request.get('/sitemap-0.xml');
  expect(res.status()).toBe(200);
  expect(await res.text()).not.toContain('/404');
});

test('shows the decoded path for non-ASCII URLs', async ({ page }) => {
  await page.goto('/caf%C3%A9/%C3%B1');
  await expect(page.locator('[data-path]')).toHaveText('/café/ñ');
});

test('content is vertically centred between header and footer on a tall viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/nope');
  const gaps = await page.evaluate(() => {
    const main = document.querySelector('main')!.getBoundingClientRect();
    const page = document.querySelector('.not-found')!;
    const first = page.firstElementChild!.getBoundingClientRect();
    const last = page.lastElementChild!.getBoundingClientRect();
    const footer = document.querySelector('footer')!.getBoundingClientRect();
    return { above: first.top - main.top, below: main.bottom - last.bottom, footerBottom: footer.bottom };
  });
  expect(Math.abs(gaps.above - gaps.below)).toBeLessThanOrEqual(2);
  expect(gaps.footerBottom).toBeGreaterThanOrEqual(899);
});
