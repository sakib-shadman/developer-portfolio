import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

// Detail pages exist only for projects that have a case study, so real content may have none (today).
// The page-level tests are tagged @fixtures and run against tests/fixtures/content (pnpm e2e:fixtures).
// Everything here discovers pages from /projects and is content-agnostic; the
// page-level checks skip themselves when there is nothing to visit.
async function detailPaths(page: Page): Promise<string[]> {
  await page.goto('/projects');
  const hrefs = await page
    .locator('main a[href^="/projects/"]')
    .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href') as string));
  return [...new Set(hrefs)];
}

test('@smoke unknown project slug returns a real 404', async ({ page }) => {
  const res = await page.goto('/projects/this-project-does-not-exist');
  expect(res?.status()).toBe(404);
});

test('/projects links only to detail pages that exist', async ({ page, request }) => {
  for (const path of await detailPaths(page)) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
  }
});

test('@smoke each detail page has one h1, breadcrumbs, unique metadata and a sane structure @fixtures', async ({
  page,
}) => {
  const paths = await detailPaths(page);
  test.skip(paths.length === 0, 'no project has a case study in this build');
  const titles = new Set<string>();
  for (const path of paths) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const name = (await page.getByRole('heading', { level: 1 }).textContent()) ?? '';
    const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(crumbs.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/projects');
    await expect(crumbs.locator('[aria-current="page"]')).toHaveText(name);
    // FR-14.7: unique title + description + canonical per page
    const title = await page.title();
    expect(titles.has(title), `duplicate title ${title}`).toBe(false);
    titles.add(title);
    expect(title).toContain(name);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /\S/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${path}$`));
    // no placeholder text, no empty sections
    await expect(page.locator('main')).not.toContainText(/\[[^\]]+\]/);
    for (const section of await page.locator('article section[aria-labelledby]').all()) {
      await expect(section.getByRole('heading', { level: 2 })).toHaveCount(1);
    }
    // case-study sections are numbered in sequence
    const eyebrows = await page.locator('article .eyebrow').allTextContents();
    eyebrows.forEach((t) => expect(t).toMatch(/\S/));
  }
});

test('@smoke detail pages: previous/next links go to existing pages @fixtures', async ({ page, request }) => {
  const paths = await detailPaths(page);
  test.skip(paths.length === 0, 'no project has a case study in this build');
  for (const path of paths) {
    await page.goto(path);
    const nav = page.getByRole('navigation', { name: 'More projects' });
    if (paths.length === 1) {
      await expect(nav).toHaveCount(0);
      continue;
    }
    for (const href of await nav
      .getByRole('link')
      .evaluateAll((as) => as.map((a) => a.getAttribute('href')))) {
      expect(paths).toContain(href);
      expect((await request.get(href as string)).status()).toBe(200);
    }
  }
});

test('detail pages: external links are safe, keyboard reachable and ≥ 40px @fixtures', async ({ page }) => {
  const paths = await detailPaths(page);
  test.skip(paths.length === 0, 'no project has a case study in this build');
  await page.goto(paths[0] as string);
  // Every external link is safe; the hero buttons (not inline prose links) must also be >= 40px tall.
  for (const a of await page.locator('main a[target="_blank"]').all()) {
    await expect(a).toHaveAttribute('rel', /noopener/);
  }
  for (const a of await page.locator('#project-title ~ .actions a').all()) {
    expect((await a.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(40);
  }
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
});

test('no axe violations on detail pages @fixtures', async ({ page }) => {
  const paths = await detailPaths(page);
  for (const path of paths) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, path).toEqual([]);
  }
});

test('no horizontal overflow at 320px on detail pages', async ({ page }) => {
  const paths = await detailPaths(page);
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of paths) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
