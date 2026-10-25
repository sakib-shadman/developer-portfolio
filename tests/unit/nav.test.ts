import { describe, expect, it } from 'vitest';
import { PRIMARY_NAV, isCurrent, normalizePath } from '../../src/lib/nav';

describe('nav', () => {
  it.each([
    ['/', '/'],
    ['', '/'],
    ['/projects/', '/projects'],
    ['/projects.html', '/projects'],
    ['/projects/lms-cricket.html', '/projects/lms-cricket'],
    ['/blog/index', '/blog'],
  ])('normalizePath(%s) = %s', (input, expected) => expect(normalizePath(input)).toBe(expected));

  it('matches the section and its children, segment-aware', () => {
    expect(isCurrent('/projects', '/projects')).toBe(true);
    expect(isCurrent('/projects/lms-cricket', '/projects')).toBe(true);
    expect(isCurrent('/projects.html', '/projects')).toBe(true);
    expect(isCurrent('/projectsx', '/projects')).toBe(false);
    expect(isCurrent('/', '/projects')).toBe(false);
    expect(isCurrent('/', undefined)).toBe(false);
  });

  it('anchors never mark current; order matches the design', () => {
    expect(PRIMARY_NAV.map((i) => i.label)).toEqual([
      'Skills',
      'Experience',
      'Projects',
      'Writing',
      'About',
      'Contact',
    ]);
    expect(PRIMARY_NAV.filter((i) => i.href.startsWith('/#')).every((i) => !i.match)).toBe(true);
  });
});

describe('visibleNav', () => {
  it('drops anchor items whose home section is not rendered', async () => {
    const { visibleNav } = await import('../../src/lib/nav');
    const labels = (r: { skills: boolean; experience: boolean }) =>
      visibleNav(PRIMARY_NAV, r).map((i) => i.label);
    expect(labels({ skills: true, experience: true })).toContain('Experience');
    expect(labels({ skills: true, experience: false })).not.toContain('Experience');
    expect(labels({ skills: false, experience: true })).not.toContain('Skills');
    // page links are never dropped
    expect(labels({ skills: false, experience: false })).toEqual(['Projects', 'Writing', 'About', 'Contact']);
  });
});
