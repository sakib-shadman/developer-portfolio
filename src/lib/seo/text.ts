/** Pure helpers for page metadata (FR-14): descriptions, canonical paths and absolute URLs. */

export const DESCRIPTION_MAX = 160;

/** One line, whitespace collapsed, cut at a word boundary with an ellipsis when over `max`. */
export function seoDescription(text: string, max = DESCRIPTION_MAX): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  // Prefer a word boundary unless that would throw away more than a third of the text.
  const base = space > max * 0.66 ? cut.slice(0, space) : cut;
  return `${base.replace(/[\s,;:.\-–—]+$/, '')}…`;
}

/**
 * "/projects/" → "/projects", "" → "/", "/index.html" → "/", "/about.html" → "/about": the one canonical
 * spelling of a route (trailingSlash: never; the `file` build format reports pathnames with .html).
 */
export const canonicalPath = (path: string): string => {
  const p = (path.startsWith('/') ? path : `/${path}`)
    .replace(/(^|\/)index\.html$/, '$1')
    .replace(/\.html$/, '');
  return p.length > 1 ? p.replace(/\/+$/, '') || '/' : '/';
};

export const absoluteUrl = (path: string, site: URL | string): string =>
  new URL(canonicalPath(path), site).toString();

/** Same-origin path of a generated Open Graph image. */
export const DEFAULT_OG_PATH = '/og/default.png';
export const projectOgPath = (slug: string): string => `/og/projects/${slug}.png`;
export const OG_SIZE = { width: 1200, height: 630 } as const;

/**
 * /about description: the bio's first paragraph when there is one; otherwise a line built from
 * profile facts (the intro already is the home page's description, and descriptions must be unique).
 */
export function aboutDescription(p: {
  name: string;
  title: string;
  location?: string | undefined;
  bio: readonly string[];
}): string {
  const first = p.bio[0];
  if (first) return first;
  return `About ${p.name}: ${p.title}${p.location ? `, based in ${p.location}` : ''}.`;
}

/** `Astro.site` with the same dev fallback everywhere (it is always set in real builds via PUBLIC_SITE_URL). */
export const siteOrigin = (site: URL | undefined): URL => site ?? new URL('http://localhost:4321');
