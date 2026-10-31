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

  describe('project timeline (start / end)', () => {
    const base = { name: 'X', category: 'sdk' };
    const parse = (extra: Record<string, unknown>) => contract.project.safeParse({ ...base, ...extra });
    const messages = (extra: Record<string, unknown>) =>
      parse(extra).error?.issues.map((i) => `${i.path.join('.')}: ${i.message}`) ?? [];

    it('accepts no dates, a finished range, an ongoing one, and a single month', () => {
      expect(parse({}).success).toBe(true);
      expect(parse({ start: '2023-03', end: '2024-06' }).success).toBe(true);
      expect(parse({ start: '2023-03', end: 'present' }).success).toBe(true);
      expect(parse({ start: '2023-03', end: '2023-03' }).success).toBe(true);
    });
    it('requires end when start is set, naming the field', () => {
      expect(messages({ start: '2023-03' })).toEqual([
        'end: end is required when start is set (YYYY-MM, or "present" for an ongoing project)',
      ]);
    });
    it('forbids end without start, naming the field', () => {
      expect(messages({ end: '2023-03' })).toEqual(['end: end is not allowed without start']);
      expect(messages({ end: 'present' })).toEqual(['end: end is not allowed without start']);
    });
    it('rejects an end before the start, but "present" is always fine', () => {
      expect(messages({ start: '2023-03', end: '2023-02' })).toEqual([
        'end: end (2023-02) is before start (2023-03)',
      ]);
      expect(messages({ start: '2023-12', end: '2022-12' })).toHaveLength(1);
      expect(parse({ start: '2099-01', end: 'present' }).success).toBe(true);
    });
    it('rejects bad formats and months outside 01-12', () => {
      for (const start of [
        '2023-13',
        '2023-00',
        '2023-3',
        '23-03',
        '2023/03',
        '2023-03-01',
        'present',
        'March 2023',
        '',
      ]) {
        expect(parse({ start, end: 'present' }).success, `start ${start}`).toBe(false);
      }
      for (const end of ['2023-13', '2023-3', 'Present', 'now', '']) {
        expect(parse({ start: '2023-01', end }).success, `end ${end}`).toBe(false);
      }
      expect(parse({ start: 2023, end: 'present' }).success).toBe(false);
    });
    it('is independent of publication status (a draft may carry dates, dates never complete a draft)', () => {
      expect(parse({ start: '2023-03', end: 'present', status: 'draft' }).success).toBe(true);
      const paths = parse({ status: 'published' }).error?.issues.map((i) => i.path.join('.'));
      expect(paths).not.toContain('start');
      expect(paths).not.toContain('end');
    });
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
