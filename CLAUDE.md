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
pnpm e2e                 # playwright + axe via the Firebase Hosting emulator (:5000)
pnpm build               # content:check + astro build
```

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
- **Content (ADR-0002):** never invent facts. Incomplete records stay `"status": "draft"`.
  No `[placeholders]` — `pnpm content:check` fails the build.
- **Primitives:** reuse `src/components/ui/*`; accept `class` and spread rest props on the root so
  parent scoped styles apply.
- **Accessibility (NFR-02):** one h1 per page, landmarks, visible focus, targets ≥ 40px, decorative
  icons `aria-hidden`, styled lists keep `role="list"`.
- **Definition of Done:** `.github/pull_request_template.md`.

## Review

PRs get an independent review from the `pr-reviewer` agent (`.claude/agents/pr-reviewer.md`),
locally or via `.github/workflows/claude-review.yml`. The owner merges.
