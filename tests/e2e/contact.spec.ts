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
  // Without profile.email in content there is no email block or copy button.
  const hasEmail = (await main.locator('a[href^="mailto:"]').count()) > 0;
  expect(await main.getByRole('button', { name: 'Copy address' }).count()).toBe(hasEmail ? 1 : 0);
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

test.describe('copy flow (real bundled script on injected markup)', () => {
  // profile.json has no email, so the email block is not in the built HTML. The page script is still
  // bundled, so we route /contact and inject the same markup ContactDirect renders (see the
  // container test for the markup contract) to exercise the real script and a real clipboard.
  test.skip(({ browserName }) => browserName !== 'chromium', 'clipboard permissions: chromium only');
  const EMAIL = 'ada@example.dev';
  const block = (hidden = true) => `
    <div data-contact-direct>
      <button type="button" data-copy="${EMAIL}" aria-describedby="copy-status" ${hidden ? 'hidden' : ''}>Copy address</button>
      <p id="copy-status" role="status"></p>
    </div>`;

  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.route('**/contact', async (route) => {
      const res = await route.fetch();
      const html = (await res.text()).replace('<main id="main" tabindex="-1">', `$&${block()}`);
      await route.fulfill({ response: res, body: html });
    });
    await page.goto('/contact');
  });

  test('script reveals the button and copying announces, then clears', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Copy address' });
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page.getByRole('status').first()).toHaveText('Email address copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(EMAIL);
    await btn.click();
    await expect(page.getByRole('status').first()).toHaveText('Email address copied');
    await expect(page.getByRole('status').first()).toHaveText('', { timeout: 6000 });
  });

  test('clipboard failure shows the manual-copy message', async ({ page }) => {
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: () => Promise.reject(new Error('denied')) },
        configurable: true,
      });
    });
    await page.getByRole('button', { name: 'Copy address' }).click();
    await expect(page.getByRole('status').first()).toContainText('Copy failed');
  });
});
