import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

test.describe('home', () => {
  test('hero: one h1, focus pill, CTA to /projects, no empty photo frame', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('engineered');
    await expect(page.getByText('Flutter · iOS · Android')).toBeVisible();
    await expect(page.getByText('Dhaka, Bangladesh · GMT+6')).toBeVisible();
    const cta = page.getByRole('link', { name: /View projects/ });
    await expect(cta).toHaveAttribute('href', (await page.locator('#work').count()) ? '#work' : '/projects');
    // Unconfigured data is hidden, not placeholdered (resume links are asserted in resume.spec.ts).
    await expect(page.locator('#hero figure')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(/\[[^\]]+\]/);
  });

  test('profile tiles only for configured links', async ({ page }) => {
    await page.goto('/');
    const tiles = page.getByRole('navigation', { name: 'Profiles' });
    await expect(tiles.getByRole('link', { name: /GitHub/ })).toHaveAttribute('target', '_blank');
    await expect(tiles.getByRole('link', { name: /GitHub/ })).toHaveAttribute('rel', /noopener/);
    await expect(tiles.getByRole('link', { name: /LinkedIn/ })).toHaveCount(0);
    await expect(tiles.getByRole('link', { name: /Medium/ })).toHaveCount(0);
    await expect(tiles.getByRole('link', { name: /Email/ })).toHaveCount(0);
  });

  test('stats band is a definition list', async ({ page }) => {
    await page.goto('/');
    const band = page.getByRole('region', { name: 'At a glance' });
    await expect(band.locator('dl dt')).toHaveText(['Platforms · iOS, Android']);
    await expect(band.locator('dl dd')).toHaveText(['2']);
  });

  test('sections render in order with gap-free numbering and labelled landmarks', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Technology stack' })).toBeVisible();
    await expect(page.getByRole('region', { name: "Where I've worked" })).toBeVisible();
    await expect(page.getByRole('region', { name: "Let's build something together." })).toBeVisible();

    const ids = await page
      .locator('main > section')
      .evaluateAll((els) => els.map((e) => e.id || e.getAttribute('aria-label')));
    expect(ids).toEqual(['hero', 'At a glance', 'skills', 'experience', 'work', 'contact']);

    await expect(page.locator('#skills .eyebrow')).toHaveText('01 — Skills');
    await expect(page.locator('#experience .eyebrow')).toHaveText('02 — Experience');
    await expect(page.locator('#work .eyebrow')).toHaveText('03 — Projects');
    // The writing slider is not built yet: no "04" eyebrow.
    await expect(page.locator('main')).not.toContainText(/04 — /);
  });

  test('heading order never skips a level', async ({ page }) => {
    await page.goto('/');
    const levels = await page
      .locator('main :is(h1,h2,h3,h4)')
      .evaluateAll((els) => els.map((e) => Number(e.tagName[1])));
    expect(levels[0]).toBe(1);
    levels.forEach((l, i) => {
      if (i > 0) expect(l - (levels[i - 1] ?? 0)).toBeLessThanOrEqual(1);
    });
  });

  test('skills: a card per group with chips as lists', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('#skills ul[role="list"] > li');
    expect(await cards.count()).toBeGreaterThan(0);
    await expect(cards.first().getByRole('heading', { level: 3 })).toBeVisible();
    await expect(cards.first().getByRole('list')).toBeVisible();
  });

  test('experience: current role with badge, unknown fields hidden', async ({ page }) => {
    await page.goto('/');
    const rows = page.locator('#experience ol > li');
    await expect(rows.first()).toContainText('Software Engineer, L-I');
    await expect(rows.first()).toContainText('Vivasoft');
    await expect(rows.first().getByText('Current', { exact: true })).toBeVisible();
    await expect(rows.first().getByRole('list', { name: /Technologies at Vivasoft/ })).toContainText(
      'Flutter',
    );
    // Draft record with only a company: just the company name, no dates/description/chips.
    const sheba = rows.nth(1);
    await expect(sheba.getByRole('heading', { level: 3 })).toHaveText('Sheba Platform');
    await expect(sheba.getByText('Current', { exact: true })).toHaveCount(0);
    await expect(sheba.locator('p, ul')).toHaveCount(0);
  });

  test('contact CTA: availability shown, email and unconfigured pills hidden', async ({ page }) => {
    await page.goto('/');
    const cta = page.locator('#contact');
    await expect(cta.getByRole('heading', { level: 2 })).toHaveText("Let's build something together.");
    await expect(cta).toContainText('Open to engineering roles');
    await expect(cta.getByRole('link', { name: /GitHub/ })).toBeVisible();
    await expect(cta.getByRole('link', { name: /LinkedIn/ })).toHaveCount(0);
    await expect(cta.locator('a[href^="mailto:"]')).toHaveCount(0);
  });

  // Passes with and without draft content: experience exists only in drafts builds.
  test('@smoke home is consistent whether or not experience is published', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('#skills .eyebrow')).toHaveText('01 — Skills');
    await expect(page.locator('#contact')).toHaveCount(1);
    const hasExperience = (await page.locator('#experience').count()) > 0;
    if (hasExperience) await expect(page.locator('#experience .eyebrow')).toHaveText('02 — Experience');
    // Every in-page header anchor must have a target, and Experience is listed only if it renders.
    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(nav.getByRole('link', { name: 'Experience', exact: true })).toHaveCount(
      hasExperience ? 1 : 0,
    );
    const hrefs = await nav
      .locator('a[href^="/#"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    for (const href of hrefs) await expect(page.locator(href!.slice(1))).toHaveCount(1);
    await expect(page.locator('body')).not.toContainText(/\[[^\]]+\]/);
  });

  test('experience rows stay aligned at every width', async ({ page }) => {
    for (const width of [390, 559, 600, 680, 720, 900, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const lefts = await page
        .locator('#experience ol > li h3')
        .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
      if (lefts.length < 2) test.skip(true, 'needs at least two experience rows (drafts build)');
      expect(new Set(lefts).size, `h3 left edges at ${width}px: ${lefts}`).toBe(1);
    }
  });

  test('no horizontal overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // body has overflow-x:hidden as a safety net, so also check no element sticks out.
    const wide = await page.evaluate(
      () =>
        [...document.querySelectorAll('main *')].filter(
          // Slider cards intentionally extend past the viewport inside their own scroll track.
          (e) => !e.closest('[data-slider-track]') && e.getBoundingClientRect().right > window.innerWidth + 1,
        ).length,
    );
    expect(wide).toBe(0);
  });

  test('no axe violations', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
