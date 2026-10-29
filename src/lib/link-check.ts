/**
 * Pure link checker over a built site (PF-44). Given every file of dist/ it reports:
 *  - broken internal links, asset references and anchors (`/path#id`, `#id`),
 *  - links the site's own policy forbids (anything `linkAttrs` rejects, plain http, external links
 *    without target=_blank + rel="noopener noreferrer", target=_blank without noopener),
 *  - canonical / og:image / sitemap URLs on our own origin that do not exist in the build.
 * scripts/check-links.ts is the thin CLI around it; tests/unit/link-check.test.ts covers the rules.
 */
import { linkAttrs } from './link';

export interface Issue {
  page: string;
  kind: 'broken-link' | 'broken-anchor' | 'broken-asset' | 'policy' | 'broken-url';
  detail: string;
}

export interface Site {
  /** Every file in the build, as a path relative to the root with forward slashes ("about.html"). */
  files: ReadonlySet<string>;
  /** HTML pages by relative path. */
  html: ReadonlyMap<string, string>;
  /** XML sitemap files by relative path. */
  xml?: ReadonlyMap<string, string>;
  /** Public origin, e.g. https://shadman-portfolio.web.app: absolute URLs on it must resolve in the build. */
  origin: string;
}

const decodeEntities = (s: string): string =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

type Attrs = Record<string, string>;

function parseAttrs(source: string): Attrs {
  const attrs: Attrs = {};
  for (const m of source.matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g))
    attrs[m[1]!.toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  return attrs;
}

/** Start tags of the given names. Generated HTML only, so a tag scan is enough. */
function tags(html: string, names: string[]): { name: string; attrs: Attrs }[] {
  const out: { name: string; attrs: Attrs }[] = [];
  const re = new RegExp(`<(${names.join('|')})\\b((?:[^>"']|"[^"]*"|'[^']*')*)>`, 'gi');
  for (const m of html.matchAll(re)) out.push({ name: m[1]!.toLowerCase(), attrs: parseAttrs(m[2]!) });
  return out;
}

/** Fragment targets: any `id`, plus `name` on `<a>` only (legacy anchors; `<meta name>`/`<input name>` are not targets). */
export const idsOf = (html: string): Set<string> => {
  const ids = new Set<string>();
  for (const m of html.matchAll(/\sid\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) ids.add(m[1] ?? m[2]!);
  for (const { attrs } of tags(html, ['a'])) if (attrs.name) ids.add(attrs.name);
  return ids;
};

/** The built file a site path serves (firebase cleanUrls: /about -> about.html), or undefined. */
export function resolvePath(pathname: string, files: ReadonlySet<string>): string | undefined {
  let p: string;
  try {
    p = decodeURIComponent(pathname).replace(/^\/+/, '');
  } catch {
    return undefined;
  }
  const candidates = p === '' || p.endsWith('/') ? [`${p}index.html`] : [p, `${p}.html`, `${p}/index.html`];
  return candidates.find((c) => files.has(c));
}

const isSkippable = (href: string) => /^(mailto:|tel:|data:)/i.test(href);
const isMailto = (href: string) => /^mailto:/i.test(href);

/** Split "/a/b?x=1#frag" (also "#frag") into path and fragment. */
function split(href: string): { path: string; hash: string } {
  const [beforeHash = '', ...rest] = href.split('#');
  return { path: beforeHash.split('?')[0]!, hash: rest.join('#') };
}

export function checkSite(site: Site): Issue[] {
  const issues: Issue[] = [];
  const idCache = new Map<string, Set<string>>();
  const idsFor = (file: string) => {
    let ids = idCache.get(file);
    if (!ids) idCache.set(file, (ids = idsOf(site.html.get(file) ?? '')));
    return ids;
  };
  const origin = new URL(site.origin).origin;

  /** Check an internal href (site-relative path, optional query/hash) found on `page`. */
  const checkInternal = (page: string, href: string, kind: 'broken-link' | 'broken-asset') => {
    const { path, hash } = split(href);
    const target = path === '' ? page : resolvePath(path, site.files);
    if (!target) {
      issues.push({ page, kind, detail: `${href} does not exist in the build` });
      return;
    }
    if (hash && target.endsWith('.html') && !idsFor(target).has(decodeURIComponentSafe(hash)))
      issues.push({
        page,
        kind: 'broken-anchor',
        detail: `${href}: no element with id "${hash}" in ${target}`,
      });
  };

  for (const [page, html] of site.html) {
    for (const { attrs } of tags(html, ['a'])) {
      const href = attrs.href;
      if (href === undefined) continue;
      const link = linkAttrs(href);
      if (!link || link.href !== href) {
        issues.push({
          page,
          kind: 'policy',
          detail: `<a href="${href}"> is not a link linkAttrs() would render (unsafe, malformed or not normalised)`,
        });
        continue;
      }
      if (link.external) {
        const rel = (attrs.rel ?? '').toLowerCase().split(/\s+/);
        if (!href.startsWith('https://'))
          issues.push({ page, kind: 'policy', detail: `${href} is not https` });
        if (attrs.target !== '_blank' || !rel.includes('noopener') || !rel.includes('noreferrer'))
          issues.push({
            page,
            kind: 'policy',
            detail: `external ${href} needs target="_blank" rel="noopener noreferrer"`,
          });
        // Our own origin written as an absolute URL would bypass the internal check below.
        if (new URL(href).origin === origin)
          issues.push({ page, kind: 'policy', detail: `${href} is internal: use a site-relative path` });
        continue;
      }
      if (isMailto(href)) continue; // valid per linkAttrs; nothing to resolve
      if (attrs.target === '_blank' && !(attrs.rel ?? '').toLowerCase().split(/\s+/).includes('noopener'))
        issues.push({ page, kind: 'policy', detail: `${href} opens a new tab without rel="noopener"` });
      checkInternal(page, href, 'broken-link');
    }

    // Same-site resources: images, scripts, styles, icons, feeds, preloads.
    for (const { name, attrs } of tags(html, [
      'img',
      'script',
      'source',
      'link',
      'video',
      'audio',
      'track',
      'iframe',
      'embed',
    ])) {
      const refs: string[] = [];
      if (name === 'link') {
        if (attrs.href && !/canonical/i.test(attrs.rel ?? '')) refs.push(attrs.href);
      } else {
        if (attrs.src) refs.push(attrs.src);
        if (attrs.poster) refs.push(attrs.poster);
      }
      for (const set of [attrs.srcset, attrs.imagesrcset])
        for (const part of (set ?? '').split(',')) if (part.trim()) refs.push(part.trim().split(/\s+/)[0]!);
      for (const ref of refs) {
        if (isSkippable(ref) || /^https?:\/\//i.test(ref) || ref.startsWith('//')) continue;
        if (ref.startsWith('/')) checkInternal(page, ref, 'broken-asset');
        else
          issues.push({
            page,
            kind: 'policy',
            detail: `${ref} is a relative asset path; use /absolute paths`,
          });
      }
    }

    // url(...) in inline <style> blocks and style="" attributes (all CSS is inlined: @font-face lives here).
    const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]!);
    for (const m of html.matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi))
      css.push(decodeEntities(m[1] ?? m[2]!));
    for (const block of css)
      for (const m of block.matchAll(/url\(\s*(['"]?)([^)'"]*)\1\s*\)/gi)) {
        const ref = m[2]!.trim();
        if (!ref || ref.startsWith('#') || isSkippable(ref) || /^(https?:)?\/\//i.test(ref)) continue;
        if (ref.startsWith('/')) checkInternal(page, ref, 'broken-asset');
        else
          issues.push({
            page,
            kind: 'policy',
            detail: `url(${ref}) in inline CSS is relative; use /absolute paths`,
          });
      }

    // JSON-LD: every string value that is an absolute URL on our own origin must exist (e.g. Person.image).
    for (const m of html.matchAll(
      /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    )) {
      let data: unknown;
      try {
        data = JSON.parse(m[1]!);
      } catch {
        issues.push({ page, kind: 'policy', detail: 'application/ld+json is not valid JSON' });
        continue;
      }
      const walk = (v: unknown): void => {
        if (typeof v === 'string') {
          if (/^https?:\/\//i.test(v) && new URL(v, origin).origin === origin)
            // `@id` values like https://site/#person are node identifiers, not links: ignore the fragment.
            checkOwnUrl(page, v.split('#')[0]!);
        } else if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === 'object') Object.values(v).forEach(walk);
      };
      walk(data);
    }

    // Absolute URLs on our own origin (canonical, og:image, twitter:image) must exist.
    const own: string[] = [];
    for (const { attrs } of tags(html, ['link']))
      if (/canonical/i.test(attrs.rel ?? '') && attrs.href) own.push(attrs.href);
    for (const { attrs } of tags(html, ['meta']))
      if (/^(og:image|og:url|twitter:image)$/i.test(attrs.property ?? attrs.name ?? '') && attrs.content)
        own.push(attrs.content);
    for (const u of own) checkOwnUrl(page, u);
  }

  function checkOwnUrl(page: string, u: string) {
    let url: URL;
    try {
      url = new URL(u);
    } catch {
      issues.push({ page, kind: 'broken-url', detail: `${u} is not a valid absolute URL` });
      return;
    }
    if (url.origin !== origin) return; // another origin (not ours to resolve)
    const { pathname, hash } = url;
    const target = resolvePath(pathname, site.files);
    if (!target) issues.push({ page, kind: 'broken-url', detail: `${u} does not exist in the build` });
    else if (hash && target.endsWith('.html') && !idsFor(target).has(decodeURIComponentSafe(hash.slice(1))))
      issues.push({ page, kind: 'broken-anchor', detail: `${u}: no such id` });
  }

  for (const [file, xml] of site.xml ?? []) {
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) checkOwnUrl(file, decodeEntities(m[1]!.trim()));
  }
  return issues;
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
