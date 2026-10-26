import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArticleCard } from '../../src/lib/content/types';
import { buildFeedItems } from '../../src/lib/rss';

const state = vi.hoisted(() => ({ articles: [] as unknown[] }));
vi.mock('../../src/lib/content/queries', () => ({
  getProfile: async () => ({ name: 'Ada Lovelace', title: 'Engineer' }),
  getArticles: async () => state.articles,
}));
import { GET } from '../../src/pages/rss.xml';

const article = (over: Partial<ArticleCard> = {}): ArticleCard => ({
  id: 'a',
  title: 'Flutter render pipeline',
  url: 'https://medium.com/@ada/flutter-render-pipeline-abc123',
  publishedAt: new Date('2026-03-04T10:00:00Z'),
  tags: [],
  featured: false,
  ...over,
});

describe('buildFeedItems', () => {
  it('maps title, canonical link and date; omits optional fields when absent', () => {
    expect(buildFeedItems([article()])).toEqual([
      {
        title: 'Flutter render pipeline',
        link: 'https://medium.com/@ada/flutter-render-pipeline-abc123',
        pubDate: new Date('2026-03-04T10:00:00Z'),
      },
    ]);
  });
  it('adds the excerpt as description and tags as categories only when present', () => {
    const [item] = buildFeedItems([
      article({ excerpt: 'How Flutter draws a frame.', tags: ['flutter', 'dart'] }),
    ]);
    expect(item).toMatchObject({
      description: 'How Flutter draws a frame.',
      categories: ['flutter', 'dart'],
    });
  });
  it('keeps order and copies the tags array', () => {
    const tags = ['x'];
    const items = buildFeedItems([article({ id: '1', tags }), article({ id: '2', title: 'Second' })]);
    expect(items.map((i) => i.title)).toEqual(['Flutter render pipeline', 'Second']);
    expect(items[0]!.categories).not.toBe(tags);
    expect(buildFeedItems([])).toEqual([]);
  });
});

const site = new URL('https://portfolio.example/');
async function feed(articles: ArticleCard[]) {
  state.articles = articles;
  const res = await GET({ site } as never);
  return { res, xml: await res.text() };
}
const parse = (xml: string) =>
  new XMLParser({ ignoreAttributes: false, processEntities: true }).parse(xml) as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped parsed XML
    rss: { channel: Record<string, any> };
  };

describe('GET /rss.xml', () => {
  beforeEach(() => {
    state.articles = [];
  });

  it('is served as RSS with a well-formed, valid-when-empty channel (FR-15.5)', async () => {
    const { res, xml } = await feed([]);
    expect(res.headers.get('content-type')).toBe('application/rss+xml; charset=utf-8');
    expect(XMLValidator.validate(xml)).toBe(true);
    const { channel } = parse(xml).rss;
    expect(channel.title).toBe('Ada Lovelace — Articles');
    expect(channel.link).toBe('https://portfolio.example/');
    expect(channel.description).toContain('original on Medium');
    expect(channel.language).toBe('en');
    expect(channel['atom:link']['@_href']).toBe('https://portfolio.example/rss.xml');
    expect(channel.item).toBeUndefined();
  });

  it('emits guid = canonical URL (isPermaLink), pubDate, categories and excerpt only', async () => {
    const { xml } = await feed([
      article({ excerpt: 'Short excerpt.', tags: ['flutter', 'dart'] }),
      article({ id: 'b', title: 'No excerpt', url: 'https://medium.com/@ada/no-excerpt-def456' }),
    ]);
    expect(XMLValidator.validate(xml)).toBe(true);
    const items = [parse(xml).rss.channel.item].flat();
    expect(items).toHaveLength(2);
    expect(items[0].link).toBe('https://medium.com/@ada/flutter-render-pipeline-abc123');
    expect(items[0].guid['#text']).toBe(items[0].link);
    expect(items[0].guid['@_isPermaLink']).toBe('true');
    expect(items[0].pubDate).toBe('Wed, 04 Mar 2026 10:00:00 GMT');
    expect(items[0].description).toBe('Short excerpt.');
    expect(items[0].category).toEqual(['flutter', 'dart']);
    expect(items[1].description).toBeUndefined();
    expect(items[1].category).toBeUndefined();
    expect(xml).not.toContain('content:encoded');
  });

  it('escapes markup characters in titles, excerpts and tags', async () => {
    const nasty = `Tom & Jerry <script>alert("x")</script> 'quoted'`;
    const { xml } = await feed([article({ title: nasty, excerpt: `a < b && c > d "e"`, tags: ['r&d'] })]);
    expect(XMLValidator.validate(xml)).toBe(true);
    expect(xml).not.toContain('<script>');
    expect(xml).not.toMatch(/<title>[^<]*<script/);
    const item = parse(xml).rss.channel.item;
    expect(item.title).toBe(nasty);
    expect(item.description).toBe(`a < b && c > d "e"`);
    expect(item.category).toBe('r&d');
  });
});
