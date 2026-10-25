/** Pure content logic over domain types — unit-tested, independent of the content source. */
import type { ArticleCard, ExperienceItem, ProjectCard } from './types';

export const MAX_FEATURED_PROJECTS = 6;

/** Drafts are visible only in local dev; archived never (FR-05.9). */
export function isVisible(status: string, includeDrafts: boolean): boolean {
  return status === 'published' || (includeDrafts && status === 'draft');
}

/** FR-07.10: duplicates are a build error, not a silent skip. */
export function assertUniqueUrls<T extends { id: string; url: string }>(items: T[]): T[] {
  const seen = new Map<string, string>();
  for (const item of items) {
    const dupe = seen.get(item.url);
    if (dupe) throw new Error(`Duplicate article URL in "${item.id}" and "${dupe}": ${item.url}`);
    seen.set(item.url, item.id);
  }
  return items;
}

/** FR-07.11: newest first; ties broken by title for a stable order. */
export function sortArticles(items: ArticleCard[]): ArticleCard[] {
  return [...items].sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime() || a.title.localeCompare(b.title),
  );
}

/** FR-09.2/09.3: explicitly featured first, otherwise latest N. */
export function pickHomeArticles(sorted: ArticleCard[], n = 6): ArticleCard[] {
  const featured = sorted.filter((a) => a.featured);
  return (featured.length ? featured : sorted).slice(0, n);
}

/** FR-03.7: current roles first, then by start date (newest first); undated last. */
export function sortExperience(items: ExperienceItem[]): ExperienceItem[] {
  const start = (e: ExperienceItem) => e.startDate?.getTime() ?? -Infinity;
  return [...items].sort((a, b) => Number(b.current) - Number(a.current) || start(b) - start(a));
}

/** Featured projects by featuredOrder (unordered last), then name. */
export function compareFeatured(a: ProjectCard, b: ProjectCard): number {
  return (
    (a.featuredOrder ?? Number.MAX_SAFE_INTEGER) - (b.featuredOrder ?? Number.MAX_SAFE_INTEGER) ||
    a.name.localeCompare(b.name)
  );
}

/** FR-05.7/05.10: featured only, by featuredOrder then name, capped. */
export function pickFeaturedProjects(items: ProjectCard[], max = MAX_FEATURED_PROJECTS): ProjectCard[] {
  return items
    .filter((p) => p.featured)
    .sort(compareFeatured)
    .slice(0, max);
}

/** Category counts for /projects filter pills (FR-05.8); zero-count categories omitted. */
export function countByCategory(
  items: readonly { category: ProjectCard['category'] }[],
): Map<ProjectCard['category'], number> {
  const counts = new Map<ProjectCard['category'], number>();
  for (const p of items) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  return counts;
}
