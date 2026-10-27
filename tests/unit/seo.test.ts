import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { blogLd, breadcrumbLd, personLd, profilePersonLd, serializeJsonLd } from '../../src/lib/seo/jsonld';
import { defaultCard, ogTree, projectCard, titleSize, type OgNode } from '../../src/lib/seo/og';
import { renderOgPng } from '../../src/lib/seo/og-render';
import { isSitemapPage } from '../../src/lib/seo/sitemap';
import {
  DEFAULT_OG_PATH,
  aboutDescription,
  absoluteUrl,
  canonicalPath,
  projectOgPath,
  seoDescription,
} from '../../src/lib/seo/text';

const SITE = 'https://example.web.app';

describe('seoDescription', () => {
  it('keeps short text and collapses whitespace', () => {
    expect(seoDescription('  Hello \n  world  ')).toBe('Hello world');
  });
  it('cuts at a word boundary with an ellipsis, within 160 chars', () => {
    const long = 'word '.repeat(60);
    const out = seoDescription(long);
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith('…')).toBe(true);
    expect(out.endsWith(' …')).toBe(false);
    expect(out).toMatch(/word…$/);
  });
  it('hard-cuts a single long token and never leaves trailing punctuation before the ellipsis', () => {
    expect(seoDescription('x'.repeat(300))).toHaveLength(160);
    expect(seoDescription(`${'a '.repeat(70)}b,`.replace(/ $/, ''), 20)).toMatch(/a…$/);
  });
});

describe('paths and URLs', () => {
  it('normalises routes', () => {
    expect(canonicalPath('')).toBe('/');
    expect(canonicalPath('/')).toBe('/');
    expect(canonicalPath('/index.html')).toBe('/');
    expect(canonicalPath('/about.html')).toBe('/about');
    expect(canonicalPath('/projects/')).toBe('/projects');
    expect(canonicalPath('projects/x')).toBe('/projects/x');
    expect(canonicalPath('/projects/x.html')).toBe('/projects/x');
  });
  it('builds absolute URLs against the site', () => {
    expect(absoluteUrl('/blog/', SITE)).toBe(`${SITE}/blog`);
    expect(absoluteUrl('/', new URL(SITE))).toBe(`${SITE}/`);
    expect(absoluteUrl(DEFAULT_OG_PATH, SITE)).toBe(`${SITE}/og/default.png`);
    expect(projectOgPath('lms')).toBe('/og/projects/lms.png');
  });
});

describe('personLd', () => {
  it('emits only fields that exist', () => {
    expect(personLd({ name: 'Ada' }, SITE)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Person',
      '@id': `${SITE}/#person`,
      name: 'Ada',
      url: `${SITE}/`,
    });
  });
  it('adds jobTitle, https sameAs only, and an absolute image', () => {
    const ld = personLd(
      {
        name: 'Ada',
        jobTitle: 'Engineer',
        links: {
          github: 'https://github.com/ada',
          linkedin: undefined,
          medium: 'http://insecure.example',
          other: 'javascript:alert(1)',
          bad: 'not a url',
        },
        image: '/_astro/me.abc.jpg',
      },
      SITE,
    );
    expect(ld).toMatchObject({
      jobTitle: 'Engineer',
      sameAs: ['https://github.com/ada'],
      image: `${SITE}/_astro/me.abc.jpg`,
    });
  });
  it('omits sameAs when no usable link exists', () => {
    expect(personLd({ name: 'Ada', links: { github: undefined } }, SITE)).not.toHaveProperty('sameAs');
  });
  it('maps a profile (photo only when present)', () => {
    const base = { name: 'Ada', title: 'Eng', links: { github: 'https://github.com/ada' } };
    expect(profilePersonLd(base, SITE)).not.toHaveProperty('image');
    expect(profilePersonLd({ ...base, photo: { src: { src: '/p.jpg' } } }, SITE)).toHaveProperty(
      'image',
      `${SITE}/p.jpg`,
    );
  });
});

describe('breadcrumbLd', () => {
  it('numbers items and links the last one to the current page', () => {
    const ld = breadcrumbLd(
      [{ label: 'Home', href: '/' }, { label: 'Projects', href: '/projects' }, { label: 'LMS' }],
      '/projects/lms',
      SITE,
    ) as { itemListElement: { position: number; name: string; item: string }[] };
    expect(ld.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Projects', item: `${SITE}/projects` },
      { '@type': 'ListItem', position: 3, name: 'LMS', item: `${SITE}/projects/lms` },
    ]);
  });
});

describe('blogLd', () => {
  const input = { name: 'Writing', description: 'd' };
  it('lists links to the Medium originals as an ItemList, never BlogPosting', () => {
    const ld = blogLd(
      {
        ...input,
        articles: [
          { title: 'A', url: 'https://medium.com/@ada/a' },
          { title: 'Bad', url: 'javascript:alert(1)' },
          { title: 'B', url: 'https://medium.com/@ada/b' },
        ],
      },
      SITE,
    );
    expect(ld).toMatchObject({ '@type': 'CollectionPage', url: `${SITE}/blog` });
    const items = (ld as { mainEntity: { itemListElement: unknown[] } }).mainEntity.itemListElement;
    expect(items).toEqual([
      { '@type': 'ListItem', position: 1, name: 'A', url: 'https://medium.com/@ada/a' },
      { '@type': 'ListItem', position: 2, name: 'B', url: 'https://medium.com/@ada/b' },
    ]);
    expect(JSON.stringify(ld)).not.toContain('BlogPosting');
  });
  it('is undefined without usable articles', () => {
    expect(blogLd({ ...input, articles: [] }, SITE)).toBeUndefined();
    expect(blogLd({ ...input, articles: [{ title: 'x', url: 'ftp://x' }] }, SITE)).toBeUndefined();
  });
});

describe('serializeJsonLd', () => {
  it('escapes "<" so markup in data cannot close the script block, and still parses back', () => {
    const data = { name: '</script><script>alert(1)</script><!--', sep: `a${String.fromCharCode(0x2028)}b` };
    const out = serializeJsonLd(data);
    expect(out).not.toContain('<');
    expect(out).not.toContain(String.fromCharCode(0x2028));
    expect(JSON.parse(out)).toEqual(data);
  });
});

describe('sitemap filter', () => {
  it('keeps public pages and drops the 404 page and generated images', () => {
    expect(isSitemapPage(`${SITE}/`)).toBe(true);
    expect(isSitemapPage(`${SITE}/projects/lms`)).toBe(true);
    expect(isSitemapPage(`${SITE}/404`)).toBe(false);
    expect(isSitemapPage(`${SITE}/404/`)).toBe(false);
    expect(isSitemapPage(`${SITE}/og/default.png`)).toBe(false);
  });
});

describe('OG cards', () => {
  const flat = (n: OgNode | string): string =>
    typeof n === 'string' ? n : [n.props.children ?? []].flat().map(flat).join('|');

  it('default card: name, title, host; no eyebrow', () => {
    const text = flat(ogTree(defaultCard({ name: 'Ada Lovelace', title: 'Engineer' }, 'ada.web.app')));
    expect(text).toContain('Ada Lovelace');
    expect(text).toContain('Engineer');
    expect(text).toContain('ada.web.app');
    expect(text).toContain('A'); // logo initial
    expect(text).not.toContain('Case study');
  });
  it('project card: case-study eyebrow, project name and label', () => {
    const text = flat(ogTree(projectCard({ name: 'LMS', label: 'Mobile app' }, 'Ada', 'h')));
    expect(text).toContain('Case study|LMS|Mobile app');
  });
  it('omits a missing subtitle and scales long titles down', () => {
    const text = flat(ogTree({ title: 'T', name: 'N', host: 'h' }));
    expect(text).toBe('T|N|N|h'); // title | logo initial | name | host
    expect(titleSize('short')).toBeGreaterThan(titleSize('x'.repeat(50)));
    expect(titleSize('x'.repeat(100))).toBe(48);
    expect(titleSize('x'.repeat(30))).toBe(76);
    expect(titleSize('x'.repeat(60))).toBe(60);
  });
  it('renders a 1200x630 PNG', async () => {
    const png = await renderOgPng(
      projectCard({ name: 'LMS Cricket', label: 'Mobile app' }, 'Ada', 'ada.web.app'),
    );
    const meta = await sharp(png).metadata();
    expect(meta).toMatchObject({ format: 'png', width: 1200, height: 630 });
  }, 20_000);
});

describe('aboutDescription', () => {
  const p = { name: 'Ada', title: 'Engineer', location: 'Dhaka', bio: [] as string[] };
  it('uses the first bio paragraph when there is one', () => {
    expect(aboutDescription({ ...p, bio: ['First.', 'Second.'] })).toBe('First.');
  });
  it('otherwise builds a distinct line from profile facts only', () => {
    expect(aboutDescription(p)).toBe('About Ada: Engineer, based in Dhaka.');
    expect(aboutDescription({ ...p, location: undefined })).toBe('About Ada: Engineer.');
  });
});
