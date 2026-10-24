import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  const res = await page.goto('/about');
  expect(res?.status()).toBe(200);
});

test('@smoke /about has one h1 and a current-page breadcrumb', async ({ page }) => {
  await expect(page.locator('h1')).toHaveCount(1);
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(crumbs.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  await expect(crumbs.locator('[aria-current="page"]')).toHaveText('About');
});

test('header nav marks About as current', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav.getByRole('link', { name: 'About', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('only sections backed by content render; no placeholders or empty headings', async ({ page }) => {
  const main = page.getByRole('main');
  // Present with today's content: expertise (skill groups) and "Looking for" (availability).
  await expect(main.getByRole('heading', { level: 2, name: 'Areas of expertise' })).toBeVisible();
  await expect(main.getByRole('heading', { level: 2, name: 'Looking for' })).toBeVisible();
  // Absent: no principles / community / photo / resume / email in profile.json.
  await expect(main.getByRole('heading', { name: 'Engineering principles' })).toHaveCount(0);
  await expect(main.getByRole('heading', { name: 'Community & writing' })).toHaveCount(0);
  await expect(main.getByRole('link', { name: /resume/i })).toHaveCount(0);
  await expect(main.locator('img')).toHaveCount(0);
  await expect(main).not.toContainText(/\[[^\]]+\]/);
  for (const h of await main.getByRole('heading').all()) {
    expect((await h.innerText()).trim()).not.toBe('');
  }
  // Configured profile link renders safely.
  const gh = main.getByRole('link', { name: /GitHub/ });
  await expect(gh).toHaveAttribute('rel', 'noopener noreferrer');
});

test('has no axe violations', async ({ page }) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('no horizontal overflow at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/about');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
