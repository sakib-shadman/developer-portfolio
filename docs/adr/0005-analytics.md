# ADR-0005 — Analytics optional, cookieless

- **Status:** accepted · 2026-10-23
- **SRS:** FR-16, §9.7

## Decision

No Google Analytics (cookies → consent banner, FR-16.5). If analytics are enabled, use the Cloudflare Web Analytics JS beacon (cookieless; works on non-Cloudflare hosts), loaded `defer` and failure-isolated. Custom events (FR-16.2) deferred. RSS (`/rss.xml`) is in scope for v1.
