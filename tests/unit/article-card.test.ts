import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import ArticleCardView from '../../src/components/blog/ArticleCard.astro';
import type { ArticleCard } from '../../src/lib/content/types';

let c: AstroContainer;
beforeAll(async () => {
  c = await AstroContainer.create();
});

const base: ArticleCard = {
  id: 'riverpod',
  title: 'Riverpod in practice',
  url: 'https://medium.com/@ada/riverpod',
  publishedAt: new Date('2026-05-14T00:00:00Z'),
  tags: [],
  featured: false,
};
const render = (article: Partial<ArticleCard>, props: Record<string, unknown> = {}) =>
  c.renderToString(ArticleCardView, { props: { article: { ...base, ...article }, ...props } });

describe('ArticleCard', () => {
  it('renders the minimum: meta date, title, external pill; no excerpt/tag/img', async () => {
    const html = await render({});
    expect(html).toContain('May 14, 2026');
    expect(html).not.toContain('min read');
    expect(html).toContain('Riverpod in practice');
    expect(html).toContain('Read on Medium');
    for (const absent of ['class="tag"', '<img', 'excerpt']) expect(html).not.toContain(absent);
  });

  it('shows reading time and excerpt', async () => {
    const html = await render({ readingMinutes: 9, excerpt: 'Short summary.' });
    expect(html).toContain('May 14, 2026 · ≈ 9 min read');
    expect(html).toContain('datetime="2026-05-14"');
    expect(html).toContain('Short summary.');
  });

  it('tags \'meta\' (default): first tag in accent in the meta row, "+N" for the rest, no chip list', async () => {
    const one = await render({ tags: ['Flutter'] });
    expect(one).toMatch(/<span class="tag"[^>]*>\s*Flutter\s*<\/span>/);
    expect(one).not.toContain('+');
    const many = await render({ tags: ['Flutter', 'Dart', 'iOS'] });
    expect(many).toMatch(/<span class="tag"[^>]*>\s*Flutter \+2\s*<\/span>/);
    expect(many).not.toContain('Dart');
    expect(many).not.toContain('class="chips');
  });

  it('shows the tag even when date and reading time are unknown', async () => {
    const html = await render({ publishedAt: new Date('invalid'), tags: ['Dart'] });
    expect(html).toMatch(/class="meta"/);
    expect(html).toContain('Dart');
  });

  it("tags 'none' hides tags (home slider)", async () => {
    const html = await render({ tags: ['Flutter', 'Dart'] }, { tags: 'none' });
    expect(html).not.toContain('Flutter');
    expect(html).not.toContain('class="tag"');
  });

  it('omits an unknown date instead of printing a placeholder', async () => {
    const html = await render({ publishedAt: new Date('invalid'), readingMinutes: 3 });
    expect(html).toContain('≈ 3 min read');
    expect(html).not.toContain('<time');
    expect(html).not.toContain('Invalid');
  });

  it('opens Medium safely in a new tab with a single link', async () => {
    const html = await render({});
    expect(html.match(/<a\b/g)).toHaveLength(1);
    expect(html).toContain('href="https://medium.com/@ada/riverpod"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('opens in a new tab');
    expect(html).not.toContain('<button');
  });

  it('renders no link for an unsafe URL', async () => {
    const html = await render({ url: 'javascript:alert(1)' });
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<a ');
  });

  it('uses astro:assets for a thumbnail with responsive sizes and its alt text', async () => {
    const html = await render({
      thumbnail: {
        src: { src: '/t.jpg', width: 1200, height: 630, format: 'jpg' },
        width: 1200,
        height: 630,
        alt: 'Cover art',
      },
    });
    expect(html).toContain('<img');
    expect(html).toContain('alt="Cover art"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('sizes=');
    expect(html).not.toContain('class="glyph"');
  });

  it('uses a decorative glyph (no text) without a thumbnail', async () => {
    const html = await render({});
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/\[Thumbnail\]/);
  });

  it('labels the card by its heading and honours level and idPrefix', async () => {
    const html = await render({}, { headingLevel: 'h2', idPrefix: 'blog' });
    expect(html).toMatch(/<h2[^>]*id="blog-riverpod"/);
    expect(html).toContain('aria-labelledby="blog-riverpod"');
    expect(html).toContain('aria-describedby="blog-riverpod"');
    expect(await render({})).toMatch(/<h3[^>]*id="article-riverpod"/);
  });

  it('is an <article> so it can sit in a slider track', async () => {
    expect(await render({})).toMatch(/<article\b/);
  });
});
