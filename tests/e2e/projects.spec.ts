import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

// Content under test (drafts included in e2e builds): 3 projects — 2 mobile apps, 1 SDK.
const counter = (page: Page) => page.locator('[data-counter]');
const cards = (page: Page) => page.locator('[data-grid] > li:not([hidden])');
const pill = (page: Page, name: RegExp) => page.getByRole('button', { name });

test('@smoke /projects renders one h1, breadcrumbs and every project', async ({ page }) => {
  await page.goto('/projects');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Projects');
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(crumbs.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  await expect(crumbs.locator('[aria-current="page"]')).toHaveText('Projects');
  await expect(cards(page)).toHaveCount(3);
  await expect(counter(page)).toHaveText('3 of 3 projects');
  await expect(counter(page)).toHaveAttribute('aria-live', 'polite');
});

test('featured projects come first in featuredOrder, names are h3', async ({ page }) => {
  await page.goto('/projects');
  await expect(page.getByRole('heading', { level: 3 })).toHaveText([
    'Adtech iOS SDK',
    'LMS Cricket',
    'Financfy',
  ]);
});

test('cards hide missing data: no placeholder text, role, links or case study', async ({ page }) => {
  await page.goto('/projects');
  const body = page.locator('main');
  await expect(body).not.toContainText(/\[[^\]]+\]/);
  await expect(body).not.toContainText('Role:');
  await expect(body.getByRole('link', { name: /Case study/ })).toHaveCount(0);
  await expect(page.getByText('In progress')).toHaveCount(1);
  await expect(page.getByText('★ Featured')).toHaveCount(2);
});

test('filter pills toggle cards, counter and the ?category= URL param', async ({ page }) => {
  await page.goto('/projects');
  const all = pill(page, /^All/);
  await expect(page.getByRole('group', { name: 'Filter by category' }).getByRole('button')).toHaveText([
    /All\s*3/,
    /Mobile apps\s*2/,
    /SDKs\s*1/,
  ]);
  await expect(all).toHaveAttribute('aria-pressed', 'true');

  await pill(page, /^SDKs/).click();
  await expect(cards(page)).toHaveCount(1);
  await expect(counter(page)).toHaveText('1 of 3 projects');
  await expect(pill(page, /^SDKs/)).toHaveAttribute('aria-pressed', 'true');
  await expect(all).toHaveAttribute('aria-pressed', 'false');
  await expect(page).toHaveURL(/\/projects\?category=sdk$/);

  await pill(page, /^Mobile apps/).click();
  await expect(cards(page)).toHaveCount(2);
  await expect(counter(page)).toHaveText('2 of 3 projects');
  await expect(page).toHaveURL(/\?category=mobile-app$/);

  await all.click();
  await expect(cards(page)).toHaveCount(3);
  await expect(page).toHaveURL(/\/projects$/);
});

test('?category= is applied on load and junk values show everything', async ({ page }) => {
  await page.goto('/projects?category=sdk');
  await expect(cards(page)).toHaveCount(1);
  await expect(pill(page, /^SDKs/)).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/projects?category=nonsense');
  await expect(cards(page)).toHaveCount(3);
  await expect(counter(page)).toHaveText('3 of 3 projects');
});

test('a category with no projects shows the empty state; Show all recovers and focuses All', async ({
  page,
}) => {
  await page.goto('/projects?category=library');
  await expect(cards(page)).toHaveCount(0);
  await expect(counter(page)).toHaveText('0 of 3 projects');
  await expect(page.getByRole('heading', { name: 'No projects in this category yet' })).toBeVisible();
  await page.getByRole('button', { name: 'Show all projects' }).click();
  await expect(cards(page)).toHaveCount(3);
  await expect(page.getByRole('heading', { name: 'No projects in this category yet' })).toBeHidden();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(pill(page, /^All/)).toBeFocused();
});

test('filters work with the keyboard', async ({ page }) => {
  await page.goto('/projects');
  await pill(page, /^SDKs/).focus();
  await expect(pill(page, /^SDKs/)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(cards(page)).toHaveCount(1);
  await pill(page, /^Mobile apps/).focus();
  await page.keyboard.press('Space');
  await expect(cards(page)).toHaveCount(2);
});

test('browser Back returns to the previous page after filtering', async ({ page }) => {
  await page.goto('/projects?category=sdk');
  await page.goto('/projects?category=mobile-app');
  await expect(cards(page)).toHaveCount(2);
  await page.goBack();
  await expect(page).toHaveURL(/category=sdk/);
  await expect(cards(page)).toHaveCount(1);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('all cards show and the filter pills are not offered', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.locator('[data-grid] > li')).toHaveCount(3);
    await expect(page.locator('[data-grid] > li:not([hidden])')).toHaveCount(3);
    await expect(page.getByRole('group', { name: 'Filter by category' })).toBeHidden();
    await expect(page.getByRole('heading', { name: /No projects/ })).toBeHidden();
  });
});

test('no axe violations (unfiltered, filtered, empty state)', async ({ page }) => {
  for (const url of ['/projects', '/projects?category=sdk', '/projects?category=library']) {
    await page.goto(url);
    await expect(counter(page)).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, url).toEqual([]);
  }
});

test('no horizontal overflow at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/projects');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
