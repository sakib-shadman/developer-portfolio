import { describe, expect, it } from 'vitest';
import { checkSite, idsOf, resolvePath } from '../../src/lib/link-check';

const ORIGIN = 'https://example.web.app';
const page = (body: string, head = '') =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

function site(pages: Record<string, string>, extra: string[] = [], xml: Record<string, string> = {}) {
  return checkSite({
    files: new Set([...Object.keys(pages), ...extra]),
    html: new Map(Object.entries(pages)),
    xml: new Map(Object.entries(xml)),
    origin: ORIGIN,
  });
}
const kinds = (issues: { kind: string }[]) => issues.map((i) => i.kind);

describe('resolvePath (firebase cleanUrls)', () => {
  const files = new Set(['index.html', 'about.html', 'projects/a.html', 'rss.xml', '_astro/x.js']);
  it('maps clean URLs to built files', () => {
    expect(resolvePath('/', files)).toBe('index.html');
    expect(resolvePath('/about', files)).toBe('about.html');
    expect(resolvePath('/projects/a', files)).toBe('projects/a.html');
    expect(resolvePath('/rss.xml', files)).toBe('rss.xml');
    expect(resolvePath('/_astro/x.js', files)).toBe('_astro/x.js');
    expect(resolvePath('/nope', files)).toBeUndefined();
    expect(resolvePath('/%E0%A4%A', files)).toBeUndefined();
  });
});

describe('idsOf', () => {
  it('collects id and name attributes', () => {
    expect([...idsOf('<h2 id="a"></h2><a name=\'b\'></a>')]).toEqual(['a', 'b']);
  });
});

describe('checkSite', () => {
  it('accepts a healthy site', () => {
    const issues = site(
      {
        'index.html': page(
          '<a href="/about">About</a> <a href="/about#team">Team</a> <a href="#main">Skip</a> <main id="main"></main>' +
            '<a href="mailto:a@b.co">mail</a> <a href="https://github.com/x" target="_blank" rel="noopener noreferrer">gh</a>' +
            '<img src="/_astro/p.webp" srcset="/_astro/p.webp 1x, /_astro/p2.webp 2x"><script src="/_astro/s.js"></script>',
          `<link rel="canonical" href="${ORIGIN}/"><meta property="og:image" content="${ORIGIN}/og/default.png">`,
        ),
        'about.html': page('<h2 id="team">Team</h2>'),
      },
      ['_astro/p.webp', '_astro/p2.webp', '_astro/s.js', 'og/default.png'],
    );
    expect(issues).toEqual([]);
  });

  it('reports broken internal links, assets and anchors', () => {
    const issues = site({
      'index.html': page(
        '<a href="/missing">x</a><a href="/about#nope">y</a><a href="#ghost">z</a><img src="/_astro/gone.png">',
      ),
      'about.html': page('<h2 id="team"></h2>'),
    });
    expect(kinds(issues).sort()).toEqual(['broken-anchor', 'broken-anchor', 'broken-asset', 'broken-link']);
  });

  it('ignores query strings when resolving', () => {
    expect(
      site({ 'index.html': page('<a href="/about?utm_source=x">a</a>'), 'about.html': page('') }),
    ).toEqual([]);
  });

  it('enforces the external-link policy', () => {
    const bad = site({
      'index.html': page(
        [
          '<a href="https://a.example/x">no target</a>',
          '<a href="https://b.example/x" target="_blank" rel="noopener">no noreferrer</a>',
          '<a href="http://c.example/x" target="_blank" rel="noopener noreferrer">http</a>',
          `<a href="${ORIGIN}/about" target="_blank" rel="noopener noreferrer">own origin</a>`,
          '<a href="javascript:alert(1)">js</a>',
          '<a href="//evil.example">proto-relative</a>',
          '<a href="/about" target="_blank">internal new tab without noopener</a>',
        ].join(''),
      ),
      'about.html': page(''),
    });
    expect(kinds(bad)).toEqual(Array(bad.length).fill('policy'));
    expect(bad).toHaveLength(7); // no target, no noreferrer, http, own origin, javascript:, //host, internal _blank
  });

  it('rejects relative asset paths and unresolved own-origin URLs', () => {
    const issues = site(
      {
        'index.html': page(
          '<img src="img/a.png">',
          `<link rel="canonical" href="${ORIGIN}/gone"><meta property="og:image" content="${ORIGIN}/og/x.png">`,
        ),
      },
      [],
      { 'sitemap-0.xml': `<urlset><url><loc>${ORIGIN}/also-gone</loc></url></urlset>` },
    );
    expect(issues.map((i) => i.kind).sort()).toEqual(['broken-url', 'broken-url', 'broken-url', 'policy']);
  });

  it('does not resolve URLs on other origins', () => {
    expect(
      site({ 'index.html': page('', '<meta property="og:image" content="https://cdn.example/x.png">') }),
    ).toEqual([]);
  });

  it('decodes entities in attributes', () => {
    expect(
      site({
        'index.html': page(
          '<a href="https://a.example/?x=1&amp;y=2" target="_blank" rel="noopener noreferrer">q</a>',
        ),
      }),
    ).toEqual([]);
  });
});
