# developer-portfolio

Personal developer portfolio of Shadman Sakib. Astro 7 (static output), TypeScript strict, plain CSS with design tokens, vanilla TypeScript for the little interactivity there is, Zod content collections, hosted on Firebase Hosting (Spark plan) at `https://shadman-portfolio.web.app`.

## Setup

Requirements: Node >= 22.23 (CI reads `.nvmrc`) and pnpm 10 (`corepack enable`).

```bash
pnpm install
pnpm dev                          # http://localhost:4321, hot reload, drafts visible
pnpm build && pnpm preview        # production build
pnpm build && pnpm serve:firebase # http://localhost:5000, with firebase.json headers, cleanUrls and a real 404
```

`pnpm install` also installs the git hooks (lefthook): Prettier and ESLint on staged files, and commitlint on the commit message.

## Scripts

| Script                                       | What                                                                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm dev:lan`                  | Dev server (the second one listens on the LAN, for phones)                                                                                    |
| `pnpm build`                                 | `content:check`, `astro build`, then two post-build guards: no fixture content in `dist/`, and the link check (see below)                     |
| `pnpm preview`                               | Serves `dist/` with Astro                                                                                                                     |
| `pnpm serve:firebase`                        | Serves `dist/` through the Firebase Hosting emulator (`E2E_PORT`, `E2E_DIST` pick the port and folder)                                        |
| `pnpm lint` / `pnpm format`                  | ESLint and Prettier (check / write)                                                                                                           |
| `pnpm typecheck`                             | `astro check` (`.astro` and `.ts`)                                                                                                            |
| `pnpm test` / `pnpm test:watch`              | Vitest unit tests with coverage (>= 90 % on `src/lib`)                                                                                        |
| `pnpm e2e`                                   | Playwright + axe against the emulator, real content (builds first; port 5000 or `E2E_PORT`)                                                   |
| `pnpm build:fixtures`                        | Builds `tests/fixtures/content` into `dist-fixtures/` and link-checks it                                                                      |
| `pnpm e2e:fixtures`                          | The `@fixtures` Playwright suite against that build (port 5390 or `E2E_FIXTURES_PORT`)                                                        |
| `pnpm lhci` / `pnpm lhci:indexable`          | Lighthouse CI budgets (ADR-0006) over every fixtures route / SEO on the real indexable build; run `pnpm build:fixtures` or `pnpm build` first |
| `pnpm lhci:local`                            | Fixtures build, Lighthouse CI and a per-route table                                                                                           |
| `pnpm content:check`                         | Placeholder guard and reference integrity (runs before every build)                                                                           |
| `pnpm schemas:export`                        | Writes the content contract as JSON Schema to `docs/contract/`                                                                                |
| `pnpm exec tsx scripts/check-links.ts [dir]` | The link check on its own (default `dist`; pass `dist-fixtures` for the fixtures build)                                                       |

Environment variables (read at build time; none is a secret):

| Variable                  | Effect                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `PUBLIC_SITE_URL`         | Origin for canonical URLs, sitemap, OG tags and the link check (default `http://localhost:4321`)                         |
| `PUBLIC_INDEXABLE`        | `true` lets search engines index (robots meta, `robots.txt`); `false` everywhere until v1.0 (ADR-0007)                   |
| `PUBLIC_INCLUDE_DRAFTS`   | `true` renders `draft` records (the dev server and e2e builds do; shipped builds never)                                  |
| `PUBLIC_CONTENT_FIXTURES` | `true` loads `tests/fixtures/content` instead of `src/content` (e2e only; refused together with `PUBLIC_INDEXABLE=true`) |
| `PUBLIC_CONTACT_FORM`     | Reserved for the later contact form (ADR-0004); `false` in every deploy                                                  |

## Architecture overview

- **Static site.** `astro build` writes plain HTML, CSS and a few small JS modules to `dist/`; Firebase Hosting serves it (`firebase.json`: `cleanUrls`, security and cache headers, ADR-0009).
- **Content.** Records live in `src/content/` (`profile.json`, `skills.json`, `skill-groups.json`, `experience.json`, `projects/*.json`, `case-studies/*.mdx`, `articles/*.md`) and are validated by Zod schemas in `src/lib/content/schemas.ts`. Pages never import `astro:content`: they call `src/lib/content/queries.ts`, which returns framework-free domain types (ADR-0008).
- **Pages** (`src/pages/`): `/` (home), `/projects`, `/projects/[slug]` (case studies), `/blog` (articles published on Medium, listed by hand), `/about`, `/contact`, `/rss.xml`, `/robots.txt`, `/og/*.png` (generated social cards) and a real 404.
- **Components** (`src/components/`): `ui/` primitives, `layout/`, `home/`, `projects/`, `blog/`, `slider/`, `case-study/`. Interactive pieces (`*.client.ts`, filters, sliders, copy button) are progressive enhancement: without JavaScript the content is still there.
- **Links.** Every rendered href goes through `src/lib/link.ts` (`linkAttrs`): unsafe URLs render nothing, external links open in a new tab with `rel="noopener noreferrer"`.
- **Quality gates.** Unit tests (`tests/unit`), Playwright e2e (`tests/e2e`: Chromium, WebKit, Firefox, a mobile device), axe, Lighthouse budgets, a build-time link check, and `@fixtures` tests that run against fictional content (`tests/fixtures/content`) because the real content is not complete yet. Decisions are in `docs/adr/`; the plan and task list in `docs/IMPLEMENTATION_PLAN.md`.

## Agent team

Development is done with Claude Code agents defined in `.claude/agents/` (repo-scoped, nothing global):

| Agent             | Role                                                                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `team-lead`       | Plans waves of tasks, routes every PR through review, merges when findings are resolved and CI is green. Run as the main session (`claude --agent team-lead`). |
| `senior-engineer` | Implements one PF task end to end on its own branch and checkout, then fixes review findings.                                                                  |
| `pr-reviewer`     | Independent review with fresh context; reports findings, verifies fixes.                                                                                       |

The working agreement (commit rules, no AI trailers, link and content rules, definition of done) is `CLAUDE.md`; the PR checklist is `.github/pull_request_template.md`.

## Workflow

`feature/*`, `fix/*`, `chore/*`, `content/*` branches go by PR into `develop` (squash, Conventional Commit title); only `develop`, `release/*` and `hotfix/*` may target `main`. CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, build and e2e; `deploy.yml` publishes preview channels, staging and production once the Firebase secret exists.

## Maintenance and docs

- `docs/MAINTENANCE.md`: add an article, project, case study or experience entry, swap the resume, update the profile, run the fixtures suite, roll back, Spark limits, rotate tokens.
- `docs/IMPLEMENTATION_PLAN.md` (tasks, workflow, deployment), `docs/adr/` (decisions), `docs/browser-support.md` (browser matrix and link checks).

## Known limitations

- **Articles are manual.** There is no Medium integration (ADR-0003): a new article appears on `/blog` and the home page only after its file is added and the site is redeployed.
- **No contact form yet.** v1 offers `mailto:`, a copy-address button and profile links (ADR-0004). The form needs the Blaze plan and is a later milestone.
- **web.app domain.** The site is served from `shadman-portfolio.web.app` and stays `noindex` until v1.0 (ADR-0007). A custom domain is deferred; `firebase.json` cannot redirect the `web.app` host to one, so `rel=canonical` would do the consolidation.
- **Content is incomplete.** Real records without every required fact stay `"status": "draft"` and are hidden from shipped builds; the owner supplies the rest.
- **Analytics are not wired.** ADR-0005 allows the Cloudflare Web Analytics beacon (the CSP already permits its hosts), but no snippet is added yet.
- **No `tel:` or `data:` links.** The link check fails the build on them (only site paths, `#anchors`, `mailto:` and https URLs are accepted).
