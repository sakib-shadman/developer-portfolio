# I let AI agents build my portfolio. Here's the setup that kept them honest.

My developer portfolio was built by a small team of AI agents: 25 pull requests in about ten days. Once the tooling was in place, every one was reviewed and tested before it merged. I'm a Flutter and iOS engineer, so a static website is a side project for me. I used it to test a question: can agents ship to the standard I'd expect from a human team?

My short answer: yes, if you build the gates first.

## The team

There are four roles, each a Claude agent defined in a Markdown file inside the repo (`.claude/agents/`), so anyone who clones it gets the same team:

- **Team lead (Claude Opus):** plans tasks, routes every PR through review, and merges only when everything is green.
- **Senior engineer (Claude Sonnet):** builds one task end to end on its own branch, then fixes every review finding.
- **PR reviewer (Claude Opus):** reviews each PR with fresh context. It can read and run code but has no write access, so it can't quietly fix what it finds; it has to report it.
- **PR verifier (Claude Sonnet):** checks that each fix answers its finding. Large or design-changing fixes go back to the Opus reviewer.

I'm the product owner. I wrote the requirements, approved the plan and made the decisions. A `CLAUDE.md` file holds the rules every agent follows. The most important one: never invent content. Missing data hides a section; it is never filled with plausible text.

## The loop

![The PR loop: develop, review, fix, verify, merge](./images/pr-loop.png)

Every change goes through the same loop. The lead assigns a task from the plan, with acceptance criteria. The engineer builds it and runs every check locally before opening a PR. The reviewer writes a report with a verdict and a findings table. The engineer fixes each finding, and the reviewer verifies the fixes, often by putting the bug back to prove the new test fails. Only then does the lead merge.

The review paid for itself. It caught tests that passed even with the bug restored, a rollback command missing one character, and a link checker that never looked at fonts referenced from inline CSS.

## The architecture

The site is Astro 7 with static output on Firebase Hosting's free plan. There is no React or other UI runtime. The few interactive pieces (sliders, filters, search, a copy-email button) are small vanilla TypeScript modules. The lead recorded why in an architecture decision record. A React single-page app would return 200 for unknown URLs and hide metadata from link previews, and a Node server needs paid hosting.

The key design rule is enforced by a lint rule: pages never touch the content API directly. Everything goes through `src/lib/content/`, where Zod schemas validate each record, mappers turn records into plain domain types, and `queries.ts` is the only data API. When content later moves to a backend, only the loader behind that API changes. The pages don't.

That gives three properties I care about:

- **Maintainable.** Adding an article or project means adding one file, and the build rejects bad records with a clear error. Placeholder text fails the build.
- **Testable.** Every rule lives in a pure function with unit tests (489 of them, 90% or more coverage on `src/lib`). My real content isn't finished, so the agents built a fixtures mode: fictional content in a separate build that exercises the blog, slider and case studies.
- **Scalable.** Static files on a CDN; a page-weight budget that keeps the free plan's daily transfer cap far away; a contact form already planned behind a feature flag; and a clear path to an API.

## The CI pipeline

![CI on every pull request: four required jobs](./images/ci-pipeline.png)

Every PR runs four required GitHub Actions jobs:

- **branch-policy** enforces the git flow into `develop` and `main`.
- **pr-title** checks the Conventional Commit title.
- **quality** runs lint, type checks, unit tests and the production build, which includes a link checker.
- **e2e** runs Playwright on Chromium, WebKit, Firefox and a mobile profile against the Firebase emulator, inside Playwright's official Docker image so a local `pnpm e2e:docker` run sees the same browsers and fonts. It runs three passes: the full suite, smoke and accessibility tests on Chromium against the exact build that ships, and the fixtures suite.

PRs into `main` also run Lighthouse CI on every route, with budgets of 0.95 for performance, a perfect accessibility score, and at most 25 KB of JavaScript and 500 KB per page.

## What went wrong

- **A font test passed locally and failed on CI,** because Ubuntu's stand-in for Arial is a different font. A unit test already pinned the exact numbers, so the fix loosened the browser check to 2% and kept its strict check that headings wrap onto the same number of lines.
- **The cloud agents couldn't push to GitHub.** They packed branches into git bundles, and a script on my Mac pushed them. It worked, but my sleeping laptop became a bottleneck.
- **Three parallel engineers caused merge conflicts** and used up my weekly usage limit. One engineer working sequentially was calmer and barely slower.
- **Agents write from memory.** The reviewer caught a browser-support table that was wrong about Safari.

## What I changed afterwards

- **One gate:** `pnpm verify` runs exactly what CI runs, read from the CI workflow.
- **Skills:** the lead's per-PR routine is now four repo skills (`ship-pr`, `watch-ci`, `merge-pr`, `rebase-stack`) backed by tested scripts.
- **Cheaper verification:** Opus does the first review; a Sonnet verifier checks the fixes.
- **Mandatory habits:** the reviewer must put the bug back to prove a test bites, and cite a primary source for any browser or platform claim.

## Was it worth it?

Yes. The model writing the code mattered less than the gates around it: an independent reviewer, CI that trusts no one, and rules written into the repo. The agent definitions, decisions and review comments are all in [the repository](https://github.com/sakib-shadman/developer-portfolio), so you can reuse the setup.
