import type { ExperienceItem, ProjectCard, SkillGroup } from './content/types';

/** Pure helpers for the home page composition. */

export interface HomeSection {
  id: string;
  label: string;
  visible: boolean;
}

/**
 * Eyebrow text ("01 — Skills") numbered over the sections actually rendered, in order,
 * so hiding one never leaves a gap. Hidden sections get no entry.
 */
export function numberSections(sections: HomeSection[]): Record<string, string> {
  const out: Record<string, string> = {};
  let n = 0;
  for (const s of sections) {
    if (!s.visible) continue;
    n += 1;
    out[s.id] = `${String(n).padStart(2, '0')} — ${s.label}`;
  }
  return out;
}

/** Splits the headline around the first occurrence of the accent word; no match → no accent. */
export function splitHeadline(
  headline: string,
  accent?: string,
): { before: string; accent: string; after: string } | undefined {
  if (!accent) return undefined;
  const i = headline.indexOf(accent);
  if (i < 0) return undefined;
  return { before: headline.slice(0, i), accent, after: headline.slice(i + accent.length) };
}

export interface HomeSections {
  /** Skill groups that have at least one item (empty groups never render). */
  skillGroups: SkillGroup[];
  experience: ExperienceItem[];
  /** Featured, published projects for the home slider (already ordered and capped). */
  featuredProjects: ProjectCard[];
  /** Which home anchors exist — drives the header nav. */
  rendered: { skills: boolean; experience: boolean; projects: boolean };
  /** "01 — Skills" etc., keyed by section id; absent for sections not rendered. */
  eyebrows: Record<string, string>;
}

/**
 * Single source of truth for which home sections render, shared by the header nav, the home page
 * and the section components so anchors and eyebrow numbers cannot drift.
 * Writing (PF-33) becomes `visible` here when it lands.
 */
export function composeHomeSections(input: {
  skillGroups: SkillGroup[];
  experience: ExperienceItem[];
  featuredProjects?: ProjectCard[];
}): HomeSections {
  const skillGroups = input.skillGroups.filter((g) => g.items.length > 0);
  const experience = input.experience;
  const featuredProjects = input.featuredProjects ?? [];
  const rendered = {
    skills: skillGroups.length > 0,
    experience: experience.length > 0,
    projects: featuredProjects.length > 0,
  };
  const eyebrows = numberSections([
    { id: 'skills', label: 'Skills', visible: rendered.skills },
    { id: 'experience', label: 'Experience', visible: rendered.experience },
    { id: 'projects', label: 'Projects', visible: rendered.projects },
    { id: 'writing', label: 'Writing', visible: false },
  ]);
  return { skillGroups, experience, featuredProjects, rendered, eyebrows };
}
