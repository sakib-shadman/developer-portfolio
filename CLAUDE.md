# CLAUDE.md — working agreement for AI agents in this repo

Personal developer portfolio of Shadman Sakib. Astro 7 (static), TypeScript strict, plain CSS with
design tokens, vanilla TS for interactivity, Zod 4 content collections, Firebase Hosting (Spark).

Read first: `docs/IMPLEMENTATION_PLAN.md` (tasks PF-xx, workflow), `docs/adr/` (decisions),
`docs/SRS.md` + `docs/HANDOFF.md` (requirements + design; may live in the claude.ai project).

## Commands

```bash
pnpm dev                 # localhost:4321, drafts visible
pnpm lint                # eslint + prettier --check
pnpm typecheck           # astro check (covers .astro + .ts)
pnpm test                # vitest + coverage (≥ 90% on src/lib)
pnpm e2e                 # playwright + axe via the Firebase Hosting emulator (:5000), real content
pnpm e2e:fixtures        # @fixtures suite against tests/fixtures/content (builds dist-fixtures, :5390)
pnpm build               # content:check + astro build
pnpm verify              # THE "ready for PR" gate; it reads the quality steps from the `quality` job of ci.yml (the visible source of truth); the e2e job runs the passes of scripts/e2e-passes.mjs
pnpm e2e:docker [pass]   # e2e in the CI Playwright container (Docker); pass = real|shipped|fixtures|all
```

`pnpm verify` is the single gate before a PR. It runs e2e in the CI container when Docker exists. Where it
does not (e.g. the cloud workspace), it falls back to local Playwright with a warning that the run does not
match CI: then **CI is the authority** for webkit, firefox and fonts, and a green local run is not proof
of those. Never loosen a test to make a local run pass.

Node ≥ 22.23 (CI: `.nvmrc`), pnpm 10.

## Rules

- **Commits:** Conventional Commits; author Shadman Sakib. **Never add `Co-Authored-By: Claude…`
  or `Claude-Session:` trailers.** PR titles are Conventional Commits (they become squash commits).
- **Branches:** `feature/PF-<id>-<slug>`, `fix/…`, `chore/…`, `content/…` from `develop`; PR into
  `develop`. Only `develop`, `release/*`, `hotfix/*` may target `main`.
- **Data access (ADR-0008):** components/pages/layouts never import `astro:content`; use
  `src/lib/content/queries.ts`, which returns domain types from `types.ts`.
- **Links (NFR-03):** every rendered href goes through `src/lib/link.ts` (`linkAttrs`) or a UI
  primitive that uses it. Unsafe hrefs render nothing.
- **Test fixtures:** `PUBLIC_CONTENT_FIXTURES=true` loads the fictional content in `tests/fixtures/content`
  instead of `src/content` (e2e only; read from the process environment only, never from `.env`; the build refuses it with
  `PUBLIC_INDEXABLE=true` and `pnpm build` fails if the fixture marker reaches `dist/`). Tests that need
  populated content (blog, case studies, photo, email, resume) are tagged `@fixtures` and run via
  `pnpm e2e:fixtures`; the default `pnpm e2e` excludes them. Never put fixture content in `src/content`.
- **Content (ADR-0002):** never invent facts. Incomplete records stay `"status": "draft"`.
  No `[placeholders]` — `pnpm content:check` fails the build.
- **Primitives:** reuse `src/components/ui/*`; accept `class` and spread rest props on the root so
  parent scoped styles apply.
- **Accessibility (NFR-02):** one h1 per page, landmarks, visible focus, targets ≥ 40px, decorative
  icons `aria-hidden`, styled lists keep `role="list"`.
- **Definition of Done:** `.github/pull_request_template.md`.

## Skills

Repo-scoped Claude Code skills in `.claude/skills/<name>/SKILL.md` (scripts in each `scripts/` folder; they
never add trailers, never print tokens). Used by the `team-lead` for each PR:

- `ship-pr`: push the branch (or bundle it for the owner's relay), open/reuse the PR, post notes.
- `watch-ci`: wait for CI and print failing jobs' annotations.
- `merge-pr`: verify the gate, squash-merge, list branches needing a rebase.
- `rebase-stack`: `git rebase --onto origin/develop <old-base-sha> <branch>` after a squash merge.

## Workflow (agreed with the owner)

1. **Develop** — by a `senior-engineer` agent (Sonnet, `.claude/agents/senior-engineer.md`) or the
   lead — on a `feature/PF-<id>-<slug>` (or `fix/` / `chore/` / `content/`) branch from `develop`;
   run `pnpm verify` locally (lint, typecheck, unit, build, e2e).
2. **Raise a PR** into `develop` (Conventional-Commit title, DoD checklist filled in).
3. **Review** by the `pr-reviewer` agent (Opus) (`.claude/agents/pr-reviewer.md`), mutation check and cited external facts mandatory — an independent agent
   with fresh context, plus `.github/workflows/claude-review.yml` once a Claude secret is set.
4. **Address every finding** in follow-up commits and post a findings → resolution table on the PR.
   Fix rounds are verified by the `pr-verifier` agent (Sonnet, `.claude/agents/pr-verifier.md`: maps findings to fixes, re-applies each bug,
   reports APPROVE / REQUEST CHANGES, edits nothing) until nothing blocking is left; the lead re-runs `pr-reviewer` only for large or design-changing fixes.
5. **Merge** (squash, delete branch) only when all review findings are resolved **and** all required
   CI checks pass. The `team-lead` (Opus, `.claude/agents/team-lead.md`, run as the main session)
   merges; the owner can review or veto any PR.
