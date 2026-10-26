/**
 * Data access for pages (ADR-0008). Thin I/O over astro:content; logic lives in logic.ts.
 * Swapping files for a backend means changing loaders in content.config.ts, not this API.
 */
import { getCollection, getEntry, render } from 'astro:content';
import {
  isVisible,
  pickFeaturedProjects,
  pickHomeArticles,
  sortArticles,
  sortExperience,
  assertUniqueUrls,
} from './logic';
import {
  toArticleCard,
  toExperienceItem,
  toProfile,
  toProjectCard,
  toSkillGroup,
  type SkillNames,
} from './mappers';
import { composeHomeSections, type HomeSections } from '../home';
import type {
  ArticleCard,
  CaseStudy,
  CaseStudyContent,
  ExperienceItem,
  Profile,
  ProjectCard,
  SkillGroup,
} from './types';

// Drafts render in `astro dev` and in e2e/test builds (PUBLIC_INCLUDE_DRAFTS=true) so pages can be
// built and tested before the owner's real content is complete. Never set it for live deploys.
const includeDrafts = import.meta.env.DEV || import.meta.env.PUBLIC_INCLUDE_DRAFTS === 'true';

let skillNames: Promise<SkillNames> | undefined;
const getSkillNames = (): Promise<SkillNames> =>
  (skillNames ??= getCollection('skills').then((s) => new Map(s.map((e) => [e.id, e.data.name]))));

export async function getProfile(): Promise<Profile> {
  const entry = await getEntry('profile', 'main');
  if (!entry) throw new Error('src/content/profile.json must contain a "main" entry');
  return toProfile(entry);
}

export async function getSkillGroups(): Promise<SkillGroup[]> {
  const [groups, names] = await Promise.all([getCollection('skillGroups'), getSkillNames()]);
  return groups.sort((a, b) => a.data.order - b.data.order).map((g) => toSkillGroup(g, names));
}

export async function getExperience(): Promise<ExperienceItem[]> {
  const [entries, names] = await Promise.all([
    getCollection('experience', (e) => isVisible(e.data.status, includeDrafts)),
    getSkillNames(),
  ]);
  return sortExperience(entries.map((e) => toExperienceItem(e, names)));
}

export async function getProjects(): Promise<ProjectCard[]> {
  const [entries, names] = await Promise.all([
    getCollection('projects', (p) => isVisible(p.data.status, includeDrafts)),
    getSkillNames(),
  ]);
  return entries.map((p) => toProjectCard(p, names)).sort((a, b) => a.name.localeCompare(b.name));
}

/** The case study linked from a project, with its MDX rendered; undefined when there is none. */
export async function getCaseStudy(project: ProjectCard): Promise<CaseStudy | undefined> {
  if (!project.caseStudyId) return undefined;
  const entry = await getEntry('caseStudies', project.caseStudyId);
  if (!entry) return undefined;
  if (entry.data.project.id !== project.slug) {
    throw new Error(
      `Case study "${entry.id}" belongs to project "${entry.data.project.id}" but is linked from "${project.slug}"`,
    );
  }
  const { Content } = await render(entry);
  return {
    id: entry.id,
    problem: entry.data.problem,
    outcomes: entry.data.outcomes,
    Content: Content as unknown as CaseStudyContent,
  };
}

export async function getFeaturedProjects(): Promise<ProjectCard[]> {
  return pickFeaturedProjects(await getProjects());
}

export async function getArticles(): Promise<ArticleCard[]> {
  const entries = await getCollection('articles', (a) => isVisible(a.data.status, includeDrafts));
  return sortArticles(assertUniqueUrls(entries.map(toArticleCard)));
}

export async function getHomeArticles(n = 6): Promise<ArticleCard[]> {
  return pickHomeArticles(await getArticles(), n);
}

/** Home sections that actually render (shared by PageLayout nav, home page and numbering). */
export async function getHomeSections(): Promise<HomeSections> {
  const [skillGroups, experience] = await Promise.all([getSkillGroups(), getExperience()]);
  return composeHomeSections({ skillGroups, experience });
}
