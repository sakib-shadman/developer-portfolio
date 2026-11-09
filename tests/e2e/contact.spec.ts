import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  const res = await page.goto('/contact');
  expect(res?.status()).toBe(200);
});

test('@smoke /contact has one h1, breadcrumb and current nav item', async ({ page }) => {
  await expect(page.locator('h1')).toHaveCount(1);
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(crumbs.locator('[aria-current="page"]')).toHaveText('Contact');
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav.getByRole('link', { name: 'Contact', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('contact route is links-based, with no form and no placeholders', async ({ page }) => {
  const main = page.getByRole('main');
  await expect(main.locator('form')).toHaveCount(0);
  await expect(main).not.toContainText(/\[[^\]]+\]/);
  await expect(main.getByRole('link', { name: /GitHub/ })).toHaveAttribute('rel', 'noopener noreferrer');
  // profile.email is set: the email block, one mailto link and one copy button.
  await expect(main.locator('a[href^="mailto:"]')).toHaveCount(1);
  await expect(main.getByRole('button', { name: 'Copy address' })).toHaveCount(1);
});

test('the email block shows the address, a mailto link and a working copy button', async ({
  page,
  context,
}) => {
  const main = page.getByRole('main');
  await expect(main).toContainText('sakib.shadman@outlook.com');
  await expect(main.getByRole('link', { name: 'Email me' })).toHaveAttribute(
    'href',
    /^mailto:sakib\.shadman@outlook\.com(\?.*)?$/,
  );
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const btn = main.getByRole('button', { name: 'Copy address' });
  await expect(btn).toBeVisible();
  await btn.click();
  await expect(page.getByRole('status').first()).toHaveText('Email address copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('sakib.shadman@outlook.com');
});

test('has no axe violations', async ({ page }) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('no horizontal overflow at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/contact');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

// The copy flow's failure paths are covered with fictional content: see fixtures.spec.ts (@fixtures).
