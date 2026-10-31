import { describe, expect, it } from 'vitest';
import {
  formatDateRange,
  formatMonthRange,
  monthRangeParts,
  formatMonthYear,
} from '../../src/lib/date-range';
import { composeHomeSections, numberSections, splitHeadline } from '../../src/lib/home';

const d = (s: string) => new Date(s);

describe('formatDateRange', () => {
  it('formats months in UTC', () => {
    expect(formatMonthYear(d('2022-03-01'))).toBe('Mar 2022');
    expect(formatMonthYear(d('2021-12-31T23:59:59Z'))).toBe('Dec 2021');
  });
  it('current with start', () => {
    expect(formatDateRange({ startDate: d('2022-03-01'), endDate: null, current: true })).toBe(
      'Mar 2022 — Present',
    );
  });
  it('current without start has no date text', () => {
    expect(formatDateRange({ endDate: null, current: true })).toBeUndefined();
  });
  it('past with both, one, or neither date', () => {
    expect(formatDateRange({ startDate: d('2020-03-01'), endDate: d('2022-02-01'), current: false })).toBe(
      'Mar 2020 — Feb 2022',
    );
    expect(formatDateRange({ startDate: d('2020-03-01'), current: false })).toBe('Mar 2020');
    expect(formatDateRange({ endDate: d('2022-02-01'), current: false })).toBe('Until Feb 2022');
    expect(formatDateRange({ current: false })).toBeUndefined();
  });
});

describe('formatMonthRange (project timeline)', () => {
  it('finished: "Mar 2023 — Jun 2024"', () => {
    expect(formatMonthRange('2023-03', '2024-06')).toBe('Mar 2023 — Jun 2024');
  });
  it('ongoing: end "present" reads "Present"', () => {
    expect(formatMonthRange('2023-03', 'present')).toBe('Mar 2023 — Present');
  });
  it('start equal to end is a single month', () => {
    expect(formatMonthRange('2023-03', '2023-03')).toBe('Mar 2023');
  });
  it('covers every month name, the year boundary and old/new years', () => {
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    names.forEach((n, i) => {
      const mm = String(i + 1).padStart(2, '0');
      expect(formatMonthRange(`2020-${mm}`, `2021-${mm}`)).toBe(`${n} 2020 — ${n} 2021`);
    });
    expect(formatMonthRange('2022-12', '2023-01')).toBe('Dec 2022 — Jan 2023');
    expect(formatMonthRange('1999-01', '2100-12')).toBe('Jan 1999 — Dec 2100');
  });
  it('is timezone independent (UTC, never local time)', () => {
    const tz = process.env.TZ;
    for (const zone of ['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'America/Los_Angeles', 'UTC']) {
      process.env.TZ = zone;
      expect(formatMonthRange('2023-01', '2023-12')).toBe('Jan 2023 — Dec 2023');
    }
    if (tz === undefined) delete process.env.TZ;
    else process.env.TZ = tz;
  });
  it('reads exactly like the experience range for the same months', () => {
    expect(formatMonthRange('2022-03', 'present')).toBe(
      formatDateRange({ startDate: d('2022-03-01'), endDate: null, current: true }),
    );
    expect(formatMonthRange('2020-03', '2022-02')).toBe(
      formatDateRange({ startDate: d('2020-03-01'), endDate: d('2022-02-01'), current: false }),
    );
  });
  it('gives nothing for malformed input instead of a wrong date', () => {
    for (const [s, e] of [
      ['2023-13', '2024-01'],
      ['2023-00', '2024-01'],
      ['2023-3', '2024-01'],
      ['2023', '2024-01'],
      ['present', '2024-01'],
      ['', 'present'],
      ['2023-03', '2024-13'],
      ['2023-03', ''],
      ['2023-03-01', '2024-01'],
    ] as const) {
      expect(formatMonthRange(s, e), `${s} → ${e}`).toBeUndefined();
    }
  });
});

describe('numberSections', () => {
  const all = [
    { id: 'skills', label: 'Skills', visible: true },
    { id: 'experience', label: 'Experience', visible: true },
    { id: 'projects', label: 'Projects', visible: true },
    { id: 'writing', label: 'Writing', visible: true },
  ];
  it('numbers in order', () => {
    expect(numberSections(all)).toEqual({
      skills: '01 — Skills',
      experience: '02 — Experience',
      projects: '03 — Projects',
      writing: '04 — Writing',
    });
  });
  it('closes gaps when sections are hidden', () => {
    const r = numberSections(all.map((s) => (s.id === 'skills' ? { ...s, visible: false } : s)));
    expect(r.skills).toBeUndefined();
    expect(r.experience).toBe('01 — Experience');
    expect(r.writing).toBe('03 — Writing');
  });
  it('empty when nothing is visible', () => {
    expect(numberSections([])).toEqual({});
  });
});

describe('splitHeadline', () => {
  it('splits around the accent', () => {
    expect(splitHeadline('Apps, engineered for production.', 'engineered')).toEqual({
      before: 'Apps, ',
      accent: 'engineered',
      after: ' for production.',
    });
  });
  it('undefined without or with a non-matching accent', () => {
    expect(splitHeadline('Hello')).toBeUndefined();
    expect(splitHeadline('Hello', 'nope')).toBeUndefined();
  });
});

describe('composeHomeSections', () => {
  const group = (id: string, n: number) => ({
    id,
    title: id,
    items: Array.from({ length: n }, (_, i) => ({ id: `${id}${i}`, name: `${id}${i}` })),
  });
  const exp = [
    {
      id: 'a',
      company: 'A',
      current: false,
      responsibilities: [],
      achievements: [],
      technologies: [],
      draft: false,
    },
  ];

  it('numbers and nav agree: both sections present', () => {
    const r = composeHomeSections({ skillGroups: [group('g', 2)], experience: exp });
    expect(r.rendered).toEqual({ skills: true, experience: true, projects: false, writing: false });
    expect(r.eyebrows).toMatchObject({ skills: '01 — Skills', experience: '02 — Experience' });
  });
  it('drops empty skill groups; hides skills when none have items', () => {
    const r = composeHomeSections({ skillGroups: [group('empty', 0), group('g', 1)], experience: [] });
    expect(r.skillGroups.map((g) => g.id)).toEqual(['g']);
    expect(r.rendered).toEqual({ skills: true, experience: false, projects: false, writing: false });
    expect(r.eyebrows.experience).toBeUndefined();
    const none = composeHomeSections({ skillGroups: [group('empty', 0)], experience: exp });
    expect(none.rendered.skills).toBe(false);
    expect(none.eyebrows.experience).toBe('01 — Experience');
  });
});

describe('composeHomeSections with featured projects', () => {
  const proj = { slug: 'p' } as never;
  it('numbers Projects after the sections before it and hides it when none', () => {
    const r = composeHomeSections({ skillGroups: [], experience: [], featuredProjects: [proj] });
    expect(r.rendered).toEqual({ skills: false, experience: false, projects: true, writing: false });
    expect(r.eyebrows.projects).toBe('01 — Projects');
    const none = composeHomeSections({ skillGroups: [], experience: [] });
    expect(none.rendered.projects).toBe(false);
    expect(none.eyebrows.projects).toBeUndefined();
    expect(none.featuredProjects).toEqual([]);
    expect(r.projectsHref).toBe('#work');
    expect(none.projectsHref).toBe('/projects');
  });
});

describe('composeHomeSections with home articles', () => {
  const art = { id: 'a' } as never;
  it('numbers Writing after Projects and hides it when there are no articles', () => {
    const r = composeHomeSections({
      skillGroups: [],
      experience: [],
      featuredProjects: [{ slug: 'p' } as never],
      homeArticles: [art],
    });
    expect(r.rendered.writing).toBe(true);
    expect(r.eyebrows).toMatchObject({ projects: '01 — Projects', writing: '02 — Writing' });
    expect(r.homeArticles).toEqual([art]);
    const none = composeHomeSections({
      skillGroups: [],
      experience: [],
      featuredProjects: [{ slug: 'p' } as never],
    });
    expect(none.rendered.writing).toBe(false);
    expect(none.eyebrows.writing).toBeUndefined();
    expect(none.homeArticles).toEqual([]);
  });
  it('closes the gap when only writing renders', () => {
    const r = composeHomeSections({ skillGroups: [], experience: [], homeArticles: [art] });
    expect(r.eyebrows.writing).toBe('01 — Writing');
  });
});

describe('monthRangeParts (the <time> segments)', () => {
  it('months carry a YYYY-MM datetime; the dash and "Present" are plain text', () => {
    expect(monthRangeParts('2023-03', '2024-06')).toEqual([
      { text: 'Mar 2023', datetime: '2023-03' },
      { text: ' — ' },
      { text: 'Jun 2024', datetime: '2024-06' },
    ]);
    expect(monthRangeParts('2023-03', 'present')).toEqual([
      { text: 'Mar 2023', datetime: '2023-03' },
      { text: ' — ' },
      { text: 'Present' },
    ]);
  });
  it('start equal to end is one <time>', () => {
    expect(monthRangeParts('2023-03', '2023-03')).toEqual([{ text: 'Mar 2023', datetime: '2023-03' }]);
  });
  it('malformed input gives undefined', () => {
    expect(monthRangeParts('2023-13', 'present')).toBeUndefined();
    expect(monthRangeParts('2023-03', 'Present')).toBeUndefined();
  });
});
