# Maintenance guide

How to change content and operate the site. Rules that always apply (from `CLAUDE.md`): never invent facts; a record missing a required fact stays `"status": "draft"`; no `[placeholder]` text (`pnpm content:check` fails the build); fixture content never goes in `src/content`.

Every content change follows the same loop:

```bash
git switch develop && git pull
git switch -c content/<short-name>
# edit files under src/content/ (and public/ for the resume)
pnpm dev            # look at it (drafts are visible in dev)
pnpm build          # schema validation, content guard, fixture guard, link check
git add -A && git commit -m "content(<area>): <what>"
```

Open a PR into `develop` (a preview URL is posted on it once Firebase is set up), squash-merge, and ship by merging `develop` into `main` through a `release/*` PR (see `docs/IMPLEMENTATION_PLAN.md` section 3.1).

## Add an article

Articles are listed by hand (ADR-0003). One Markdown file per article in `src/content/articles/`, **frontmatter only, empty body** (a body fails the build):

```markdown
---
title: 'Example title'
url: https://medium.com/@example/example-post-123abc
publishedAt: 2026-01-31
excerpt: One or two sentences of your own, at most 240 characters.
thumbnail: ./images/example-post.png
thumbnailAlt: Describes the cover image
tags: [flutter, dart]
readingMinutes: 6
featured: false
status: published
---
```

- `url` must be https and unique (duplicates fail the build). `title`, `url` and `publishedAt` are required; everything else is optional, but `thumbnailAlt` is required when there is a `thumbnail`.
- Put the image in `src/content/articles/images/`; astro:assets resizes it.
- The home page "Writing" slider shows the articles marked `featured: true` if there are any, otherwise the latest ones. `status: draft` hides it from shipped builds.

## Add a project

One JSON file per project in `src/content/projects/`; the file name (without `.json`) is the project id and the URL slug.

```json
{
  "name": "Example App",
  "label": "Mobile app",
  "category": "mobile-app",
  "summary": "At most 200 characters.",
  "description": "What it is and why it exists.",
  "role": "Your role",
  "technologies": ["flutter", "dart"],
  "contributions": ["One line each"],
  "links": { "repo": "https://github.com/example/example-app" },
  "media": [{ "src": "./images/example-app.png", "alt": "Describes the screenshot" }],
  "featured": true,
  "featuredOrder": 1,
  "status": "published"
}
```

- `category` is one of `mobile-app`, `sdk`, `library`, `open-source`, `web-app`, `backend`. `links` may hold `repo`, `demo`, `store`, `docs`.
- `technologies` are ids from `src/content/skills.json` (`{ "id": "dart", "name": "Dart" }`). Add a missing skill there, and group it in `src/content/skill-groups.json` if it should show in the home "Skills" section. An unknown id fails `pnpm content:check`.
- Images go in `src/content/projects/images/`.
- `status: published` requires `summary`, `description`, `role` and at least one technology; otherwise keep `draft`.

## Add a case study

A project gets a detail page (`/projects/<slug>`) only when it has a case study.

1. Create `src/content/case-studies/<slug>.mdx` with frontmatter `project: <project-id>`, `problem: <text>` and optional `outcomes: [...]`. The MDX body may use these components, which need no import: `Section`, `Diagram`, `Decision`, `Callout`, `Challenge`, `Metrics`, `Figure` (props are in `src/components/case-study/*.astro`). A complete, fictional example is `tests/fixtures/content/case-studies/sample-app.mdx`.
2. In the project JSON add `"caseStudy": "<slug>"`.
3. `pnpm build`: a dangling reference fails `content:check`.

## Add or edit an experience entry

`src/content/experience.json` is an array. Add an object:

```json
{
  "id": "example-company",
  "company": "Example Company",
  "title": "Your title",
  "startDate": "2024-03-01",
  "endDate": null,
  "description": "Optional summary.",
  "responsibilities": ["One line each"],
  "achievements": ["One line each"],
  "technologies": ["flutter", "dart"],
  "companyUrl": "https://example.com",
  "status": "published"
}
```

`endDate: null` marks the current role. `status: published` requires `title`, `startDate` and an `endDate` (a date or `null`); `endDate` may not be before `startDate`. `technologies` are skill ids, as above.

## Update the profile

Edit the `main` record in `src/content/profile.json`. Required: `name`, `title`, `headline`, `intro`. Optional fields (location, focus, links, stats, bio, principles, expertise, community, interests, availability, objective, `yearsExperience`, ...) render only when present; the full list is the `makeProfileSchema` in `src/lib/content/schemas.ts` (also exported to `docs/contract/profile.schema.json`).

- `email`: the contact page shows the address, a `mailto:` link and the copy button only when it is set. Publish an alias address to limit spam.
- `photo`: `{ "src": "./images/<file>", "alt": "..." }`, with the image in `src/content/images/` (the path is relative to `profile.json`). `alt` is required.
- `links`: `github`, `linkedin`, `medium` (https URLs). Links the site does not accept (see "Links" below) render nothing.

## Swap the resume

1. Put the PDF in `public/resume/`, for example `public/resume/shadman-sakib-resume.pdf`. The name may use letters, digits, `.`, `_` and `-`.
2. Set `"resume": "/resume/shadman-sakib-resume.pdf"` in `src/content/profile.json`.
3. `pnpm build` fails if the file is missing. The Download/View resume actions (home, About, header, footer) appear on their own, and none are shown while `resume` is unset.
4. To replace the file, overwrite it (or change the name and the setting) and delete the old one. `firebase.json` caches `/resume/**` for an hour, so a replaced file can take up to an hour to show for returning visitors.

## Run the fixtures suite

Real content has no articles, case studies, photo, email or resume yet, so tests that need them run against fictional content in `tests/fixtures/content` (tagged `@fixtures`):

```bash
pnpm exec playwright install --with-deps chromium webkit firefox   # once
pnpm e2e:fixtures        # builds dist-fixtures/ and serves it on :5390 (E2E_FIXTURES_PORT changes it)
pnpm build:fixtures      # just the build (also runs the link check on it)
```

`pnpm e2e` runs everything else against the real content. Never copy fixture records into `src/content`: `content:check` and the build refuse the fixture marker.

## Links

`pnpm build` runs a link check over `dist/` (`scripts/check-links.ts`, also `pnpm exec tsx scripts/check-links.ts dist-fixtures`). It fails on a broken internal link, asset or `#anchor`; on an own-origin absolute URL that does not exist; and on any link `linkAttrs()` would not render. That includes `tel:` and `data:` links, which the site does not support (only site paths, `#anchors`, `mailto:` and https URLs). External links must be https and open in a new tab with `rel="noopener noreferrer"` (the components do this). Dead external links are found weekly by `.github/workflows/links.yml` (lychee).

## Roll back

- **Bad deploy on production:** Firebase console, Hosting, Release history, Rollback to the previous version. Or from a terminal logged in with `pnpm exec firebase login`: `pnpm exec firebase hosting:clone shadman-portfolio:<version-id> shadman-portfolio:live`.
- **Then fix the source:** revert the offending squash commit on `develop` with `git revert <sha>` through a PR, and release again, so `main` stops containing it.
- Hosting keeps the last 10 versions (set once in the Firebase console), so only recent releases can be rolled back.

## Spark plan limits

The site runs on Firebase's free Spark plan (verify the numbers on the Firebase pricing page):

| Limit            | Value                                                                | What we do                                                          |
| ---------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Hosting transfer | about 360 MB/day, a hard cap: the site stops serving until the reset | first visit <= 500 KB (ADR-0006), immutable caching of `/_astro/**` |
| Hosting storage  | 10 GB including old releases                                         | release retention of 10 versions                                    |
| Cloud Functions  | not available                                                        | no contact form in v1 (ADR-0004); needs the Blaze plan              |

Preview and staging channels are public and expire (7 days for PR previews, 30 days for staging, per `deploy.yml`); they stay `noindex` and hold nothing private.

## Rotate tokens and secrets

Nothing secret is in the repo or shipped to the browser. These live in GitHub (Settings, Secrets and variables, Actions):

| Name                                                                | Used by                               | Rotate by                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `FIREBASE_SERVICE_ACCOUNT_SHADMAN_PORTFOLIO` (secret)               | `deploy.yml` (preview, staging, live) | Google Cloud console, IAM and Admin, Service accounts, the account `firebase init hosting:github` created, Keys, Add key (JSON); paste it into the GitHub secret; then delete the old key. Deploys skip with a notice while the secret is unset. |
| `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` (optional secrets) | `claude-review.yml`                   | Create a new credential at its provider, update the secret, revoke the old one. The review job does nothing when neither is set.                                                                                                                 |
| `PUBLIC_INDEXABLE` (repository variable, not a secret)              | `deploy.yml` (production build only)  | Set to `true` at launch (v1.0); `false` before.                                                                                                                                                                                                  |

`GITHUB_TOKEN` is issued per workflow run and needs no rotation. After rotating the Firebase key, re-run the latest `deploy` workflow on `develop` to confirm it still deploys.
