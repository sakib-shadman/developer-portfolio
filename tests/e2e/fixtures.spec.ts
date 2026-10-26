import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

// @fixtures: run against a build of tests/fixtures/content (`pnpm e2e:fixtures`), whose profile has a
// photo, email, resume, all profile links, bio, principles, expertise, community, objective and
// interests, plus 4 projects (2 with case studies) and 9 articles. Everything there is fictional.
const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();

test.describe('/about populated', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/about');
  });

  test('@fixtures every section renders from data', async ({ page }) => {
    const main = page.getByRole('main');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('About Alex Example');
    await expect(main).toContainText('8 years of professional experience');
    await expect(main).toContainText('This second paragraph checks');
    for (const h of ['Areas of expertise', 'Engineering principles', 'Community & writing', 'Looking for']) {
      await expect(main.getByRole('heading', { level: 2, name: h })).toBeVisible();
    }
    await expect(main).toContainText('Fictional cross-platform apps');
    await expect(main).toContainText('Outside work: Sample chess, Sample hiking');
    await expect(main).not.toContainText(/\[[^\]]+\]/);
  });

  test('@fixtures photo loads with its alt text', async ({ page }) => {
    const img = page.getByRole('img', { name: 'Sample portrait of Alex Example' });
    await expect(img).toBeVisible();
    expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  });

  test('@fixtures principles are an ordered list numbered 01-03', async ({ page }) => {
    const items = page.locator('ol.principles > li');
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText('01');
    await expect(items.nth(2)).toContainText('03');
  });

  test('@fixtures community link and profile links are safe external links', async ({ page }) => {
    const main = page.getByRole('main');
    const medium = main.getByRole('link', { name: /Writes sample articles on Medium/ });
    await expect(medium).toHaveAttribute('target', '_blank');
    await expect(medium).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(medium.locator('.sr-only')).toHaveText(/opens in a new tab/);
    for (const name of ['GitHub', 'LinkedIn', 'Medium']) {
      await expect(main.getByRole('link', { name: new RegExp(`^${name}`) }).first()).toHaveAttribute(
        'rel',
        'noopener noreferrer',
      );
    }
  });

  test('@fixtures has no axe violations and no overflow at 320px', async ({ page }) => {
    expect((await axe(page)).violations).toEqual([]);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/about');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(
      0,
    );
  });
});

test.describe('resume', () => {
  for (const path of ['/', '/about', '/projects']) {
    test(`@fixtures ${path}: every resume link serves a PDF; actions are consistent`, async ({
      page,
      request,
    }) => {
      await page.goto(path);
      const links = page.locator('a[href^="/resume/"]');
      expect(await links.count()).toBeGreaterThan(0);
      for (const a of await links.all()) {
        const href = (await a.getAttribute('href')) as string;
        const res = await request.get(href);
        expect(res.status(), href).toBe(200);
        expect(res.headers()['content-type'], href).toContain('pdf');
      }
      await expect(page.getByRole('banner').getByRole('link', { name: /resume/i })).toHaveCount(1);
      await expect(page.getByRole('contentinfo').getByRole('link', { name: /resume/i })).toHaveCount(1);
    });
  }

  test('@fixtures hero and About show their resume actions', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('#hero').getByRole('link', { name: /Download resume/ });
    await expect(hero).toHaveCount(1);
    await expect(hero).toHaveAttribute('download', '');
    await page.goto('/about');
    const main = page.getByRole('main');
    await expect(main.getByRole('link', { name: /Download resume/ })).toHaveCount(2);
    const view = main.getByRole('link', { name: /View resume/ });
    await expect(view).toHaveCount(1);
    await expect(view).toHaveAttribute('target', '_blank');
  });
});

test.describe('/contact with an email', () => {
  test('@fixtures shows email, mailto with subject, reply time and location', async ({ page }) => {
    await page.goto('/contact');
    const main = page.getByRole('main');
    await expect(main.getByRole('link', { name: 'Email me' })).toHaveAttribute(
      'href',
      'mailto:hello@example.com?subject=Hello%20from%20your%20portfolio',
    );
    await expect(main).toContainText('hello@example.com');
    await expect(main).toContainText('within 2 days');
    await expect(main).toContainText('Sampletown · GMT+0');
    expect((await axe(page)).violations).toEqual([]);
  });

  test.describe('copy address', () => {
    test.skip(({ browserName }) => browserName !== 'chromium', 'clipboard permissions: chromium only');

    test('@fixtures the script reveals the button; copying announces, fills the clipboard and clears', async ({
      page,
      context,
    }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.goto('/contact');
      const btn = page.getByRole('button', { name: 'Copy address' });
      const status = page.getByRole('status').first();
      await expect(btn).toBeVisible();
      await btn.click();
      await expect(status).toHaveText('Email address copied');
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('hello@example.com');
      await btn.click();
      await expect(status).toHaveText('Email address copied');
      await expect(status).toHaveText('', { timeout: 6000 });
    });

    test('@fixtures a rejected clipboard write shows the manual-copy message', async ({ page }) => {
      await page.goto('/contact');
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText: () => Promise.reject(new Error('denied')) },
          configurable: true,
        });
      });
      await page.getByRole('button', { name: 'Copy address' }).click();
      await expect(page.getByRole('status').first()).toContainText('Copy failed');
    });
  });
});

test.describe('projects and case studies', () => {
  test('@fixtures /projects lists 4 projects; only the 2 with case studies link to detail pages', async ({
    page,
    request,
  }) => {
    await page.goto('/projects');
    await expect(page.locator('[data-grid] > li')).toHaveCount(4);
    const hrefs = await page
      .locator('main a[href^="/projects/"]')
      .evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')))]);
    expect(hrefs.sort()).toEqual(['/projects/sample-app', '/projects/sample-sdk']);
    for (const h of hrefs) expect((await request.get(h as string)).status()).toBe(200);
    expect((await axe(page)).violations).toEqual([]);
  });

  test('@fixtures case study renders its MDX sections, media and sibling navigation', async ({ page }) => {
    await page.goto('/projects/sample-sdk');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sample SDK');
    await expect(page.getByRole('heading', { level: 2, name: 'Sample technical decisions' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Why this sample exists' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Sample screenshot of Sample SDK' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'More projects' }).getByRole('link')).toHaveCount(1);
  });
});

test('@fixtures home renders populated hero, stats and featured projects', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.locator('#work')).toBeVisible();
  expect((await axe(page)).violations).toEqual([]);
});
