# ADR-0008 — Content source abstraction (future backend)

- **Status:** accepted · 2026-10-23
- **SRS:** NFR-05

## Context

Content will later come from a backend API. That must not force a rewrite of components.

## Decision

1. Components, pages and layouts never import `astro:content` (ESLint `no-restricted-imports`).
2. `src/lib/content/queries.ts` is the only data API; it returns domain types from `types.ts`, produced by `mappers.ts`.
3. Logic (sorting, dedupe, featured selection) lives in pure functions in `logic.ts` and is unit-tested against domain types.
4. `schemas.ts` is the contract; `pnpm schemas:export` writes JSON Schema to `docs/contract/` for the backend.
5. Slugs/ids are permanent keys.

## Migration path

Default: replace `file()`/`glob()` loaders with an API loader (build-time) and trigger rebuilds via `repository_dispatch`. Only pages that need second-level freshness move to SSR (adapter + Blaze). A client-side SPA is out of scope.
