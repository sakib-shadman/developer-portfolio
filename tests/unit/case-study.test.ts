import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import mdxRenderer from '@astrojs/mdx/server.js';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import Callout from '../../src/components/case-study/Callout.astro';
import Challenge from '../../src/components/case-study/Challenge.astro';
import Decision from '../../src/components/case-study/Decision.astro';
import Diagram from '../../src/components/case-study/Diagram.astro';
import Figure from '../../src/components/case-study/Figure.astro';
import Metrics from '../../src/components/case-study/Metrics.astro';
import Section from '../../src/components/case-study/Section.astro';
import { caseStudyComponents } from '../../src/components/case-study';
import EmptyBody from './fixtures/empty.mdx';
import FixtureBody from './fixtures/case-study.mdx';
import type { CaseStudy, ProjectCard } from '../../src/lib/content/types';

// The page reads data only through queries.ts (ADR-0008); mock it so no content collection is needed.
const state = vi.hoisted(() => ({ study: undefined as unknown, projects: [] as unknown[] }));
vi.mock('../../src/lib/content/queries', () => ({
  getProfile: async () => ({
    name: 'Shadman Sakib',
    links: {},
    focus: [],
    stats: [],
    bio: [],
    principles: [],
  }),
  getHomeSections: async () => ({ skills: true, experience: true }),
  getSkillGroups: async () => [{ id: 'platforms', title: 'Platforms', items: [{ id: 'ios', name: 'iOS' }] }],
  getProjects: async () => state.projects,
  getCaseStudy: async () => state.study,
}));

import Page from '../../src/pages/projects/[slug].astro';

let c: AstroContainer;
beforeAll(async () => {
  c = await AstroContainer.create();
  // The fixture body is MDX, as the real Content from astro:content render() is.
  c.addServerRenderer({ name: '@astrojs/mdx', renderer: mdxRenderer });
});

describe('case-study components', () => {
  it('Section numbers via a counter class and labels its heading', async () => {
    const html = await c.renderToString(Section, {
      props: { eyebrow: 'Context', title: 'The problem' },
      slots: { default: '<p>x</p>' },
    });
    expect(html).toContain('aria-labelledby="cs-the-problem"');
    expect(html).toMatch(/<h2 id="cs-the-problem"[^>]*>The problem<\/h2>/);
    expect(html).toContain('Context');
  });

  it('Diagram renders an ordered flow with decorative arrows and a caption; empty renders nothing', async () => {
    const html = await c.renderToString(Diagram, {
      props: { nodes: [{ label: 'App', highlight: true }, { label: 'API' }], caption: 'Flow' },
    });
    expect(html).toContain('role="list"');
    expect(html).toMatch(/class="[^"]*node highlight/);
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(1);
    expect(html).toContain('<figcaption');
    expect(await c.renderToString(Diagram, { props: { nodes: [] } })).not.toContain('<figure');
  });

  it('Metrics renders a dl and nothing when empty', async () => {
    const html = await c.renderToString(Metrics, {
      props: { items: [{ label: 'Crash-free', value: '99.9%' }] },
    });
    expect(html).toMatch(/<dt[^>]*>Crash-free<\/dt>\s*<dd[^>]*>99\.9%<\/dd>/);
    expect(await c.renderToString(Metrics, { props: { items: [] } })).not.toContain('<dl');
  });

  it('Callout, Decision, Challenge and Figure render their content', async () => {
    expect(
      await c.renderToString(Callout, { props: { title: 'Heads up' }, slots: { default: 'Body' } }),
    ).toMatch(/Heads up[\s\S]*Body/);
    expect(await c.renderToString(Callout, { slots: { default: 'Body' } })).not.toContain('<strong');
    expect(
      await c.renderToString(Decision, { props: { title: 'Riverpod' }, slots: { default: 'Why' } }),
    ).toMatch(/<h3[^>]*>Riverpod<\/h3>[\s\S]*Why/);
    const ch = await c.renderToString(Challenge, { props: { challenge: 'Slow', resolution: 'Windowed' } });
    expect(ch).toMatch(/Challenge[\s\S]*Slow[\s\S]*Resolution[\s\S]*Windowed/);
    const fig = await c.renderToString(Figure, {
      props: { src: { src: '/a.png', width: 1200, height: 800, format: 'png' }, alt: 'Shot', caption: 'Cap' },
    });
    expect(fig).toContain('alt="Shot"');
    expect(fig).toMatch(/srcset="[^"]+ 480w/);
    expect(fig).toContain('Cap');
  });
});

const base: ProjectCard = {
  slug: 'lms-cricket',
  name: 'LMS Cricket',
  label: 'Mobile app',
  category: 'mobile-app',
  summary: 'Live scoring.',
  technologies: [
    { id: 'flutter', name: 'Flutter' },
    { id: 'ios', name: 'iOS' },
  ],
  role: 'Lead developer',
  contributions: ['Built the scoring engine'],
  links: { store: 'https://apps.example.dev/x', repo: 'https://github.com/x/y' },
  media: [],
  featured: true,
  hasCaseStudy: true,
  caseStudyId: 'lms-cricket',
  draft: false,
};
const study = (extra: Partial<CaseStudy> = {}): CaseStudy => ({
  id: 'lms-cricket',
  problem: 'Scores must update live.',
  outcomes: [],
  Content: FixtureBody as unknown as CaseStudy['Content'],
  ...extra,
});
const renderPage = (props: Record<string, unknown>) =>
  c.renderToString(Page, {
    props,
    params: { slug: 'lms-cricket' },
    request: new Request('http://localhost/projects/lms-cricket'),
  });

describe('/projects/[slug] page', () => {
  it('renders hero, facts, links, MDX body with components and Shiki code', async () => {
    const html = await renderPage({ project: base, caseStudy: study() });
    expect(html).toContain('<h1');
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('Mobile app · Case study');
    expect(html).toMatch(/<a href="https:\/\/apps\.example\.dev\/x"[^>]*>\s*App listing/);
    expect(html).toContain('Source');
    expect(html).toMatch(/Role<\/dt>\s*<dd[^>]*>Lead developer/);
    expect(html).toMatch(/Platforms<\/dt>\s*<dd[^>]*>iOS/);
    expect(html).toMatch(/Stack<\/dt>\s*<dd[^>]*>Flutter/);
    expect(html).toContain('Scores must update live.');
    expect(html).toContain('Built the scoring engine');
    expect(html).toContain('How it&#39;s built');
    expect(html).toContain('Use Riverpod');
    expect(html).toContain('99.9%');
    expect(html).toContain('class="astro-code');
    expect(html).toContain('<title>LMS Cricket — Case study — Shadman Sakib</title>');
    expect(html).toContain('<link rel="canonical" href="http://localhost:4321/projects/lms-cricket"');
    expect(html).toContain('content="Live scoring."');
  });

  it('omits every optional part when data is missing: no facts, links, role, outcome, nav, screenshots', async () => {
    const bare: ProjectCard = {
      ...base,
      summary: undefined,
      role: undefined,
      contributions: [],
      links: {},
      technologies: [],
    };
    const html = await renderPage({ project: bare, caseStudy: study({ Content: EmptyBody as never }) });
    for (const absent of [
      'class="facts',
      'App listing',
      'What I did',
      'Results',
      'More projects',
      'Screenshots',
    ]) {
      expect(html).not.toContain(absent);
    }
    expect(html).toContain('Scores must update live.');
    // description falls back to the problem statement
    expect(html).toContain('content="Scores must update live."');
    expect(html).not.toMatch(/\[[^\]]+\]/);
  });

  it('outcomes render only when provided', async () => {
    const html = await renderPage({ project: base, caseStudy: study({ outcomes: ['Cut crashes by half'] }) });
    expect(html).toContain('Results');
    expect(html).toContain('Cut crashes by half');
  });

  it('prev/next navigation links to neighbours only', async () => {
    const prev = { ...base, slug: 'a', name: 'Alpha' };
    const next = { ...base, slug: 'b', name: 'Beta' };
    const both = await renderPage({ project: base, caseStudy: study(), prev, next });
    expect(both).toContain('aria-label="More projects"');
    expect(both).toMatch(/<a href="\/projects\/a"[\s\S]*Previous[\s\S]*Alpha/);
    expect(both).toMatch(/<a href="\/projects\/b"[\s\S]*Next[\s\S]*Beta/);
    const onlyNext = await renderPage({ project: base, caseStudy: study(), next });
    expect(onlyNext).not.toContain('Previous');
  });

  it('screenshots render through astro:assets with alt text', async () => {
    const shot = { src: '/s.png', width: 640, height: 1280, format: 'png' as const };
    const html = await renderPage({
      project: { ...base, media: [{ src: shot, width: 640, height: 1280, alt: 'Live score screen' }] },
      caseStudy: study(),
    });
    expect(html).toContain('aria-label="Screenshots"');
    expect(html).toContain('alt="Live score screen"');
    expect(html).toContain('srcset=');
  });
});

describe('caseStudyComponents', () => {
  it('exposes the MDX component set', () => {
    expect(Object.keys(caseStudyComponents).sort()).toEqual([
      'Callout',
      'Challenge',
      'Decision',
      'Diagram',
      'Figure',
      'Metrics',
      'Section',
    ]);
  });
});
