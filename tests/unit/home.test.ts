import { describe, expect, it } from 'vitest';
import { formatDateRange, formatMonthYear } from '../../src/lib/date-range';
import { numberSections, splitHeadline } from '../../src/lib/home';

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
