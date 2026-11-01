# ADR-0007 — No custom domain during 0.x; noindex until v1.0

- **Status:** accepted · 2026-10-23

## Decision

Serve from `shadman-portfolio.web.app`. `PUBLIC_INDEXABLE` controls `<meta name="robots">` and `robots.txt`: `false` for previews, staging and all 0.x production builds; `true` from v1.0.

## Consequences

- Firebase config cannot 301 the default `*.web.app` host to a custom domain later; when a domain is added, `PUBLIC_SITE_URL` moves canonical URLs, sitemap and OG tags, and `rel=canonical` consolidates indexing.

> **Update 2026-11-01:** the default Hosting site is `shadman-portfolio-96097` (the Firebase project ID `shadman-portfolio` was taken), served at `https://shadman-portfolio-96097.web.app`. The decision is unchanged.
