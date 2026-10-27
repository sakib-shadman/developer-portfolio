import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import Seo from '../../src/components/layout/Seo.astro';

let c: AstroContainer;
beforeAll(async () => {
  c = await AstroContainer.create();
});
const seo = (props: Record<string, unknown>) =>
  c.renderToString(Seo, {
    props: { title: 'Page — Ada', description: 'About the page.', path: '/page', ...props },
    request: new Request('http://localhost/page'),
  });
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

describe('<Seo>', () => {
  it('emits one title, description, canonical and the full OG + Twitter set with the default image', async () => {
    const html = await seo({ siteName: 'Ada' });
    expect(count(html, /<title>/g)).toBe(1);
    expect(html).toContain('<title>Page — Ada</title>');
    expect(count(html, /name="description"/g)).toBe(1);
    expect(count(html, /rel="canonical"/g)).toBe(1);
    expect(html).toContain('href="http://localhost:4321/page"');
    for (const tag of [
      'property="og:type" content="website"',
      'property="og:title" content="Page — Ada"',
      'property="og:description" content="About the page."',
      'property="og:url" content="http://localhost:4321/page"',
      'property="og:site_name" content="Ada"',
      'property="og:image" content="http://localhost:4321/og/default.png"',
      'property="og:image:width" content="1200"',
      'property="og:image:height" content="630"',
      'name="twitter:card" content="summary_large_image"',
      'name="twitter:title" content="Page — Ada"',
      'name="twitter:description" content="About the page."',
      'name="twitter:image" content="http://localhost:4321/og/default.png"',
    ])
      expect(html, tag).toContain(tag);
  });

  it('uses a per-page image and alt text when given', async () => {
    const html = await seo({ image: '/og/projects/lms.png', imageAlt: 'LMS case study' });
    expect(html).toContain('property="og:image" content="http://localhost:4321/og/projects/lms.png"');
    expect(html).toContain('property="og:image:alt" content="LMS case study"');
  });

  it('truncates long descriptions to 160 characters in every tag', async () => {
    const html = await seo({ description: 'long '.repeat(100) });
    const [, d] = html.match(/name="description" content="([^"]*)"/) ?? [];
    expect(d?.length).toBeLessThanOrEqual(160);
    expect(html).toContain(`property="og:description" content="${d}"`);
  });

  it('normalises the canonical of a .html pathname and the home route', async () => {
    expect(await seo({ path: '/index.html' })).toContain('rel="canonical" href="http://localhost:4321/"');
    expect(await seo({ path: '/about.html' })).toContain('href="http://localhost:4321/about"');
  });

  it('the 404 page has no canonical and no og:url', async () => {
    const html = await seo({ noindex: true });
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('og:url');
    expect(html).toContain('name="robots" content="noindex, nofollow"');
  });

  it('renders each JSON-LD block as an inert, parseable script with "<" escaped', async () => {
    const html = await seo({
      jsonLd: [
        { '@context': 'https://schema.org', '@type': 'Person', name: '</script><b>x' },
        { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [] },
      ],
    });
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)];
    expect(blocks).toHaveLength(2);
    expect(JSON.parse(blocks[0]![1]!)).toMatchObject({ name: '</script><b>x' });
    expect(blocks[0]![1]).not.toContain('<');
  });

  it('no JSON-LD script when none is given', async () => {
    expect(await seo({})).not.toContain('ld+json');
  });
});
