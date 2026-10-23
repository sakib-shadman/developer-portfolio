import { describe, expect, it } from 'vitest';
import { findPlaceholders, isPlaceholder } from '../../src/lib/content/guards';

describe('placeholder guard', () => {
  it.each(['[Project name]', '[X]', 'Built with [Tech]', 'TODO: write bio', 'TBD', 'Lorem ipsum dolor'])(
    'flags %s',
    (v) => expect(isPlaceholder(v)).toBe(true),
  );

  it.each(['Flutter', 'Large-scale live scoring and statistics app for cricket.', 'Array<Int>'])(
    'accepts %s',
    (v) => expect(isPlaceholder(v)).toBe(false),
  );

  it('reports JSON paths', () => {
    const hits = findPlaceholders({ name: 'ok', items: ['fine', { role: '[Your role]' }], n: 3, x: null });
    expect(hits).toEqual([{ path: '$.items[1].role', value: '[Your role]' }]);
  });
});
