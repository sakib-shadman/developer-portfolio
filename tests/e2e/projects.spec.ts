import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

// Tests tagged @smoke / named "axe" run against the shipped build (no drafts, possibly zero
// projects) and the live site, so they must not assume any content. The rest need the draft
// content that e2e builds include (the 4 published projects plus the LMS Cricket draft: 4 mobile apps, 1 SDK) and skip themselves otherwise.
const counter = (page: Page) => page.locator('[data-counter]');
const items = (page: Page) => page.locator('[data-grid] > li');
const cards = (page: Page) => page.locator('[data-grid] > li:not([hidden])');
const pill = (page: Page, name: RegExp) => page.getByRole('button', { name });

test('@smoke /projects renders one h1, breadcrumbs and a consistent list or empty state', async ({
  page,
}) => {
  await page.goto('/projects');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Projects');
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(crumbs.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  await expect(crumbs.locator('[aria-current="page"]')).toHaveText('Projects');
  const n = await items(page).count();
  if (n === 0) {
    await expect(page.getByRole('heading', { name: 'No projects yet' })).toBeVisible();
  } else {
    await expect(cards(page)).toHaveCount(n);
    await expect(counter(page)).toHaveText(`${n} of ${n} ${n === 1 ? 'project' : 'projects'}`);
    await expect(counter(page)).toHaveAttribute('aria-live', 'polite');
    await expect(counter(page)).toHaveAttribute('aria-atomic', 'true');
  }
});

test('@smoke with zero projects: only the empty state, no list, filters, counter or extra headings', async ({
  page,
}) => {
  await page.goto('/projects');
  test.skip((await items(page).count()) > 0, 'only meaningful on a build without projects');
  await expect(page.getByRole('heading', { name: 'No projects yet' })).toBeVisible();
  await expect(page.locator('[data-grid]')).toHaveCount(0);
  await expect(counter(page)).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Filter by category' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Project list' })).toHaveCount(0);
  await expect(page.locator('script[type="module"][src*="index.astro_astro_type_script"]')).toHaveCount(0);
});

test('no axe violations (unfiltered and with a category param)', async ({ page }) => {
  for (const url of ['/projects', '/projects?category=sdk']) {
    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
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

test.describe('with draft content', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects');
    test.skip((await items(page).count()) === 0, 'needs the draft projects of the e2e build');
  });

  test('all projects listed, counter and heading levels', async ({ page }) => {
    await expect(cards(page)).toHaveCount(9);
    await expect(counter(page)).toHaveText('9 of 9 projects');
    // Featured first (by featuredOrder), then the rest by name.
    await expect(page.getByRole('heading', { level: 2 })).toHaveText([
      'BlueStack iOS SDK',
      'bKash DSO App',
      'Inspector Android',
      'Financfy',
      'LMS Cricket',
      'Amtel MyCash',
      'bKash Customer App',
      'Inpixon',
      'PiHR',
    ]);
    await expect(page.getByRole('heading', { name: 'Project list' })).toHaveCount(0);
  });

  test('cards hide missing data: no placeholder text, links or case study; role only where set', async ({
    page,
  }) => {
    const body = page.locator('main');
    await expect(body).not.toContainText(/\[[^\]]+\]/);
    await expect(body.getByRole('link', { name: /Case study/ })).toHaveCount(0);
    // Every published project carries a role; the LMS Cricket draft has none and so shows no "Role:" line.
    const card = (name: string) => items(page).filter({ has: page.getByRole('heading', { name }) });
    await expect(card('BlueStack iOS SDK')).toContainText('Role: Senior Software Engineer');
    await expect(card('bKash DSO App')).toContainText('Role: Flutter developer; led a five-person team');
    await expect(card('Inspector Android')).toContainText('Role: Android developer');
    await expect(card('Financfy')).toContainText('Role: Flutter developer');
    await expect(card('bKash Customer App')).toContainText('Role: Flutter developer (bKash partner team)');
    await expect(card('Inpixon')).toContainText('Role: Flutter developer; started the app');
    await expect(card('Amtel MyCash')).toContainText('Role: Android developer');
    await expect(card('PiHR')).toContainText('Role: Android and Flutter developer');
    await expect(card('LMS Cricket')).not.toContainText('Role:');
    await expect(page.getByText('In progress')).toHaveCount(1);
    await expect(card('BlueStack iOS SDK')).toContainText('In progress');
    // Featured badge: the four featured projects that are not marked in progress.
    await expect(page.getByText('Featured')).toHaveCount(4);
    await expect(page.locator('[aria-hidden="true"]', { hasText: '★' })).toHaveCount(4);
  });

  test('filter pills toggle cards, counter and the ?category= URL param', async ({ page }) => {
    const all = pill(page, /^All/);
    await expect(page.getByRole('group', { name: 'Filter by category' }).getByRole('button')).toHaveText([
      /All\s*9/,
      /Mobile apps\s*8/,
      /SDKs\s*1/,
    ]);
    await expect(all).toHaveAttribute('aria-pressed', 'true');

    await pill(page, /^SDKs/).click();
    await expect(cards(page)).toHaveCount(1);
    await expect(counter(page)).toHaveText('1 of 9 projects');
    await expect(pill(page, /^SDKs/)).toHaveAttribute('aria-pressed', 'true');
    await expect(all).toHaveAttribute('aria-pressed', 'false');
    await expect(page).toHaveURL(/\/projects\?category=sdk$/);

    await pill(page, /^Mobile apps/).click();
    await expect(cards(page)).toHaveCount(8);
    await expect(counter(page)).toHaveText('8 of 9 projects');
    await expect(page).toHaveURL(/\?category=mobile-app$/);

    await all.click();
    await expect(cards(page)).toHaveCount(9);
    await expect(page).toHaveURL(/\/projects$/);
  });

  test('?category= is applied on load', async ({ page }) => {
    await page.goto('/projects?category=sdk');
    await expect(cards(page)).toHaveCount(1);
    await expect(pill(page, /^SDKs/)).toHaveAttribute('aria-pressed', 'true');
  });

  test('unknown or pill-less categories fall back to All, pressed, and the URL is normalised', async ({
    page,
  }) => {
    for (const bad of ['nonsense', 'library', 'backend']) {
      await page.goto(`/projects?category=${bad}`);
      await expect(cards(page)).toHaveCount(9);
      await expect(counter(page)).toHaveText('9 of 9 projects');
      await expect(pill(page, /^All/)).toHaveAttribute('aria-pressed', 'true');
      await expect(page).toHaveURL(/\/projects$/);
    }
  });

  test('filters work with the keyboard', async ({ page }) => {
    await pill(page, /^SDKs/).focus();
    await expect(pill(page, /^SDKs/)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(cards(page)).toHaveCount(1);
    await pill(page, /^Mobile apps/).focus();
    await page.keyboard.press('Space');
    await expect(cards(page)).toHaveCount(8);
  });

  test('filtering uses replaceState: Back leaves the page, not the previous filter', async ({ page }) => {
    await page.goto('/');
    await page.goto('/projects');
    await pill(page, /^SDKs/).click();
    await pill(page, /^Mobile apps/).click();
    await expect(page).toHaveURL(/category=mobile-app$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
  });

  test('a direct visit is reloadable: reload keeps the filter', async ({ page }) => {
    await pill(page, /^SDKs/).click();
    await page.reload();
    await expect(cards(page)).toHaveCount(1);
    await expect(pill(page, /^SDKs/)).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('all cards show and the filter pills are not offered', async ({ page }) => {
    await page.goto('/projects');
    const n = await items(page).count();
    await expect(page.locator('[data-grid] > li:not([hidden])')).toHaveCount(n);
    await expect(page.getByRole('group', { name: 'Filter by category' })).toBeHidden();
    await expect(page.getByRole('heading', { name: 'No projects in this category yet' })).toBeHidden();
  });
});
