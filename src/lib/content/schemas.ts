/**
 * Content contract (SRS §6, ADR-0008).
 *
 * Schemas are factories so the same definition serves two purposes:
 *  - src/content.config.ts passes Astro's `image()` / `reference()` helpers (build-time validation)
 *  - the contract variants below pass plain strings (JSON Schema export for a future backend)
 *
 * Rule: `draft` records may be incomplete; `published` records must be complete (superRefine).
 * Nothing is ever invented to satisfy a required field — leave the record as draft instead.
 */
import { z } from 'astro/zod';
import { canonicalize } from '../url';

export const httpUrl = z.url({ protocol: /^https?$/ });
export const canonicalHttpsUrl = z.url({ protocol: /^https$/ }).transform(canonicalize);
export const publication = z.enum(['draft', 'published', 'archived']);

const need = (ctx: z.RefinementCtx, ok: unknown, path: string, why = 'required when published') => {
  if (!ok) ctx.addIssue({ code: 'custom', path: [path], message: `${path} is ${why}` });
};

// ---------- Profile (§6.1) ----------
export const makeProfileSchema = <I extends z.ZodType>(image: I) =>
  z.object({
    name: z.string().min(1),
    title: z.string().min(1),
    headline: z.string().min(1),
    /** Substring of `headline` rendered in the accent colour. */
    headlineAccent: z.string().optional(),
    intro: z.string().min(1),
    location: z.string().optional(),
    timezone: z.string().optional(),
    focus: z.array(z.string().min(1)).default([]),
    now: z.string().optional(),
    email: z.email().optional(),
    links: z.object({ github: httpUrl, linkedin: httpUrl, medium: httpUrl }).partial().default({}),
    /** File under public/, e.g. "/resume/shadman-sakib-resume.pdf". Build asserts it exists (PF-18). */
    resume: z
      .string()
      .regex(/^\/resume\/[\w.-]+\.pdf$/)
      .optional(),
    photo: z.object({ src: image, alt: z.string().min(1) }).optional(),
    stats: z
      .array(z.object({ label: z.string().min(1), value: z.string().min(1), suffix: z.string().optional() }))
      .max(3)
      .default([]),
    availability: z.string().optional(),
    bio: z.array(z.string().min(1)).default([]),
    principles: z.array(z.object({ title: z.string().min(1), text: z.string().min(1) })).default([]),
    objective: z.string().optional(),
    /** FR-02.2: shown on /about only when provided. */
    yearsExperience: z.number().int().positive().max(60).optional(),
    /** Overrides the /about h1 (default "About {name}"). */
    aboutTitle: z.string().min(1).optional(),
    /** Curated /about expertise cards (HANDOFF §5); falls back to skill groups, then `focus`. */
    expertise: z
      .array(
        z.object({
          title: z.string().min(1),
          text: z.string().min(1).optional(),
          items: z.array(z.string().min(1)).default([]),
        }),
      )
      .default([]),
    /** FR-02.4: talks, mentoring, open source, interviewing… one line each, optional link. */
    community: z
      .array(
        z.object({
          text: z.string().min(1),
          href: z.union([httpUrl, z.string().regex(/^\/(?!\/)[^\s\\]*$/)]).optional(),
        }),
      )
      .default([]),
    /** FR-02.4: "Outside work" interests. */
    interests: z.array(z.string().min(1)).default([]),
    replyTime: z.string().optional(),
  });

// ---------- Skills (§6.3) ----------
export const skillSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

/** Groups reference skills, so one skill (e.g. Go) can appear in several groups. */
export const makeSkillGroupSchema = <R extends z.ZodType>(skillRef: R) =>
  z.object({
    title: z.string().min(1),
    order: z.number().int(),
    items: z.array(skillRef).min(1),
  });

// ---------- Experience (§6.2) ----------
export const makeExperienceSchema = <R extends z.ZodType>(skillRef: R) =>
  z
    .object({
      company: z.string().min(1),
      title: z.string().min(1).optional(),
      startDate: z.coerce.date().optional(),
      /** null = current role (FR-03.3). Must be set (date or null) when published. */
      endDate: z.coerce.date().nullable().optional(),
      description: z.string().optional(),
      responsibilities: z.array(z.string().min(1)).default([]),
      achievements: z.array(z.string().min(1)).default([]),
      technologies: z.array(skillRef).default([]),
      companyUrl: httpUrl.optional(),
      status: z.enum(['draft', 'published']).default('draft'),
    })
    .superRefine((e, ctx) => {
      if (e.status === 'published') {
        need(ctx, e.title, 'title');
        need(ctx, e.startDate, 'startDate');
        need(ctx, e.endDate !== undefined, 'endDate', 'required when published (use null for current)');
      }
      if (e.startDate && e.endDate && e.endDate < e.startDate) {
        ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'endDate is before startDate' });
      }
    });

// ---------- Projects (§6.4) ----------
export const projectCategory = z.enum(['mobile-app', 'sdk', 'library', 'open-source', 'web-app', 'backend']);

export const makeProjectSchema = <I extends z.ZodType, S extends z.ZodType, C extends z.ZodType>(h: {
  image: I;
  skillRef: S;
  caseStudyRef: C;
}) =>
  z
    .object({
      name: z.string().min(1),
      /** Card eyebrow, e.g. "iOS SDK · Adtech". Defaults to the category label. */
      label: z.string().optional(),
      summary: z.string().max(200).optional(),
      description: z.string().optional(),
      category: projectCategory,
      technologies: z.array(h.skillRef).default([]),
      role: z.string().optional(),
      contributions: z.array(z.string().min(1)).default([]),
      links: z.object({ repo: httpUrl, demo: httpUrl, store: httpUrl, docs: httpUrl }).partial().default({}),
      media: z.array(z.object({ src: h.image, alt: z.string().min(1) })).default([]),
      progress: z.enum(['in-progress', 'shipped']).optional(),
      featured: z.boolean().default(false),
      featuredOrder: z.number().int().optional(),
      status: publication.default('draft'),
      caseStudy: h.caseStudyRef.optional(),
    })
    .superRefine((p, ctx) => {
      if (p.status === 'published') {
        need(ctx, p.summary, 'summary');
        need(ctx, p.description, 'description');
        need(ctx, p.role, 'role');
        need(ctx, p.technologies.length > 0, 'technologies');
      }
    });

// ---------- Case studies (FR-06) ----------
export const makeCaseStudySchema = <P extends z.ZodType>(projectRef: P) =>
  z.object({
    project: projectRef,
    problem: z.string().min(1),
    outcomes: z.array(z.string().min(1)).default([]),
  });

// ---------- Articles (§6.5, ADR-0003: manual, frontmatter only) ----------
export const makeArticleSchema = <I extends z.ZodType>(image: I) =>
  z
    .object({
      title: z.string().min(1),
      url: canonicalHttpsUrl,
      publishedAt: z.coerce.date(),
      excerpt: z.string().max(240).optional(),
      thumbnail: image.optional(),
      thumbnailAlt: z.string().optional(),
      tags: z.array(z.string().min(1)).default([]),
      readingMinutes: z.number().int().positive().optional(),
      featured: z.boolean().default(false),
      status: z.enum(['draft', 'published']).default('published'),
    })
    .superRefine((a, ctx) => {
      if (a.thumbnail && !a.thumbnailAlt) need(ctx, false, 'thumbnailAlt', 'required with thumbnail');
    });

// ---------- Contract variants (no Astro helpers) — exported as JSON Schema ----------
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'kebab-case id');
const mediaPath = z.string().min(1);

export const contract = {
  profile: makeProfileSchema(mediaPath),
  skill: skillSchema.extend({ id }),
  skillGroup: makeSkillGroupSchema(id).extend({ id }),
  experience: makeExperienceSchema(id),
  project: makeProjectSchema({ image: mediaPath, skillRef: id, caseStudyRef: id }),
  caseStudy: makeCaseStudySchema(id),
  article: makeArticleSchema(mediaPath),
};
