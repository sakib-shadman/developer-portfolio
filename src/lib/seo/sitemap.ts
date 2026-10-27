/** Sitemap filter (FR-14): every public, indexable page; never the 404 page. */
export function isSitemapPage(pageUrl: string): boolean {
  const path = new URL(pageUrl).pathname.replace(/\/+$/, '') || '/';
  return path !== '/404' && !path.startsWith('/og/');
}
