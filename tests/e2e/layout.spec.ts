import { test, expect } from '@playwright/test';

test('@smoke header, main and footer landmarks with primary nav', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Primary' });
  // Anchor items exist only when their home section renders (experience is draft-only for now).
  const hasExperience = (await page.locator('#experience').count()) > 0;
  const labels = ['Skills', 'Experience', 'Projects', 'Writing', 'About', 'Contact'].filter(
    (l) => l !== 'Experience' || hasExperience,
  );
  for (const label of labels) {
    await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
});

test('skip link is the first tab stop and moves focus to main', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#main')).toBeFocused();
});

test('back to top targets the header', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Back to top' })).toHaveAttribute('href', '#top');
  await expect(page.locator('#top')).toHaveCount(1);
});

test('no horizontal overflow at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
