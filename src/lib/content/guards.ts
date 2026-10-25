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

/**
 * Case-study authoring rule: every piece of MDX body content lives inside a `<Section>`, so it is
 * numbered and headed (loose text would read as part of the preceding page section). Returns the
 * 1-based body line numbers (frontmatter excluded) of content found outside any Section.
 * `import`/`export` lines and `{/* … *\/}` comments are allowed anywhere.
 */
export function looseMdxContent(source: string): { line: number; text: string }[] {
  const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  const hits: { line: number; text: string }[] = [];
  let depth = 0;
  let fenced = false;
  body.split(/\r?\n/).forEach((raw, i) => {
    const text = raw.trim();
    const insideBefore = depth > 0;
    if (!fenced) {
      depth += (text.match(/<Section(?=[\s>]|$)/g) ?? []).length;
      depth -= (text.match(/<\/Section>/g) ?? []).length;
    }
    if (/^(```|~~~)/.test(text)) fenced = !fenced;
    const allowed = text === '' || /^(import|export)\s/.test(text) || /^\{\/\*.*\*\/\}$/.test(text);
    if (
      !allowed &&
      !insideBefore &&
      depth <= 0 &&
      !text.startsWith('<Section') &&
      !text.startsWith('</Section')
    ) {
      hits.push({ line: i + 1, text });
    }
  });
  return hits;
}
