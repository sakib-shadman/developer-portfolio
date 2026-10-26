import AxeBuilder from '@axe-core/playwright';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { test, expect } from '@playwright/test';

// Runs against shipped and drafts builds, so it must not assume any articles exist.
test('@smoke /rss.xml is a well-formed RSS 2.0 feed served as RSS', async ({ request }) => {
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
  expect(doc.rss.channel.link).toBeTruthy();
  expect(doc.rss.channel.description).toBeTruthy();
  // Items (if any) link to the originals and carry a permalink guid; never full text.
  expect(xml).not.toContain('content:encoded');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped parsed XML
  for (const item of [doc.rss.channel.item ?? []].flat() as Record<string, any>[]) {
    expect(item.guid['#text']).toBe(item.link);
    expect(item.guid['@_isPermaLink']).toBe('true');
  }
});

test('@smoke footer links to the feed and the head advertises it', async ({ page }) => {
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
