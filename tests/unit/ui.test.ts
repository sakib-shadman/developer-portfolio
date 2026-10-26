import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import Badge from '../../src/components/ui/Badge.astro';
import Button from '../../src/components/ui/Button.astro';
import Card from '../../src/components/ui/Card.astro';
import ChipList from '../../src/components/ui/ChipList.astro';
import FilterChip from '../../src/components/ui/FilterChip.astro';
import LinkPill from '../../src/components/ui/LinkPill.astro';
import SectionHeading from '../../src/components/ui/SectionHeading.astro';
import ScopedParent from './fixtures/ScopedParent.astro';

let c: AstroContainer;
beforeAll(async () => {
  c = await AstroContainer.create();
});
const label = (s: string) => ({ slots: { default: s } });

describe('Button', () => {
  it('renders a <button type=button> without href', async () => {
    const html = await c.renderToString(Button, { props: {}, ...label('Go') });
    expect(html).toMatch(/<button type="button" class="btn outline md/);
  });

  it('internal href → <a> in the same tab', async () => {
    const html = await c.renderToString(Button, {
      props: { href: '/projects', variant: 'soft' },
      ...label('All'),
    });
    expect(html).toMatch(/<a href="\/projects"[^>]*class="btn soft md/);
    expect(html).not.toContain('target=');
    expect(html).not.toContain('opens in a new tab');
  });

  it('external href → new tab, rel, sr-only hint', async () => {
    const html = await c.renderToString(Button, {
      props: { href: 'https://x.dev', variant: 'solid' },
      ...label('Site'),
    });
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('(opens in a new tab)');
    expect(html).toContain('btn solid lg');
  });

  it('hint is separated from the label by a space', async () => {
    const html = await c.renderToString(Button, { props: { href: 'https://x.dev' }, ...label('Site') });
    expect(html).toMatch(/Site[\s\S]*<span class="sr-only"> \(opens in a new tab\)<\/span>/);
  });

  it('newTab opens an internal PDF in a new tab with the notice, and download is independent', async () => {
    const view = await c.renderToString(Button, {
      props: { href: '/resume/cv.pdf', newTab: true },
      ...label('View'),
    });
    expect(view).toContain('target="_blank"');
    expect(view).toContain('rel="noopener noreferrer"');
    expect(view).toContain(' (opens in a new tab)');
    const dl = await c.renderToString(Button, {
      props: { href: '/resume/cv.pdf', download: true },
      ...label('Get'),
    });
    expect(dl).toMatch(/<a href="\/resume\/cv\.pdf"[^>]*download/);
    expect(dl).not.toContain('target=');
    expect(dl).not.toContain('opens in a new tab');
  });

  it('newTab with an aria-label puts the notice in the name', async () => {
    const html = await c.renderToString(Button, {
      props: { href: '/resume/cv.pdf', newTab: true, 'aria-label': 'View resume' },
      ...label('View'),
    });
    expect(html).toContain('aria-label="View resume (opens in a new tab)"');
  });

  it('external link with aria-label keeps the new-tab notice in the name', async () => {
    const html = await c.renderToString(Button, {
      props: { href: 'https://github.com/sakib-shadman', 'aria-label': 'GitHub profile' },
      ...label('GitHub'),
    });
    expect(html).toContain('aria-label="GitHub profile (opens in a new tab)"');
    expect(html).not.toContain('class="sr-only"');
  });

  it('disabled buttons render the attribute', async () => {
    const html = await c.renderToString(Button, {
      props: { disabled: true, type: 'submit' },
      ...label('Send'),
    });
    expect(html).toMatch(/<button type="submit"[^>]*disabled/);
  });

  it('unsafe href renders nothing', async () => {
    const html = await c.renderToString(Button, { props: { href: 'javascript:alert(1)' }, ...label('x') });
    expect(html.trim()).toBe('');
  });

  it('icons are decorative; outline icons are teal', async () => {
    const html = await c.renderToString(Button, {
      props: { href: '/r.pdf', icon: 'download', download: true },
      ...label('CV'),
    });
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('stroke="var(--acc)"');
    expect(html).toMatch(/\sdownload[\s>]/);
  });
});

describe('LinkPill', () => {
  it('internal → arrow, external → ↗ + new tab, unsafe → nothing', async () => {
    const internal = await c.renderToString(LinkPill, {
      props: { href: '/projects/x' },
      ...label('Case study'),
    });
    expect(internal).toContain('→');
    expect(internal).toContain('pill primary');
    const external = await c.renderToString(LinkPill, {
      props: { href: 'https://apps.apple.com/app/x', variant: 'secondary' },
      ...label('App listing'),
    });
    expect(external).toContain('↗');
    expect(external).toContain('target="_blank"');
    expect(external).toContain('pill secondary');
    expect(external).toMatch(/App listing[\s\S]*<span class="sr-only"> \(opens in a new tab\)<\/span>/);
    const pdf = await c.renderToString(LinkPill, {
      props: { href: '/resume/cv.pdf', newTab: true },
      ...label('Resume'),
    });
    expect(pdf).toContain('↗');
    expect(pdf).toContain('target="_blank"');
    expect(pdf).toContain('rel="noopener noreferrer"');
    expect(pdf).toContain(' (opens in a new tab)');
    expect(internal).not.toContain('opens in a new tab');
    const none = await c.renderToString(LinkPill, { props: { href: undefined }, ...label('Docs') });
    expect(none.trim()).toBe('');
  });
});

describe('ChipList', () => {
  it('renders a list of chips and nothing when empty', async () => {
    const html = await c.renderToString(ChipList, {
      props: { items: ['Flutter', 'Dart'], label: 'Technologies' },
    });
    expect(html).toContain('aria-label="Technologies"');
    expect(html.match(/<li/g)).toHaveLength(2);
    expect((await c.renderToString(ChipList, { props: { items: [] } })).trim()).toBe('');
  });
});

describe('FilterChip', () => {
  it('exposes pressed state and data hooks', async () => {
    const html = await c.renderToString(FilterChip, {
      props: { value: 'sdk', group: 'category', pressed: true, count: 2 },
      ...label('SDKs'),
    });
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('data-filter="sdk"');
    expect(html).toContain('data-filter-group="category"');
    expect(html).toMatch(/class="count"[^>]*>2</);
    const off = await c.renderToString(FilterChip, {
      props: { value: 'all', group: 'category' },
      ...label('All'),
    });
    expect(off).toContain('aria-pressed="false"');
    expect(off).not.toContain('class="count"');
  });
});

describe('Card, Badge, SectionHeading', () => {
  it('Card uses the requested element and highlight', async () => {
    const html = await c.renderToString(Card, { props: { as: 'article', highlight: true }, ...label('x') });
    expect(html).toMatch(/<article[^>]*class="card highlight"/);
    expect(html).toContain('class="body padded"');
    expect(html).not.toContain('class="media"');
  });

  it('Card renders the media well only when the slot is used', async () => {
    const html = await c.renderToString(Card, {
      props: { mediaHeight: 180 },
      slots: { default: 'b', media: 'img' },
    });
    expect(html).toMatch(/class="media"[^>]*style="height:180px"/);
  });

  it('Badge status has a decorative dot', async () => {
    const html = await c.renderToString(Badge, { props: { variant: 'status' }, ...label('In progress') });
    expect(html).toContain('class="dot"');
    expect(html).toContain('aria-hidden="true"');
  });

  it('SectionHeading renders eyebrow, heading level and id', async () => {
    const html = await c.renderToString(SectionHeading, {
      props: { eyebrow: '01 — Skills', title: 'Technology stack', id: 'skills-title' },
    });
    expect(html).toContain('01 — Skills');
    expect(html).toMatch(/<h2 id="skills-title"[^>]*class="h2"[^>]*>Technology stack<\/h2>/);
  });
});

describe('class passthrough', () => {
  it("every primitive carries the parent's class and scoped-style attribute", async () => {
    const html = await c.renderToString(ScopedParent);
    const tags = [...html.matchAll(/<[a-z0-9]+\s[^>]*>/g)]
      .map((m) => m[0])
      .filter((tag) => /class="(?:[^"]*\s)?x(?:\s[^"]*)?"/.test(tag));
    expect(tags).toHaveLength(8);
    const cidSets = tags.map((tag) => new Set([...tag.matchAll(/data-astro-cid-(\w+)/g)].map((m) => m[1])));
    const shared = cidSets.reduce((a, b) => new Set([...a].filter((cid) => b.has(cid))));
    expect(shared.size, tags.join('\n')).toBe(1); // the parent's cid is on all eight roots
  });
});
