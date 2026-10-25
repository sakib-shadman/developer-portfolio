import { describe, expect, it } from 'vitest';
import { contract } from '../../src/lib/content/schemas';

describe('content contract', () => {
  it('article: canonicalises the Medium URL and requires https', () => {
    const ok = contract.article.parse({
      title: 'T',
      url: 'https://medium.com/@me/post-abc?source=rss',
      publishedAt: '2026-05-14',
    });
    expect(ok.url).toBe('https://medium.com/@me/post-abc');
    expect(ok.status).toBe('published');
    expect(
      contract.article.safeParse({ title: 'T', url: 'http://medium.com/x', publishedAt: '2026-01-01' })
        .success,
    ).toBe(false);
  });

  it('article: thumbnail requires alt text', () => {
    const r = contract.article.safeParse({
      title: 'T',
      url: 'https://m.com/x',
      publishedAt: '2026-01-01',
      thumbnail: 'a.png',
    });
    expect(r.success).toBe(false);
  });

  it('project: draft may be incomplete, published may not', () => {
    const base = { name: 'LMS Cricket', category: 'mobile-app' };
    expect(contract.project.safeParse(base).success).toBe(true);
    const r = contract.project.safeParse({ ...base, status: 'published' });
    expect(r.success).toBe(false);
    const paths = r.error?.issues.map((i) => i.path.join('.'));
    expect(paths).toEqual(expect.arrayContaining(['summary', 'description', 'role', 'technologies']));
  });

  it('project: rejects non-http links', () => {
    const r = contract.project.safeParse({
      name: 'X',
      category: 'sdk',
      links: { repo: 'javascript:alert(1)' },
    });
    expect(r.success).toBe(false);
  });

  it('experience: published needs dates; end before start rejected; null = current', () => {
    expect(
      contract.experience.safeParse({ company: 'Vivasoft', status: 'published', title: 'SE' }).success,
    ).toBe(false);
    expect(
      contract.experience.safeParse({
        company: 'A',
        title: 'SE',
        status: 'published',
        startDate: '2024-01-01',
        endDate: null,
      }).success,
    ).toBe(true);
    expect(
      contract.experience.safeParse({ company: 'A', startDate: '2024-01-01', endDate: '2023-01-01' }).success,
    ).toBe(false);
  });

  it('profile: about fields are optional; years must be a positive integer', () => {
    const min = { name: 'A', title: 'B', headline: 'C', intro: 'D' };
    const ok = contract.profile.parse(min);
    expect(ok.community).toEqual([]);
    expect(ok.interests).toEqual([]);
    expect(ok.yearsExperience).toBeUndefined();
    expect(contract.profile.safeParse({ ...min, yearsExperience: 12 }).success).toBe(true);
    for (const bad of [0, -1, 1.5, 61]) {
      expect(contract.profile.safeParse({ ...min, yearsExperience: bad }).success).toBe(false);
    }
    expect(contract.profile.safeParse({ ...min, community: [{ text: '' }] }).success).toBe(false);
    expect(ok.expertise).toEqual([]);
    const c = (href: string) =>
      contract.profile.safeParse({ ...min, community: [{ text: 'T', href }] }).success;
    expect(c('https://medium.com/@me')).toBe(true);
    expect(c('/blog')).toBe(true);
    for (const bad of ['//evil.com', 'javascript:alert(1)', '/a b', '/\\evil.com'])
      expect(c(bad)).toBe(false);
    expect(contract.profile.safeParse({ ...min, community: [{ text: 'T' }] }).success).toBe(true);
    expect(
      contract.profile.safeParse({
        ...min,
        expertise: [{ title: 'T', text: 'x', items: ['a'] }],
        aboutTitle: 'Hi',
      }).success,
    ).toBe(true);
    expect(contract.profile.safeParse({ ...min, expertise: [{ title: '', items: [] }] }).success).toBe(false);
    expect(contract.profile.safeParse({ ...min, aboutTitle: '' }).success).toBe(false);
    expect(contract.profile.safeParse({ ...min, interests: ['Chess'] }).success).toBe(true);
  });

  it('profile: optional fields may be omitted; email validated', () => {
    const min = { name: 'S', title: 'SE', headline: 'H', intro: 'I' };
    expect(contract.profile.safeParse(min).success).toBe(true);
    expect(contract.profile.safeParse({ ...min, email: 'nope' }).success).toBe(false);
    expect(contract.profile.safeParse({ ...min, resume: '/etc/passwd' }).success).toBe(false);
  });

  it('skill ids are kebab-case', () => {
    expect(contract.skill.safeParse({ id: 'spring-boot', name: 'Spring Boot' }).success).toBe(true);
    expect(contract.skill.safeParse({ id: 'Spring Boot', name: 'Spring Boot' }).success).toBe(false);
  });
});
