/** Collection entry → domain type. The only place that knows Astro's entry shape (ADR-0008). */
import type { CollectionEntry } from 'astro:content';
import type { ArticleCard, ExperienceItem, Img, Profile, ProjectCard, SkillGroup, Tech } from './types';

type Ref = { id: string };
export type SkillNames = ReadonlyMap<string, string>;

const CATEGORY_LABEL: Record<ProjectCard['category'], string> = {
  'mobile-app': 'Mobile app',
  sdk: 'SDK',
  library: 'Library',
  'open-source': 'Open source',
  'web-app': 'Web app',
  backend: 'Backend',
};

export const categoryLabel = (c: ProjectCard['category']): string => CATEGORY_LABEL[c];

const toImg = (img: { src: string; width: number; height: number }, alt: string): Img => ({
  src: img.src,
  width: img.width,
  height: img.height,
  alt,
});

export const toTech = (refs: Ref[], names: SkillNames): Tech[] =>
  refs.map((r) => ({ id: r.id, name: names.get(r.id) ?? r.id }));

export const toProfile = ({ data }: CollectionEntry<'profile'>): Profile => ({
  ...data,
  photo: data.photo ? toImg(data.photo.src, data.photo.alt) : undefined,
});

export const toSkillGroup = (
  { id, data }: CollectionEntry<'skillGroups'>,
  names: SkillNames,
): SkillGroup => ({
  id,
  title: data.title,
  items: toTech(data.items, names),
});

export const toExperienceItem = (
  { id, data }: CollectionEntry<'experience'>,
  names: SkillNames,
): ExperienceItem => ({
  id,
  company: data.company,
  title: data.title,
  startDate: data.startDate,
  endDate: data.endDate,
  current: data.endDate === null,
  description: data.description,
  responsibilities: data.responsibilities,
  achievements: data.achievements,
  technologies: toTech(data.technologies, names),
  companyUrl: data.companyUrl,
  draft: data.status === 'draft',
});

export const toProjectCard = ({ id, data }: CollectionEntry<'projects'>, names: SkillNames): ProjectCard => ({
  slug: id,
  name: data.name,
  label: data.label ?? CATEGORY_LABEL[data.category],
  category: data.category,
  summary: data.summary,
  description: data.description,
  technologies: toTech(data.technologies, names),
  role: data.role,
  contributions: data.contributions,
  links: data.links,
  media: data.media.map((m) => toImg(m.src, m.alt)),
  progress: data.progress,
  featured: data.featured,
  featuredOrder: data.featuredOrder,
  hasCaseStudy: Boolean(data.caseStudy),
  draft: data.status === 'draft',
});

export const toArticleCard = ({ id, data }: CollectionEntry<'articles'>): ArticleCard => ({
  id,
  title: data.title,
  url: data.url,
  publishedAt: data.publishedAt,
  excerpt: data.excerpt,
  thumbnail: data.thumbnail && data.thumbnailAlt ? toImg(data.thumbnail, data.thumbnailAlt) : undefined,
  tags: data.tags,
  readingMinutes: data.readingMinutes,
  featured: data.featured,
});
