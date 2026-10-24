import { describe, expect, it } from 'vitest';
import {
  buildFilters,
  categoryQuery,
  counterParts,
  filterByCategory,
  parseCategory,
  pluralCategoryLabel,
  sortProjects,
} from '../../src/lib/projects';
import type { ProjectCard } from '../../src/lib/content/types';

const project = (name: string, extra: Partial<ProjectCard> = {}): ProjectCard => ({
  slug: name.toLowerCase(),
  name,
  label: 'x',
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

describe('sortProjects', () => {
  it('puts featured first by featuredOrder, then the rest by name', () => {
    const sorted = sortProjects([
      project('Zeta'),
      project('Beta', { featured: true, featuredOrder: 2 }),
      project('Alpha'),
      project('Gamma', { featured: true, featuredOrder: 1 }),
    ]);
    expect(sorted.map((p) => p.name)).toEqual(['Gamma', 'Beta', 'Alpha', 'Zeta']);
  });

  it('breaks featuredOrder ties by name, unordered featured after ordered, and does not mutate', () => {
    const input = [
      project('B', { featured: true }),
      project('A', { featured: true }),
      project('D', { featured: true, featuredOrder: 1 }),
      project('C', { featured: true, featuredOrder: 1 }),
    ];
    const copy = [...input];
    expect(sortProjects(input).map((p) => p.name)).toEqual(['C', 'D', 'A', 'B']);
    expect(input).toEqual(copy);
  });
});

describe('pluralCategoryLabel', () => {
  it('pluralises countable labels and leaves mass nouns alone', () => {
    expect(pluralCategoryLabel('mobile-app')).toBe('Mobile apps');
    expect(pluralCategoryLabel('sdk')).toBe('SDKs');
    expect(pluralCategoryLabel('library')).toBe('Libraries');
    expect(pluralCategoryLabel('web-app')).toBe('Web apps');
    expect(pluralCategoryLabel('backend')).toBe('Backend');
    expect(pluralCategoryLabel('open-source')).toBe('Open source');
  });
});

describe('buildFilters', () => {
  it('starts with All, counts per category and omits empty categories', () => {
    const f = buildFilters([{ category: 'sdk' }, { category: 'mobile-app' }, { category: 'mobile-app' }]);
    expect(f).toEqual([
      { value: 'all', label: 'All', count: 3 },
      { value: 'mobile-app', label: 'Mobile apps', count: 2 },
      { value: 'sdk', label: 'SDKs', count: 1 },
    ]);
  });

  it('with no projects only All (count 0) remains', () => {
    expect(buildFilters([])).toEqual([{ value: 'all', label: 'All', count: 0 }]);
  });
});

describe('filterByCategory / parseCategory / categoryQuery', () => {
  const items = [project('A'), project('B', { category: 'sdk' })];
  it('filters by category and keeps everything for all', () => {
    expect(filterByCategory(items, 'sdk').map((p) => p.name)).toEqual(['B']);
    expect(filterByCategory(items, 'all')).toHaveLength(2);
    expect(filterByCategory(items, 'library')).toEqual([]);
  });

  it('parses known categories and falls back to all for junk or missing values', () => {
    expect(parseCategory('sdk')).toBe('sdk');
    expect(parseCategory('library')).toBe('library');
    expect(parseCategory('nope')).toBe('all');
    expect(parseCategory('all')).toBe('all');
    expect(parseCategory(null)).toBe('all');
    expect(parseCategory(undefined)).toBe('all');
  });

  it('builds the query string, empty for all', () => {
    expect(categoryQuery('all')).toBe('');
    expect(categoryQuery('mobile-app')).toBe('?category=mobile-app');
  });
});

describe('counterParts', () => {
  it('formats "x of y projects" with singular for one', () => {
    expect(counterParts(2, 3)).toEqual({ shown: '2', rest: ' of 3 projects' });
    expect(counterParts(0, 3)).toEqual({ shown: '0', rest: ' of 3 projects' });
    expect(counterParts(1, 1)).toEqual({ shown: '1', rest: ' of 1 project' });
  });
});
