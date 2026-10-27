/**
 * /blog logic (FR-08): tag filters, search, pagination, URL state, counter and card meta text.
 * Pure and DOM-free: the page script and unit tests share it. Helpers are generic over the few
 * fields they read so the script can run them on DOM-backed items.
 */

export const PAGE_SIZE = 6;
export const TAG_PARAM = 'tag';
export const QUERY_PARAM = 'q';
/** Sentinel filter value for "All" (never a real tag). */
export const ALL_TAGS = '*';

export interface BlogItem {
  title: string;
  excerpt?: string | undefined;
  tags: readonly string[];
}

export interface TagFilter {
  value: string;
  label: string;
  count: number;
}

export interface BlogState {
  /** `ALL_TAGS` or one of the tags that has a pill. */
  tag: string;
  /** Trimmed search text ("" = no search). */
  q: string;
}

export const EMPTY_STATE: BlogState = { tag: ALL_TAGS, q: '' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** "May 14, 2026" (UTC, so a date-only front matter value never shifts a day by time zone). */
export function formatPublished(date: Date): string {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/** Card meta line: "May 14, 2026 · ≈ 9 min read"; unknown parts are omitted. */
export function formatMeta(date: Date | undefined, readingMinutes: number | undefined): string {
  const parts: string[] = [];
  if (date && !Number.isNaN(date.getTime())) parts.push(formatPublished(date));
  if (readingMinutes) parts.push(`≈ ${readingMinutes} min read`);
  return parts.join(' · ');
}

/** "All" first, then every tag in use (alphabetical) with its article count. */
export function buildTagFilters(items: readonly BlogItem[]): TagFilter[] {
  const counts = new Map<string, number>();
  for (const a of items) for (const t of new Set(a.tags)) counts.set(t, (counts.get(t) ?? 0) + 1);
  const tags = [...counts.keys()].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  return [
    { value: ALL_TAGS, label: 'All', count: items.length },
    ...tags.map((t) => ({ value: t, label: t, count: counts.get(t) as number })),
  ];
}

/** The tag row is shown only when at least one article has a tag (HANDOFF §6.3). */
export const hasTagRow = (filters: readonly TagFilter[]): boolean => filters.length > 1;

/** Case-insensitive search over title + excerpt; every whitespace-separated word must match. */
export function matchesQuery(item: BlogItem, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = `${item.title} ${item.excerpt ?? ''}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

export function filterArticles<T extends BlogItem>(items: readonly T[], state: BlogState): T[] {
  return items.filter(
    (a) => (state.tag === ALL_TAGS || a.tags.includes(state.tag)) && matchesQuery(a, state.q),
  );
}

/** First `page` pages of `matches`; `page` starts at 1. */
export function paginate<T>(matches: readonly T[], page: number, size = PAGE_SIZE) {
  const visible = matches.slice(0, Math.max(1, page) * size);
  return { visible, total: matches.length, hasMore: matches.length > visible.length };
}

/** Reads `?tag=` / `?q=`. An unknown tag (not in `available`) falls back to All; matching ignores case. */
export function parseBlogState(search: string, available: readonly string[]): BlogState {
  const params = new URLSearchParams(search);
  const raw = (params.get(TAG_PARAM) ?? '').trim().toLowerCase();
  const tag = available.find((t) => t.toLowerCase() === raw && t !== ALL_TAGS) ?? ALL_TAGS;
  return { tag, q: (params.get(QUERY_PARAM) ?? '').trim() };
}

/**
 * Query string for the state ("" when nothing is filtered, keeping the clean URL). Pass the current
 * `search` so unrelated params (utm_*, ...) survive: only `tag` and `q` are set or removed.
 */
export function blogQuery(state: BlogState, search = ''): string {
  const params = new URLSearchParams(search);
  params.delete(TAG_PARAM);
  params.delete(QUERY_PARAM);
  if (state.tag !== ALL_TAGS) params.set(TAG_PARAM, state.tag);
  if (state.q.trim()) params.set(QUERY_PARAM, state.q.trim());
  const s = params.toString();
  return s ? `?${s}` : '';
}

/** "Showing 6 of 9": the number is styled separately from the rest. */
export function counterParts(shown: number, total: number): { shown: string; rest: string } {
  return { shown: String(shown), rest: ` of ${total}` };
}

/** Text for the always-present status live region (announced after a filter, search or Load more). */
export const statusText = (shown: number, total: number): string =>
  total === 0 ? 'No articles match your search' : `Showing ${shown} of ${total}`;

export const isFiltered = (state: BlogState): boolean => state.tag !== ALL_TAGS || state.q.trim() !== '';
