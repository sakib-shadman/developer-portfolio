import { describe, expect, it } from 'vitest';
import {
  detailDescription,
  detailFacts,
  detailLinks,
  detailPageProjects,
  neighbours,
  platformIds,
  slugify,
  splitTech,
} from '../../src/lib/project-detail';
import type { ProjectCard, SkillGroup } from '../../src/lib/content/types';

const project = (slug: string, extra: Partial<ProjectCard> = {}): ProjectCard => ({
  slug,
  name: slug,
  label: 'Mobile app',
  category: 'mobile-app',
  technologies: [],
  contributions: [],
  links: {},
  media: [],
  featured: false,
  hasCaseStudy: false,
  draft: false,
  ...extra,
});
const tech = (id: string) => ({ id, name: id.toUpperCase() });

describe('detailPageProjects / neighbours', () => {
  it('only projects with a case study get a page', () => {
    const list = [project('a', { hasCaseStudy: true }), project('b'), project('c', { hasCaseStudy: true })];
    expect(detailPageProjects(list).map((p) => p.slug)).toEqual(['a', 'c']);
  });

  it('previous/next follow list order with no wrap-around', () => {
    const list = [project('a'), project('b'), project('c')];
    expect(neighbours(list, 'b')).toEqual({ prev: list[0], next: list[2] });
    expect(neighbours(list, 'a')).toEqual({ prev: undefined, next: list[1] });
    expect(neighbours(list, 'c').next).toBeUndefined();
    expect(neighbours(list, 'zzz')).toEqual({});
  });
});

describe('platforms / stack / facts', () => {
  const groups = [
    { id: 'platforms', title: 'Platforms', items: [tech('ios'), tech('android')] },
    { id: 'languages', title: 'Languages', items: [tech('dart')] },
  ] as SkillGroup[];

  it('splits technologies using the Platforms skill group', () => {
    const ids = platformIds(groups);
    const { platforms, stack } = splitTech([tech('flutter'), tech('ios'), tech('dart')], ids);
    expect(platforms.map((t) => t.id)).toEqual(['ios']);
    expect(stack.map((t) => t.id)).toEqual(['flutter', 'dart']);
    expect(platformIds([]).size).toBe(0);
  });

  it('facts include only what exists, in Role / Platforms / Stack order', () => {
    expect(detailFacts(project('a'), [], [])).toEqual([]);
    expect(
      detailFacts(project('a', { role: 'Lead' }), [tech('ios'), tech('android')], [tech('dart')]),
    ).toEqual([
      { label: 'Role', value: 'Lead' },
      { label: 'Platforms', value: 'IOS · ANDROID' },
      { label: 'Stack', value: 'DART' },
    ]);
    expect(detailFacts(project('a'), [], [tech('dart')])).toEqual([{ label: 'Stack', value: 'DART' }]);
  });
});

describe('detailLinks', () => {
  it('lists configured safe links as store, demo, repo, docs', () => {
    expect(
      detailLinks({
        docs: 'https://d.dev',
        repo: 'https://github.com/x/y',
        store: 'https://s.dev',
        demo: 'javascript:alert(1)',
      }),
    ).toEqual([
      { label: 'App listing', href: 'https://s.dev' },
      { label: 'Source', href: 'https://github.com/x/y' },
      { label: 'Docs', href: 'https://d.dev' },
    ]);
    expect(detailLinks({})).toEqual([]);
  });
});

describe('detailDescription / slugify', () => {
  it('prefers the summary, otherwise trims the problem statement at a word boundary', () => {
    expect(detailDescription('Short summary', 'problem')).toBe('Short summary');
    expect(detailDescription(undefined, '  A  short\nproblem. ')).toBe('A short problem.');
    const long = detailDescription(undefined, 'word '.repeat(60));
    expect(long.length).toBeLessThanOrEqual(160);
    expect(long.endsWith('…')).toBe(true);
    expect(long).not.toMatch(/wor…$/);
    expect(detailDescription(undefined, 'x'.repeat(200))).toHaveLength(160);
  });

  it('slugifies headings', () => {
    expect(slugify("How it's built")).toBe('how-it-s-built');
    expect(slugify('!!!')).toBe('section');
  });
});
