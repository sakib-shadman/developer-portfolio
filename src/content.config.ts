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

const profile = defineCollection({
  loader: file('src/content/profile.json'),
  schema: ({ image }) => makeProfileSchema(image()),
});

const skills = defineCollection({
  loader: file('src/content/skills.json'),
  schema: skillSchema,
});

const skillGroups = defineCollection({
  loader: file('src/content/skill-groups.json'),
  schema: makeSkillGroupSchema(reference('skills')),
});

const experience = defineCollection({
  loader: file('src/content/experience.json'),
  schema: makeExperienceSchema(reference('skills')),
});

const projects = defineCollection({
  loader: glob({ pattern: '*.json', base: 'src/content/projects' }),
  schema: ({ image }) =>
    makeProjectSchema({
      image: image(),
      skillRef: reference('skills'),
      caseStudyRef: reference('caseStudies'),
    }),
});

const caseStudies = defineCollection({
  loader: glob({ pattern: '*.mdx', base: 'src/content/case-studies' }),
  schema: makeCaseStudySchema(reference('projects')),
});

const articles = defineCollection({
  loader: glob({ pattern: '*.md', base: 'src/content/articles' }),
  schema: ({ image }) => makeArticleSchema(image()),
});

export const collections = { profile, skills, skillGroups, experience, projects, caseStudies, articles };
