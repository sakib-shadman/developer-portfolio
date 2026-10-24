/**
 * /about view model (FR-02, HANDOFF §5). Pure: decides which sections exist and in what shape,
 * so the page template only renders what this returns. Nothing is invented — a section whose
 * data is missing is `undefined`/empty and the page omits it (FR-02.6).
 */
import type { Profile, SkillGroup } from './content/types';

export interface ExpertiseCard {
  title: string;
  items: string[];
}
export interface NumberedPrinciple {
  num: string;
  title: string;
  text: string;
}

export interface AboutModel {
  /** Hero paragraphs: the bio, or the short intro when no bio is written yet. */
  lead: string[];
  years?: string;
  expertise: ExpertiseCard[];
  principles: NumberedPrinciple[];
  community: string[];
  /** "Looking for" copy: the career objective, else the availability line. */
  objective?: string;
  interests: string[];
}

const clean = (s: string | undefined): string | undefined => s?.trim() || undefined;
const cleanList = (xs: string[]): string[] => xs.map((x) => x.trim()).filter(Boolean);

/** "1 year" / "12 years"; undefined for missing or non-positive values. */
export function yearsLabel(n: number | undefined): string | undefined {
  if (n === undefined || !Number.isFinite(n) || n < 1) return undefined;
  const whole = Math.floor(n);
  return `${whole} ${whole === 1 ? 'year' : 'years'}`;
}

/** Zero-padded ordinals: 1 → "01". */
export const ordinal = (i: number): string => String(i + 1).padStart(2, '0');

/**
 * Expertise comes from the skill groups (each group → one card). Without groups, `profile.focus`
 * becomes a single "Focus" card; without either, no section.
 */
export function expertiseCards(groups: SkillGroup[], focus: string[]): ExpertiseCard[] {
  const fromGroups = groups
    .map((g) => ({ title: g.title, items: g.items.map((t) => t.name) }))
    .filter((c) => c.items.length > 0);
  if (fromGroups.length) return fromGroups;
  const f = cleanList(focus);
  return f.length ? [{ title: 'Focus', items: f }] : [];
}

export function buildAbout(profile: Profile, groups: SkillGroup[]): AboutModel {
  const bio = cleanList(profile.bio);
  const intro = clean(profile.intro);
  return {
    lead: bio.length ? bio : intro ? [intro] : [],
    years: yearsLabel(profile.yearsExperience),
    expertise: expertiseCards(groups, profile.focus),
    principles: profile.principles.map((p, i) => ({ num: ordinal(i), title: p.title, text: p.text })),
    community: cleanList(profile.community),
    objective: clean(profile.objective) ?? clean(profile.availability),
    interests: cleanList(profile.interests),
  };
}
