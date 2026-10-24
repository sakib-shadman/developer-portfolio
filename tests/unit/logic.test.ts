import { describe, expect, it } from 'vitest';
import {
  assertUniqueUrls,
  countByCategory,
  isVisible,
  pickFeaturedProjects,
  pickHomeArticles,
  sortArticles,
  sortExperience,
} from '../../src/lib/content/logic';
import type { ArticleCard, ExperienceItem, ProjectCard } from '../../src/lib/content/types';

const article = (id: string, date: string, extra: Partial<ArticleCard> = {}): ArticleCard => ({
  id,
  title: id,
  url: `https://medium.com/@me/${id}`,
  publishedAt: new Date(date),
  tags: [],
  featured: false,
  ...extra,
});

const job = (id: string, extra: Partial<ExperienceItem> = {}): ExperienceItem => ({
  id,
  company: id,
  current: false,
  responsibilities: [],
  achievements: [],
  technologies: [],
  draft: false,
  ...extra,
});

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

describe('isVisible', () => {
  it('published always, draft only with includeDrafts, archived never', () => {
    expect(isVisible('published', false)).toBe(true);
    expect(isVisible('draft', false)).toBe(false);
    expect(isVisible('draft', true)).toBe(true);
    expect(isVisible('archived', true)).toBe(false);
  });
});

describe('articles', () => {
  it('assertUniqueUrls throws on duplicate canonical URL', () => {
    const a = article('a', '2026-01-01');
    const b = { ...article('b', '2026-01-02'), url: a.url };
    expect(() => assertUniqueUrls([a, b])).toThrow(/Duplicate article URL in "b" and "a"/);
    expect(assertUniqueUrls([a])).toEqual([a]);
  });

  it('sortArticles: newest first, ties by title', () => {
    const sorted = sortArticles([
      article('b', '2026-01-01'),
      article('c', '2026-03-01'),
      article('a', '2026-01-01'),
    ]);
    expect(sorted.map((a) => a.id)).toEqual(['c', 'a', 'b']);
  });

  it('pickHomeArticles prefers featured, else latest N', () => {
    const all = sortArticles([
      article('x', '2026-01-01'),
      article('y', '2026-02-01'),
      article('z', '2026-03-01'),
    ]);
    expect(pickHomeArticles(all, 2).map((a) => a.id)).toEqual(['z', 'y']);
    const withFeatured = all.map((a) => (a.id === 'x' ? { ...a, featured: true } : a));
    expect(pickHomeArticles(withFeatured, 2).map((a) => a.id)).toEqual(['x']);
  });
});

describe('sortExperience', () => {
  it('current first, then newest start, undated last', () => {
    const sorted = sortExperience([
      job('old', { startDate: new Date('2018-01-01') }),
      job('undated'),
      job('now', { current: true, startDate: new Date('2023-01-01') }),
      job('mid', { startDate: new Date('2021-01-01') }),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['now', 'mid', 'old', 'undated']);
  });
});

describe('projects', () => {
  it('pickFeaturedProjects: featured only, by order then name, capped', () => {
    const list = [
      project('b', { featured: true }),
      project('a', { featured: true }),
      project('first', { featured: true, featuredOrder: 1 }),
      project('hidden'),
    ];
    expect(pickFeaturedProjects(list).map((p) => p.slug)).toEqual(['first', 'a', 'b']);
    expect(pickFeaturedProjects(list, 1).map((p) => p.slug)).toEqual(['first']);
  });

  it('countByCategory omits empty categories', () => {
    const counts = countByCategory([project('a'), project('b'), project('c', { category: 'sdk' })]);
    expect([...counts]).toEqual([
      ['mobile-app', 2],
      ['sdk', 1],
    ]);
  });
});
