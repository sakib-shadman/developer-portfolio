# ADR-0004 — Email-only contact in v1; form later on Blaze

- **Status:** accepted · 2026-10-23
- **SRS:** FR-11, §9.6

## Decision

v1 ships `mailto:` + copy-address button + profile links. The contact form (Cloud Function `/api/contact` → Resend, Turnstile, honeypot, rate limit) is milestone M5 and requires the Blaze plan. The form is gated by `PUBLIC_CONTACT_FORM` and is not rendered until delivery is tested on staging (FR-11 acceptance).

## Consequences

- No card or secrets needed for v1. Publish an alias address to limit scraper spam.
