/** Wires the content contract (src/lib/content/schemas.ts) to loaders. See ADR-0002 / ADR-0008. */
import { defineCollection, reference } from 'astro:content';
import { file, glob } from 'astro/loaders';
import {
  makeArticleSchema,
  makeCaseStudySchema,
  makeExperienceSchema,
  makeProfileSchema,
  makeProjectSchema,
  makeSkillGroupSchema,
  skillSchema,
} from './lib/content/schemas';
import { contentRoot } from './lib/content/root';

// PUBLIC_CONTENT_FIXTURES=true loads tests/fixtures/content instead (e2e only). Read from the process
// environment ONLY: import.meta.env would also pick it up from a stray .env file, which the build guard,
// content:check and the fixture PDF copy (all process.env) would not see.
const root = contentRoot(process.env.PUBLIC_CONTENT_FIXTURES);

const profile = defineCollection({
  loader: file(`${root}/profile.json`),
  schema: ({ image }) => makeProfileSchema(image()),
});

const skills = defineCollection({
  loader: file(`${root}/skills.json`),
  schema: skillSchema,
});

const skillGroups = defineCollection({
  loader: file(`${root}/skill-groups.json`),
  schema: makeSkillGroupSchema(reference('skills')),
});

const experience = defineCollection({
  loader: file(`${root}/experience.json`),
  schema: makeExperienceSchema(reference('skills')),
});

const projects = defineCollection({
  loader: glob({ pattern: '*.json', base: `${root}/projects` }),
  schema: ({ image }) =>
    makeProjectSchema({
      image: image(),
      skillRef: reference('skills'),
      caseStudyRef: reference('caseStudies'),
    }),
});

const caseStudies = defineCollection({
  loader: glob({ pattern: '*.mdx', base: `${root}/case-studies` }),
  schema: makeCaseStudySchema(reference('projects')),
});

const articles = defineCollection({
  loader: glob({ pattern: '*.md', base: `${root}/articles` }),
  schema: ({ image }) => makeArticleSchema(image()),
});

export const collections = { profile, skills, skillGroups, experience, projects, caseStudies, articles };
