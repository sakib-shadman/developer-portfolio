import { describe, expect, it } from 'vitest';
import {
  categoryLabel,
  toArticleCard,
  toExperienceItem,
  toProfile,
  toProjectCard,
  toSkillGroup,
  toTech,
} from '../../src/lib/content/mappers';

const names = new Map([
  ['flutter', 'Flutter'],
  ['dart', 'Dart'],
]);

describe('mappers', () => {
  it('toTech resolves names, falls back to id', () => {
    expect(toTech([{ id: 'flutter' }, { id: 'zig' }], names)).toEqual([
      { id: 'flutter', name: 'Flutter' },
      { id: 'zig', name: 'zig' },
    ]);
  });

  it('toProjectCard defaults label from category and flags drafts', () => {
    const card = toProjectCard(
      {
        id: 'lms-cricket',
        collection: 'projects',
        data: {
          name: 'LMS Cricket',
          category: 'mobile-app',
          technologies: [{ id: 'flutter', collection: 'skills' }],
          contributions: [],
          links: {},
          media: [],
          featured: true,
          status: 'draft',
        },
      } as never,
      names,
    );
    expect(card).toMatchObject({
      slug: 'lms-cricket',
      label: 'Mobile app',
      draft: true,
      hasCaseStudy: false,
    });
    expect(card.technologies).toEqual([{ id: 'flutter', name: 'Flutter' }]);
    expect(categoryLabel('sdk')).toBe('SDK');
  });

  it('toExperienceItem: endDate null means current', () => {
    const item = toExperienceItem(
      {
        id: 'vivasoft',
        collection: 'experience',
        data: {
          company: 'Vivasoft',
          endDate: null,
          responsibilities: [],
          achievements: [],
          technologies: [],
          status: 'draft',
        },
      } as never,
      names,
    );
    expect(item).toMatchObject({ current: true, draft: true });
  });

  it('toArticleCard drops a thumbnail without alt', () => {
    const card = toArticleCard({
      id: 'a',
      collection: 'articles',
      data: {
        title: 'A',
        url: 'https://medium.com/@me/a',
        publishedAt: new Date('2026-01-01'),
        thumbnail: { src: '/a.png', width: 10, height: 10, format: 'png' },
        tags: [],
        featured: false,
        status: 'published',
      },
    } as never);
    expect(card.thumbnail).toBeUndefined();
  });

  it('toProfile maps the photo to an Img', () => {
    const p = toProfile({
      id: 'main',
      collection: 'profile',
      data: {
        name: 'S',
        title: 'SE',
        headline: 'H',
        intro: 'I',
        focus: [],
        links: {},
        stats: [],
        bio: [],
        principles: [],
        photo: { src: { src: '/me.jpg', width: 800, height: 1000, format: 'jpg' }, alt: 'Portrait' },
      },
    } as never);
    const meta = { src: '/me.jpg', width: 800, height: 1000, format: 'jpg' };
    expect(p.photo).toEqual({ src: meta, width: 800, height: 1000, alt: 'Portrait' });
    const noPhoto = toProfile({
      id: 'main',
      collection: 'profile',
      data: {
        name: 'S',
        title: 'SE',
        headline: 'H',
        intro: 'I',
        focus: [],
        links: {},
        stats: [],
        bio: [],
        principles: [],
      },
    } as never);
    expect(noPhoto.photo).toBeUndefined();
  });

  it('toSkillGroup resolves item names', () => {
    const g = toSkillGroup(
      {
        id: 'frameworks',
        collection: 'skillGroups',
        data: { title: 'Frameworks', order: 2, items: [{ id: 'flutter' }] },
      } as never,
      names,
    );
    expect(g).toEqual({ id: 'frameworks', title: 'Frameworks', items: [{ id: 'flutter', name: 'Flutter' }] });
  });

  it('toArticleCard keeps a thumbnail with alt', () => {
    const card = toArticleCard({
      id: 'b',
      collection: 'articles',
      data: {
        title: 'B',
        url: 'https://medium.com/@me/b',
        publishedAt: new Date('2026-01-01'),
        thumbnail: { src: '/b.png', width: 10, height: 10, format: 'png' },
        thumbnailAlt: 'Diagram',
        tags: [],
        featured: false,
        status: 'published',
      },
    } as never);
    expect(card.thumbnail).toEqual({
      src: { src: '/b.png', width: 10, height: 10, format: 'png' },
      width: 10,
      height: 10,
      alt: 'Diagram',
    });
  });
});
