import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { ArticleCard, Profile } from '../../src/lib/content/types';

const state = vi.hoisted(() => ({ profile: undefined as unknown, articles: [] as unknown[] }));
vi.mock('../../src/lib/content/queries', async () => {
  const { composeHomeSections } = await import('../../src/lib/home');
  return {
    getProfile: async () => state.profile,
    getArticles: async () => state.articles,
    getHomeSections: async () => composeHomeSections({ skillGroups: [], experience: [] }),
  };
});

import Blog from '../../src/pages/blog/index.astro';

const profile: Profile = {
  name: 'Ada Lovelace',
  title: 'Engineer',
  headline: 'h',
  intro: 'i',
  focus: [],
  links: { medium: 'https://medium.com/@ada' },
  stats: [],
  bio: [],
  principles: [],
  expertise: [],
  community: [],
  interests: [],
};
const article = (n: number, extra: Partial<ArticleCard> = {}): ArticleCard => ({
  id: `a${n}`,
  title: `Article ${n}`,
  url: `https://medium.com/@ada/a${n}`,
  publishedAt: new Date(Date.UTC(2026, 0, n)),
  tags: [],
  featured: false,
  ...extra,
});

let c: AstroContainer;
beforeAll(async () => {
  c = await AstroContainer.create();
});
async function render(articles: ArticleCard[], p: Profile = profile): Promise<string> {
  state.profile = p;
  state.articles = articles;
  return c.renderToString(Blog);
}
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

describe('/blog page', () => {
  it('renders one h1, breadcrumbs and the Medium profile link', async () => {
    const html = await render([article(1)]);
    expect(count(html, /<h1\b/g)).toBe(1);
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('href="https://medium.com/@ada"');
    expect(html).toContain('Medium profile');
  });

  it('omits the Medium profile link when unset or unsafe', async () => {
    for (const medium of [undefined, 'javascript:alert(1)']) {
      const html = await render([article(1)], { ...profile, links: medium ? { medium } : {} });
      expect(html).not.toContain('Medium profile');
      expect(html).not.toContain('javascript:');
    }
  });

  it('empty state: copy, profile link, and no list, controls, counter or script', async () => {
    const html = await render([]);
    expect(html).toContain('No articles yet');
    expect(html).toContain("New writing will appear here once it's published on Medium.");
    expect(html).toContain('Medium profile');
    for (const absent of [
      'data-grid',
      'data-controls',
      'data-counter',
      'data-status',
      'Filter by topic',
      'blog-search',
      'Load more',
      'No articles match',
      '<script',
    ])
      expect(html).not.toContain(absent);
  });

  it('empty state without a profile link has no links in the page body', async () => {
    const html = await render([], { ...profile, links: {} });
    expect(html).toContain('No articles yet');
    expect(html).not.toContain('Medium profile');
  });

  it('many articles: all server-rendered with h2 titles, counter, hidden controls and one script', async () => {
    const html = await render(Array.from({ length: 9 }, (_, i) => article(i + 1)));
    expect(count(html, /<article\b/g)).toBe(9);
    expect(count(html, /<h2[^>]*id="blog-a\d"/g)).toBe(9);
    expect(count(html, /<h3\b/g)).toBe(0);
    expect(html).toMatch(/data-counter-shown[^>]*>\s*9\s*</);
    expect(html).toContain('of 9');
    // One always-present status region, outside the (hideable) footer; the visual counter is plain text.
    expect(count(html, /role="status"/g)).toBe(1);
    expect(html).toMatch(/<p[^>]*class="sr-only"[^>]*role="status"[^>]*data-status/);
    expect(html).not.toContain('aria-live');
    expect(html.indexOf('data-status')).toBeLessThan(html.indexOf('data-footer'));
    expect(html).toMatch(/data-controls[^>]*\shidden/);
    expect(html).toMatch(/data-more[^>]*\shidden/);
    expect(html).toMatch(/data-empty[^>]*\shidden/);
    expect(html).toContain('No articles match your search');
    expect(html).toContain('Clear search and filters');
    expect(html).toContain('Load more articles');
    expect(count(html, /<script\b/g)).toBeGreaterThanOrEqual(1);
  });

  it('search input has a label', async () => {
    const html = await render([article(1)]);
    expect(html).toMatch(/<label[^>]*for="blog-search"[^>]*>\s*Search articles/);
    expect(html).toMatch(
      /<input[^>]*id="blog-search"[^>]*type="search"|<input[^>]*type="search"[^>]*id="blog-search"/,
    );
  });

  it('tag row: pills with counts when articles have tags; none when no article does', async () => {
    const tagged = await render([
      article(1, { tags: ['Flutter', 'Dart'] }),
      article(2, { tags: ['Flutter'] }),
      article(3),
    ]);
    expect(tagged).toContain('aria-label="Filter by topic"');
    expect(count(tagged, /data-filter-group="blog-tag"/g)).toBe(3); // All, Dart, Flutter
    expect(tagged).not.toContain('class="count"'); // labels only, per the design
    expect(tagged).toMatch(
      /data-filter="\*"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-filter="\*"/,
    );
    const untagged = await render([article(1), article(2)]);
    expect(untagged).not.toContain('Filter by topic');
    expect(untagged).toContain('blog-search');
  });

  it('cards carry the data the script searches; tags with quotes stay escaped', async () => {
    const html = await render([article(1, { excerpt: 'About "quotes"', tags: ['C++ "x"'] })]);
    expect(html).toContain('data-title="Article 1"');
    expect(html).toContain('data-excerpt="About &quot;quotes&quot;"');
    expect(html).not.toContain('data-excerpt="About "quotes""');
    expect(html).toContain('data-tags="[&quot;C++ \\&quot;x\\&quot;&quot;]"'); // JSON survives the attribute
  });

  it('thumbnail and no-thumbnail cards render side by side', async () => {
    const html = await render([
      article(1, {
        thumbnail: {
          src: { src: '/t.jpg', width: 800, height: 400, format: 'jpg' },
          width: 800,
          height: 400,
          alt: 'Cover',
        },
      }),
      article(2),
    ]);
    expect(count(html, /<img\b/g)).toBe(1);
    expect(count(html, /class="[^"]*glyph/g)).toBe(1);
  });
});
