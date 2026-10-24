/**
 * Link safety (NFR-03). Every href rendered by UI primitives goes through here:
 *  - internal: "/path", "/path?q#hash", "#hash" → same tab
 *  - external: absolute http(s) ("https://host…") → new tab, rel="noopener noreferrer"
 *  - mailto:address[?subject=…] → same tab
 *  - anything else → null and the caller renders nothing. That includes javascript:/data:,
 *    protocol-relative "//host", and strings with backslashes, whitespace or control
 *    characters, which browsers normalise in surprising ways ("/\evil.com" → https://evil.com).
 */
export interface LinkAttrs {
  href: string;
  target?: '_blank';
  rel?: string;
  external: boolean;
}

const INTERNAL_BASE = 'https://internal.invalid';
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARS = /[\u0000- \u007f\\]/;

export function linkAttrs(href: string | undefined | null): LinkAttrs | null {
  if (!href || UNSAFE_CHARS.test(href)) return null;

  if (href.startsWith('#') || (href.startsWith('/') && !href.startsWith('//'))) {
    // Resolve against a sentinel origin: anything that escapes it is not internal.
    return new URL(href, INTERNAL_BASE).origin === INTERNAL_BASE ? { href, external: false } : null;
  }

  if (/^mailto:[^@?]+@[^@?]+(\?.*)?$/i.test(href)) return { href, external: false };

  // Require "scheme://" so "https:evil.com" (resolved relative by browsers) is rejected.
  if (/^https?:\/\/[^/]/i.test(href)) {
    try {
      const u = new URL(href);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        return { href: u.href, target: '_blank', rel: 'noopener noreferrer', external: true };
      }
    } catch {
      return null;
    }
  }
  return null;
}
