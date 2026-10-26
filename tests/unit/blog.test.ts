import { describe, expect, it } from 'vitest';
import {
  ALL_TAGS,
  PAGE_SIZE,
  blogQuery,
  buildTagFilters,
  counterParts,
  filterArticles,
  formatMeta,
  formatPublished,
  hasTagRow,
  isFiltered,
  matchesQuery,
  paginate,
  parseBlogState,
} from '../../src/lib/blog';

const a = (title: string, tags: string[] = [], excerpt?: string) => ({ title, tags, excerpt });
const items = [
  a('Flutter state management', ['Flutter', 'Dart'], 'Riverpod versus Bloc.'),
  a('Kotlin coroutines', ['Android'], 'Structured concurrency explained'),
  a('Untagged note', [], 'About FLUTTER animations'),
];

describe('formatMeta', () => {
  const d = new Date('2026-05-14T00:00:00Z');
  it('formats date and reading time', () => {
    expect(formatMeta(d, 9)).toBe('May 14, 2026 · ≈ 9 min read');
  });
  it('omits unknown parts', () => {
    expect(formatMeta(d, undefined)).toBe('May 14, 2026');
    expect(formatMeta(undefined, 4)).toBe('≈ 4 min read');
    expect(formatMeta(undefined, undefined)).toBe('');
    expect(formatMeta(new Date('nope'), undefined)).toBe('');
  });
  it('uses UTC so a date-only value never shifts', () => {
    expect(formatPublished(new Date('2026-01-01T00:00:00Z'))).toBe('Jan 1, 2026');
    expect(formatPublished(new Date('2026-12-31T23:59:59Z'))).toBe('Dec 31, 2026');
  });
});

describe('tag filters', () => {
  it('lists All first, then tags alphabetically with counts', () => {
    expect(buildTagFilters(items)).toEqual([
      { value: ALL_TAGS, label: 'All', count: 3 },
      { value: 'Android', label: 'Android', count: 1 },
      { value: 'Dart', label: 'Dart', count: 1 },
      { value: 'Flutter', label: 'Flutter', count: 1 },
    ]);
  });
  it('counts a repeated tag once per article', () => {
    expect(buildTagFilters([a('x', ['A', 'A'])])[1]?.count).toBe(1);
  });
  it('hides the row when no article has tags', () => {
    expect(hasTagRow(buildTagFilters([a('x'), a('y')]))).toBe(false);
    expect(hasTagRow(buildTagFilters(items))).toBe(true);
    expect(hasTagRow(buildTagFilters([]))).toBe(false);
  });
});

describe('search and filter', () => {
  it('matches title and excerpt case-insensitively', () => {
    expect(matchesQuery(items[0]!, 'FLUTTER')).toBe(true);
    expect(matchesQuery(items[0]!, 'riverpod')).toBe(true);
    expect(matchesQuery(items[1]!, 'riverpod')).toBe(false);
  });
  it('requires every word and ignores extra whitespace', () => {
    expect(matchesQuery(items[0]!, '  flutter   bloc ')).toBe(true);
    expect(matchesQuery(items[0]!, 'flutter kotlin')).toBe(false);
    expect(matchesQuery(items[0]!, '   ')).toBe(true);
  });
  it('does not search tags or missing excerpts', () => {
    expect(matchesQuery(items[0]!, 'dart')).toBe(false);
    expect(matchesQuery(a('T'), 'undefined')).toBe(false);
  });
  it('combines tag and query', () => {
    expect(filterArticles(items, { tag: ALL_TAGS, q: '' })).toHaveLength(3);
    expect(filterArticles(items, { tag: 'Flutter', q: '' }).map((x) => x.title)).toEqual([
      'Flutter state management',
    ]);
    expect(filterArticles(items, { tag: ALL_TAGS, q: 'flutter' })).toHaveLength(2);
    expect(filterArticles(items, { tag: 'Android', q: 'flutter' })).toHaveLength(0);
  });
});

describe('paginate', () => {
  const nine = Array.from({ length: 9 }, (_, i) => i);
  it('shows the first page and reports more', () => {
    expect(PAGE_SIZE).toBe(6);
    const p = paginate(nine, 1);
    expect(p.visible).toHaveLength(6);
    expect(p).toMatchObject({ total: 9, hasMore: true });
  });
  it('accumulates pages and stops at the end', () => {
    expect(paginate(nine, 2)).toMatchObject({ total: 9, hasMore: false });
    expect(paginate(nine, 2).visible).toHaveLength(9);
    expect(paginate(nine, 99).visible).toHaveLength(9);
  });
  it('treats an exact multiple as complete and an empty list as empty', () => {
    expect(paginate([1, 2, 3, 4, 5, 6], 1).hasMore).toBe(false);
    expect(paginate([], 1)).toEqual({ visible: [], total: 0, hasMore: false });
    expect(paginate(nine, 0).visible).toHaveLength(6);
  });
});

describe('URL state', () => {
  const avail = [ALL_TAGS, 'Flutter', 'Android'];
  it('parses tag and q', () => {
    expect(parseBlogState('?tag=Flutter&q=state', avail)).toEqual({ tag: 'Flutter', q: 'state' });
  });
  it('matches the tag ignoring case and returns the canonical spelling', () => {
    expect(parseBlogState('?tag=flutter', avail).tag).toBe('Flutter');
  });
  it('falls back to All for unknown tags, the sentinel and no params', () => {
    expect(parseBlogState('?tag=Rust', avail).tag).toBe(ALL_TAGS);
    expect(parseBlogState('?tag=*', avail).tag).toBe(ALL_TAGS);
    expect(parseBlogState('', avail)).toEqual({ tag: ALL_TAGS, q: '' });
  });
  it('serialises only what is set', () => {
    expect(blogQuery({ tag: ALL_TAGS, q: '' })).toBe('');
    expect(blogQuery({ tag: 'Flutter', q: '' })).toBe('?tag=Flutter');
    expect(blogQuery({ tag: ALL_TAGS, q: ' a b ' })).toBe('?q=a+b');
    expect(blogQuery({ tag: 'Flutter', q: 'x' })).toBe('?tag=Flutter&q=x');
  });
  it('round-trips', () => {
    const s = { tag: 'Android', q: 'coroutines & more' };
    expect(parseBlogState(blogQuery(s), avail)).toEqual(s);
  });
  it('knows when it is filtered', () => {
    expect(isFiltered({ tag: ALL_TAGS, q: '' })).toBe(false);
    expect(isFiltered({ tag: ALL_TAGS, q: ' ' })).toBe(false);
    expect(isFiltered({ tag: 'A', q: '' })).toBe(true);
    expect(isFiltered({ tag: ALL_TAGS, q: 'x' })).toBe(true);
  });
});

describe('counterParts', () => {
  it('splits the number from the rest', () => {
    expect(counterParts(6, 9)).toEqual({ shown: '6', rest: ' of 9' });
    expect(counterParts(0, 0)).toEqual({ shown: '0', rest: ' of 0' });
  });
});
