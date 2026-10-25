/** Primary navigation (HANDOFF §3 Header). Skills/Experience are homepage anchors (FR-12). */
export interface NavItem {
  label: string;
  href: string;
  /** Path prefix that marks this item as the current page. Anchors have none. */
  match?: string;
  /** Home-page section this anchor targets; the item is dropped when that section isn't rendered. */
  section?: HomeAnchor;
}

export type HomeAnchor = 'skills' | 'experience';

export const PRIMARY_NAV: readonly NavItem[] = [
  { label: 'Skills', href: '/#skills', section: 'skills' },
  { label: 'Experience', href: '/#experience', section: 'experience' },
  { label: 'Projects', href: '/projects', match: '/projects' },
  { label: 'Writing', href: '/blog', match: '/blog' },
  { label: 'About', href: '/about', match: '/about' },
  { label: 'Contact', href: '/contact', match: '/contact' },
];

/** Normalise "/projects/", "/projects.html", "/projects/x/" → "/projects", "/projects/x". */
export function normalizePath(pathname: string): string {
  const p = pathname
    .replace(/\.html$/, '')
    .replace(/\/index$/, '')
    .replace(/\/+$/, '');
  return p === '' ? '/' : p;
}

/** True when `pathname` is `match` itself or nested under it (segment-aware: /blogroll ≠ /blog). */
export function isCurrent(pathname: string, match: string | undefined): boolean {
  if (!match) return false;
  const p = normalizePath(pathname);
  return p === match || p.startsWith(`${match}/`);
}

/** Drops anchor items whose home section is not rendered, so no nav link points at a missing id. */
export function visibleNav(
  items: readonly NavItem[],
  rendered: Readonly<Record<HomeAnchor, boolean>>,
): NavItem[] {
  return items.filter((i) => !i.section || rendered[i.section]);
}
