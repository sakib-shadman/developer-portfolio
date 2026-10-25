/**
 * /projects page logic (FR-05.8): ordering, derived category filters, URL param, counter text.
 * Pure and DOM-free so the page script and unit tests share it. The filter helpers are generic
 * over `{ category }` so the script can run them on DOM-backed items.
 */
import { compareFeatured, countByCategory } from './content/logic';
import { categoryLabel } from './content/mappers';
import type { ProjectCard, ProjectCategory } from './content/types';

export type CategoryFilter = ProjectCategory | 'all';

export interface FilterOption {
  value: CategoryFilter;
  label: string;
  count: number;
}

/** Display order of category pills (matches the design: apps, SDKs, backend, open source). */
export const CATEGORY_ORDER: readonly ProjectCategory[] = [
  'mobile-app',
  'sdk',
  'library',
  'web-app',
  'backend',
  'open-source',
];

/** Query-string key used to deep-link a category (`/projects?category=sdk`). */
export const CATEGORY_PARAM = 'category';

/** Featured first (shared comparator with the home page), then the rest by name. */
export function sortProjects(items: ProjectCard[]): ProjectCard[] {
  return [...items].sort((a, b) =>
    a.featured !== b.featured
      ? a.featured
        ? -1
        : 1
      : a.featured
        ? compareFeatured(a, b)
        : a.name.localeCompare(b.name),
  );
}

const UNCOUNTABLE: ReadonlySet<ProjectCategory> = new Set(['backend', 'open-source']);

/** Pill label: "Mobile app" → "Mobile apps", "SDK" → "SDKs", "Library" → "Libraries". */
export function pluralCategoryLabel(c: ProjectCategory): string {
  const label = categoryLabel(c);
  if (UNCOUNTABLE.has(c)) return label;
  return label.endsWith('y') ? `${label.slice(0, -1)}ies` : `${label}s`;
}

/** "All" first, then only the categories that have projects, each with its count. */
export function buildFilters(items: readonly { category: ProjectCategory }[]): FilterOption[] {
  const counts = countByCategory(items);
  return [
    { value: 'all', label: 'All', count: items.length },
    ...CATEGORY_ORDER.filter((c) => counts.has(c)).map((c) => ({
      value: c,
      label: pluralCategoryLabel(c),
      count: counts.get(c) as number,
    })),
  ];
}

export function filterByCategory<T extends { category: ProjectCategory }>(
  items: readonly T[],
  filter: CategoryFilter,
): T[] {
  return filter === 'all' ? [...items] : items.filter((p) => p.category === filter);
}

/** Only a category that has a pill is accepted (so the pressed pill always shows the active filter). */
export function parseCategory(
  raw: string | null | undefined,
  available: readonly CategoryFilter[] = ['all', ...CATEGORY_ORDER],
): CategoryFilter {
  return available.find((c) => c === raw) ?? 'all';
}

/** Query string for the filter ("" for All, so the clean URL is kept). */
export function categoryQuery(filter: CategoryFilter): string {
  return filter === 'all' ? '' : `?${CATEGORY_PARAM}=${encodeURIComponent(filter)}`;
}

/** Counter pieces: the number is styled separately from the rest ("2" + " of 3 projects"). */
export function counterParts(shown: number, total: number): { shown: string; rest: string } {
  return { shown: String(shown), rest: ` of ${total} ${total === 1 ? 'project' : 'projects'}` };
}
