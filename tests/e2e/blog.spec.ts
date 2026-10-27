import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

// Two kinds of tests. Untagged / @smoke / "axe" / @any-content tests assume no content (the shipped
// build has zero articles) and also run against the fixture build. Tests tagged @fixtures run only in
// `pnpm e2e:fixtures`, against tests/fixtures/content (9 articles); their expectations are read from
// those fixture files, never hard-coded.
const PAGE_SIZE = 6;

interface Fixture {
  title: string;
  publishedAt: string;
  tags: string[];
}
const FIXTURE_DIR = 'tests/fixtures/content/articles';
/** Fixture articles, newest first (the order the page renders). */
const FIXTURES: Fixture[] = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const fm = parse(readFileSync(join(FIXTURE_DIR, f), 'utf8').split('---')[1] ?? '') as {
      title: string;
      publishedAt: Date | string;
      tags?: string[];
    };
    const at = fm.publishedAt;
    return {
      title: fm.title,
      publishedAt: at instanceof Date ? at.toISOString().slice(0, 10) : String(at),
      tags: fm.tags ?? [],
    };
  })
  .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
const N = FIXTURES.length;
const TAGS = [...new Set(FIXTURES.flatMap((a) => a.tags))].sort((a, b) => a.localeCompare(b));
const withTag = (tag: string) => FIXTURES.filter((a) => a.tags.includes(tag));
const counter = (page: Page) => page.locator('[data-counter]');
const allItems = (page: Page) => page.locator('[data-grid] > li');
const shown = (page: Page) => page.locator('[data-grid] > li:not([hidden])');
const status = (page: Page) => page.getByRole('status');
const search = (page: Page) => page.getByRole('searchbox', { name: 'Search articles' });
const more = (page: Page) => page.getByRole('button', { name: 'Load more articles' });
const tagPills = (page: Page) => page.getByRole('group', { name: 'Filter by topic' }).getByRole('button');
const noMatch = (page: Page) => page.getByRole('heading', { name: 'No articles match your search' });

test('@smoke @any-content /blog renders one h1, breadcrumbs and a consistent list or empty state', async ({
  page,
}) => {
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

test('@any-content no axe violations (empty or populated, plus filtered, no-match and expanded states)', async ({
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

test('@any-content no horizontal overflow at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/blog');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('@any-content the Medium profile link (when configured) opens safely in a new tab', async ({ page }) => {
  await page.goto('/blog');
  const link = page.locator('main').getByRole('link', { name: /Medium profile/ });
  test.skip((await link.count()) === 0, 'no Medium profile configured');
  await expect(link.first()).toHaveAttribute('href', /^https:\/\//);
  await expect(link.first()).toHaveAttribute('target', '_blank');
  await expect(link.first()).toHaveAttribute('rel', /noopener/);
});

test.describe('@fixtures populated /blog', () => {
  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('@fixtures every article is listed; controls and Load more stay hidden', async ({ page }) => {
      await page.goto('/blog');
      await expect(shown(page)).toHaveCount(N);
      await expect(search(page)).toBeHidden();
      await expect(more(page)).toBeHidden();
      await expect(page.getByRole('link', { name: /Read on Medium/ })).toHaveCount(N);
    });
  });

  test.describe('with JavaScript', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/blog');
      await expect(allItems(page)).toHaveCount(N);
    });

    test('@fixtures first page: newest first, 6 of N, h2 titles, thumbnails, tag in meta row', async ({
      page,
    }) => {
      expect(N).toBeGreaterThan(PAGE_SIZE);
      await expect(shown(page)).toHaveCount(PAGE_SIZE);
      await expect(counter(page)).toHaveText(`Showing ${PAGE_SIZE} of ${N}`);
      await expect(shown(page).locator('h2')).toHaveText(FIXTURES.slice(0, PAGE_SIZE).map((a) => a.title));
      const first = shown(page).first();
      await expect(first.locator('img')).toHaveCount(1);
      await expect(first.locator('.meta')).toContainText(FIXTURES[0]!.tags[0]!);
      await expect(first.locator('.meta time')).toHaveAttribute('datetime', FIXTURES[0]!.publishedAt);
      // Cards load their thumbnails.
      expect(await first.locator('img').evaluate((el: HTMLImageElement) => el.complete)).toBe(true);
    });

    test('@fixtures cards: one external link each, no placeholders, no nested interactive elements', async ({
      page,
    }) => {
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

    test('@fixtures the whole card is clickable (stretched link covers the card)', async ({ page }) => {
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

    test('@fixtures search: title/excerpt, case-insensitive, ?q= synced, back to page 1 when cleared', async ({
      page,
    }) => {
      // "architecture" appears in the title of exactly the fixtures that are about it.
      const q = 'ARCHITECTURE';
      const expected = FIXTURES.filter((a) => a.title.toLowerCase().includes('architecture'));
      expect(expected.length).toBeGreaterThan(0);
      await search(page).fill(q);
      await expect(page).toHaveURL(new RegExp(`\\?q=${q}$`));
      await expect(shown(page).locator('h2')).toHaveText(expected.slice(0, PAGE_SIZE).map((a) => a.title));
      await expect(counter(page)).toHaveText(
        `Showing ${Math.min(expected.length, PAGE_SIZE)} of ${expected.length}`,
      );
      // Excerpts are searched too: no title contains it, every fixture excerpt does.
      await search(page).fill('exists only');
      await expect(counter(page)).toHaveText(`Showing ${PAGE_SIZE} of ${N}`);

      await search(page).fill('');
      await expect(page).toHaveURL(/\/blog$/);
      await expect(shown(page)).toHaveCount(PAGE_SIZE);
    });

    test('@fixtures ?q= is restored on load, and Back/Forward re-read the URL', async ({ page }) => {
      const title = FIXTURES[1]!.title;
      await page.goto(`/blog?q=${encodeURIComponent(title)}`);
      await expect(search(page)).toHaveValue(title);
      await expect(shown(page)).toHaveCount(1);
      await expect(shown(page).first().locator('h2')).toHaveText(title);
      await page.goto('/blog');
      await expect(search(page)).toHaveValue('');
      await page.goBack();
      await expect(search(page)).toHaveValue(title);
    });

    test('@fixtures the status region announces results after a change, and "No articles match" at 0', async ({
      page,
    }) => {
      await expect(status(page)).toHaveText(''); // nothing is spoken on load
      await search(page).fill('zzzz-no-such-article-zzzz');
      await expect(status(page)).toHaveText('No articles match your search');
      await expect(status(page)).toBeAttached();
      await search(page).fill('');
      await expect(status(page)).toHaveText(`Showing ${PAGE_SIZE} of ${N}`);
    });

    test('@fixtures other URL params survive filtering (utm_*)', async ({ page }) => {
      await page.goto('/blog?utm_source=x');
      await search(page).fill('zzz');
      await expect(page).toHaveURL(/\?utm_source=x&q=zzz$/);
      await search(page).fill('');
      await expect(page).toHaveURL(/\?utm_source=x$/);
    });

    test('@fixtures no match shows the empty state; Clear search and filters restores everything', async ({
      page,
    }) => {
      await search(page).fill('zzzz-no-such-article-zzzz');
      await expect(noMatch(page)).toBeVisible();
      await expect(shown(page)).toHaveCount(0);
      await expect(counter(page)).toBeHidden();
      await expect(more(page)).toBeHidden();
      await page.getByRole('button', { name: 'Clear search and filters' }).click();
      await expect(noMatch(page)).toBeHidden();
      await expect(search(page)).toHaveValue('');
      await expect(search(page)).toBeFocused();
      await expect(shown(page)).toHaveCount(PAGE_SIZE);
      await expect(page).toHaveURL(/\/blog$/);
    });

    test('@fixtures Load more: 6 then the rest, counter, focus on the first new card, button hides', async ({
      page,
    }) => {
      await expect(more(page)).toBeVisible();
      await expect(counter(page)).toHaveText(`Showing ${PAGE_SIZE} of ${N}`);
      await more(page).click();
      await expect(shown(page)).toHaveCount(N);
      await expect(counter(page)).toHaveText(`Showing ${N} of ${N}`);
      await expect(status(page)).toHaveText(`Showing ${N} of ${N}`);
      await expect(allItems(page).nth(PAGE_SIZE).getByRole('link')).toBeFocused();
      await expect(more(page)).toBeHidden();
    });

    test('@fixtures Load more works with the keyboard', async ({ page }) => {
      await more(page).focus();
      await page.keyboard.press('Enter');
      await expect(shown(page)).toHaveCount(N);
    });

    test('@fixtures changing the search or a tag resets pagination to the first page', async ({ page }) => {
      await more(page).click();
      await expect(shown(page)).toHaveCount(N);
      await search(page).fill('a');
      await search(page).fill('');
      await expect(shown(page)).toHaveCount(PAGE_SIZE);
      await more(page).click();
      await tagPills(page).first().click(); // All: same set, but still back to page 1
      await expect(shown(page)).toHaveCount(PAGE_SIZE);
    });

    test('@fixtures tag pills: labels only, filter, counter, URL, unknown tag -> All', async ({ page }) => {
      const pills = tagPills(page);
      await expect(pills).toHaveText(['All', ...TAGS]); // labels only, no counts
      await expect(pills.first()).toHaveAttribute('aria-pressed', 'true');

      // Every tag: matches come from the fixture front matter.
      for (const tag of TAGS) {
        const expected = withTag(tag);
        await tagPills(page)
          .filter({ hasText: new RegExp(`^${tag}$`) })
          .click();
        await expect(tagPills(page).filter({ hasText: new RegExp(`^${tag}$`) })).toHaveAttribute(
          'aria-pressed',
          'true',
        );
        await expect(pills.first()).toHaveAttribute('aria-pressed', 'false');
        await expect(shown(page).locator('h2')).toHaveText(expected.slice(0, PAGE_SIZE).map((a) => a.title));
        await expect(counter(page)).toHaveText(
          `Showing ${Math.min(expected.length, PAGE_SIZE)} of ${expected.length}`,
        );
        await expect(page).toHaveURL(new RegExp(`\\?tag=${tag}$`));
      }

      // Tag + search combine.
      await search(page).fill('zzzz');
      await expect(noMatch(page)).toBeVisible();
      await expect(page).toHaveURL(/\?tag=[^&]+&q=zzzz$/);

      await page.goto(`/blog?tag=${TAGS[0]!.toUpperCase()}`); // case-insensitive
      await expect(tagPills(page).nth(1)).toHaveAttribute('aria-pressed', 'true');

      await page.goto('/blog?tag=definitely-not-a-tag');
      await expect(tagPills(page).first()).toHaveAttribute('aria-pressed', 'true');
      await expect(shown(page)).toHaveCount(PAGE_SIZE);
      await expect(page).toHaveURL(/\/blog$/);
    });

    test('@fixtures no axe violations: populated, filtered, expanded', async ({ page }) => {
      const run = async (label: string) =>
        expect(
          (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze())
            .violations,
          label,
        ).toEqual([]);
      await run('populated');
      await tagPills(page).nth(1).click();
      await run('tag filtered');
      await search(page).fill('zzzz');
      await run('no match');
      await page.goto('/blog');
      await more(page).click();
      await run('expanded');
    });

    test('@fixtures no horizontal overflow at 320px with cards', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto('/blog');
      await expect(shown(page)).toHaveCount(PAGE_SIZE);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      ).toBeLessThanOrEqual(0);
    });

    test('@fixtures the Medium profile link is a safe external link', async ({ page }) => {
      const link = page.locator('main').getByRole('link', { name: /Medium profile/ });
      await expect(link).toHaveAttribute('href', 'https://example.com/medium/example');
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });
});
