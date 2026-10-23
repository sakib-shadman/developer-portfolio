# ADR-0003 — Medium articles maintained manually (SRS deviation)

- **Status:** accepted · 2026-10-23
- **SRS:** FR-07, FR-08, FR-09, §9.3, §9.8

## Decision

No Medium RSS integration. Each article is a Markdown file with frontmatter only (title, canonical Medium URL, date, own excerpt, self-hosted thumbnail, tags, reading time, featured). Body stays empty.

## Deviation

- **Dropped:** FR-07.2–07.6, FR-07.10–07.14 (feed configuration, retrieval, refresh, caching); §6.5 "last refresh time".
- **Promoted:** FR-07.15 (manual list) is the only source.
- **Still met:** FR-07.7–07.9, FR-07.16, FR-08, FR-09, FR-15. Duplicate URLs fail the build (FR-07.10).

## Consequences

- No scheduled job, no CORS, nothing to fail at runtime; blog has only empty / no-match states.
- A new Medium article appears only after its file is merged and deployed.
