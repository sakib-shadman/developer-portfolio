/** Text for the 404 "requested path" line. Static hosting serves one 404.html, so it is filled in by script. */
export const MAX_PATH_CHARS = 80;

export function requestedPath(pathname: string): string {
  const p = pathname.length > MAX_PATH_CHARS ? `${pathname.slice(0, MAX_PATH_CHARS - 1)}…` : pathname;
  return p || '/';
}
