import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

// The repo currently ships zero articles and the e2e build may include test-only fixtures, so
// nothing here assumes specific content. Populated checks read what the page renders (titles, tags,
// counts) and skip themselves when the data they need (cards, tags, >1 page) is absent.
// Tests tagged @smoke / named "axe" also run against the shipped build.
const PAGE_SIZE = 6;
const counter = (page: Page) => page.locator('[data-counter]');
const allItems = (page: Page) => page.locator('[data-grid] > li');
const shown = (page: Page) => page.locator('[data-grid] > li:not([hidden])');
const status = (page: Page) => page.getByRole('status');
const search = (page: Page) => page.getByRole('searchbox', { name: 'Search articles' });
const more = (page: Page) => page.getByRole('button', { name: 'Load more articles' });
const tagPills = (page: Page) => page.getByRole('group', { name: 'Filter by topic' }).getByRole('button');
const noMatch = (page: Page) => page.getByRole('heading', { name: 'No articles match your search' });

test('@smoke /blog renders one h1, breadcrumbs and a consistent list or empty state', async ({ page }) => {
  await page.goto('/blog');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Writing');
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(crumbs.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  await expect(crumbs.locator('[aria-current="page"]')).toHaveText('Writing');
  const n = await allItems(page).count();
  if (n === 0) {
    await expect(page.getByRole('heading', { name: 'No articles yet' })).toBeVisible();
  } else {
    await expect(shown(page)).toHaveCount(Math.min(n, PAGE_SIZE));
    await expect(counter(page)).toHaveText(`Showing ${Math.min(n, PAGE_SIZE)} of ${n}`);
    // One always-present status live region; the visible counter is plain text.
    await expect(status(page)).toHaveCount(1);
    await expect(counter(page)).not.toHaveAttribute('aria-live', /.*/);
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(Math.min(n, PAGE_SIZE));
  }
});

test('@smoke with zero articles: only the empty state, no list, controls, counter or script', async ({
  page,
}) => {
  await page.goto('/blog');
  test.skip((await allItems(page).count()) > 0, 'only meaningful on a build without articles');
  await expect(page.getByText("New writing will appear here once it's published on Medium.")).toBeVisible();
  await expect(page.locator('[data-grid]')).toHaveCount(0);
  await expect(counter(page)).toHaveCount(0);
  await expect(search(page)).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Filter by topic' })).toHaveCount(0);
  await expect(page.locator('main script')).toHaveCount(0);
});

test('no axe violations (empty or populated, plus filtered, no-match and expanded states)', async ({
  page,
}) => {
  await page.goto('/blog');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const axe = async (label: string) =>
    expect((await new AxeBuilder({ page }).analyze()).violations, label).toEqual([]);
  await axe('/blog');
  if ((await allItems(page).count()) === 0) return;

  const pills = tagPills(page);
  if ((await pills.count()) > 1) {
    await pills.nth(1).click();
    await axe('tag filtered');
  }
  await search(page).fill('zzzz-no-such-article-zzzz');
  await expect(noMatch(page)).toBeVisible();
  await axe('no match');
  await page.goto('/blog');
  if (await more(page).isVisible()) {
    await more(page).click();
    await axe('expanded');
  }
});

test('no horizontal overflow at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/blog');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('the Medium profile link (when configured) opens safely in a new tab', async ({ page }) => {
  await page.goto('/blog');
  const link = page.locator('main').getByRole('link', { name: /Medium profile/ });
  test.skip((await link.count()) === 0, 'no Medium profile configured');
  await expect(link.first()).toHaveAttribute('href', /^https:\/\//);
  await expect(link.first()).toHaveAttribute('target', '_blank');
  await expect(link.first()).toHaveAttribute('rel', /noopener/);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('every article is listed; controls and Load more stay hidden', async ({ page }) => {
    await page.goto('/blog');
    const n = await allItems(page).count();
    test.skip(n === 0, 'needs articles');
    await expect(shown(page)).toHaveCount(n);
    await expect(search(page)).toBeHidden();
    await expect(more(page)).toBeHidden();
    await expect(page.getByRole('link', { name: /Read on Medium/ })).toHaveCount(n);
  });
});

test.describe('with articles', () => {
  let n = 0;
  test.beforeEach(async ({ page }) => {
    await page.goto('/blog');
    n = await allItems(page).count();
    test.skip(n === 0, 'needs articles (test fixtures or real content)');
  });

  test('cards: one external link each, no placeholders, no nested interactive elements', async ({ page }) => {
    const li = allItems(page).first();
    const links = li.getByRole('link');
    await expect(links).toHaveCount(1);
    await expect(links).toHaveAttribute('href', /^https:\/\//);
    await expect(links).toHaveAttribute('target', '_blank');
    await expect(links).toHaveAttribute('rel', /noopener/);
    await expect(links).toContainText('Read on Medium');
    await expect(li.locator('button, input, a a')).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText(/\[[^\]]+\]/);
  });

  test('the whole card is clickable (stretched link covers the card)', async ({ page }) => {
    const card = allItems(page).first().locator('article');
    await card.scrollIntoViewIfNeeded();
    // The pill itself is small; its ::after must cover the card: the card's centre hits the link.
    const hit = await card.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!top?.closest('a');
    });
    expect(hit).toBe(true);
  });

  test('search filters by title or excerpt, case-insensitively, resets to page 1, and syncs ?q=', async ({
    page,
  }) => {
    const title = (await allItems(page).first().locator('h2').innerText()).trim();
    const word = title.split(/\s+/).find((w) => w.length > 3) ?? title;
    await search(page).fill(word.toUpperCase());
    await expect(page).toHaveURL(new RegExp(`\\?q=${encodeURIComponent(word.toUpperCase())}$`));
    await expect(shown(page).first().locator('h2')).toContainText(new RegExp(word, 'i'));
    const total = Number((await counter(page).innerText()).match(/of (\d+)$/)?.[1]);
    expect(total).toBeGreaterThan(0);
    await expect(shown(page)).toHaveCount(Math.min(total, PAGE_SIZE));
    await expect(counter(page)).toHaveText(`Showing ${Math.min(total, PAGE_SIZE)} of ${total}`);

    await search(page).fill('');
    await expect(page).toHaveURL(/\/blog$/);
    await expect(shown(page)).toHaveCount(Math.min(n, PAGE_SIZE));
  });

  test('?q= is restored on load, and Back/Forward re-read the URL', async ({ page }) => {
    const title = (await allItems(page).first().locator('h2').innerText()).trim();
    await page.goto(`/blog?q=${encodeURIComponent(title)}`);
    await expect(search(page)).toHaveValue(title);
    await expect(shown(page).first().locator('h2')).toHaveText(title);
    await page.goto('/blog');
    await expect(search(page)).toHaveValue('');
    await page.goBack();
    await expect(search(page)).toHaveValue(title);
  });

  test('the status region announces results after a change, and "No articles match" at 0', async ({
    page,
  }) => {
    await expect(status(page)).toHaveText(''); // nothing is spoken on load
    await search(page).fill('zzzz-no-such-article-zzzz');
    await expect(status(page)).toHaveText('No articles match your search');
    await expect(status(page)).toBeAttached();
    await search(page).fill('');
    await expect(status(page)).toHaveText(`Showing ${Math.min(n, PAGE_SIZE)} of ${n}`);
  });

  test('other URL params survive filtering (utm_*)', async ({ page }) => {
    await page.goto('/blog?utm_source=x');
    await search(page).fill('zzz');
    await expect(page).toHaveURL(/\?utm_source=x&q=zzz$/);
    await search(page).fill('');
    await expect(page).toHaveURL(/\?utm_source=x$/);
  });

  test('no match shows the empty state; Clear search and filters restores everything', async ({ page }) => {
    await search(page).fill('zzzz-no-such-article-zzzz');
    await expect(noMatch(page)).toBeVisible();
    await expect(shown(page)).toHaveCount(0);
    await expect(counter(page)).toBeHidden();
    await expect(more(page)).toBeHidden();
    await page.getByRole('button', { name: 'Clear search and filters' }).click();
    await expect(noMatch(page)).toBeHidden();
    await expect(search(page)).toHaveValue('');
    await expect(search(page)).toBeFocused();
    await expect(shown(page)).toHaveCount(Math.min(n, PAGE_SIZE));
    await expect(page).toHaveURL(/\/blog$/);
  });

  test('Load more reveals the next page, updates the counter and moves focus to the first new card', async ({
    page,
  }) => {
    test.skip(n <= PAGE_SIZE, 'needs more than one page of articles');
    await expect(more(page)).toBeVisible();
    await expect(counter(page)).toHaveText(`Showing ${PAGE_SIZE} of ${n}`);
    await more(page).click();
    const now = Math.min(n, PAGE_SIZE * 2);
    await expect(shown(page)).toHaveCount(now);
    await expect(counter(page)).toHaveText(`Showing ${now} of ${n}`);
    await expect(allItems(page).nth(PAGE_SIZE).getByRole('link')).toBeFocused();
    if (n <= PAGE_SIZE * 2) await expect(more(page)).toBeHidden();
  });

  test('Load more works with the keyboard', async ({ page }) => {
    test.skip(n <= PAGE_SIZE, 'needs more than one page of articles');
    await more(page).focus();
    await page.keyboard.press('Enter');
    await expect(shown(page)).toHaveCount(Math.min(n, PAGE_SIZE * 2));
  });

  test('changing the search resets pagination to the first page', async ({ page }) => {
    test.skip(n <= PAGE_SIZE, 'needs more than one page of articles');
    await more(page).click();
    await search(page).fill('a');
    await search(page).fill('');
    await expect(shown(page)).toHaveCount(PAGE_SIZE);
  });

  test('tag pills (when articles have tags): filter, counter, URL, reset page, unknown tag -> All', async ({
    page,
  }) => {
    const pills = tagPills(page);
    test.skip((await pills.count()) < 2, 'no article has tags: the pill row is hidden');
    await expect(pills.first()).toHaveText('All'); // labels only, no counts
    await expect(pills.first()).toHaveAttribute('aria-pressed', 'true');

    const pill = pills.nth(1);
    const label = (await pill.innerText()).trim();
    // Expected matches come from the cards' own tag data, not from pill counts.
    const count = await page.evaluate(
      (tag) =>
        [...document.querySelectorAll<HTMLElement>('[data-grid] > li')].filter((li) =>
          (JSON.parse(li.dataset.tags ?? '[]') as string[]).includes(tag),
        ).length,
      label,
    );
    await pill.click();
    await expect(pill).toHaveAttribute('aria-pressed', 'true');
    await expect(pills.first()).toHaveAttribute('aria-pressed', 'false');
    await expect(shown(page)).toHaveCount(Math.min(count, PAGE_SIZE));
    await expect(counter(page)).toHaveText(`Showing ${Math.min(count, PAGE_SIZE)} of ${count}`);
    await expect(page).toHaveURL(
      new RegExp(`\\?tag=${encodeURIComponent(label).replace(/%20/g, '(\\+|%20)')}$`),
    );

    await page.goto(`/blog?tag=${encodeURIComponent(label.toLowerCase())}`);
    await expect(tagPills(page).nth(1)).toHaveAttribute('aria-pressed', 'true');

    await page.goto('/blog?tag=definitely-not-a-tag');
    await expect(tagPills(page).first()).toHaveAttribute('aria-pressed', 'true');
    await expect(shown(page)).toHaveCount(Math.min(n, PAGE_SIZE));
    await expect(page).toHaveURL(/\/blog$/);
  });
});
