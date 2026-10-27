import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { parse as parseYaml } from 'yaml';

const writing = (page: Page) => page.locator('#writing');
const wSlider = (page: Page) => page.locator('#writing-slider');
const pSlider = (page: Page) => page.locator('#projects-slider');
const track = (s: ReturnType<typeof wSlider>) => s.locator('[data-slider-track]');
const counter = (s: ReturnType<typeof wSlider>) => s.locator('[data-slider-counter]');
const dots = (s: ReturnType<typeof wSlider>) => s.getByRole('button', { name: /^Show (article|project)/ });

// Content-agnostic: the shipped build has no articles (section absent); fixture builds have them.
test('@smoke @any-content home writing section is consistent with the data', async ({ page }) => {
  await page.goto('/');
  const present = (await writing(page).count()) > 0;
  // The header "Writing" link always goes to /blog; it is a page link, not an in-page anchor.
  await expect(
    page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Writing', exact: true }),
  ).toHaveAttribute('href', '/blog');
  if (!present) {
    await expect(page.locator('main')).not.toContainText(/— Writing/);
    return;
  }
  await expect(writing(page).getByRole('heading', { level: 2 })).toHaveText('Latest on Medium');
  await expect(writing(page).locator('.eyebrow')).toHaveText(/^\d\d — Writing$/);
  await expect(writing(page).getByRole('link', { name: /All articles/ })).toHaveAttribute('href', '/blog');
  await expect(wSlider(page).getByRole('region', { name: /Latest articles/ })).toBeVisible();
});

test('@any-content home has no axe violations with the writing section', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

// ---- @fixtures: articles 1-3 are featured (tests/fixtures/content/articles) ----
const FIXTURE_DIR = 'tests/fixtures/content/articles';
const featured = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const fm = parseYaml(
      /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(join(FIXTURE_DIR, f), 'utf8'))?.[1] ?? '',
    ) as {
      title: string;
      url: string;
      publishedAt: Date | string;
      tags?: string[];
      featured?: boolean;
    };
    const at = fm.publishedAt;
    return {
      ...fm,
      at: at instanceof Date ? at.toISOString().slice(0, 10) : String(at),
    };
  })
  .filter((a) => a.featured)
  .sort((a, b) => b.at.localeCompare(a.at) || a.title.localeCompare(b.title));

test.describe('@fixtures home writing slider', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 900 }); // 2 per view: every fixture slider scrolls
    await page.goto('/');
    await expect(wSlider(page)).toHaveAttribute('data-ready', 'true');
    await expect(pSlider(page)).toHaveAttribute('data-ready', 'true');
  });

  test('@fixtures shows the featured articles, newest first, without tags', async ({ page }) => {
    expect(featured).toHaveLength(3);
    await expect(writing(page).locator('.eyebrow')).toHaveText('04 — Writing');
    const cards = track(wSlider(page)).locator(':scope > article');
    await expect(cards).toHaveCount(3);
    await expect(cards.getByRole('heading', { level: 3 })).toHaveText(featured.map((a) => a.title));
    // each card has one external link to the canonical URL; the tag never shows on the home cards
    for (const [i, a] of featured.entries()) {
      const links = cards.nth(i).getByRole('link');
      await expect(links).toHaveCount(1);
      await expect(links.first()).toHaveAttribute('href', a.url);
      await expect(links.first()).toHaveAttribute('target', '_blank');
      await expect(cards.nth(i).locator('.tag')).toHaveCount(0);
    }
  });

  test('@fixtures labels, dots and counter belong to the writing slider', async ({ page }) => {
    await expect(dots(wSlider(page)).first()).toHaveAttribute('aria-label', 'Show article 1 of 3');
    await expect(wSlider(page).locator('[data-slider-toggle]')).toHaveAttribute(
      'aria-label',
      'Pause automatic article scrolling',
    );
    await expect(dots(pSlider(page)).first()).toHaveAttribute('aria-label', /^Show project 1 of /);
  });

  test('@fixtures two sliders on one page work independently', async ({ page }) => {
    const left = (s: ReturnType<typeof wSlider>) => track(s).evaluate((e) => e.scrollLeft);
    const toggle = (s: ReturnType<typeof wSlider>) => s.locator('[data-slider-toggle]');
    // Pause the projects slider first so its autoplay cannot move it during the assertions.
    await toggle(pSlider(page)).click();
    await expect(pSlider(page)).toHaveAttribute('data-holds', /paused/);
    await expect(wSlider(page)).not.toHaveAttribute('data-holds', /paused/);

    await dots(wSlider(page)).nth(1).click();
    await expect.poll(() => left(wSlider(page))).toBeGreaterThan(100);
    await expect(counter(wSlider(page))).toHaveText(/^02 \//);
    // the projects slider did not move
    expect(await left(pSlider(page))).toBe(0);
    await expect(counter(pSlider(page))).toHaveText(/^01 \//);

    // and the other way round: a projects dot leaves the writing slider where it is
    await dots(pSlider(page)).nth(1).click();
    await expect.poll(() => left(pSlider(page))).toBeGreaterThan(100);
    await expect(counter(wSlider(page))).toHaveText(/^02 \//);

    // pausing the writing slider is its own state
    await toggle(wSlider(page)).click();
    await expect(wSlider(page)).toHaveAttribute('data-holds', /paused/);
  });

  test('@fixtures the focus ring of a card inside a slider is fully visible (not clipped)', async ({
    page,
  }) => {
    await page.keyboard.press('Shift'); // keyboard modality, so focus() matches :focus-visible
    for (const slider of [wSlider(page), pSlider(page)]) {
      const card = track(slider).locator(':scope > article').first();
      await card.getByRole('link').first().focus();
      const ring = await card.evaluate((el) => {
        const cs = getComputedStyle(el);
        const c = el.getBoundingClientRect();
        const t = el.parentElement!.getBoundingClientRect();
        const grow = parseFloat(cs.outlineOffset) + parseFloat(cs.outlineWidth); // outer edge vs border box
        return {
          style: cs.outlineStyle,
          top: c.top - grow - t.top,
          left: c.left - grow - t.left,
        };
      });
      // pill-focused project cards draw their ring on the pill; only assert cards that own the ring
      if (ring.style === 'none') continue;
      expect(ring.top, 'ring top edge inside the track').toBeGreaterThanOrEqual(-0.5);
      expect(ring.left, 'ring left edge inside the track').toBeGreaterThanOrEqual(-0.5);
    }
    // the writing card owns the ring, so it must have been asserted
    const w = track(wSlider(page)).locator(':scope > article').first();
    await w.getByRole('link').first().focus();
    expect(await w.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
  });

  test('@fixtures no axe violations and no horizontal overflow at 320px', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('#writing').analyze();
    expect(results.violations).toEqual([]);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
