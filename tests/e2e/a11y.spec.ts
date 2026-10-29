import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

// PF-42: WCAG 2.2 AA audit, automatable part. Content-agnostic tests (@any-content) run on the shipped and
// fixtures builds; tests that need populated lists, an email or a slider are @fixtures. Viewport sweeps and
// keyboard walks run on the desktop project only (the mobile project is the same browser engine).
// Manual part (VoiceOver etc.): docs/a11y-audit.md.
const STATIC_ROUTES = ['/', '/projects', '/blog', '/about', '/contact', '/this-route-does-not-exist'];
const WIDTHS = [1440, 768, 390] as const;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

async function routes(page: Page): Promise<string[]> {
  await page.goto('/projects');
  const detail = await page.evaluate(() => [
    ...new Set(
      [...document.querySelectorAll('main a[href^="/projects/"]')].map((a) => a.getAttribute('href')!),
    ),
  ]);
  return [...STATIC_ROUTES, ...detail];
}

async function axe(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
    label,
  ).toEqual([]);
}

test.describe('axe, every route x width', () => {
  test('@any-content wcag2a/aa/21aa/22aa at 1440, 768 and 390', async ({ page }, info) => {
    test.skip(info.project.name !== 'chromium', 'viewport sweep runs once');
    for (const route of await routes(page)) {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route);
        await axe(page, `${route} @${width}`);
      }
    }
  });
});

test.describe('axe, interactive states', () => {
  for (const width of [1440, 390]) {
    test(`@fixtures filters, no-match, load more, slider paused, copy status at ${width}`, async ({
      page,
      context,
    }, info) => {
      test.skip(info.project.name !== 'chromium', 'viewport sweep runs once');
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.setViewportSize({ width, height: 900 });

      await page.goto('/blog');
      await page.getByRole('group', { name: 'Filter by topic' }).getByRole('button').nth(1).click();
      await axe(page, 'blog tag filtered');
      await page.getByRole('searchbox', { name: 'Search articles' }).fill('zzzz-no-such-article');
      await expect(page.getByRole('heading', { name: 'No articles match your search' })).toBeVisible();
      await axe(page, 'blog no match');
      await page.getByRole('button', { name: 'Clear search and filters' }).click();
      await page.getByRole('button', { name: 'Load more articles' }).click();
      await axe(page, 'blog load more expanded');

      await page.goto('/projects');
      await page.getByRole('group', { name: 'Filter by category' }).getByRole('button').nth(1).click();
      await axe(page, 'projects filtered');

      await page.goto('/');
      const pause = page.getByRole('button', { name: /Pause automatic/ }).first();
      if (await pause.isVisible()) {
        await pause.click();
        await expect(page.getByRole('button', { name: /Resume automatic/ }).first()).toBeVisible();
        await axe(page, 'home slider paused');
      }

      await page.goto('/contact');
      await page.getByRole('button', { name: 'Copy address' }).click();
      await expect(page.getByRole('status').first()).toHaveText('Email address copied');
      await axe(page, 'contact copy status');
    });
  }
});

interface Stop {
  tag: string;
  name: string;
  region: number;
  visible: boolean;
  indicator: boolean;
  obscured: boolean;
  forcedIndicator: boolean;
}

/** Tab through the page; returns every stop until focus leaves the document (or a trap is suspected). */
async function tabWalk(page: Page, max = 150): Promise<{ stops: Stop[]; left: boolean }> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const stops: Stop[] = [];
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate((): Stop | null => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body || el === document.documentElement) return null;
      // The ring may sit on the focused element or on a card that contains it (:has(:focus-visible)).
      let outline = false;
      let shadow = false;
      for (let n: HTMLElement | null = el; n; n = n.parentElement) {
        if (n !== el && !n.matches(':has(:focus-visible)')) continue;
        const c = getComputedStyle(n);
        outline ||= c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0;
        shadow ||= c.boxShadow !== 'none' && c.boxShadow !== '';
      }
      const cs = getComputedStyle(el);
      const parent = (s: string) => el.closest(s);
      const region = parent('header') ? 0 : parent('footer') ? 2 : 1;
      const rect = el.getBoundingClientRect();
      return {
        tag: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`,
        name: (el.getAttribute('aria-label') ?? el.textContent ?? '')
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 50),
        region,
        visible: rect.width > 0 && rect.height > 0 && cs.visibility !== 'hidden',
        indicator: outline || shadow,
        // WCAG 2.4.11 Focus Not Obscured: the element's centre must hit the element itself, not a sticky bar.
        obscured: (() => {
          const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          return !!hit && !el.contains(hit) && !hit.contains(el);
        })(),
        forcedIndicator: outline,
      };
    });
    // Focus left the page: either it landed on body, or it wrapped around to the skip link.
    if (!stop || (stops.length > 0 && stop.name === stops[0]!.name)) return { stops, left: true };
    stops.push(stop);
  }
  return { stops, left: false };
}

test.describe('keyboard', () => {
  test('@any-content tab order: skip link, header, main, footer; no trap; visible focus on every stop', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'chromium', 'keyboard walk runs once');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of await routes(page)) {
        await page.goto(route);
        const { stops, left } = await tabWalk(page);
        expect(left, `${route} @${width} @${width}: focus must leave the page (no trap)`).toBe(true);
        expect(stops.length, route).toBeGreaterThan(2);
        expect(stops[0]!.name, `${route} @${width} @${width}: first stop`).toBe('Skip to content');
        // stops[0] is the skip link (before the header landmark); order is checked after it.
        for (let i = 2; i < stops.length; i += 1)
          expect(
            stops[i]!.region,
            `${route} @${width} @${width}: ${stops[i]!.name} out of order`,
          ).toBeGreaterThanOrEqual(stops[i - 1]!.region);
        for (const s of stops) {
          expect(
            s.visible,
            `${route} @${width} @${width}: ${s.tag} "${s.name}" is focusable but not visible`,
          ).toBe(true);
          expect(
            s.obscured,
            `${route} @${width} @${width}: ${s.tag} "${s.name}" is covered when focused`,
          ).toBe(false);
          expect(
            s.indicator,
            `${route} @${width} @${width}: ${s.tag} "${s.name}" has no focus indicator`,
          ).toBe(true);
        }
      }
    }
  });

  test('@any-content skip link moves focus to main and Enter on a header link navigates', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'chromium', 'keyboard walk runs once');
    await page.goto('/about');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('main');
    const link = page.getByRole('navigation', { name: 'Primary' }).getByRole('link').first();
    const href = await link.getAttribute('href');
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${href === '/' ? '/$' : href}`));
  });

  test('@fixtures buttons act on Enter and Space (filters, load more, pause, copy)', async ({
    page,
    context,
  }, info) => {
    test.skip(info.project.name !== 'chromium', 'keyboard walk runs once');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/blog');
    const pills = page.getByRole('group', { name: 'Filter by topic' }).getByRole('button');
    await pills.nth(1).focus();
    await page.keyboard.press('Enter');
    await expect(pills.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await pills.nth(0).focus();
    await page.keyboard.press('Space');
    await expect(pills.nth(0)).toHaveAttribute('aria-pressed', 'true');
    const more = page.getByRole('button', { name: 'Load more articles' });
    const before = await page.locator('[data-grid] > li:not([hidden])').count();
    await more.focus();
    await page.keyboard.press('Enter');
    expect(await page.locator('[data-grid] > li:not([hidden])').count()).toBeGreaterThan(before);

    await page.goto('/');
    const pause = page.getByRole('button', { name: /Pause automatic/ }).first();
    if (await pause.isVisible()) {
      await pause.focus();
      await page.keyboard.press('Space');
      await expect(page.getByRole('button', { name: /Resume automatic/ }).first()).toBeFocused();
    }

    await page.goto('/contact');
    await page.getByRole('button', { name: 'Copy address' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').first()).toHaveText('Email address copied');
  });
});

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe('reflow and zoom', () => {
  test('@any-content 320px wide and 200%/400% zoom: no horizontal scrolling, axe clean', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'chromium', 'viewport sweep runs once');
    for (const route of await routes(page)) {
      // 1280px at 200% zoom = 640 CSS px; at 400% = 320 CSS px (WCAG 1.4.10).
      for (const [w, h] of [
        [640, 400],
        [320, 256],
      ] as const) {
        await page.setViewportSize({ width: w, height: h });
        await page.goto(route);
        expect(await overflow(page), `${route} @${w}px`).toBeLessThanOrEqual(0);
      }
      await axe(page, `${route} @320`);
    }
  });

  test('@any-content text-spacing overrides do not clip or overflow (WCAG 1.4.12)', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'chromium', 'viewport sweep runs once');
    await page.setViewportSize({ width: 390, height: 800 });
    for (const route of await routes(page)) {
      await page.goto(route);
      await page.addStyleTag({
        content:
          '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }',
      });
      expect(await overflow(page), `${route} text spacing`).toBeLessThanOrEqual(0);
    }
  });
});

test.describe('forced colors', () => {
  test('@any-content focus indicators and form controls stay visible', async ({ page }, info) => {
    test.skip(info.project.name !== 'chromium', 'keyboard walk runs once');
    await page.emulateMedia({ forcedColors: 'active' });
    for (const route of await routes(page)) {
      await page.goto(route);
      const { stops } = await tabWalk(page);
      for (const s of stops)
        expect(s.forcedIndicator, `${route}: ${s.tag} "${s.name}" needs an outline in forced colors`).toBe(
          true,
        );
      const bare = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('main button, main input, main textarea, main select')]
          .filter((el) => el.getBoundingClientRect().width > 0)
          .filter((el) => {
            const cs = getComputedStyle(el);
            return parseFloat(cs.borderTopWidth) === 0 && cs.outlineStyle === 'none';
          })
          .map(
            (el) =>
              `${el.tagName.toLowerCase()} "${(el.textContent ?? el.getAttribute('aria-label') ?? '').trim().slice(0, 30)}"`,
          ),
      );
      expect(bare, `${route}: controls without a border in forced colors`).toEqual([]);
    }
  });
});

test.describe('reduced motion', () => {
  test('@any-content no smooth scrolling and near-zero animation durations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const route of ['/', '/projects', '/blog']) {
      await page.goto(route);
      const r = await page.evaluate(() => {
        const slow = [...document.querySelectorAll<HTMLElement>('body *')]
          .filter((el) => {
            const cs = getComputedStyle(el);
            const secs = (v: string) => Math.max(...v.split(',').map((x) => parseFloat(x) || 0));
            return secs(cs.animationDuration) > 0.05 || secs(cs.transitionDuration) > 0.05;
          })
          .map(
            (el) => el.tagName.toLowerCase() + (el.className ? `.${String(el.className).split(' ')[0]}` : ''),
          );
        return { smooth: getComputedStyle(document.documentElement).scrollBehavior, slow };
      });
      expect(r.smooth, route).toBe('auto');
      expect(r.slow, `${route}: animations/transitions still running`).toEqual([]);
    }
  });

  test('@fixtures sliders do not auto-advance and show no pause control', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const tracks = page.locator('[data-slider] [data-track], [data-track]');
    const before = await tracks.evaluateAll((els) => els.map((e) => e.scrollLeft));
    await page.waitForTimeout(7000);
    expect(await tracks.evaluateAll((els) => els.map((e) => e.scrollLeft))).toEqual(before);
    await expect(page.getByRole('button', { name: /Pause automatic/ })).toHaveCount(0);
  });
});

test.describe('structure', () => {
  test('@any-content headings, landmarks, link purpose and image alt on every page', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'chromium', 'structure runs once');
    for (const route of await routes(page)) {
      await page.goto(route);
      const s = await page.evaluate(() => {
        const visible = (el: Element) => (el as HTMLElement).checkVisibility({ visibilityProperty: true });
        const levels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
          .filter(visible)
          .map((h) => Number(h.tagName[1]));
        const skipped: string[] = [];
        levels.forEach((l, i) => {
          if (i > 0 && l > levels[i - 1]! + 1) skipped.push(`h${levels[i - 1]} -> h${l}`);
        });
        const name = (el: Element) =>
          el.getAttribute('aria-label') ??
          (el.getAttribute('aria-labelledby') ?? '')
            .split(' ')
            .map((id) => document.getElementById(id)?.textContent ?? '')
            .join(' ');
        const navs = [...document.querySelectorAll('nav, [role=navigation]')].map((n) => name(n).trim());
        const regions = [
          ...document.querySelectorAll('section[aria-label], section[aria-labelledby], [role=region]'),
        ].map((n) => name(n).trim());
        const labelled = [...navs, ...regions].filter(Boolean);
        const links = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')]
          .filter(visible)
          .map((a) => ({
            text: (name(a) || a.textContent || '').trim().replace(/\s+/g, ' '),
            href: a.getAttribute('href'),
            described: !!a.getAttribute('aria-describedby') || !!a.closest('[aria-labelledby]'),
          }));
        const imgs = [...document.querySelectorAll('img')].map((i) => ({
          src: i.getAttribute('src') ?? '',
          alt: i.getAttribute('alt'),
        }));
        return {
          h1: levels.filter((l) => l === 1).length,
          firstLevel: levels[0],
          skipped,
          main: document.querySelectorAll('main, [role=main]').length,
          banner: document.querySelectorAll('header').length,
          footer: document.querySelectorAll('footer').length,
          navs,
          dupLabels: labelled.filter((l, i) => labelled.indexOf(l) !== i),
          links,
          imgs,
        };
      });
      expect(s.h1, `${route}: exactly one h1`).toBe(1);
      expect(s.firstLevel, `${route}: first heading is h1`).toBe(1);
      expect(s.skipped, `${route}: skipped heading levels`).toEqual([]);
      expect(s.main, `${route}: one main`).toBe(1);
      expect(s.banner, route).toBe(1);
      expect(s.footer, route).toBe(1);
      for (const n of s.navs) expect(n, `${route}: every nav needs a label`).not.toBe('');
      expect(new Set(s.navs).size, `${route}: nav labels unique`).toBe(s.navs.length);
      expect(s.dupLabels, `${route}: duplicate landmark/region labels`).toEqual([]);
      for (const l of s.links) {
        expect(l.text.length, `${route}: link ${l.href} has no name`).toBeGreaterThan(0);
        expect(l.text, `${route}: vague link text`).not.toMatch(
          /^(click here|here|link|more|read more|learn more)$/i,
        );
      }
      // Same name, different destination is only acceptable when the link is named by its card heading.
      const byText = new Map<string, Set<string>>();
      for (const l of s.links) byText.set(l.text, (byText.get(l.text) ?? new Set()).add(l.href ?? ''));
      const ambiguous = [...byText].filter(([, hrefs]) => hrefs.size > 1).map(([t]) => t);
      const undescribed = ambiguous.filter((t) =>
        s.links.filter((l) => l.text === t).some((l) => !l.described),
      );
      expect(undescribed, `${route}: links with the same name and different targets`).toEqual([]);
      for (const i of s.imgs) {
        expect(i.alt, `${route}: ${i.src} needs an alt attribute`).not.toBeNull();
        expect(i.alt, `${route}: ${i.src} alt looks like a file name`).not.toMatch(
          /\.(png|jpe?g|webp|svg)$|^image$/i,
        );
      }
    }
  });
});
