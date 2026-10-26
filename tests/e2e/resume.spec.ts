import { test, expect } from '@playwright/test';

// No resume is configured yet (profile.resume is unset), so these tests are content-agnostic:
// with no resume nothing may be advertised (FR-10.4); once a file is configured, every resume link
// must be consistent and point at a real PDF (FR-10.2/10.3).
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
