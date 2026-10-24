/**
 * Placeholder guard (SRS §6.6, DoD #7): production content must not contain design placeholders
 * such as "[Project name]", "[X]", "TODO" or "lorem ipsum".
 */
const PATTERNS: RegExp[] = [/\[[^\]\n]{1,80}\]/, /\bTODO\b/, /\bTBD\b/, /lorem ipsum/i];

export interface PlaceholderHit {
  path: string;
  value: string;
}

export function isPlaceholder(value: string): boolean {
  return PATTERNS.some((re) => re.test(value));
}

/** Walks any JSON-like value and reports every string that looks like a placeholder. */
export function findPlaceholders(value: unknown, path = '$'): PlaceholderHit[] {
  if (typeof value === 'string') return isPlaceholder(value) ? [{ path, value }] : [];
  if (Array.isArray(value)) return value.flatMap((v, i) => findPlaceholders(v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => findPlaceholders(v, `${path}.${k}`));
  }
  return [];
}
