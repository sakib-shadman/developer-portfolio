import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import ContactCta from '../../src/components/home/ContactCta.astro';
import Experience from '../../src/components/home/Experience.astro';
import HomeWriting from '../../src/components/home/HomeWriting.astro';
import Hero from '../../src/components/home/Hero.astro';
import Stats from '../../src/components/home/Stats.astro';
import ProfileLinks from '../../src/components/ui/ProfileLinks.astro';
import type { ArticleCard, ExperienceItem, Profile } from '../../src/lib/content/types';

let c: AstroContainer;
beforeAll(async () => {
  c = await AstroContainer.create();
});

const full: Profile = {
  name: 'Ada Lovelace',
  title: 'Engineer',
  headline: 'Mobile apps, engineered for production.',
  headlineAccent: 'engineered',
  intro: 'Intro text.',
  location: 'Dhaka',
  timezone: 'GMT+6',
  focus: ['Flutter', 'iOS'],
  now: 'Building an SDK',
  email: 'ada@example.com',
  links: {
    github: 'https://github.com/ada',
    linkedin: 'https://linkedin.com/in/ada',
    medium: 'https://medium.com/@ada',
  },
  resume: '/resume/ada.pdf',
  photo: {
    src: { src: '/ada.jpg', width: 800, height: 1000, format: 'jpg' },
    width: 800,
    height: 1000,
    alt: 'Ada at her desk',
  },
  stats: [{ label: 'Years', value: '10', suffix: '+' }],
  availability: 'Open to work.',
  bio: [],
  principles: [],
  expertise: [],
  community: [],
  interests: [],
};
const bare: Profile = {
  ...full,
  email: undefined,
  resume: undefined,
  photo: undefined,
  now: undefined,
  links: {},
  stats: [],
};

const role: ExperienceItem = {
  id: 'acme',
  company: 'Acme',
  title: 'Senior Engineer',
  startDate: new Date('2022-03-01'),
  endDate: null,
  current: true,
  description: 'Led the mobile team.',
  responsibilities: ['Own the release train'],
  achievements: ['Cut crash rate by 40%'],
  technologies: [{ id: 'dart', name: 'Dart' }],
  companyUrl: 'https://acme.example.com',
  draft: false,
};

describe('Hero', () => {
  it('renders every configured element with accessible names', async () => {
    const html = await c.renderToString(Hero, { props: { profile: full } });
    expect(html).toContain('<span class="accent"');
    expect(html).toContain('Flutter · iOS');
    expect(html).toContain('Dhaka · GMT+6');
    expect(html).toMatch(/href="\/projects"/);
    expect(html).toMatch(/href="\/resume\/ada\.pdf"[^>]*download/);
    // The photo outline must not use a class the Button variants share ("outline"): scoped styles
    // would leak onto the Download button and stretch it over the page.
    expect(html).toMatch(/<div class="frame-outline"/);
    expect(html).not.toMatch(/<div class="outline"/);
    expect(html).toContain('alt="Ada at her desk"');
    expect(html).toContain('sizes="(max-width: 1000px) 100vw, 440px"');
    expect(html).toMatch(/srcset=/);
    expect(html).toContain('Now: Building an SDK');
    expect(html).toContain('has-photo');
    expect(html).toMatch(/<nav aria-label="Profiles"/);
    expect(html).toMatch(/href="#contact"/);
    expect(html).toMatch(/GitHub[\s\S]*?\(opens in a new tab\)/);
    expect(html).toContain('LinkedIn');
    expect(html).toContain('Medium');
  });

  it('View projects points at the given target (default /projects)', async () => {
    const slider = await c.renderToString(Hero, { props: { profile: full, projectsHref: '#work' } });
    expect(slider).toMatch(/href="#work"[^>]*>\s*View projects/);
    const dflt = await c.renderToString(Hero, { props: { profile: full } });
    expect(dflt).toMatch(/href="\/projects"[^>]*>\s*View projects/);
  });

  it('is a clean single column when nothing optional is configured', async () => {
    const html = await c.renderToString(Hero, { props: { profile: bare } });
    expect(html).not.toContain('has-photo');
    expect(html).not.toContain('<figure');
    expect(html).not.toContain('Download resume');
    expect(html).not.toContain('Profiles');
    expect(html).not.toContain('Now:');
  });
});

describe('Stats', () => {
  it('renders suffix and hides when empty', async () => {
    const html = await c.renderToString(Stats, { props: { stats: full.stats } });
    expect(html).toMatch(/<dd[^>]*>\s*10\s*<span class="suffix"[^>]*>\+<\/span>/);
    expect((await c.renderToString(Stats, { props: { stats: [] } })).trim()).toBe('');
  });
});

describe('Experience', () => {
  it('renders dates, badge, description, responsibilities, achievements, tech and company link', async () => {
    const html = await c.renderToString(Experience, { props: { items: [role], eyebrow: '02 — Experience' } });
    expect(html).toContain('Mar 2022 — Present');
    expect(html).toContain('Current');
    expect(html).toContain('Senior Engineer');
    expect(html).toContain('Acme');
    expect(html).toContain('Led the mobile team.');
    expect(html).toContain('Own the release train');
    expect(html).toContain('Cut crash rate by 40%');
    expect(html).toContain('Dart');
    expect(html).toContain('02 — Experience');
  });

  it('company link: visible label is inside the accessible name, new tab disclosed', async () => {
    const html = await c.renderToString(Experience, { props: { items: [role], eyebrow: '01 — Experience' } });
    const a = html.match(/<a [^>]*href="https:\/\/acme\.example\.com\/"[\s\S]*?<\/a>/)?.[0] ?? '';
    expect(a).not.toContain('aria-label');
    expect(a).toContain('Company site');
    expect(a).toMatch(/: Acme/);
    expect(a).toContain('(opens in a new tab)');
  });

  it('keeps the date column even for an undated, non-current role and hides empty fields', async () => {
    const sparse: ExperienceItem = {
      id: 'x',
      company: 'Sheba',
      current: false,
      responsibilities: [],
      achievements: [],
      technologies: [],
      draft: true,
    };
    const html = await c.renderToString(Experience, {
      props: { items: [sparse], eyebrow: '01 — Experience' },
    });
    expect(html).toMatch(/class="when[^"]*"/);
    expect(html).not.toContain('<ul');
    expect(html).not.toContain('<p class="desc');
    expect(html).not.toContain('Company site');
  });

  it('renders nothing without records', async () => {
    const html = await c.renderToString(Experience, { props: { items: [], eyebrow: '' } });
    expect(html.trim()).toBe('');
  });
});

describe('ContactCta', () => {
  it('shows the email button and profile pills when configured', async () => {
    const html = await c.renderToString(ContactCta, { props: { profile: full } });
    expect(html).toMatch(/href="mailto:ada@example\.com"/);
    expect(html).toContain('Open to work.');
    expect(html).toContain('LinkedIn');
    expect(html).toContain('GitHub');
  });
  it('hides actions when nothing is configured', async () => {
    const html = await c.renderToString(ContactCta, { props: { profile: bare } });
    expect(html).not.toContain('mailto:');
    expect(html).not.toContain('class="actions');
  });
});

describe('ProfileLinks', () => {
  it('tile email goes to #contact, pill email to mailto; unsafe hrefs render nothing', async () => {
    const tile = await c.renderToString(ProfileLinks, {
      props: { links: {}, email: 'a@b.co', kinds: ['email'], variant: 'tile' },
    });
    expect(tile).toContain('href="#contact"');
    const pill = await c.renderToString(ProfileLinks, {
      props: { links: {}, email: 'a@b.co', kinds: ['email'], variant: 'pill' },
    });
    expect(pill).toContain('href="mailto:a@b.co"');
    const bad = await c.renderToString(ProfileLinks, {
      props: { links: { github: 'javascript:alert(1)' }, kinds: ['github', 'medium'] },
    });
    expect(bad.trim()).toBe('');
  });
});

describe('HomeWriting', () => {
  const art = (n: number): ArticleCard => ({
    id: `a${n}`,
    title: `Article ${n}`,
    url: `https://medium.com/@ada/article-${n}`,
    publishedAt: new Date(`2026-0${n}-10`),
    excerpt: `Excerpt ${n}`,
    tags: ['flutter', 'dart'],
    readingMinutes: 4,
    featured: false,
  });

  it('renders a labelled section with a slider of tag-less cards and links', async () => {
    const html = await c.renderToString(HomeWriting, {
      props: { articles: [art(1), art(2), art(3)], eyebrow: '04 — Writing' },
    });
    expect(html).toContain('id="writing"');
    expect(html).toContain('04 — Writing');
    expect(html).toContain('Latest on Medium');
    expect(html).toMatch(/href="\/blog"[^>]*>\s*All articles/);
    expect(html).toContain('id="writing-slider"');
    expect(html).toContain('data-noun="article"');
    expect(html).toContain('Latest articles — scroll sideways');
    expect(html.match(/<article/g)).toHaveLength(3);
    expect(html).toContain('Article 2');
    expect(html).toContain('https://medium.com/@ada/article-3');
    // tags="none": the first tag never shows in the meta row on the home cards
    expect(html).not.toContain('flutter');
  });

  it('renders nothing without articles', async () => {
    expect((await c.renderToString(HomeWriting, { props: { articles: [], eyebrow: '' } })).trim()).toBe('');
  });
});
