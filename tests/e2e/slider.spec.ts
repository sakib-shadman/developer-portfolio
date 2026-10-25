import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

// The featured-projects slider needs draft content (3 featured projects); the shipped build may
// have none, in which case the section must be absent and these tests skip themselves.
const root = (page: Page) => page.locator('#projects-slider');
const track = (page: Page) => root(page).getByRole('region', { name: /Featured projects/ });
const dots = (page: Page) => root(page).getByRole('button', { name: /^Show project/ });
const counter = (page: Page) => root(page).locator('[data-slider-counter]');
const toggle = (page: Page) => root(page).locator('[data-slider-toggle]');
const scrollLeft = (page: Page) => track(page).evaluate((e) => e.scrollLeft);

async function open(page: Page): Promise<void> {
  await page.setViewportSize({ width: 900, height: 900 }); // 2 cards per view, 3 cards → scrolls
  await page.goto('/');
  if ((await page.locator('#work').count()) === 0) test.skip(true, 'no featured projects in this build');
  await expect(root(page)).toHaveAttribute('data-ready', 'true');
}

test.describe('featured projects slider', () => {
  test('section is labelled, numbered and links to /projects', async ({ page }) => {
    await open(page);
    const section = page.locator('#work');
    await expect(section.getByRole('heading', { level: 2 })).toHaveText('Featured projects');
    await expect(section.locator('.eyebrow')).toHaveText(/^\d\d — Projects$/);
    await expect(section.getByRole('link', { name: /All projects/ })).toHaveAttribute('href', '/projects');
    await expect(track(page)).toHaveAttribute('tabindex', '0');
    expect(await section.locator('[data-slider-track] > article').count()).toBeGreaterThan(1);
  });

  test('dots, counter and aria-current follow the scroll position', async ({ page }) => {
    await open(page);
    const n = await dots(page).count();
    expect(n).toBeGreaterThan(1);
    await expect(dots(page).first()).toHaveAttribute('aria-label', `Show project 1 of ${n}`);
    await expect(dots(page).first()).toHaveAttribute('aria-current', 'true');
    await expect(counter(page)).toHaveText(`01 / 0${n}`);
    const box = await dots(page).first().boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    await track(page).evaluate((e) => e.scrollTo({ left: e.scrollWidth, behavior: 'instant' }));
    await expect(counter(page)).toHaveText(`0${n} / 0${n}`);
    await expect(dots(page).last()).toHaveAttribute('aria-current', 'true');
    await expect(dots(page).first()).toHaveAttribute('aria-current', 'false');
  });

  test('clicking a dot scrolls to that card', async ({ page }) => {
    await open(page);
    await dots(page).nth(1).click();
    await expect.poll(() => scrollLeft(page)).toBeGreaterThan(100);
    await expect(counter(page)).toHaveText(/^02 \/ /);
    await expect(dots(page).nth(1)).toHaveAttribute('aria-current', 'true');
  });

  test('keyboard: the focused track scrolls with arrow keys', async ({ page }) => {
    await open(page);
    await track(page).focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => scrollLeft(page)).toBeGreaterThan(100);
    await expect(counter(page)).toHaveText(/^02 \//);
  });

  test('pause toggle changes its label and stops auto-advance', async ({ page, isMobile }) => {
    test.skip(isMobile, 'timing test runs on desktop only');
    await open(page);
    const t = toggle(page);
    await expect(t).toHaveAttribute('aria-label', 'Pause automatic project scrolling');
    const box = await t.boundingBox();
    expect(box!.width).toBe(40);
    await t.click();
    await expect(t).toHaveAttribute('aria-label', 'Resume automatic project scrolling');
    await page.mouse.move(0, 0);
    await t.blur();
    await page.waitForTimeout(5800);
    expect(await scrollLeft(page)).toBe(0);
    await expect(counter(page)).toHaveText(/^01 \//);
  });

  test('auto-advances one card after 5s, then holds while hovered', async ({ page, isMobile }) => {
    test.skip(isMobile, 'timing test runs on desktop only');
    await open(page);
    // 3 cards at 2 per view: one step already reaches the end, so the counter shows the last card.
    await expect.poll(() => scrollLeft(page), { timeout: 8000 }).toBeGreaterThan(100);
    await expect(counter(page)).not.toHaveText(/^01 \//);
    // Hover pauses: park the pointer on the track and make sure the next tick does nothing.
    await track(page).hover();
    // The wrap-around back to card 1 would happen on the next tick; hovering must hold it.
    await page.waitForTimeout(5800);
    expect(await scrollLeft(page)).toBeGreaterThan(100);
  });

  test('reduced motion: no auto-advance and no pause control', async ({ page, isMobile }) => {
    test.skip(isMobile, 'timing test runs on desktop only');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await expect(toggle(page)).toBeHidden();
    await page.waitForTimeout(5800);
    expect(await scrollLeft(page)).toBe(0);
    await dots(page).nth(1).click(); // manual navigation still works
    await expect.poll(() => scrollLeft(page)).toBeGreaterThan(100);
  });

  test('cards per view: 3 → 2 → 1 and gap 24px', async ({ page }) => {
    await open(page);
    const widths = async (w: number) => {
      await page.setViewportSize({ width: w, height: 900 });
      return page.locator('#work [data-slider-track]').evaluate((t) => {
        const a = t.querySelector('article')!.getBoundingClientRect().width;
        return { ratio: a / t.clientWidth, gap: getComputedStyle(t).columnGap };
      });
    };
    expect((await widths(1440)).ratio).toBeCloseTo((1 - 48 / 1152) / 3, 1);
    expect((await widths(900)).ratio).toBeCloseTo(0.5, 1);
    const mobile = await widths(390);
    expect(mobile.ratio).toBeCloseTo(0.85, 2);
    expect(mobile.gap).toBe('24px');
  });

  test('no axe violations', async ({ page }) => {
    await open(page);
    const results = await new AxeBuilder({ page }).include('#work').analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the track is a plain scrollable region and the controls stay hidden', async ({ page }) => {
    await page.goto('/');
    if ((await page.locator('#work').count()) === 0) test.skip(true, 'no featured projects in this build');
    await expect(track(page)).toBeVisible();
    await expect(root(page).locator('[data-slider-controls]')).toBeHidden();
    expect(await page.locator('#work [data-slider-track] > article').count()).toBeGreaterThan(1);
  });
});
