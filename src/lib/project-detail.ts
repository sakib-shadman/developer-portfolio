/** /projects/[slug] logic (FR-05.11, FR-06, FR-14.7): which projects get a page, facts, links, SEO text. */
import { linkAttrs } from './link';
import type { ProjectCard, SkillGroup, Tech } from './content/types';

/** FR-05.11/06.8: a dedicated page exists only for projects that have a case study. */
export const detailPageProjects = (sorted: readonly ProjectCard[]): ProjectCard[] =>
  sorted.filter((p) => p.hasCaseStudy);

/** Previous/next in list order (the same order as /projects); no wrap-around at the ends. */
export function neighbours<T extends { slug: string }>(
  list: readonly T[],
  slug: string,
): { prev?: T; next?: T } {
  const i = list.findIndex((p) => p.slug === slug);
  if (i < 0) return {};
  return { prev: list[i - 1], next: list[i + 1] };
}

/** Ids of the skills in the "Platforms" group (iOS, Android, …). */
export const platformIds = (groups: readonly SkillGroup[]): Set<string> =>
  new Set(groups.find((g) => g.id === 'platforms')?.items.map((t) => t.id));

/** Splits a project's technologies into platforms and the rest of the stack. */
export function splitTech(technologies: readonly Tech[], platforms: ReadonlySet<string>) {
  return {
    platforms: technologies.filter((t) => platforms.has(t.id)),
    stack: technologies.filter((t) => !platforms.has(t.id)),
  };
}

export interface Fact {
  label: string;
  value: string;
}

/** Hero facts; an item with no data is omitted (there is no timeline field in the content model). */
export function detailFacts(
  project: ProjectCard,
  platforms: readonly Tech[],
  stack: readonly Tech[],
): Fact[] {
  const facts: Fact[] = [];
  if (project.role) facts.push({ label: 'Role', value: project.role });
  if (platforms.length) facts.push({ label: 'Platforms', value: platforms.map((t) => t.name).join(' · ') });
  if (stack.length) facts.push({ label: 'Stack', value: stack.map((t) => t.name).join(' · ') });
  return facts;
}

const LINKS = [
  ['store', 'App listing'],
  ['demo', 'Live demo'],
  ['repo', 'Source'],
  ['docs', 'Docs'],
] as const;

/** Configured, safe links in display order (first is the primary button). */
export const detailLinks = (links: ProjectCard['links']): { label: string; href: string }[] =>
  LINKS.flatMap(([key, label]) => {
    const href = links[key];
    return linkAttrs(href) ? [{ label, href: href as string }] : [];
  });

/** Meta description: the summary, else the case study's problem statement trimmed to ~160 chars. */
export function detailDescription(summary: string | undefined, problem: string, max = 160): string {
  if (summary) return summary;
  const text = problem.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 40 ? cut.lastIndexOf(' ') : cut.length)}…`;
}

/** Heading text → URL-safe fragment id. */
export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
