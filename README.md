# developer-portfolio

Personal developer portfolio of Shadman Sakib — Astro 7 (static) on Firebase Hosting.

## Quick start

```bash
pnpm install
pnpm dev                 # http://localhost:4321 (hot reload; drafts visible)
pnpm build && pnpm preview          # production build
pnpm build && pnpm serve:firebase   # http://localhost:5000 — firebase.json headers, cleanUrls, real 404
```

Node ≥ 22.23 (CI uses `.nvmrc`), pnpm 10 (`corepack enable`).

## Scripts

| Script                      | What                                                                          |
| --------------------------- | ----------------------------------------------------------------------------- |
| `pnpm lint` / `pnpm format` | ESLint + Prettier                                                             |
| `pnpm typecheck`            | `astro check` + `tsc`                                                         |
| `pnpm test`                 | Vitest unit tests + coverage (≥ 90% on `src/lib`)                             |
| `pnpm e2e`                  | Playwright + axe against the Firebase Hosting emulator (builds automatically) |
| `pnpm lhci`                 | Lighthouse CI budgets against `dist/`                                         |
| `pnpm content:check`        | Placeholder guard + reference integrity (runs before every build)             |
| `pnpm schemas:export`       | Writes the content contract to `docs/contract/`                               |

## Content

All content lives in `src/content/` and is validated at build time. Records stay `"status": "draft"` until every required fact is filled in — drafts show only in `pnpm dev`. See `docs/adr/0002-content-format.md`.

## Docs

`docs/IMPLEMENTATION_PLAN.md` (tasks, workflow, deployment) · `docs/adr/` (decisions).

## Workflow

`feature/*` → PR into `develop` (squash) → `release/x.y.z` → `main`. Conventional Commits; see the plan §3.
