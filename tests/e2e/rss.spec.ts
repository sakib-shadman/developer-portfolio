import AxeBuilder from '@axe-core/playwright';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { test, expect } from '@playwright/test';

// Runs against shipped and drafts builds, so it must not assume any articles exist.
test('@smoke @any-content /rss.xml is a well-formed RSS 2.0 feed served as RSS', async ({ request }) => {
  const res = await request.get('/rss.xml');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/rss+xml');
  const xml = await res.text();
  expect(XMLValidator.validate(xml)).toBe(true);
  const doc = new XMLParser({ ignoreAttributes: false }).parse(xml) as {
    rss: { '@_version': string; channel: Record<string, unknown> };
  };
  expect(doc.rss['@_version']).toBe('2.0');
  expect(doc.rss.channel.title).toBeTruthy();
  expect(String(doc.rss.channel.link)).toMatch(/\/blog$/);
  expect(doc.rss.channel.description).toBeTruthy();
  // Items (if any) link to the originals and carry a permalink guid; never full text.
  expect(xml).not.toContain('content:encoded');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped parsed XML
  for (const item of [doc.rss.channel.item ?? []].flat() as Record<string, any>[]) {
    expect(item.guid['#text']).toBe(item.link);
    expect(item.guid['@_isPermaLink']).toBe('true');
  }
});

test('@smoke @any-content footer links to the feed and the head advertises it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'RSS' })).toHaveAttribute(
    'href',
    '/rss.xml',
  );
  await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute(
    'href',
    '/rss.xml',
  );
});

test('axe stays clean with the footer RSS link', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

// ---- @fixtures: 9 fictional articles in tests/fixtures/content/articles (expectations read from them) ----
interface Fixture {
  title: string;
  url: string;
  publishedAt: string;
  excerpt?: string;
  tags: string[];
}
function fixtures(): Fixture[] {
  const dir = 'tests/fixtures/content/articles';
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const fm = parseYaml(readFileSync(join(dir, f), 'utf8').split('---')[1] ?? '') as {
        title: string;
        url: string;
        publishedAt: Date | string;
        excerpt?: string;
        tags?: string[];
      };
      const at = fm.publishedAt;
      return {
        title: fm.title,
        url: fm.url,
        publishedAt: at instanceof Date ? at.toISOString().slice(0, 10) : String(at),
        excerpt: fm.excerpt,
        tags: fm.tags ?? [],
      };
    })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.title.localeCompare(b.title));
}

test('@fixtures /rss.xml lists every fixture article newest first with canonical links and excerpts only', async ({
  request,
}) => {
  const expected = fixtures();
  expect(expected).toHaveLength(9);
  const xml = await (await request.get('/rss.xml')).text();
  expect(XMLValidator.validate(xml)).toBe(true);
  const doc = new XMLParser({ ignoreAttributes: false }).parse(xml) as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped parsed XML
    rss: { channel: { item: Record<string, any>[] } };
  };
  const items = doc.rss.channel.item;
  expect(items).toHaveLength(9);
  expect(items.map((i) => i.title)).toEqual(expected.map((a) => a.title));
  expected.forEach((a, i) => {
    const item = items[i]!;
    expect(item.link, a.title).toBe(a.url);
    expect(item.guid['#text']).toBe(a.url);
    expect(item.guid['@_isPermaLink']).toBe('true');
    expect(item.description).toBe(a.excerpt);
    expect([item.category ?? []].flat()).toEqual(a.tags);
    expect(new Date(item.pubDate).toISOString().slice(0, 10)).toBe(a.publishedAt);
  });
  expect(xml).not.toContain('content:encoded');
});
