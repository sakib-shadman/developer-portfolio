/**
 * Link safety (NFR-03). Every href rendered by UI primitives goes through here:
 *  - internal: "/path", "/path#hash", "#hash" → rendered as-is
 *  - external: absolute http(s) → new tab with rel="noopener noreferrer"
 *  - mailto: → rendered as-is (no new tab)
 *  - anything else (javascript:, data:, protocol-relative, empty) → null, caller renders nothing
 */
import { isHttpUrl } from './url';

export interface LinkAttrs {
  href: string;
  target?: '_blank';
  rel?: string;
  external: boolean;
}

export function linkAttrs(href: string | undefined | null): LinkAttrs | null {
  if (!href) return null;
  if ((href.startsWith('/') && !href.startsWith('//')) || href.startsWith('#')) {
    return { href, external: false };
  }
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(href)) return { href, external: false };
  if (isHttpUrl(href)) return { href, target: '_blank', rel: 'noopener noreferrer', external: true };
  return null;
}
