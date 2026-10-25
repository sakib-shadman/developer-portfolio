import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Profile, SkillGroup } from '../../src/lib/content/types';

const state = vi.hoisted(() => ({ profile: undefined as unknown, groups: [] as unknown[] }));
vi.mock('../../src/lib/content/queries', async () => {
  const { composeHomeSections } = await import('../../src/lib/home');
  return {
    getProfile: async () => state.profile,
    getSkillGroups: async () => state.groups,
    // PageLayout derives header anchors from this; reuse the real pure composition.
    getHomeSections: async () => composeHomeSections({ skillGroups: state.groups as never, experience: [] }),
  };
});

import About from '../../src/pages/about.astro';

const base: Profile = {
  name: 'Ada Lovelace',
  title: 'Engineer',
  headline: 'h',
  intro: 'Intro line.',
  focus: [],
  links: {},
  stats: [],
  bio: [],
  principles: [],
  expertise: [],
  community: [],
  interests: [],
};
const full: Profile = {
  ...base,
  bio: ['First paragraph.', 'Second paragraph.'],
  yearsExperience: 12,
  resume: '/resume/ada.pdf',
  photo: {
    src: { src: '/p.jpg', width: 800, height: 1000, format: 'jpg' },
    width: 800,
    height: 1000,
    alt: 'Ada at a desk',
  },
  links: { github: 'https://github.com/ada', linkedin: 'https://linkedin.com/in/ada' },
  expertise: [{ title: 'Mobile', text: 'Apps end to end.', items: ['Flutter', 'Dart'] }],
  principles: [
    { title: 'Simple', text: 'Keep it small.' },
    { title: 'Tested', text: 'Prove it.' },
  ],
  community: [{ text: 'Writes on Medium.', href: 'https://medium.com/@ada' }, { text: 'Mentors.' }],
  objective: 'Senior mobile roles.',
  interests: ['Chess'],
  aboutTitle: 'Hi, I am Ada.',
};

let c: AstroContainer;
beforeAll(async () => {
  c = await AstroContainer.create();
});
async function render(profile: Profile, groups: SkillGroup[] = []): Promise<string> {
  state.profile = profile;
  state.groups = groups;
  return c.renderToString(About, { request: new Request('http://localhost/about') });
}
const main = (html: string) => html.slice(html.indexOf('<main'), html.indexOf('</main>'));

describe('about page (populated)', () => {
  it('renders every section from data', async () => {
    const html = main(await render(full));
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>\s*Hi, I am Ada\.\s*<\/h1>/);
    expect(html).toContain('First paragraph.');
    expect(html).toContain('12 years of professional experience');
    expect(html).toMatch(/<img[^>]*alt="Ada at a desk"/);
    expect(html).toContain('Apps end to end.');
    expect(html).toContain('Senior mobile roles.');
    expect(html).toMatch(/<h2[^>]*>\s*Looking for\s*<\/h2>/);
    expect(html).toMatch(/href="https:\/\/github\.com\/ada"[^>]*rel="noopener noreferrer"/);
  });

  it('both resume links go through linkAttrs and carry download', async () => {
    const html = main(await render(full));
    const links = [...html.matchAll(/<a\b[^>]*href="\/resume\/ada\.pdf"[^>]*>/g)].map((m) => m[0]);
    expect(links).toHaveLength(2);
    for (const l of links) expect(l).toMatch(/\bdownload\b/);
  });

  it('principles are an ordered list numbered 01, 02', async () => {
    const html = main(await render(full));
    const ol =
      [...html.matchAll(/<ol\b[\s\S]*?<\/ol>/g)].map((m) => m[0]).find((o) => o.includes('Simple')) ?? '';
    expect(ol).toContain('Simple');
    expect(ol).toMatch(/>\s*01\s*</);
    expect(ol).toMatch(/>\s*02\s*</);
  });

  it('community links use linkAttrs; unsafe hrefs render as plain text', async () => {
    const html = main(await render(full));
    const a = html.match(/<a[^>]*href="https:\/\/medium\.com\/@ada"[^>]*>[\s\S]*?<\/a>/)?.[0] ?? '';
    expect(a).toMatch(/target="_blank"/);
    expect(a).toMatch(/rel="noopener noreferrer"/);
    expect(a).toMatch(/<span class="sr-only"[^>]*> \(opens in a new tab\)<\/span>/);
    expect(a).toMatch(/<span aria-hidden="true"[^>]*> ↗<\/span>/);
    const bad = main(await render({ ...full, community: [{ text: 'Sneaky', href: 'javascript:alert(1)' }] }));
    expect(bad).toContain('Sneaky');
    expect(bad).not.toContain('javascript:');
  });

  it('every aria-labelledby points at an existing id', async () => {
    const html = main(await render(full));
    const refs = [...html.matchAll(/aria-labelledby="([^"]+)"/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThanOrEqual(4);
    for (const id of refs) expect(html).toContain(`id="${id}"`);
  });
});

describe('about page (sparse)', () => {
  it('interests only: "Outside work" heading without the "What\'s next" eyebrow', async () => {
    const html = main(await render({ ...base, interests: ['Chess', 'Hiking'] }));
    expect(html).toMatch(/<h2[^>]*>\s*Outside work\s*<\/h2>/);
    expect(html).toContain('Chess, Hiking');
    expect(html).not.toContain("What's next");
    expect(html).not.toContain('Looking for');
    expect(html).toContain('About Ada Lovelace');
  });

  it('no objective, availability or interests: no "Looking for" card at all', async () => {
    const html = main(await render(base));
    expect(html).not.toContain('Looking for');
    expect(html).not.toContain('Outside work');
    expect(html).not.toContain('Beyond the day job');
    expect(html).not.toContain('Engineering principles');
    expect(html).not.toContain('Areas of expertise');
    expect(html).not.toContain('<img');
    expect(html).not.toMatch(/resume/i);
    expect(html).toContain('Intro line.');
  });

  it('falls back to skill groups for expertise', async () => {
    const html = main(
      await render(base, [{ id: 'l', title: 'Languages', items: [{ id: 'dart', name: 'Dart' }] }]),
    );
    expect(html).toContain('Areas of expertise');
    expect(html).toContain('Languages');
  });
});
