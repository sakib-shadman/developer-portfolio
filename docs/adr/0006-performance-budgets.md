# ADR-0006 — Browser support and performance budgets

- **Status:** accepted · 2026-10-23
- **SRS:** NFR-01, NFR-06, §9.9

## Decision

- Browsers: last 2 versions of Chrome, Edge, Firefox, Safari (macOS + iOS), Samsung Internet.
- Lighthouse (mobile): Performance ≥ 0.95, Accessibility = 1, SEO = 1, Best Practices ≥ 0.95.
- LCP < 2.0 s, CLS < 0.05, INP < 200 ms; ≤ 25 KB JS per page; ≤ 500 KB first-visit page weight.

Enforced by `lighthouserc.json` on PRs into `main`.
