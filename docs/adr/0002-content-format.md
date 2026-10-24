# ADR-0002 — Content as validated files (JSON, MDX, Markdown frontmatter)

- **Status:** accepted · 2026-10-23
- **SRS:** §6, §9.2, NFR-05

## Decision

Astro content collections with **Zod 4** schemas:

| Collection          | Source                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| profile             | `src/content/profile.json` (`main` entry)                                                               |
| skills, skillGroups | `skills.json`, `skill-groups.json` (groups reference skills, so one skill can appear in several groups) |
| experience          | `experience.json`                                                                                       |
| projects            | `src/content/projects/<slug>.json` (slug = stable URL, FR-05.11)                                        |
| caseStudies         | `src/content/case-studies/<slug>.mdx`                                                                   |
| articles            | `src/content/articles/<slug>.md` (frontmatter only)                                                     |

Every record has a `status`. **Draft records may be incomplete; published records must be complete** (enforced by `superRefine`). Drafts render only in `astro dev`.

`scripts/check-content.ts` runs before every build and fails on design placeholders (`[Project name]`, `TODO`, …) and on dangling references (Astro only logs those).

## Consequences

- A bad URL, missing alt text, an incomplete published record, a placeholder or a dangling reference fails the build — content errors never reach production (SRS §6.6, DoD #7).
- Nothing is invented to satisfy a schema; unknown facts keep a record in draft.
