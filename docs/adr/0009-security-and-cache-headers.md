# ADR-0009 — Security and cache headers

- **Status:** accepted · 2026-10-27 · closes PF-41 (#31)

## Decision

Headers live in `firebase.json` only (no `<meta http-equiv>` CSP). Firebase applies every matching rule and the **last matching rule wins per header name**, so the `**` defaults come first and specific rules after them. `tests/unit/headers-config.test.ts` lints that order and `tests/e2e/headers.spec.ts` asserts the result on every route in the emulator.

### Security headers (every path)

| Header                                                              | Value / reason                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`                                           | `default-src 'self'; img-src 'self' data:; script-src 'self' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` |
| `X-Frame-Options`                                                   | `DENY`. Redundant with `frame-ancestors 'none'`, kept for old browsers. Nothing is ever framed.                                                                                                                                                                        |
| `Cross-Origin-Opener-Policy`                                        | `same-origin`. The site opens no cross-origin popups it needs to talk to.                                                                                                                                                                                              |
| `Cross-Origin-Resource-Policy`                                      | `same-origin`. Nobody else hot-links our assets.                                                                                                                                                                                                                       |
| `X-Content-Type-Options` / `Referrer-Policy` / `Permissions-Policy` | `nosniff` / `strict-origin-when-cross-origin` / camera, microphone, geolocation, payment, usb, browsing-topics all denied.                                                                                                                                             |

CSP review against what the site loads: images come from astro:assets (same origin, `/_astro`) plus `data:` for tiny inlined images; fonts are self-hosted `@fontsource` files; every script (Slider, filters, writing slider) is an external `/_astro/*.js` module, so **no `'unsafe-inline'` or `'unsafe-eval'` in `script-src`** (asserted by e2e: no inline scripts, no inline handlers, no `securitypolicyviolation` on any page). Styles need `'unsafe-inline'` because Astro scoped CSS can be inlined and components use `style=""` attributes (CSS custom properties). The Cloudflare Web Analytics beacon (ADR-0005) is the only third party. The PDF and RSS are same-origin.

### Deliberately not set

- **`object-src 'none'`**: `default-src 'self'` already limits objects to same-origin, and `'none'` would break the browser's built-in PDF viewer for `/resume/*.pdf` in some browsers.
- **`Strict-Transport-Security`**: Firebase Hosting already sends it on `*.web.app` and `*.firebaseapp.com` (HTTPS only). Setting it in `firebase.json` would be overridden anyway and would be wrong on the plain-http emulator. Revisit with `includeSubDomains; preload` if a custom domain is added (ADR-0007).
- **`upgrade-insecure-requests`**: would break the http emulator used by e2e; every subresource is same-origin relative.
- **COEP**: nothing needs cross-origin isolation, and the beacon would need CORP headers.

### Cache policy

| Path           | `Cache-Control`                       | Why                                                              |
| -------------- | ------------------------------------- | ---------------------------------------------------------------- |
| `**` (HTML …)  | `no-cache`                            | Always revalidate (ETag), so a deploy is visible immediately.    |
| `/_astro/**`   | `public, max-age=31536000, immutable` | Content-hashed file names.                                       |
| `/rss.xml`     | `public, max-age=3600`                | Feed readers poll; an hour is fine. Content-Type set explicitly. |
| `/resume/**`   | `public, max-age=3600`                | PDF name is stable, so it must not be immutable.                 |
| `/favicon.svg` | `public, max-age=86400`               | Stable name, rarely changes.                                     |

## Consequences

- Adding a third-party origin (fonts, analytics, embeds) requires a CSP change and a test update in the same PR.
- A new inline `<script>` fails e2e. Use an external module.
