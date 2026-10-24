# ADR-0001 — Astro (static) on Firebase Hosting, Spark plan

- **Status:** accepted · 2026-10-23
- **SRS:** §9.1, FR-12, FR-14, NFR-01

## Context

The site is ~95% static content with four small interactive pieces (slider, project filters, blog search, copy-email). Requirements include real 404 status codes (FR-12.5), per-page metadata readable by link-preview scrapers that do not run JS (FR-14), and tight performance budgets (NFR-01). The owner wants no card on file and no custom domain for the early versions.

## Decision

- **Astro 7**, `output: 'static'`, `build.format: 'file'`, `trailingSlash: 'never'`. No UI framework runtime; interactivity in vanilla TypeScript modules.
- **Firebase Hosting on the free Spark plan** at `https://shadman-portfolio.web.app`, `cleanUrls: true`, `trailingSlash: false`. PR preview channels, a `staging` channel for `develop`, `live` for `main`.

## Consequences

- Zero JS by default; HTML contains all metadata; Firebase serves `404.html` with HTTP 404.
- Spark has a hard daily transfer cap (~360 MB/day) — enforced via page-weight budgets (ADR-0006). No Cloud Functions on Spark (see ADR-0004).
- Rejected: React SPA (200 for unknown routes, metadata only after JS), Next.js static export (full-page hydration cost), a Node server (needs paid hosting).
