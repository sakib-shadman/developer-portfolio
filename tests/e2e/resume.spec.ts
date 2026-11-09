import { test, expect } from '@playwright/test';

// The real content has a resume (profile.resume), asserted exactly in the last section. The generic tests
// below stay content-agnostic and are also valid for a build without one: with no resume nothing may be
// advertised (FR-10.4); once a file is configured, every resume link must be consistent and point at a
// real PDF (FR-10.2/10.3).
const PAGES = ['/', '/about', '/projects'];

for (const path of PAGES) {
  test(`@smoke ${path}: resume links are absent, or all valid`, async ({ page, request }) => {
    await page.goto(path);
    const links = page.locator('a[href^="/resume/"]');
    const n = await links.count();
    if (n === 0) {
      await expect(page.getByRole('banner').getByRole('link', { name: /resume/i })).toHaveCount(0);
      await expect(page.getByRole('contentinfo').getByRole('link', { name: /resume/i })).toHaveCount(0);
      await expect(page.locator('main').getByRole('link', { name: /resume/i })).toHaveCount(0);
      return;
    }
    for (const a of await links.all()) {
      const href = (await a.getAttribute('href')) as string;
      const res = await request.get(href);
      expect(res.status(), href).toBe(200);
      expect(res.headers()['content-type'], href).toContain('pdf');
      const download = (await a.getAttribute('download')) !== null;
      if (!download) {
        // "View" actions open the PDF in a new tab and announce it
        await expect(a).toHaveAttribute('target', '_blank');
        await expect(a).toHaveAttribute('rel', /noopener/);
        await expect(a.locator('.sr-only')).toHaveText(/\(opens in a new tab\)/);
      }
    }
  });
}

// The hero ("Download resume") and About page actions exist exactly when a resume is configured.
test('@smoke hero and About show Download resume if and only if a resume is configured', async ({ page }) => {
  await page.goto('/');
  const configured = (await page.locator('a[href^="/resume/"]').count()) > 0;
  const hero = page.locator('#hero').getByRole('link', { name: /Download resume/ });
  await expect(hero).toHaveCount(configured ? 1 : 0);
  if (configured) await expect(hero).toHaveAttribute('download', '');
  await page.goto('/about');
  const main = page.getByRole('main');
  const download = main.getByRole('link', { name: /Download resume/ });
  const view = main.getByRole('link', { name: /View resume/ });
  await expect(download).toHaveCount(configured ? 2 : 0);
  await expect(view).toHaveCount(configured ? 1 : 0);
  if (configured) {
    await expect(download.first()).toHaveAttribute('download', '');
    await expect(view).toHaveAttribute('target', '_blank');
    await expect(view).not.toHaveAttribute('download', /.*/);
  }
});

// Real content: the owner's resume is configured, so every surface must advertise it, exactly once each.
const RESUME = '/resume/shadman-sakib-resume.pdf';

test('@smoke the real resume PDF is served as application/pdf with a short cache and nosniff', async ({
  request,
}) => {
  const res = await request.get(RESUME);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/pdf');
  expect(res.headers()['cache-control']).toBe('public, max-age=3600');
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
  const body = await res.body();
  expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(body.length).toBeGreaterThan(10_000);
});

test('@smoke home: header and footer open the resume in a new tab, the hero downloads it', async ({
  page,
}) => {
  await page.goto('/');
  const links = page.locator(`a[href="${RESUME}"]`);
  await expect(links).toHaveCount(3);
  const header = page.getByRole('banner').locator(`a[href="${RESUME}"]`);
  const footer = page.getByRole('contentinfo').locator(`a[href="${RESUME}"]`);
  const hero = page.locator('#hero').locator(`a[href="${RESUME}"]`);
  for (const l of [header, footer]) {
    await expect(l).toHaveCount(1);
    await expect(l).toHaveAttribute('target', '_blank');
    await expect(l).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(l).not.toHaveAttribute('download', /.*/);
  }
  await expect(hero).toHaveCount(1);
  await expect(hero).toHaveAttribute('download', '');
  await expect(hero).toContainText('Download resume');
});

test('@smoke about: Download resume (twice) and View resume, plus header and footer', async ({ page }) => {
  await page.goto('/about');
  await expect(page.locator(`a[href="${RESUME}"]`)).toHaveCount(5);
  const main = page.getByRole('main');
  await expect(main.locator(`a[href="${RESUME}"][download]`)).toHaveCount(2);
  const view = main.getByRole('link', { name: /View resume/ });
  await expect(view).toHaveCount(1);
  await expect(view).toHaveAttribute('href', RESUME);
  await expect(view).toHaveAttribute('target', '_blank');
  await expect(view).toHaveAttribute('rel', 'noopener noreferrer');
  for (const region of ['banner', 'contentinfo'] as const) {
    const l = page.getByRole(region).locator(`a[href="${RESUME}"]`);
    await expect(l).toHaveCount(1);
    await expect(l).toHaveAttribute('target', '_blank');
  }
});

test('@smoke the resume is a link only: no page preloads or prefetches it', async ({ page }) => {
  for (const path of ['/', '/about', '/projects', '/contact']) {
    await page.goto(path);
    await expect(page.locator(`link[href*="/resume/"]`)).toHaveCount(0);
  }
});
