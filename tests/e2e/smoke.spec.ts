import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = ['/'];

for (const route of routes) {
  test(`@smoke ${route} renders with one h1`, async ({ page }) => {
    const res = await page.goto(route);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test(`${route} has no axe violations`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test('@smoke unknown route returns a real 404', async ({ request }) => {
  const res = await request.get('/this-route-does-not-exist');
  expect(res.status()).toBe(404);
});

test('security headers are served', async ({ request }) => {
  test.skip(
    !!process.env.BASE_URL && !process.env.BASE_URL.includes('web.app'),
    'headers come from firebase.json',
  );
  const res = await request.get('/');
  const h = res.headers();
  expect(h['content-security-policy']).toContain("default-src 'self'");
  expect(h['x-content-type-options']).toBe('nosniff');
});
