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
 * 1-based line numbers (in the whole file, frontmatter included) of content outside any Section.
 * `import`/`export` lines and `{/* … *\/}` comments are allowed anywhere. Self-closing
 * `<Section … />` (also across lines) does not open a section. Limitation: a `>` inside a prop
 * value of a Section start tag (e.g. an arrow function) ends the tag early.
 */
export function looseMdxContent(source: string): { line: number; text: string }[] {
  const front = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(source)?.[0] ?? '';
  const offset = front ? front.split(/\r?\n/).length - 1 : 0;
  const hits: { line: number; text: string }[] = [];
  let depth = 0;
  let inStartTag = false;
  let fenced = false;
  source
    .slice(front.length)
    .split(/\r?\n/)
    .forEach((raw, i) => {
      const text = raw.trim();
      const insideBefore = depth > 0;
      if (!fenced) {
        let rest = text;
        while (rest) {
          if (inStartTag) {
            const end = rest.indexOf('>');
            if (end < 0) break;
            if (rest[end - 1] === '/') depth--; // self-closing: never opened a section
            inStartTag = false;
            rest = rest.slice(end + 1);
            continue;
          }
          const open = /<Section(?=[\s>/]|$)/.exec(rest);
          const close = /<\/Section>/.exec(rest);
          if (open && (!close || open.index < close.index)) {
            depth++;
            inStartTag = true;
            rest = rest.slice(open.index + open[0].length);
          } else if (close) {
            depth--;
            rest = rest.slice(close.index + close[0].length);
          } else break;
        }
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
        hits.push({ line: offset + i + 1, text });
      }
    });
  return hits;
}

/**
 * FR-10.4: a configured resume must exist under public/ (`exists` is injected for tests).
 * Returns the error message, or undefined when there is no resume or the file is present.
 */
export function resumeError(
  resume: string | undefined,
  exists: (publicPath: string) => boolean,
): string | undefined {
  return resume && !exists(`public${resume}`)
    ? `src/content/profile.json $.main.resume: file public${resume} does not exist`
    : undefined;
}
