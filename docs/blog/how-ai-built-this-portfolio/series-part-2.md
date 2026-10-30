# Building my portfolio with AI agents, part 2: architecture, tests and CI

In [part 1](./series-part-1.md) I described the agent team (a lead, an engineer and a reviewer) and the loop every change went through. This part covers what they built, and the tests and CI pipeline that stopped them from merging something broken.

## A static site, chosen on purpose

The site is Astro 7 with static output, hosted on Firebase Hosting's free Spark plan. There is no UI framework runtime. About 95% of the site is content, and the four interactive pieces (a writing slider, project filters, blog search and a copy-email button) are small vanilla TypeScript modules that enhance pages that already work without JavaScript.

The lead wrote the reasoning down in ADR-0001, including what it rejected:

- **A React single-page app:** unknown URLs return HTTP 200, and metadata only appears after JavaScript runs, so link previews break.
- **A Next.js static export:** every page pays the hydration cost.
- **A Node server:** needs paid hosting, and I wanted no card on file for v1.

## One door to the data

![Architecture: content files to Firebase Hosting](./images/architecture.png)

One ESLint rule shapes the whole codebase: no page or component may import `astro:content`. All data goes through `src/lib/content/`:

- `schemas.ts`: Zod schemas, the content contract. A bad record fails the build with the file name and the reason.
- `mappers.ts`: turns raw records into plain domain types (`Profile`, `Project`, `Article`).
- `queries.ts`: the only data API pages may call. Sorting, deduplication and featured selection are pure functions in `logic.ts`.

The reason is ADR-0008: content will move to a backend one day, and that must not mean rewriting components. When it does, the file loaders are swapped for an API loader behind `queries.ts`. `pnpm schemas:export` already writes the contract as JSON Schema for whoever builds that API.

## Maintainable: content is data

Adding an article, project or job means adding one file to `src/content/`. A content check runs before every build and fails on placeholder text or broken references. `docs/MAINTENANCE.md` covers the routine jobs, from swapping the resume to rolling back a deploy, and a guard test fails CI if a command or path it mentions stops existing.

## Testable: logic in pure functions, and fake content for real features

Anything with a rule (link safety, RSS, structured data, featured selection) is a pure function in `src/lib/` with unit tests. Coverage there must stay at 90% or more.

My real content isn't finished: no articles or case studies yet. To test those features anyway, the agents built a fixtures mode. Clearly fictional content in `tests/fixtures/content/` goes through a separate build, every feature runs against it, and a guard fails the real build if any fixture text leaks in.

| Layer         | Tool                                                             | What it catches                                                                                |
| ------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Unit          | Vitest, plus the Astro container API to render components        | Logic bugs, schema rules, component output (375 tests)                                         |
| End to end    | Playwright on Chromium, WebKit, Firefox and a Pixel 7 profile    | Broken pages, navigation, headers, keyboard flows, layout shift                                |
| Accessibility | axe-core inside the e2e run, plus a manual WCAG 2.2 AA checklist | Missing names, contrast, focus problems                                                        |
| Performance   | Lighthouse CI on every route                                     | Performance under 0.95, accessibility or SEO under 1, more than 25 KB of JS or 500 KB per page |
| Build guards  | Content check, fixture-leak scan, link checker                   | Placeholders, broken links and anchors, unsafe external links                                  |

The e2e tests run against the Firebase Hosting emulator, not a dev server, so they check the real security headers, clean URLs and the real 404 status.

## Scalable: traffic, content, features, backend

- **Traffic:** static files on a CDN. The free plan caps transfer at about 360 MB a day, so a 500 KB page-weight budget keeps that cap far away.
- **Content:** pages are generated from collections, so the 50th article costs one file, like the first.
- **Features:** the contact form is planned as a Cloud Function behind a `PUBLIC_CONTACT_FORM` flag, switched on when I move to the paid plan.
- **Backend:** the content boundary means an API can replace the files, and only pages that need live data move to server rendering.

## The CI pipeline

![CI on every pull request: four required jobs](./images/ci-pipeline.png)

Every push to a PR runs four required GitHub Actions jobs, and nothing merges until all four pass:

- **branch-policy:** feature, fix, chore and content branches target `develop`; only `develop`, `release/*` and `hotfix/*` may target `main`.
- **pr-title:** the title must be a Conventional Commit. PRs are squash-merged, so it becomes the commit message and later the changelog.
- **quality:** frozen-lockfile install, ESLint and Prettier, `astro check`, unit tests with coverage, and the full production build including the link checker.
- **e2e:** Chromium, WebKit and Firefox run three passes:
  1. The full suite, with drafts visible.
  2. The `@smoke` and axe tests on the build that ships, with drafts hidden.
  3. The `@fixtures` suite on fictional content.

Around them:

- **lighthouse:** runs on PRs into `main` only, checking budgets on every route plus SEO on the real build.
- **deploy:** publishes a preview URL per PR, staging from `develop` and live from `main` with a smoke test. It skips cleanly until Firebase is configured.
- **links:** a weekly job checks that external links still resolve.

Locally, git hooks run Prettier, ESLint and commitlint before a commit even exists.

## The CI failure that taught me the most

To stop text jumping when web fonts load, the engineer generated fallback fonts sized to match the real ones, plus a browser test that the widths match within 1%. It passed on every laptop and failed on GitHub's Ubuntu runners. Their stand-in for Arial is a different font, and Inter came out 1.66% off. The fix wasn't to delete the test. The exact numbers moved into a unit test, and the browser test now guards what users actually see: headings wrap onto the same number of lines. Each guarantee is now owned by the layer that can actually check it.

## Takeaway

None of this is unusual. It's the setup a careful human team would use. That's the point: agents do well inside the same guardrails we'd give people, and badly without them. The whole setup, including the agent definitions, ADRs and CI workflows, is in [the repository](https://github.com/sakib-shadman/developer-portfolio).
