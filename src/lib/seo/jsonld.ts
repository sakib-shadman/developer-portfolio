/**
 * schema.org JSON-LD builders (FR-14). Pure, and only ever emit fields that exist in the data:
 * never invented values. Articles live on Medium, so /blog is a list of links to them (an ItemList
 * on a CollectionPage), never BlogPosting entries that would claim hosted content.
 */
import { absoluteUrl } from './text';

export type JsonLd = Record<string, unknown>;

const CONTEXT = 'https://schema.org';

const httpsOnly = (href: string | undefined): string | undefined => {
  if (!href) return undefined;
  try {
    const u = new URL(href);
    return u.protocol === 'https:' ? u.toString() : undefined;
  } catch {
    return undefined;
  }
};

export interface PersonInput {
  name: string;
  jobTitle?: string;
  links?: Record<string, string | undefined>;
  /** Site-relative or absolute URL of the profile photo. */
  image?: string;
}

/** Person entity for the home and about pages. `url` is the site root; sameAs = configured profiles. */
export function personLd(input: PersonInput, site: URL | string): JsonLd {
  const sameAs = Object.values(input.links ?? {})
    .map(httpsOnly)
    .filter((u): u is string => !!u);
  return {
    '@context': CONTEXT,
    '@type': 'Person',
    '@id': `${absoluteUrl('/', site)}#person`,
    name: input.name,
    url: absoluteUrl('/', site),
    ...(input.jobTitle ? { jobTitle: input.jobTitle } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(input.image ? { image: new URL(input.image, site).toString() } : {}),
  };
}

/** Person for the profile's owner: photo (built asset URL) only when one is configured. */
export const profilePersonLd = (
  profile: {
    name: string;
    title: string;
    links: Record<string, string | undefined>;
    photo?: { src: { src: string } };
  },
  site: URL | string,
): JsonLd =>
  personLd(
    {
      name: profile.name,
      jobTitle: profile.title,
      links: profile.links,
      ...(profile.photo ? { image: profile.photo.src.src } : {}),
    },
    site,
  );

export interface Crumb {
  label: string;
  href?: string;
}

/** BreadcrumbList mirroring the visible breadcrumbs; the current page uses its own `currentPath`. */
export function breadcrumbLd(items: readonly Crumb[], currentPath: string, site: URL | string): JsonLd {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      item: absoluteUrl(i === items.length - 1 ? currentPath : (c.href ?? currentPath), site),
    })),
  };
}

export interface BlogInput {
  name: string;
  description: string;
  articles: readonly { title: string; url: string }[];
}

/** /blog: a collection page listing links to the Medium originals; undefined when there are none. */
export function blogLd(input: BlogInput, site: URL | string): JsonLd | undefined {
  const items = input.articles.flatMap((a) => {
    const url = httpsOnly(a.url);
    return url ? [{ title: a.title, url }] : [];
  });
  if (items.length === 0) return undefined;
  return {
    '@context': CONTEXT,
    '@type': 'CollectionPage',
    name: input.name,
    description: input.description,
    url: absoluteUrl('/blog', site),
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: items.map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: a.title,
        url: a.url,
      })),
    },
  };
}

/**
 * Safe to put inside <script type="application/ld+json">: `<` (so "</script>" and "<!--" can't end
 * the block) and the JS line separators are escaped; the result is still valid JSON.
 */
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
export const serializeJsonLd = (data: JsonLd): string =>
  JSON.stringify(data).replaceAll('<', '\\u003c').replaceAll(LS, '\\u2028').replaceAll(PS, '\\u2029');
