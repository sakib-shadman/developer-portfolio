import { describe, expect, it } from 'vitest';
import { buildAbout, expertiseCards, ordinal, yearsLabel } from '../../src/lib/about';
import type { Profile, SkillGroup } from '../../src/lib/content/types';

const profile: Profile = {
  name: 'A B',
  title: 'SE',
  headline: 'h',
  intro: 'Short intro.',
  focus: ['Flutter', 'iOS'],
  links: {},
  stats: [],
  bio: [],
  principles: [],
  expertise: [],
  community: [],
  interests: [],
};
const groups: SkillGroup[] = [
  { id: 'a', title: 'Languages', items: [{ id: 'dart', name: 'Dart' }] },
  { id: 'empty', title: 'Empty', items: [] },
];

describe('yearsLabel', () => {
  it('formats singular/plural and rejects missing or invalid', () => {
    expect(yearsLabel(1)).toBe('1 year');
    expect(yearsLabel(12)).toBe('12 years');
    expect(yearsLabel(12.9)).toBe('12 years');
    expect(yearsLabel(undefined)).toBeUndefined();
    expect(yearsLabel(0)).toBeUndefined();
    expect(yearsLabel(Number.NaN)).toBeUndefined();
  });
});

describe('ordinal', () => {
  it('zero-pads from 01', () => {
    expect([0, 8, 9].map(ordinal)).toEqual(['01', '09', '10']);
  });
});

describe('expertiseCards', () => {
  it('maps non-empty groups to cards', () => {
    expect(expertiseCards(groups, ['x'])).toEqual([{ title: 'Languages', items: ['Dart'] }]);
  });
  it('prefers curated expertise, keeps text, drops empty cards', () => {
    const curated = [
      { title: 'Mobile', text: ' Apps. ', items: ['Flutter', ' '] },
      { title: 'Text only', items: [] as string[], text: 'Just text' },
      { title: 'Nothing', items: [] as string[] },
    ];
    expect(expertiseCards(groups, ['x'], curated)).toEqual([
      { title: 'Mobile', text: 'Apps.', items: ['Flutter'] },
      { title: 'Text only', text: 'Just text', items: [] },
    ]);
  });
  it('falls back to groups when curated is all empty', () => {
    expect(expertiseCards(groups, [], [{ title: 'N', items: [] }])).toHaveLength(1);
  });
  it('falls back to focus, then to nothing', () => {
    expect(expertiseCards([], [' Flutter ', ''])).toEqual([{ title: 'Focus', items: ['Flutter'] }]);
    expect(expertiseCards([], [])).toEqual([]);
  });
});

describe('buildAbout', () => {
  it('with minimal content falls back to intro/focus/availability and omits the rest', () => {
    const m = buildAbout({ ...profile, availability: 'Open to roles.' }, []);
    expect(m).toEqual({
      title: 'About A B',
      lead: ['Short intro.'],
      years: undefined,
      expertise: [{ title: 'Focus', items: ['Flutter', 'iOS'] }],
      principles: [],
      community: [],
      objective: 'Open to roles.',
      interests: [],
    });
  });

  it('prefers bio over intro and objective over availability; numbers principles', () => {
    const m = buildAbout(
      {
        ...profile,
        bio: ['One.', ' ', 'Two.'],
        objective: 'Senior mobile roles.',
        availability: 'ignored',
        yearsExperience: 10,
        principles: [
          { title: 'P1', text: 't1' },
          { title: 'P2', text: 't2' },
        ],
        community: [{ text: ' Mentoring ', href: '/blog' }, { text: 'Talks' }, { text: ' ' }],
        aboutTitle: ' Hi there ',
        interests: ['Chess'],
      },
      groups,
    );
    expect(m.lead).toEqual(['One.', 'Two.']);
    expect(m.objective).toBe('Senior mobile roles.');
    expect(m.years).toBe('10 years');
    expect(m.principles.map((p) => p.num)).toEqual(['01', '02']);
    expect(m.community).toEqual([{ text: 'Mentoring', href: '/blog' }, { text: 'Talks' }]);
    expect(m.title).toBe('Hi there');
    expect(m.interests).toEqual(['Chess']);
    expect(m.expertise).toHaveLength(1);
  });

  it('blank objective and intro yield nothing', () => {
    const m = buildAbout({ ...profile, intro: ' ', objective: ' ', focus: [] }, []);
    expect(m.lead).toEqual([]);
    expect(m.objective).toBeUndefined();
    expect(m.expertise).toEqual([]);
  });
});
