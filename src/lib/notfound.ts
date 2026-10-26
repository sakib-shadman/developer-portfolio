/** Text for the 404 "requested path" line. Static hosting serves one 404.html, so it is filled in by script. */
export const MAX_PATH_CHARS = 80;

// Control characters and bidi overrides would make the line misleading; textContent already keeps it inert.
// eslint-disable-next-line no-control-regex
const UNWANTED = /[\u0000-\u001f\u007f‪-‮⁦-⁩]/g;

function decode(pathname: string): string {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname; // malformed escape such as %E0%A4%A: show it as typed
  }
}

/** Decoded for readability, then truncated by code point so a character is never split. */
export function requestedPath(pathname: string): string {
  const chars = Array.from(decode(pathname).replace(UNWANTED, ''));
  const p =
    chars.length > MAX_PATH_CHARS ? `${chars.slice(0, MAX_PATH_CHARS - 1).join('')}…` : chars.join('');
  return p || '/';
}
