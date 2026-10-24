/** True for absolute http(s) URLs only (rejects javascript:, data:, relative paths). */
export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Returns the URL if safe to render as an external link, otherwise undefined (NFR-03). */
export function safeExternalUrl(value: unknown): string | undefined {
  return isHttpUrl(value) ? value : undefined;
}

/** Strip query string and hash — used to canonicalise article URLs (e.g. ?source=rss). */
export function canonicalize(value: string): string {
  const u = new URL(value);
  u.search = '';
  u.hash = '';
  return u.toString();
}
