import { test, expect, type APIResponse, type Page } from '@playwright/test';

// Response headers come from firebase.json, so against an arbitrary BASE_URL only web.app counts.
test.skip(
  !!process.env.BASE_URL && !process.env.BASE_URL.includes('web.app'),
  'headers come from firebase.json',
);

// Content-agnostic: runs on the shipped build and the fixtures build (see @fixtures for the PDF).
const PAGES = ['/', '/projects', '/blog', '/about', '/contact'];
const FEEDS_AND_FILES = ['/rss.xml', '/robots.txt', '/sitemap-index.xml', '/favicon.svg'];

const directive = (csp: string, name: string): string[] | undefined =>
  csp
    .split(';')
    .map((d) => d.trim().split(/\s+/))
    .find(([n]) => n === name)
    ?.slice(1);

function expectSecurityHeaders(res: APIResponse, url: string): void {
  const h = res.headers();
  const csp = h['content-security-policy'] ?? '';
  expect(csp, `${url} CSP`).not.toBe('');
  expect(directive(csp, 'default-src'), `${url} default-src`).toEqual(["'self'"]);
  expect(directive(csp, 'frame-ancestors'), `${url} frame-ancestors`).toEqual(["'none'"]);
  expect(directive(csp, 'base-uri'), `${url} base-uri`).toEqual(["'self'"]);
  expect(directive(csp, 'form-action'), `${url} form-action`).toEqual(["'self'"]);
  // Scripts: same-origin bundles only. No inline or eval, ever.
  const script = directive(csp, 'script-src') ?? [];
  expect(script, `${url} script-src`).toContain("'self'");
  expect(script).not.toContain("'unsafe-inline'");
  expect(script).not.toContain("'unsafe-eval'");
  expect(script).not.toContain('*');
  expect(csp).not.toContain('http:'); // https only
  expect(h['x-content-type-options'], `${url} nosniff`).toBe('nosniff');
  expect(h['referrer-policy'], `${url} referrer`).toBe('strict-origin-when-cross-origin');
  expect(h['permissions-policy'], `${url} permissions`).toMatch(
    /camera=\(\).*microphone=\(\).*geolocation=\(\)/,
  );
  expect(h['cross-origin-opener-policy'], `${url} COOP`).toBe('same-origin');
  expect(h['cross-origin-resource-policy'], `${url} CORP`).toBe('same-origin');
  expect(h['x-frame-options'], `${url} XFO`).toBe('DENY');
}

for (const url of [...PAGES, ...FEEDS_AND_FILES]) {
  test(`@smoke security headers on ${url}`, async ({ request }) => {
    const res = await request.get(url);
    expect(res.status()).toBe(200);
    expectSecurityHeaders(res, url);
  });
}

test('@smoke security headers also cover the 404 page', async ({ request }) => {
  const res = await request.get('/this-route-does-not-exist');
  expect(res.status()).toBe(404);
  expectSecurityHeaders(res, '404');
});

test('@smoke HTML revalidates on every load (no-cache)', async ({ request }) => {
  for (const url of [...PAGES, '/this-route-does-not-exist']) {
    const res = await request.get(url);
    expect(res.headers()['cache-control'], url).toBe('no-cache');
  }
});

test('@smoke cache: hashed assets are immutable, feed and favicon are short-lived', async ({ request }) => {
  const html = await (await request.get('/')).text();
  const assets = [...html.matchAll(/(?:href|src)="(\/_astro\/[^"]+)"/g)].map((m) => m[1]!);
  expect(assets.length).toBeGreaterThan(0);
  for (const a of assets) {
    const res = await request.get(a);
    expect(res.status(), a).toBe(200);
    expect(res.headers()['cache-control'], a).toBe('public, max-age=31536000, immutable');
    expectSecurityHeaders(res, a);
  }
  expect((await request.get('/rss.xml')).headers()['cache-control']).toBe('public, max-age=3600');
  expect((await request.get('/rss.xml')).headers()['content-type']).toContain('application/rss+xml');
  expect((await request.get('/favicon.svg')).headers()['cache-control']).toBe('public, max-age=86400');
  expect((await request.get('/robots.txt')).headers()['cache-control']).toBe('no-cache');
});

// The CSP must not break the site: load every page in a real browser and fail on any violation
// (blocked image, font, script, style, connection). Also proves no inline scripts crept in.
async function collectViolations(page: Page, url: string): Promise<string[]> {
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`),
    );
  });
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) consoleErrors.push(m.text());
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  const events = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
  return [...events, ...consoleErrors];
}

test('@smoke no CSP violations on any page (images, fonts, scripts, styles all allowed)', async ({
  page,
}) => {
  await page.goto('/');
  const detail = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="/projects/"]')].map((a) => a.getAttribute('href')!),
  );
  const urls = [...PAGES, '/this-route-does-not-exist', ...new Set(detail)];
  for (const url of urls) {
    const fresh = await page.context().newPage();
    expect(await collectViolations(fresh, url), url).toEqual([]);
    await fresh.close();
  }
});

test('@smoke pages ship no inline scripts (script-src is self-only)', async ({ request }) => {
  for (const url of PAGES) {
    const html = await (await request.get(url)).text();
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>/g)];
    expect(
      inline.map((m) => m[0]),
      url,
    ).toEqual([]);
    expect(html, url).not.toMatch(/\son[a-z]+="/); // inline event handlers
  }
});

test('@fixtures resume PDF: served as a PDF with security headers and a short cache', async ({ request }) => {
  const home = await (await request.get('/')).text();
  const href = /href="(\/resume\/[^"]+\.pdf)"/.exec(home)?.[1];
  expect(href, 'home links to a resume PDF in the fixtures build').toBeTruthy();
  const res = await request.get(href!);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/pdf');
  expect(res.headers()['cache-control']).toBe('public, max-age=3600');
  expectSecurityHeaders(res, href!);
});
