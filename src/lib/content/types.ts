/**
 * Domain types — the only data shapes components and pages consume (ADR-0008).
 * They must not depend on astro:content so the source (files today, an API later) can change.
 */
import type { ImageMetadata } from 'astro';

export interface Img {
  /** astro:assets metadata (not a URL string) so <Image> can resize/convert; width/height mirror it. */
  src: ImageMetadata;
  width: number;
  height: number;
  alt: string;
}

export interface Profile {
  name: string;
  title: string;
  headline: string;
  headlineAccent?: string;
  intro: string;
  location?: string;
  timezone?: string;
  focus: string[];
  now?: string;
  email?: string;
  links: { github?: string; linkedin?: string; medium?: string };
  resume?: string;
  photo?: Img;
  stats: { label: string; value: string; suffix?: string }[];
  availability?: string;
  bio: string[];
  principles: { title: string; text: string }[];
  objective?: string;
  yearsExperience?: number;
  aboutTitle?: string;
  expertise: { title: string; text?: string; items: string[] }[];
  community: { text: string; href?: string }[];
  interests: string[];
  replyTime?: string;
}

export interface Tech {
  id: string;
  name: string;
}

export interface SkillGroup {
  id: string;
  title: string;
  items: Tech[];
}

export interface ExperienceItem {
  id: string;
  company: string;
  title?: string;
  startDate?: Date;
  /** null = current role */
  endDate?: Date | null;
  current: boolean;
  description?: string;
  responsibilities: string[];
  achievements: string[];
  technologies: Tech[];
  companyUrl?: string;
  draft: boolean;
}

export type ProjectCategory = 'mobile-app' | 'sdk' | 'library' | 'open-source' | 'web-app' | 'backend';

export interface ProjectCard {
  slug: string;
  name: string;
  label: string;
  category: ProjectCategory;
  summary?: string;
  description?: string;
  technologies: Tech[];
  role?: string;
  contributions: string[];
  links: { repo?: string; demo?: string; store?: string; docs?: string };
  media: Img[];
  progress?: 'in-progress' | 'shipped';
  featured: boolean;
  featuredOrder?: number;
  hasCaseStudy: boolean;
  draft: boolean;
}

export interface ArticleCard {
  id: string;
  title: string;
  url: string;
  publishedAt: Date;
  excerpt?: string;
  thumbnail?: Img;
  tags: string[];
  readingMinutes?: number;
  featured: boolean;
}
