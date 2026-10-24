import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import ProjectCardView from '../../src/components/projects/ProjectCard.astro';
import Badge from '../../src/components/ui/Badge.astro';
import type { ProjectCard } from '../../src/lib/content/types';

let c: AstroContainer;
beforeAll(async () => {
  c = await AstroContainer.create();
});

const base: ProjectCard = {
  slug: 'lms-cricket',
  name: 'LMS Cricket',
  label: 'Mobile app',
  category: 'mobile-app',
  technologies: [],
  contributions: [],
  links: {},
  media: [],
  featured: false,
  hasCaseStudy: false,
  draft: false,
};
const render = (project: Partial<ProjectCard>, props: Record<string, unknown> = {}) =>
  c.renderToString(ProjectCardView, { props: { project: { ...base, ...project }, ...props } });

describe('ProjectCard', () => {
  it('renders only what exists: name + label, nothing else', async () => {
    const html = await render({});
    expect(html).toContain('LMS Cricket');
    expect(html).toContain('Mobile app');
    for (const absent of [
      'Role:',
      'Case study',
      'class="chips',
      'summary',
      'App listing',
      'Featured',
      'In progress',
    ]) {
      expect(html).not.toContain(absent);
    }
    expect(html).not.toMatch(/<a /);
    expect(html).not.toMatch(/\[[^\]]+\]/);
  });

  it('uses an h3 by default, h2 on request, labelled by its name', async () => {
    expect(await render({})).toMatch(/<h3 id="project-lms-cricket"/);
    expect(await render({}, { headingLevel: 'h2' })).toMatch(/<h2 id="project-lms-cricket"/);
    expect(await render({})).toContain('aria-labelledby="project-lms-cricket"');
  });

  it('shows summary, tech chips and role', async () => {
    const html = await render({
      summary: 'Live scoring.',
      role: 'Lead developer',
      technologies: [
        { id: 'flutter', name: 'Flutter' },
        { id: 'dart', name: 'Dart' },
      ],
    });
    expect(html).toContain('Live scoring.');
    expect(html).toContain('Flutter');
    expect(html).toContain('Dart');
    expect(html).toMatch(/Role:<\/span>\s*Lead developer/);
  });

  it('badge: In progress wins over Featured and highlights the card; Featured alone has no dot', async () => {
    const both = await render({ progress: 'in-progress', featured: true });
    expect(both).toContain('In progress');
    expect(both).not.toContain('Featured');
    expect(both).toMatch(/class="card highlight/);
    const featured = await render({ featured: true });
    expect(featured).toContain('★ Featured');
    expect(featured).not.toContain('class="dot"');
    expect(featured).not.toMatch(/class="card highlight/);
  });

  it('case study pill is internal and only when hasCaseStudy', async () => {
    const html = await render({ hasCaseStudy: true });
    expect(html).toMatch(/<a href="\/projects\/lms-cricket"[^>]*>\s*Case study/);
    expect(html).not.toContain('target=');
  });

  it('shows the first available secondary link: store > demo > repo > docs', async () => {
    const links = {
      docs: 'https://docs.example.dev',
      repo: 'https://github.com/x/y',
      demo: 'https://demo.example.dev',
      store: 'https://apps.example.dev/x',
    };
    expect(await render({ links })).toMatch(/href="https:\/\/apps\.example\.dev\/x"[^>]*>\s*App listing/);
    const noStore = { demo: links.demo, repo: links.repo, docs: links.docs };
    expect(await render({ links: noStore })).toContain('Live demo');
    const noDemo = { repo: links.repo, docs: links.docs };
    expect(await render({ links: noDemo })).toContain('Source');
    expect(await render({ links: { docs: links.docs } })).toContain('Docs');
    const html = await render({ links });
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html.match(/<a /g)).toHaveLength(1);
  });

  it('drops unsafe links and the whole link row when nothing remains', async () => {
    const html = await render({ links: { store: 'javascript:alert(1)' } });
    expect(html).not.toMatch(/<a /);
    expect(html).not.toContain('class="links');
  });

  it('without media renders a decorative glyph, never a text placeholder', async () => {
    const html = await render({});
    expect(html).toMatch(/<svg[^>]*class="glyph[^"]*"[^>]*aria-hidden="true"/);
    expect(html).not.toContain('<img');
    expect(html).not.toMatch(/Screenshot|Media/);
  });

  it('with media renders the first image with its alt text', async () => {
    const html = await render({
      media: [
        { src: '/a.png', width: 800, height: 600, alt: 'Scoreboard screen' },
        { src: '/b.png', width: 800, height: 600, alt: 'Second' },
      ],
    });
    expect(html).toContain('<img');
    expect(html).toContain('alt="Scoreboard screen"');
    expect(html).not.toContain('Second');
    expect(html).not.toContain('class="glyph');
  });
});

describe('Badge dot', () => {
  it('status badge can omit the dot', async () => {
    const html = await c.renderToString(Badge, {
      props: { variant: 'status', dot: false },
      slots: { default: 'x' },
    });
    expect(html).not.toContain('class="dot"');
  });
});
