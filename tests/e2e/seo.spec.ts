import { readdirSync, readFileSync } from 'node:fs';
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// Content-agnostic SEO checks (FR-14): they discover the routes from the page, so they run on the
// shipped build (no projects/articles), the draft build and the fixture build. @fixtures tests need
// tests/fixtures/content (`pnpm e2e:fixtures`) and read their expectations from those files.
const STATIC_ROUTES = ['/', '/projects', '/about', '/contact', '/blog'];
const MISSING = '/definitely-not-a-page';

interface Head {
  route: string;
  status: number;
  title: string[];
  description: string[];
  canonical: string[];
  robots: string[];
  og: Record<string, string>;
  twitter: Record<string, string>;
  jsonLd: unknown[];
}

async function head(page: Page, route: string): Promise<Head> {
  const response = await page.goto(route);
  return page.evaluate(
    ([route, status]) => {
      const metas = (sel: string) => [...document.head.querySelectorAll<HTMLMetaElement>(sel)];
      const map = (attr: string, prefix: string) =>
        Object.fromEntries(
          metas(`meta[${attr}^="${prefix}"]`).map((m) => [m.getAttribute(attr) as string, m.content]),
        );
      return {
        route: route as string,
        status: status as number,
        title: [...document.head.querySelectorAll('title')].map((t) => t.textContent ?? ''),
        description: metas('meta[name="description"]').map((m) => m.content),
        canonical: [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]')].map(
          (l) => l.href,
        ),
        robots: metas('meta[name="robots"]').map((m) => m.content),
        og: map('property', 'og:'),
        twitter: map('name', 'twitter:'),
        jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) =>
          JSON.parse(s.textContent ?? ''),
        ),
      };
    },
    [route, response?.status() ?? 0] as const,
  );
}

/** Project detail routes, found from the /projects cards (none on a build without case studies). */
async function detailRoutes(page: Page): Promise<string[]> {
  await page.goto('/projects');
  const hrefs = await page
    .locator('main a[href^="/projects/"]')
    .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href') as string));
  return [...new Set(hrefs)];
}

const asArray = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v : [v]) as never;
const types = (h: Head) => h.jsonLd.flatMap(asArray).map((b) => b['@type']);

test.describe('@any-content head metadata on every route', () => {
  let heads: Head[] = [];
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const routes = [...STATIC_ROUTES, ...(await detailRoutes(page)), MISSING];
    heads = [];
    for (const r of routes) heads.push(await head(page, r));
    await page.close();
  });

  test('@smoke @any-content each route has exactly one title and description, unique across routes', () => {
    for (const h of heads) {
      expect(h.title, h.route).toHaveLength(1);
      expect(h.title[0]!.trim().length, h.route).toBeGreaterThan(0);
      expect(h.description, h.route).toHaveLength(1);
      expect(h.description[0]!.length, h.route).toBeGreaterThan(0);
      expect(h.description[0]!.length, h.route).toBeLessThanOrEqual(160);
    }
    const titles = heads.map((h) => h.title[0]);
    expect(new Set(titles).size, titles.join(' | ')).toBe(titles.length);
    const real = heads.filter((h) => h.route !== MISSING).map((h) => h.description[0]);
    expect(new Set(real).size, real.join(' | ')).toBe(real.length);
  });

  test('@smoke @any-content canonical: one per page matching its own route; none on the 404', () => {
    for (const h of heads) {
      if (h.route === MISSING) {
        expect(h.status).toBe(404);
        expect(h.canonical, 'canonical on 404').toHaveLength(0);
        expect(h.og['og:url']).toBeUndefined();
        expect(h.robots.join()).toContain('noindex');
        continue;
      }
      expect(h.status, h.route).toBe(200);
      expect(h.canonical, h.route).toHaveLength(1);
      expect(new URL(h.canonical[0]!).pathname, h.route).toBe(h.route);
      expect(h.og['og:url'], h.route).toBe(h.canonical[0]);
    }
  });

  test('@smoke @any-content Open Graph and Twitter tags are complete and consistent', () => {
    for (const h of heads) {
      expect(h.og['og:title'], h.route).toBe(h.title[0]);
      expect(h.og['og:description'], h.route).toBe(h.description[0]);
      expect(h.og['og:type'], h.route).toMatch(/^(website|profile|article)$/);
      expect(h.og['og:image'], h.route).toMatch(/^https?:\/\/.+\.png$/);
      expect(h.og['og:image:width'], h.route).toBe('1200');
      expect(h.og['og:image:height'], h.route).toBe('630');
      expect(h.og['og:image:alt']?.length, h.route).toBeGreaterThan(0);
      expect(h.twitter['twitter:card'], h.route).toBe('summary_large_image');
      expect(h.twitter['twitter:title'], h.route).toBe(h.title[0]);
      expect(h.twitter['twitter:description'], h.route).toBe(h.description[0]);
      expect(h.twitter['twitter:image'], h.route).toBe(h.og['og:image']);
    }
  });

  test('@smoke @any-content og:image resolves to a 1200x630 PNG', async ({ request }) => {
    for (const url of new Set(heads.map((h) => h.og['og:image']!))) {
      const res = await request.get(new URL(url).pathname);
      expect(res.status(), url).toBe(200);
      expect(res.headers()['content-type'], url).toBe('image/png');
      const png = await res.body();
      expect(png.subarray(1, 4).toString(), url).toBe('PNG');
      expect([png.readUInt32BE(16), png.readUInt32BE(20)], url).toEqual([1200, 630]);
    }
  });

  test('@smoke @any-content JSON-LD parses; Person on home/about, BreadcrumbList on inner pages, none on 404', () => {
    for (const h of heads) {
      const t = types(h);
      if (h.route === MISSING) expect(h.jsonLd, h.route).toHaveLength(0);
      else if (h.route === '/') expect(t, h.route).toEqual(['Person']);
      else {
        expect(t, h.route).toContain('BreadcrumbList');
        const crumbs = asArray(h.jsonLd.find((b) => asArray(b)[0]!['@type'] === 'BreadcrumbList'))[0]!;
        const items = crumbs.itemListElement as { position: number; name: string; item: string }[];
        expect(items.map((i) => i.position)).toEqual(items.map((_, i) => i + 1));
        expect(items[0]!.name).toBe('Home');
        expect(new URL(items.at(-1)!.item).pathname).toBe(h.route);
      }
      if (h.route === '/' || h.route === '/about') {
        const person = asArray(h.jsonLd.find((b) => asArray(b)[0]!['@type'] === 'Person'))[0]!;
        expect(person['@context']).toBe('https://schema.org');
        expect(String(person.name).length).toBeGreaterThan(0);
        for (const u of (person.sameAs as string[] | undefined) ?? []) expect(u).toMatch(/^https:\/\//);
      }
      // Articles live on Medium: never claim hosted BlogPosting content.
      expect(JSON.stringify(h.jsonLd), h.route).not.toContain('BlogPosting');
    }
  });

  test('@any-content /blog JSON-LD lists exactly the Medium links the page shows (or is absent when empty)', async ({
    page,
  }) => {
    const h = heads.find((x) => x.route === '/blog')!;
    await page.goto('/blog');
    const cards = await page.locator('[data-grid] > li').count();
    const list = h.jsonLd.flatMap(asArray).find((b) => b['@type'] === 'CollectionPage');
    if (cards === 0) return expect(list).toBeUndefined();
    const items = (list!.mainEntity as { itemListElement: { url: string }[] }).itemListElement;
    expect(items).toHaveLength(cards);
    const hrefs = await page
      .locator('[data-grid] a')
      .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
    expect(items.map((i) => i.url)).toEqual(hrefs);
  });
});

test.describe('@any-content sitemap and robots', () => {
  const locs = async (request: APIRequestContext) => {
    const xml = await (await request.get('/sitemap-0.xml')).text();
    return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname);
  };

  test('@smoke @any-content sitemap lists the public routes, never the 404 page, rss or images', async ({
    page,
    request,
  }) => {
    const paths = await locs(request);
    for (const r of STATIC_ROUTES) expect(paths, r).toContain(r);
    for (const r of await detailRoutes(page)) expect(paths, r).toContain(r);
    for (const p of paths) {
      expect(p).not.toMatch(/404|rss|\/og\//);
      expect((await request.get(p)).status(), p).toBe(200);
    }
    expect(new Set(paths).size).toBe(paths.length);
  });

  test('@smoke @any-content robots.txt agrees with the robots meta tag', async ({ page, request }) => {
    const txt = await (await request.get('/robots.txt')).text();
    const h = await head(page, '/');
    if (h.robots.join().includes('noindex')) {
      expect(txt).toContain('Disallow: /');
      expect(txt).not.toContain('Sitemap:');
    } else {
      expect(txt).toContain('Allow: /');
      expect(txt).toMatch(/Sitemap: .+\/sitemap-index\.xml/);
    }
  });
});

test.describe('@fixtures SEO with populated content', () => {
  const profile = JSON.parse(readFileSync('tests/fixtures/content/profile.json', 'utf8')).main as {
    name: string;
    title: string;
    links: Record<string, string>;
  };
  const studies = readdirSync('tests/fixtures/content/case-studies').filter((f) => f.endsWith('.mdx'));

  test('@fixtures every project detail page has its own OG image (1200x630) and breadcrumbs', async ({
    page,
    request,
  }) => {
    const routes = await detailRoutes(page);
    expect(routes).toHaveLength(studies.length);
    for (const route of routes) {
      const slug = route.split('/').pop()!;
      const h = await head(page, route);
      expect(new URL(h.og['og:image']!).pathname, route).toBe(`/og/projects/${slug}.png`);
      expect(h.og['og:image:alt'], route).toContain('case study');
      const res = await request.get(`/og/projects/${slug}.png`);
      expect(res.status(), route).toBe(200);
      const png = await res.body();
      expect([png.readUInt32BE(16), png.readUInt32BE(20)], route).toEqual([1200, 630]);
      expect(types(h), route).toContain('BreadcrumbList');
      expect(h.title[0], route).toContain(profile.name);
    }
    // And the default image is a different file.
    const d = await request.get('/og/default.png');
    const p = await request.get(`/og/projects/${routes[0]!.split('/').pop()}.png`);
    expect((await d.body()).equals(await p.body())).toBe(false);
  });

  test('@fixtures home and about carry a Person with sameAs from the profile links and the photo', async ({
    page,
  }) => {
    for (const route of ['/', '/about']) {
      const h = await head(page, route);
      const person = h.jsonLd.flatMap(asArray).find((b) => b['@type'] === 'Person')!;
      expect(person.name).toBe(profile.name);
      expect(person.jobTitle).toBe(profile.title);
      expect(person.sameAs).toEqual(Object.values(profile.links));
      expect(String(person.image)).toMatch(/^https?:\/\/.+\/_astro\/.+/);
      expect(person['@id']).toMatch(/#person$/);
    }
  });

  test('@fixtures /blog lists all fixture articles as links to their originals', async ({ page }) => {
    const h = await head(page, '/blog');
    const list = h.jsonLd.flatMap(asArray).find((b) => b['@type'] === 'CollectionPage')!;
    const items = (list.mainEntity as { itemListElement: { name: string; url: string }[] }).itemListElement;
    expect(items).toHaveLength(
      readdirSync('tests/fixtures/content/articles').filter((f) => f.endsWith('.md')).length,
    );
    for (const i of items) expect(i.url).toMatch(/^https:\/\/example\.com\/articles\//);
    expect(h.description[0]).toContain(profile.name);
  });

  test('@fixtures sitemap includes the fixture project pages', async ({ request }) => {
    const xml = await (await request.get('/sitemap-0.xml')).text();
    expect([...xml.matchAll(/<loc>[^<]*\/projects\/[^<]+<\/loc>/g)]).toHaveLength(studies.length);
  });
});
