import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MAX_PATH_CHARS, requestedPath } from '../../src/lib/notfound';

const state = vi.hoisted(() => ({ profile: undefined as unknown }));
vi.mock('../../src/lib/content/queries', async () => {
  const { composeHomeSections } = await import('../../src/lib/home');
  return {
    getProfile: async () => state.profile,
    getSkillGroups: async () => [],
    getHomeSections: async () => composeHomeSections({ skillGroups: [], experience: [] }),
  };
});

import NotFound from '../../src/pages/404.astro';
import Seo from '../../src/components/layout/Seo.astro';

state.profile = {
  name: 'Ada Lovelace',
  title: 'Engineer',
  headline: 'h',
  intro: 'i',
  focus: [],
  links: {},
  stats: [],
  bio: [],
  principles: [],
  expertise: [],
  community: [],
  interests: [],
};

let c: AstroContainer;
beforeAll(async () => {
  c = await AstroContainer.create();
});
afterEach(() => vi.unstubAllEnvs());

describe('requestedPath decoding', () => {
  it('decodes percent-escapes for display', () => {
    expect(requestedPath('/caf%C3%A9/%C3%B1')).toBe('/café/ñ');
  });
  it('falls back to the raw value on a malformed escape', () => {
    expect(requestedPath('/%E0%A4%A')).toBe('/%E0%A4%A');
  });
  it('truncates after decoding without splitting a surrogate pair', () => {
    const p = '/' + '%F0%9F%98%80'.repeat(100); // 100 emoji = 200 UTF-16 units
    const out = requestedPath(p);
    expect(Array.from(out)).toHaveLength(MAX_PATH_CHARS);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/);
  });
  it('strips control and bidi-override characters', () => {
    expect(requestedPath('/a%00b%E2%80%AEc')).toBe('/abc');
    expect(requestedPath('/%00')).toBe('/');
  });
});

describe('requestedPath', () => {
  it('passes short paths, truncates long ones, never returns empty', () => {
    expect(requestedPath('/nope')).toBe('/nope');
    expect(requestedPath('')).toBe('/');
    const long = requestedPath('/' + 'a'.repeat(500));
    expect(long).toHaveLength(MAX_PATH_CHARS);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('404 page', () => {
  it('renders the designed content with one h1 and links to existing routes only', async () => {
    const html = await c.renderToString(NotFound, { request: new Request('http://localhost/404') });
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>This page doesn(&#39;|')t exist\.<\/h1>/);
    expect(html).toContain('Error 404');
    expect(html).toContain('Page not found — Ada Lovelace');
    const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
    const hrefs = [...main.matchAll(/<a[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(['/', '/projects', '/contact']);
    expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"/);
    expect(html).not.toContain('rel="canonical"');
  });

  it('requested-path line ships hidden until the script fills it (no path in static HTML)', async () => {
    const html = await c.renderToString(NotFound, { request: new Request('http://localhost/404') });
    expect(html).toMatch(/<pre[^>]*aria-hidden="true"[^>]*\bhidden\b[^>]*data-requested/);
  });
});

describe('Seo noindex prop', () => {
  const seo = (props: Record<string, unknown>) =>
    c.renderToString(Seo, {
      props: { title: 'T', description: 'D', path: '/x', ...props },
      request: new Request('http://localhost/x'),
    });

  it('noindex wins even when the site is indexable', async () => {
    vi.stubEnv('PUBLIC_INDEXABLE', 'true');
    const html = await seo({ noindex: true });
    expect(html).toContain('name="robots" content="noindex, nofollow"');
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('og:url');
  });

  it('indexable site without the prop: no robots tag, canonical present', async () => {
    vi.stubEnv('PUBLIC_INDEXABLE', 'true');
    const html = await seo({});
    expect(html).not.toContain('name="robots"');
    expect(html).toContain('rel="canonical"');
  });

  it('non-indexable site still emits noindex and canonical (unchanged behaviour)', async () => {
    vi.stubEnv('PUBLIC_INDEXABLE', 'false');
    const html = await seo({});
    expect(html).toContain('name="robots" content="noindex, nofollow"');
    expect(html).toContain('rel="canonical"');
  });
});
