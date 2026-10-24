# Developer Portfolio — Implementation Plan

**Version:** 1.2 (proposal, pending owner approval)
**Read with:** `SRS.md` (what), `HANDOFF.md` (how it looks). This file covers **how it gets built, reviewed and shipped.**
**Repo:** `github.com/sakib-shadman/developer-portfolio`

### Changelog

| Version | Change                                                                                                                                                                                                                                                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.2     | **Content source abstraction** for a future backend (ADR-0008, §2.8): `lib/content` returns plain domain types (no `CollectionEntry` leaks), Zod schemas live in a standalone module that doubles as the API contract, slugs are permanent. PF-06 / PF-30 updated.                                                              |
| 1.1     | Hosting → **Firebase Hosting on the free Spark plan** (`*.web.app`, no custom domain for the early versions). Phase-1 contact = **email only**; the contact form + Cloud Function moves to a later milestone (Blaze). **Medium feed integration dropped**: articles are maintained manually as content files; no scheduled job. |
| 1.0     | Initial plan (Astro + Cloudflare Workers, build-time Medium feed).                                                                                                                                                                                                                                                              |

---

## 0. Decisions (closes SRS §9 / HANDOFF §12)

| #   | Open decision              | Decision                                                                                                                                                                                                                                                                           | Why                                                                                              |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | Stack & hosting            | **Astro + TypeScript (strict)**, fully static output, on **Firebase Hosting (Spark, free)** at `https://<project-id>.web.app`                                                                                                                                                      | Site is static; Spark needs no card; preview channels per PR. Custom domain deferred (see §4.6). |
| 2   | Content format             | **JSON** for profile/skills/experience/projects, **MDX** per case study, **Markdown frontmatter** per article — all validated by **Zod** (Astro content collections)                                                                                                               | Schema validation enforces SRS §6.6 at build time.                                               |
| 3   | Medium fetch location      | **No fetch.** Articles are added by hand as content files (ADR-0003, SRS deviation — §2.4)                                                                                                                                                                                         | No runtime, no cron, no CORS, nothing to fail at runtime.                                        |
| 4   | Blog search in v1          | **Yes** — client-side over title + excerpt                                                                                                                                                                                                                                         | Already designed; ~1 KB JS.                                                                      |
| 5   | Case studies               | **Selected projects only**; optional in schema                                                                                                                                                                                                                                     | FR-06.8.                                                                                         |
| 6   | Contact form               | **v1: email only** (mailto + copy button + profile links). **Form later** (milestone M5, needs Blaze) behind `PUBLIC_CONTACT_FORM`                                                                                                                                                 | SRS allows email-only; FR-11 forbids showing an untested form.                                   |
| 7   | Analytics / RSS            | **RSS: yes** (`/rss.xml` from the articles collection). **Analytics: optional**, Cloudflare Web Analytics JS snippet (cookieless; works on non-Cloudflare hosts). No Google Analytics (cookies → consent banner)                                                                   | FR-16.3/16.5.                                                                                    |
| 8   | Refresh / cache / fallback | **N/A** — articles change only when you commit a new file and deploy                                                                                                                                                                                                               | Follows from #3.                                                                                 |
| 9   | Browsers & perf            | Last 2 versions of Chrome, Edge, Firefox, Safari (macOS + iOS), Samsung Internet. Lighthouse mobile: **Perf ≥ 95, A11y = 100, SEO = 100, BP ≥ 95**; LCP < 2.0 s, CLS < 0.05, INP < 200 ms; **≤ 25 KB gz JS/page**; first-visit page weight **≤ 500 KB** (Spark transfer cap, §4.5) | Enforced by Lighthouse CI.                                                                       |
| 10  | Future backend content     | **Data access goes only through `src/lib/content/*`, which returns framework-free domain types.** A backend later replaces collection loaders, not components (ADR-0008, §2.8)                                                                                                     | Avoids a rewrite when content moves to an API.                                                   |

Each decision gets an ADR in `docs/adr/` (PF-07).

### SRS deviation — ADR-0003 (manual articles)

- **Dropped:** FR-07.2–07.6, FR-07.10–07.14 (feed URL config, retrieval, normalisation from feed, refresh, caching). §6.5 "last successful refresh time" no longer applies.
- **Promoted:** FR-07.15 (manual list) becomes the only source.
- **Still met:** FR-07.7–07.9, FR-07.16, FR-08, FR-09, FR-15 — cards link to the original Medium URL; no article text is stored.
- **Known limitation:** a new Medium article appears on the site only after its content file is merged and deployed.

---

## 1. Tech stack

### 1.1 Core

| Concern                   | Choice                                                                            | Notes                                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Framework                 | **Astro** (latest stable; pin exact version at scaffold)                          | `output: 'static'`, `build.format: 'file'`, `trailingSlash: 'never'` (pairs with Firebase `cleanUrls`). No adapter. |
| Language                  | **TypeScript** `strict` + `noUncheckedIndexedAccess`                              | `astro check` in CI.                                                                                                |
| Package manager / runtime | **pnpm**, **Node 24 LTS** (`.nvmrc`, `packageManager` field)                      |                                                                                                                     |
| Styling                   | **Plain CSS** with `tokens.css` + Astro scoped `<style>`                          | Design files are literal CSS; translate 1:1.                                                                        |
| Interactivity             | **Vanilla TypeScript** in Astro `<script>` modules                                | Slider, project filters, blog filter/search/load-more, copy-email button. No UI framework runtime.                  |
| Content                   | Astro **content collections** + **Zod**                                           | `reference()` for project/experience → skills.                                                                      |
| Case studies              | **MDX** (`@astrojs/mdx`), Shiki code blocks                                       | Custom `<Figure>`, `<Diagram>`, `<Callout>`.                                                                        |
| Images                    | `astro:assets` (AVIF/WebP, sharp at build)                                        | Article thumbnails are **self-hosted** — no Medium hotlinking.                                                      |
| Fonts                     | **Fontsource** self-hosted, latin subset, `font-display: swap`, preload 2 weights |                                                                                                                     |
| Icons                     | Inline SVG; brand marks from **simple-icons**                                     | `aria-hidden="true"`.                                                                                               |

### 1.2 Hosting & integrations

| Concern         | Phase 1 (Spark)                                                                                  | Later (M5, Blaze)                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Hosting         | Firebase Hosting: CDN, HTTPS, `cleanUrls`, headers, 404, preview channels, rollback              | same                                                                                                                   |
| Contact         | `mailto:` + copy button                                                                          | 2nd-gen Cloud Function `contact` via Hosting rewrite `/api/contact`                                                    |
| Email delivery  | —                                                                                                | **Resend** HTTP API, sender `onboarding@resend.dev` (no domain needed; delivers only to your own Resend account email) |
| Spam protection | —                                                                                                | Honeypot + **Cloudflare Turnstile** + best-effort in-memory rate limit (`maxInstances: 1`)                             |
| Secrets         | none                                                                                             | `defineSecret()` → Secret Manager                                                                                      |
| SEO             | `@astrojs/sitemap`, generated `robots.txt`, `<Seo>` component, JSON-LD `Person`/`BreadcrumbList` | same                                                                                                                   |
| OG images       | Static PNG per page type; build-time `satori` for project pages (optional)                       | same                                                                                                                   |
| RSS             | `@astrojs/rss` from articles collection                                                          | same                                                                                                                   |
| Analytics       | Optional CF Web Analytics snippet                                                                | same                                                                                                                   |

### 1.3 Quality tooling

| Layer       | Tool                                                                                                                          | Gate                      |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Format      | Prettier (+ `prettier-plugin-astro`)                                                                                          | CI                        |
| Lint        | ESLint flat config (`eslint-plugin-astro`, `typescript-eslint`, a11y rules)                                                   | CI                        |
| Types       | `astro check` + `tsc --noEmit`                                                                                                | CI                        |
| Unit        | **Vitest** — content guards, article queries (dedupe/featured/sort), slider math, URL safety; later contact schema + function | CI, ≥ 90% on `src/lib/**` |
| E2E         | **Playwright** (Chromium, WebKit, Firefox + mobile viewports) against `astro preview`                                         | CI                        |
| A11y        | `@axe-core/playwright` on every route; manual keyboard + VoiceOver pass                                                       | CI (0 violations)         |
| Performance | **Lighthouse CI** with budgets (§0 #9)                                                                                        | PRs to `main`             |
| Links       | **lychee** on built `dist/`                                                                                                   | weekly + pre-release      |
| Commits     | commitlint (Conventional Commits) + **lefthook**                                                                              | local + PR-title check    |
| Content     | `pnpm content:check` — placeholder guard (fails prod build on `[Bracketed]` text / required nulls)                            | CI                        |

---

## 2. Project architecture

### 2.1 Directory layout

```
developer-portfolio/
├── .github/
│   ├── workflows/{ci.yml, deploy.yml, links.yml}
│   ├── ISSUE_TEMPLATE/{feature,bug,content}.yml
│   ├── pull_request_template.md
│   └── CODEOWNERS
├── docs/
│   ├── SRS.md  HANDOFF.md  IMPLEMENTATION_PLAN.md  MAINTENANCE.md
│   ├── adr/0001-astro-firebase.md …
│   └── design/*.dc.html               # reference only
├── public/
│   ├── resume/shadman-sakib-resume.pdf
│   └── og/default.png
├── scripts/check-content.ts           # placeholder + content guard
├── src/
│   ├── content.config.ts              # collections + Zod schemas
│   ├── content/
│   │   ├── profile.json  skills.json  experience.json
│   │   ├── projects/<slug>.json
│   │   ├── case-studies/<slug>.mdx
│   │   └── articles/<slug>.md  articles/images/*
│   ├── lib/                           # framework-free, unit-tested
│   │   ├── content/
│   │   │   ├── types.ts               # domain types (ProjectCard, ArticleCard, …) — what components consume
│   │   │   ├── schemas.ts             # Zod schemas — the content contract (future API contract)
│   │   │   ├── mappers.ts             # collection entry → domain type
│   │   │   └── {queries,articles,guards}.ts
│   │   ├── seo/{meta,jsonld}.ts
│   │   ├── url.ts                     # safeExternalUrl(), isHttpUrl()
│   │   └── contact/schema.ts          # (M5) shared client/function schema
│   ├── components/
│   │   ├── ui/        Button, LinkPill, Chip, FilterChip, Card, Icon, Eyebrow, Badge
│   │   ├── layout/    Header, Footer, Seo, SkipLink, Breadcrumbs
│   │   ├── sections/  Hero, Stats, Skills, ExperienceList, FeaturedProjects, Writing, ContactCta
│   │   ├── slider/    Slider.astro, slider.client.ts, slider-math.ts
│   │   ├── projects/  ProjectCard, ProjectFilters(.client.ts), CaseStudy/*
│   │   ├── blog/      ArticleCard, BlogBrowser(.client.ts), BlogEmpty
│   │   └── contact/   ContactDirect.astro, (M5) ContactForm.astro + contact-form.client.ts
│   ├── layouts/BaseLayout.astro, PageLayout.astro
│   ├── pages/
│   │   ├── index.astro  about.astro  contact.astro  404.astro
│   │   ├── projects/index.astro  projects/[slug].astro
│   │   ├── blog/index.astro
│   │   ├── rss.xml.ts  robots.txt.ts
│   └── styles/tokens.css  global.css
├── functions/                         # (M5 only) Cloud Function package
├── tests/{unit,e2e}/
├── firebase.json  .firebaserc
├── astro.config.mjs  lighthouserc.json  lychee.toml
├── eslint.config.js  .prettierrc  lefthook.yml  commitlint.config.js
└── package.json
```

### 2.2 Layering rules

```
pages ──► layouts ──► sections ──► ui
  │                      │
  └──► lib/content ◄─────┘        (components never read collections directly)
          │
   content collections (Zod-validated at build)
```

1. `src/lib/**` is framework-free TypeScript and unit-tested.
2. Only `pages/` query collections, via `lib/content/*`, which applies `status === 'published'` filtering in one place (FR-05.9).
3. `*.client.ts` is the only browser code, and every piece is progressive enhancement: slider = native scroll-snap list; filters/search fall back to "show all"; copy button is optional next to the `mailto:` link.
4. **No Astro content types outside `lib/content`.** `CollectionEntry`, `getCollection`, `getEntry` and `astro:content` imports appear only in `src/lib/content/**` and `src/content.config.ts`. Components and pages consume `lib/content/types.ts`. Enforced by ESLint:

```js
// eslint.config.js (excerpt)
{
  files: ['src/components/**', 'src/pages/**', 'src/layouts/**'],
  rules: {
    'no-restricted-imports': ['error', {
      paths: [{ name: 'astro:content', message: 'Import data via src/lib/content/* (ADR-0008).' }],
    }],
  },
}
```

### 2.3 Content schema

Schemas are defined in `src/lib/content/schemas.ts` (plain Zod, no loader concerns) and wired to loaders in `src/content.config.ts`. Fields that need Astro helpers (`image()`, `reference()`) are supplied by the config. Shown together below for brevity:

```ts
import { defineCollection, reference, z } from 'astro:content';
import { file, glob } from 'astro/loaders';

const httpUrl = z
  .string()
  .url()
  .refine((u) => /^https?:\/\//.test(u), 'http(s) only');
const canonicalUrl = z
  .string()
  .url()
  .refine((u) => u.startsWith('https://'), 'https only')
  .transform((u) => {
    const x = new URL(u);
    x.search = '';
    x.hash = '';
    return x.toString();
  });

const skills = defineCollection({
  loader: file('src/content/skills.json'),
  schema: z.object({
    id: z.string(),
    name: z.string().min(1),
    category: z.enum(['languages', 'frameworks', 'platforms', 'tools', 'testing', 'architecture']),
    description: z.string().optional(),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '*.json', base: 'src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      name: z.string().min(1),
      summary: z.string().max(200),
      description: z.string(),
      category: z.enum(['mobile-app', 'sdk', 'library', 'open-source', 'web-app', 'backend']),
      technologies: z.array(reference('skills')).min(1),
      role: z.string(),
      contributions: z.array(z.string()).default([]),
      links: z.object({ repo: httpUrl, demo: httpUrl, store: httpUrl }).partial().default({}),
      media: z.array(z.object({ src: image(), alt: z.string().min(1) })).default([]),
      featured: z.boolean().default(false),
      featuredOrder: z.number().int().optional(),
      status: z.enum(['draft', 'published', 'archived']),
      caseStudy: reference('caseStudies').optional(),
    }),
});

const experience = defineCollection({
  loader: file('src/content/experience.json'),
  schema: z
    .object({
      id: z.string(),
      company: z.string(),
      title: z.string(),
      startDate: z.coerce.date(),
      endDate: z.coerce.date().nullable(), // null = current (FR-03.3)
      description: z.string().optional(),
      responsibilities: z.array(z.string()).default([]),
      achievements: z.array(z.string()).default([]),
      technologies: z.array(reference('skills')).default([]),
      companyUrl: httpUrl.optional(),
    })
    .refine((e) => !e.endDate || e.endDate >= e.startDate, 'endDate before startDate'),
});

const caseStudies = defineCollection({
  loader: glob({ pattern: '*.mdx', base: 'src/content/case-studies' }),
  schema: z.object({
    project: reference('projects'),
    problem: z.string(),
    outcomes: z.array(z.string()).default([]),
  }),
});

// One Markdown file per article; frontmatter only, body empty (FR-07.9).
const articles = defineCollection({
  loader: glob({ pattern: '*.md', base: 'src/content/articles' }), // id = filename
  schema: ({ image }) =>
    z
      .object({
        title: z.string().min(1),
        url: canonicalUrl, // original Medium URL (FR-07.8)
        publishedAt: z.coerce.date(),
        excerpt: z.string().max(240).optional(), // your own summary
        thumbnail: image().optional(),
        thumbnailAlt: z.string().optional(),
        tags: z.array(z.string()).default([]),
        readingMinutes: z.number().int().positive().optional(),
        featured: z.boolean().default(false),
        status: z.enum(['draft', 'published']).default('published'),
      })
      .refine((a) => !a.thumbnail || a.thumbnailAlt, { message: 'thumbnailAlt required with thumbnail' }),
});

export const collections = { skills, projects, experience, caseStudies, articles /*, profile */ };
```

Bad URLs, dangling skill references, missing required fields or missing alt text **fail the build**.

### 2.4 Articles (manual)

Example entry:

```md
<!-- src/content/articles/flutter-render-pipeline.md -->

---

title: "How Flutter's Render Pipeline Actually Works"
url: https://medium.com/@your-handle/how-flutters-render-pipeline-works-abc123?source=rss
publishedAt: 2026-05-14
excerpt: Walking from setState to a rasterized frame — build, layout, paint, compositing.
thumbnail: ./images/flutter-render-pipeline.png
thumbnailAlt: Diagram of Flutter's build, layout and paint phases
tags: [flutter, rendering]
readingMinutes: 9
featured: true
---
```

Domain type (what `ArticleCard.astro`, the home slider and `/blog` consume):

```ts
// src/lib/content/types.ts
export interface Img {
  src: string;
  width: number;
  height: number;
  alt: string;
}

export interface ArticleCard {
  id: string;
  title: string;
  url: string;
  publishedAt: Date;
  excerpt?: string;
  thumbnail?: Img;
  tags: string[];
  readingMinutes?: number;
  featured: boolean;
}
// ProjectCard, ProjectDetail, ExperienceItem, SkillGroup, Profile follow the same pattern.
```

Mapper + queries — duplicates are a build error (FR-07.10), newest first (FR-07.11), featured-or-latest for home (FR-09.2/09.3):

```ts
// src/lib/content/mappers.ts
import type { CollectionEntry } from 'astro:content';
import type { ArticleCard } from './types';

export const toArticleCard = ({ id, data }: CollectionEntry<'articles'>): ArticleCard => ({
  id,
  title: data.title,
  url: data.url,
  publishedAt: data.publishedAt,
  excerpt: data.excerpt,
  thumbnail: data.thumbnail && {
    src: data.thumbnail.src,
    width: data.thumbnail.width,
    height: data.thumbnail.height,
    alt: data.thumbnailAlt!,
  },
  tags: data.tags,
  readingMinutes: data.readingMinutes,
  featured: data.featured,
});
```

```ts
// src/lib/content/articles.ts
import { getCollection } from 'astro:content';
import { toArticleCard } from './mappers';
import type { ArticleCard } from './types';

export function assertUniqueUrls(items: ArticleCard[]): ArticleCard[] {
  const seen = new Map<string, string>();
  for (const a of items) {
    const dupe = seen.get(a.url);
    if (dupe) throw new Error(`Duplicate article URL in "${a.id}" and "${dupe}": ${a.url}`);
    seen.set(a.url, a.id);
  }
  return items;
}

export async function getArticles(): Promise<ArticleCard[]> {
  const entries = await getCollection('articles', (a) => a.data.status === 'published');
  return assertUniqueUrls(entries.map(toArticleCard)).sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
  );
}

export async function getHomeArticles(n = 6): Promise<ArticleCard[]> {
  const all = await getArticles();
  const featured = all.filter((a) => a.featured);
  return (featured.length ? featured : all).slice(0, n);
}
```

`assertUniqueUrls` and the sort/featured logic are pure functions over `ArticleCard[]`, so their unit tests survive a source change unchanged.

Blog states: only **empty** (no articles) and **no-match** (filters/search). The loading/error designs in `BlogStates.dc.html` are not used.

### 2.5 Contact

**Phase 1 — `src/components/contact/ContactDirect.astro`:**

```astro
---
import { getEntry } from 'astro:content';
const profile = (await getEntry('profile', 'main'))!.data;
const formEnabled = import.meta.env.PUBLIC_CONTACT_FORM === 'true'; // false until M5
---

{profile.email && (
  <div class="direct">
    <a
      class="btn-solid"
      href={`mailto:${profile.email}?subject=${encodeURIComponent('Hello from your portfolio')}`}
    >
      Email me
    </a>
    <button class="btn-outline" type="button" data-copy={profile.email} aria-describedby="copy-status">
      Copy address
    </button>
    <span id="copy-status" role="status" class="sr-only"></span>
  </div>
)}
{formEnabled && <slot name="form" />}

<script>
  document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const status = document.getElementById('copy-status')!;
      try {
        await navigator.clipboard.writeText(btn.dataset.copy!);
        status.textContent = 'Email address copied';
      } catch {
        status.textContent = 'Copy failed — select the address manually';
      }
    }),
  );
</script>
```

Publish a dedicated alias (e.g. a `+portfolio` Gmail address or a forwarding address) so scraper spam can be filtered or the address retired.

**M5 — Cloud Function (Blaze):**

```
Browser form ─(client Zod validate, Turnstile token, disable button)─► POST /api/contact
Hosting rewrite ─► function `contact` (asia-south1, maxInstances 1):
    method check → rate limit → Zod → honeypot → Turnstile siteverify → Resend → 202 | 4xx | 502
Browser: 202 → "sent"; anything else → alert with mailto fallback (FR-11.10)
```

```ts
// functions/src/index.ts
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { contactSchema } from '../../src/lib/contact/schema'; // bundled with esbuild

const RESEND_API_KEY = defineSecret('RESEND_API_KEY');
const TURNSTILE_SECRET = defineSecret('TURNSTILE_SECRET_KEY');
const CONTACT_TO = defineSecret('CONTACT_TO_EMAIL');

// Best-effort: maxInstances 1 + concurrency → one process sees all traffic; resets on cold start.
const hits = new Map<string, number[]>();
const limited = (ip: string, max = 5, windowMs = 10 * 60_000) => {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > max;
};

export const contact = onRequest(
  {
    region: 'asia-south1',
    maxInstances: 1,
    concurrency: 40,
    memory: '256MiB',
    timeoutSeconds: 15,
    secrets: [RESEND_API_KEY, TURNSTILE_SECRET, CONTACT_TO],
  },
  async (req, res) => {
    if (req.method !== 'POST') return void res.status(405).end();
    if (limited(req.ip ?? 'unknown')) return void res.status(429).json({ ok: false });

    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success)
      return void res.status(400).json({ ok: false, errors: parsed.error.flatten().fieldErrors });
    const { website, token, ...msg } = parsed.data;
    if (website) return void res.status(202).json({ ok: true }); // honeypot

    const ts = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({
        secret: TURNSTILE_SECRET.value(),
        response: token,
        remoteip: req.ip ?? '',
      }),
    }).then((r) => r.json() as Promise<{ success: boolean }>);
    if (!ts.success) return void res.status(403).json({ ok: false });

    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY.value()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Portfolio <onboarding@resend.dev>',
        to: CONTACT_TO.value(),
        reply_to: msg.email,
        subject: `[Portfolio · ${msg.topic}] ${msg.name}`,
        text: msg.message,
      }),
    });
    res.status(sent.ok ? 202 : 502).json({ ok: sent.ok }); // never fake success
  },
);
```

### 2.6 Slider (HANDOFF §6.1) — pure logic for tests

```ts
// src/components/slider/slider-math.ts
export const activeIndex = (
  scrollLeft: number,
  maxScroll: number,
  cardW: number,
  gap: number,
  count: number,
) => (scrollLeft >= maxScroll - 1 ? count - 1 : Math.min(count - 1, Math.round(scrollLeft / (cardW + gap))));

export const nextIndex = (i: number, count: number) => (i + 1) % count;

export const shouldAutoAdvance = (s: {
  hovered: boolean;
  focusWithin: boolean;
  paused: boolean;
  reducedMotion: boolean;
  hidden: boolean;
}) => !(s.hovered || s.focusWithin || s.paused || s.reducedMotion || s.hidden);
```

### 2.7 Indexing control

`<head>` and `robots.txt` are driven by `PUBLIC_INDEXABLE` (Firebase headers are site-wide, so this can't be per-channel in `firebase.json`):

```ts
// src/pages/robots.txt.ts
import type { APIRoute } from 'astro';
export const GET: APIRoute = ({ site }) => {
  const indexable = import.meta.env.PUBLIC_INDEXABLE === 'true';
  const body = indexable
    ? `User-agent: *\nAllow: /\nSitemap: ${new URL('sitemap-index.xml', site)}\n`
    : `User-agent: *\nDisallow: /\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain' } });
};
```

```astro
<!-- in Seo.astro -->
{import.meta.env.PUBLIC_INDEXABLE !== 'true' && <meta name="robots" content="noindex, nofollow" />}
```

`false` for previews, staging and all 0.x production builds; `true` from v1.0 production.

### 2.8 Future backend — content source abstraction (ADR-0008)

**Goal:** when content moves from repo files to a backend API (Spring Boot / Go / anything serving JSON), only the data layer and the deploy trigger change.

| Layer                                                 | Change when the backend arrives                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| Components, layouts, CSS, client scripts              | none                                                                           |
| Pages                                                 | none (Option A / C); `export const prerender = false` on live pages (Option B) |
| `src/lib/content/types.ts`, query function signatures | none                                                                           |
| `src/lib/content/schemas.ts`                          | none — now validates API responses                                             |
| `src/content.config.ts` loaders                       | `file()`/`glob()` → `apiLoader()`                                              |
| `mappers.ts`                                          | image mapping: local `image()` → remote URL + width/height from API            |
| `astro.config.mjs`                                    | `image.remotePatterns` for the backend's media host                            |
| Deploy                                                | `repository_dispatch` trigger (A) or adapter + Blaze hosting (B)               |

**Integration options (choose per collection when the time comes):**

| Option                      | How                                                                                 | Hosting                                  | Freshness            | When                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------- | -------------------- | ----------------------------------------------------------------------------- |
| **A. Build-time** (default) | custom loader fetches API during `astro build`; backend publish → webhook → rebuild | Spark (static)                           | ~2 min after publish | profile, projects, experience, skills, articles                               |
| **B. Request-time (SSR)**   | Node adapter + Astro live content collections on selected pages                     | Firebase App Hosting / Cloud Run (Blaze) | seconds              | only data that must be live                                                   |
| **C. Client island**        | `fetch` from the browser in one component; backend enables CORS                     | Spark                                    | real time            | non-critical widgets; never core content (not indexed / not in link previews) |

Option A loader:

```ts
// src/lib/content/api-loader.ts
import type { Loader } from 'astro/loaders';

export function apiLoader(endpoint: string): Loader {
  return {
    name: 'api-loader',
    load: async ({ store, parseData, generateDigest, logger }) => {
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${import.meta.env.CONTENT_API_TOKEN}` },
      });
      if (!res.ok) throw new Error(`${endpoint} → ${res.status}`); // fail build; live site keeps last deploy
      const items: Array<{ slug: string } & Record<string, unknown>> = await res.json();
      store.clear();
      for (const item of items) {
        const data = await parseData({ id: item.slug, data: item }); // existing Zod schema
        store.set({ id: item.slug, data, digest: generateDigest(data) });
      }
      logger.info(`Loaded ${items.length} from ${endpoint}`);
    },
  };
}
```

```ts
// src/content.config.ts — the only change per collection
const projects = defineCollection({
  loader: apiLoader(`${import.meta.env.CONTENT_API_URL}/projects`), // was glob({ pattern: '*.json', ... })
  schema: projectSchema, // unchanged
});
```

```yaml
# deploy.yml — add to `on:`
repository_dispatch:
  types: [content-updated]
```

```bash
# backend publish hook
curl -X POST https://api.github.com/repos/sakib-shadman/developer-portfolio/dispatches \
  -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" \
  -d '{"event_type":"content-updated"}'
```

**Rules to follow from day one:**

1. Components and pages never import `astro:content` (ESLint rule, §2.2 #4).
2. Query functions return domain types from `types.ts`; tests target pure functions over those types.
3. Schemas in `schemas.ts` are the contract. Export them for the backend:

   ```ts
   // scripts/export-schemas.ts → docs/contract/*.schema.json
   import { writeFileSync, mkdirSync } from 'node:fs';
   import { zodToJsonSchema } from 'zod-to-json-schema';
   import {
     articleSchema,
     projectSchema,
     experienceSchema,
     skillSchema,
     profileSchema,
   } from '../src/lib/content/schemas';

   mkdirSync('docs/contract', { recursive: true });
   for (const [name, schema] of Object.entries({
     article: articleSchema,
     project: projectSchema,
     experience: experienceSchema,
     skill: skillSchema,
     profile: profileSchema,
   }))
     writeFileSync(
       `docs/contract/${name}.schema.json`,
       JSON.stringify(zodToJsonSchema(schema, name), null, 2),
     );
   ```

4. **Slugs are permanent.** File names / ids today become the backend's unique keys; `/projects/[slug]` URLs never change (FR-05, FR-12.2).
5. A full SPA rewrite that fetches everything client-side is **out** — it reintroduces the 404-status, link-preview and performance problems (ADR-0001).

**Effort when it happens:** Option A ≈ 1–2 days; Option B ≈ 3–5 days (mostly hosting + caching).

---

## 3. Development workflow

### 3.1 Branching — trimmed Gitflow

```
main      ●───────────────────●──────────────●────────●   (production = live channel; tags v0.1.0 … v1.0.0)
           \                 / \            / \      /
release     \               ●   \          ●   \    /       release/x.y.z (per milestone)
             \             /     \        /     \  /
develop       ●──●──●──●──●───────●──●──●───────●─●──     (staging channel)
                 │  │  │           │  │         │
feature/*        PF-02 PF-05 …     PF-30 PF-34  content/*
hotfix/*                                      ●────────●   (main → main + develop)
```

| Branch                                        | From → Into                                 | Deploys to          | Merge method                                                                       |
| --------------------------------------------- | ------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------- |
| `main`                                        | —                                           | **live** channel    | merge commit from `release/*`, `hotfix/*`, or a content release PR                 |
| `develop`                                     | `main` (once)                               | **staging** channel | —                                                                                  |
| `feature/PF-<id>-<slug>`, `fix/…`, `chore/…`  | `develop` → `develop`                       | PR preview channel  | **squash** (PR title = Conventional Commit)                                        |
| `content/<slug>` (articles, projects, resume) | `develop` → `develop`                       | PR preview channel  | squash; then a quick `develop` → `main` release PR (patch bump), no release branch |
| `release/<x.y.z>`                             | `develop` → `main`, back-merge to `develop` | staging             | merge commit, tag `vX.Y.Z`                                                         |
| `hotfix/<x.y.z>`                              | `main` → `main` + `develop`                 | live                | merge commit, tag patch                                                            |

Release branches are cut **once per milestone**. If Gitflow feels heavy after M1, collapse to GitHub Flow (feature → `main`); only the staging trigger changes.

**Naming & commits:** branch `feature/PF-30-articles-collection`; commits / PR titles `feat(blog): add tag filter`, `fix(slider): pause on focus-within`, `content(articles): add flutter render pipeline`, `chore(ci): cache pnpm store`.

**GitHub rulesets**

- `main`: PR required; required checks `lint`, `typecheck`, `unit`, `build`, `e2e`, `a11y`, `lighthouse`; no force-push/deletion; head branch must be `develop`, `release/*` or `hotfix/*` (small CI check on `github.head_ref`).
- `develop`: PR required, same checks minus Lighthouse, squash only, conversation resolution required.

### 3.2 Task tracking

- **GitHub Projects** board: `Backlog → Ready → In progress → In review → Done`.
- **Milestones** = M0…M5. **Labels**: `type:feature|bug|chore|content|docs`, `area:home|projects|blog|contact|seo|infra|a11y`, `size:S|M|L` (S ≤ ½ day, M ≤ 1 day, L ≤ 2 days), `blocked:owner-content`.
- Each issue: SRS IDs, acceptance criteria, design file, subtasks as a checklist.

### 3.3 Task breakdown

Legend: **[size]** · _SRS refs_ · ⟵ depends on

#### M0 — Foundation → `v0.1.0` "walking skeleton live on web.app"

| ID    | Task                          | Subtasks                                                                                                                                                                                                                                                                                                                                                                         |
| ----- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PF-01 | Repo governance **[S]**       | create `develop`; rulesets; labels; issue + PR templates; CODEOWNERS; `.editorconfig`, `.nvmrc`; move SRS/HANDOFF/design into `docs/`                                                                                                                                                                                                                                            |
| PF-02 | Scaffold **[S]** ⟵01          | `pnpm create astro` (minimal, strict TS); MDX + sitemap; `build.format: 'file'`, `trailingSlash: 'never'`, `site` from `PUBLIC_SITE_URL`; Prettier, ESLint, lefthook, commitlint; scripts                                                                                                                                                                                        |
| PF-03 | CI pipeline **[M]** ⟵02       | `ci.yml`: install → lint → typecheck → unit → build → Playwright (+axe) on `astro preview`; PR-title lint; Lighthouse CI on PRs to `main`                                                                                                                                                                                                                                        |
| PF-04 | Firebase Hosting **[M]** ⟵02  | create Firebase project (Spark); `firebase init hosting:github` (creates service account + GH secret); `firebase.json` (§4.2); release retention = 10; `deploy.yml` (previews, staging, live); deploy "hello" to live                                                                                                                                                            |
| PF-05 | Design foundation **[M]** ⟵02 | `tokens.css`, `global.css` (reset, `.wrap`, focus ring, reduced motion); Fontsource + preload; BaseLayout with landmarks + skip link                                                                                                                                                                                                                                             |
| PF-06 | Content model **[M]** ⟵02     | `schemas.ts` (Zod, standalone) + `content.config.ts` wiring (§2.3); `types.ts` domain types + `mappers.ts`; query functions return domain types only; ESLint `no-restricted-imports` rule for `astro:content` (§2.2 #4); `scripts/export-schemas.ts` → `docs/contract/`; seed JSON from handoff (unknowns omitted); `check-content.ts`; unit tests on mappers + pure query logic |
| PF-07 | ADRs **[S]**                  | 0001 Astro + Firebase Spark, 0002 content format, 0003 manual articles (SRS deviation), 0004 email-only contact in v1, 0005 analytics, 0006 perf budgets, 0007 no custom domain in 0.x, **0008 content source abstraction / future backend (§2.8)**                                                                                                                              |

#### M1 — Core portfolio → `v0.2.0`

| ID    | Task                                        | Subtasks                                                                                                                                                                                                                                   |
| ----- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PF-10 | Layout shell **[M]** ⟵05                    | Header (logo, nav, `aria-current`, wraps), Footer (©, Resume/RSS/Back-to-top), Breadcrumbs, `<Seo>` stub with noindex flag (§2.7); _FR-12.7, FR-13_                                                                                        |
| PF-11 | UI primitives **[M]** ⟵05                   | Button variants, LinkPill (40 px), Chip, FilterChip (`aria-pressed`), Card, Badge, Icon; `safeExternalUrl` + `rel="noopener noreferrer"`; _NFR-03_                                                                                         |
| PF-12 | Home static sections **[L]** ⟵10,11,06      | Hero, Stats `<dl>`, Skills grid, Experience list (current first + badge), Contact CTA; hide blocks with missing data; _FR-01, FR-03, FR-04_                                                                                                |
| PF-13 | Slider component **[L]** ⟵11                | scroll-snap track; labelled dot buttons; counter; 5 s auto-advance; pause on hover/focus/hidden/reduced-motion; Pause/Play toggle; 3→2→1 cards; unit tests (`slider-math.ts`) + Playwright keyboard/reduced-motion; _HANDOFF §6.1, NFR-02_ |
| PF-14 | Featured projects on home **[S]** ⟵13       | `featured && published`, `featuredOrder`, cap 6; _FR-01.4, FR-05.7/10_                                                                                                                                                                     |
| PF-15 | `/projects` **[M]** ⟵11,06                  | grid; derived category pills + counts; "x of y"; empty state; no-JS = all shown; _FR-05.8_                                                                                                                                                 |
| PF-16 | `/projects/[slug]` + case study **[L]** ⟵15 | `getStaticPaths` from published; MDX components; related links; omit if no case study; unique meta; _FR-05.11, FR-06_                                                                                                                      |
| PF-17 | `/about` **[M]** ⟵12                        | bio, expertise, optional sections omitted when null; _FR-02_                                                                                                                                                                               |
| PF-18 | Resume **[S]** ⟵06                          | PDF in `public/resume/`; build asserts it exists (else hide CTAs); View + Download; _FR-10_                                                                                                                                                |
| PF-19 | `/contact` (email only) **[S]** ⟵11         | `ContactDirect` (§2.5), profile pills, reply-time note; no form; _FR-11.1–11.3_                                                                                                                                                            |
| PF-21 | 404 **[S]** ⟵10                             | `404.astro` → `404.html`; e2e asserts HTTP 404 on unknown path against a preview channel; _FR-12.5_                                                                                                                                        |

#### M2 — Writing → `v0.3.0`

| ID    | Task                                  | Subtasks                                                                                                                                                                                                                                                                                                                              |
| ----- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PF-30 | Articles collection **[S]** ⟵06       | `articleSchema` in `schemas.ts`; `ArticleCard` type + `toArticleCard` mapper; `articles.ts` queries returning `ArticleCard[]` (§2.4); unit tests (duplicate URL throws, query string stripped, featured-or-latest, sort, drafts hidden) on pure functions; seed existing articles with self-hosted thumbnails; _FR-07.7–07.11, 07.15_ |
| PF-33 | Writing slider on home **[S]** ⟵13,30 | `getHomeArticles()`; "All articles" link; section hidden if 0 articles; _FR-09_                                                                                                                                                                                                                                                       |
| PF-34 | `/blog` **[M]** ⟵30                   | ArticleCard (optional thumbnail, "≈ N min read"); tag pills (row hidden if no tags); search over title + excerpt; page size 6 + Load more + "Showing x of y"; reset to page 1 on change; empty + no-match states; Medium profile link; no-JS = full list; _FR-08_                                                                     |
| PF-35 | `/rss.xml` **[S]** ⟵30                | `@astrojs/rss`; guid = canonical URL; valid when empty; W3C feed validator; _FR-15_                                                                                                                                                                                                                                                   |

#### M3 — Quality & discoverability → `v0.4.0`

| ID    | Task                             | Subtasks                                                                                                                                                                                         |
| ----- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PF-40 | SEO **[M]**                      | per-page title/description/canonical/OG/Twitter; OG images; sitemap (exclude 404); `robots.txt.ts` (§2.7); JSON-LD `Person`, `BreadcrumbList`; blog meta states articles live on Medium; _FR-14_ |
| PF-41 | Security & cache headers **[S]** | CSP, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'`; immutable `/_astro/**`; _NFR-03_                                                                              |
| PF-42 | Accessibility audit **[M]**      | axe all routes × 3 viewports; keyboard walkthrough; VoiceOver macOS + iOS; 200% zoom; 320 px no horizontal scroll; _NFR-02, FR-13_                                                               |
| PF-43 | Performance **[M]**              | Lighthouse budgets; image sizes; font subset; ≤ 25 KB JS/page; ≤ 500 KB first-visit weight; _NFR-01_                                                                                             |
| PF-44 | Link & compat check **[S]**      | lychee; real-device iOS Safari + Samsung Internet; resume download on mobile; _NFR-06_                                                                                                           |
| PF-45 | Analytics (optional) **[S]**     | CF Web Analytics snippet; privacy note; site works with it blocked; _FR-16_                                                                                                                      |

#### M4 — Release → `v1.0.0`

| ID    | Task                           | Subtasks                                                                                                                                                                                                        |
| ----- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PF-50 | Content completion **[owner]** | HANDOFF §11; `content:check --production` passes                                                                                                                                                                |
| PF-51 | Release candidate **[S]**      | `release/1.0.0`; full regression on staging; manual checklist                                                                                                                                                   |
| PF-52 | Launch **[S]**                 | merge to `main`, tag `v1.0.0`, `PUBLIC_INDEXABLE=true` on live; prod smoke e2e; Search Console (URL-prefix property, HTML-tag verification) + Bing; sitemap submit; OG preview checks (LinkedIn Post Inspector) |
| PF-53 | Docs **[S]**                   | README; `MAINTENANCE.md` (add article/project/case study, swap resume, rollback, Spark limits); known limitations                                                                                               |

#### M5 — Contact form (post-launch, Blaze) → `v1.1.0`

| ID    | Task                       | Subtasks                                                                                                                                                                                                                                      |
| ----- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PF-60 | Blaze upgrade **[S]**      | upgrade plan; $1 budget alert (alerts only — `maxInstances: 1` is the real cap)                                                                                                                                                               |
| PF-61 | Function + rewrite **[L]** | `functions/` package (esbuild bundle sharing `src/lib/contact/schema.ts`); `/api/contact` rewrite; secrets via `firebase functions:secrets:set`; Resend (`onboarding@resend.dev`); Turnstile; honeypot; limiter; unit tests with mocked fetch |
| PF-62 | Form UI **[M]**            | fields + validation (submit, then live); `aria-invalid`/`aria-describedby`; idle → sending → sent/failed; `role=status/alert`; mailto fallback in failure banner; e2e with route interception; _FR-11.4–11.10_                                |
| PF-63 | Enable **[S]**             | real send test on staging → `PUBLIC_CONTACT_FORM=true` on live; update CSP for Turnstile                                                                                                                                                      |

**Critical path:** PF-01 → 02 → 05/06 → 10/11 → 12 → 13 → 30 → 34 → 40–44 → 51 → 52. Owner content (PF-50) runs in parallel from day one.

### 3.4 Definition of Ready / Done

**Ready:** SRS refs + acceptance criteria, design file linked, dependencies merged, content available or "hide when missing".

```markdown
<!-- .github/pull_request_template.md -->

## What & why

Closes #<issue>. SRS: FR-xx.x … Design: docs/design/<file>

## Preview

Preview URL: <posted by Firebase action> · Desktop / 768px / 375px screenshots

## Checklist (Definition of Done)

- [ ] Acceptance criteria verified on the preview URL
- [ ] Unit tests for new logic in src/lib; e2e for new user flows
- [ ] Empty / missing-data states handled (no "[placeholder]" or broken element renders)
- [ ] Keyboard-only + axe clean; touch targets ≥ 40px; no horizontal scroll at 320px
- [ ] No secrets client-side; external links via safeExternalUrl
- [ ] JS + page-weight budgets respected
- [ ] Docs/ADR updated if behaviour or decisions changed
```

### 3.5 Code review

Loop for every PR (see `CLAUDE.md` → Workflow):

1. Agent develops on a task branch, runs lint/typecheck/tests/build, raises a PR into `develop`.
2. Independent `pr-reviewer` agent (fresh context) reviews: correctness vs SRS/HANDOFF → a11y →
   security → repo rules → maintainability → tests. Output: verdict + findings table.
3. Agent addresses every finding, posts a findings → resolution comment, and has the reviewer
   verify the fix commits.
4. When no finding is open and all required CI checks pass, the agent squash-merges and deletes the
   branch. The owner can review or veto any PR at any time.

Rules: one task per PR (< 400 changed lines excluding content); PR title = Conventional Commit;
release PRs (`release/*` → `main`) additionally need staging e2e + Lighthouse green and a changelog.

### 3.6 Adding an article

```bash
git switch develop && git pull
git switch -c content/article-flutter-render-pipeline
# add src/content/articles/<slug>.md and the image in src/content/articles/images/
pnpm build                                  # schema + duplicate check
git add -A && git commit -m "content(articles): add flutter render pipeline"
gh pr create --base develop --fill          # check the preview URL, squash-merge
gh pr create --base main --head develop --title "release: v1.0.1"   # ships to live
```

### 3.7 `package.json` scripts

```json
{
  "scripts": {
    "dev": "astro dev",
    "content:check": "tsx scripts/check-content.ts",
    "build": "pnpm content:check && astro build",
    "preview": "astro preview",
    "lint": "eslint . && prettier --check .",
    "typecheck": "astro check && tsc --noEmit",
    "test": "vitest run --coverage",
    "e2e": "playwright test",
    "lhci": "lhci autorun",
    "links": "lychee --config lychee.toml dist",
    "deploy:live": "firebase deploy --only hosting"
  }
}
```

---

## 4. Deployment

### 4.1 Environments

| Env        | Trigger                         | URL                                                                  | `PUBLIC_INDEXABLE`               |
| ---------- | ------------------------------- | -------------------------------------------------------------------- | -------------------------------- |
| Local      | `pnpm dev` / `pnpm preview`     | `localhost:4321`                                                     | false                            |
| PR preview | every PR                        | `<project-id>--pr<N>-<hash>.web.app` (posted on the PR, expires 7 d) | false                            |
| Staging    | push to `develop` / `release/*` | `<project-id>--staging-<hash>.web.app`                               | false                            |
| Production | push to `main`                  | `<project-id>.web.app`                                               | false in 0.x, **true from v1.0** |

Notes:

- Preview channels expire after **at most 30 days**; each staging deploy resets the clock. If `develop` is idle for 30+ days the staging URL disappears and the next push recreates it.
- Preview/staging URLs are public (no access control on Spark), so they rely on `noindex` and contain nothing private.
- `<project-id>` must be globally unique (e.g. `shadman-portfolio`); it becomes the public URL, so pick it deliberately.

### 4.2 `firebase.json`

```json
{
  "hosting": {
    "public": "dist",
    "cleanUrls": true,
    "trailingSlash": false,
    "headers": [
      {
        "source": "/_astro/**",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
      },
      {
        "source": "**",
        "headers": [
          {
            "key": "Content-Security-Policy",
            "value": "default-src 'self'; img-src 'self' data:; script-src 'self' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
          },
          { "key": "X-Content-Type-Options", "value": "nosniff" },
          { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
          { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
        ]
      }
    ]
  }
}
```

M5 adds `"rewrites": [{ "source": "/api/contact", "function": { "functionId": "contact", "region": "asia-south1" } }]`, a `"functions"` block, and Turnstile hosts in the CSP.

### 4.3 Workflows

```yaml
# .github/workflows/deploy.yml
name: deploy
on:
  pull_request:
  push: { branches: [main, develop, 'release/**'] }
  workflow_dispatch:
concurrency: { group: deploy-${{ github.ref }}, cancel-in-progress: true }
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions: { contents: read, pull-requests: write, checks: write }
    env:
      IS_LIVE: ${{ github.ref == 'refs/heads/main' && github.event_name != 'pull_request' }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
        env:
          PUBLIC_SITE_URL: https://shadman-portfolio.web.app
          PUBLIC_INDEXABLE: ${{ env.IS_LIVE == 'true' && vars.PUBLIC_INDEXABLE || 'false' }}
          PUBLIC_CONTACT_FORM: 'false'
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          projectId: shadman-portfolio
          channelId: ${{ github.event_name == 'pull_request' && '' || (env.IS_LIVE == 'true' && 'live' || 'staging') }}
          expires: ${{ github.event_name == 'pull_request' && '7d' || '30d' }}
      - if: env.IS_LIVE == 'true'
        run: pnpm exec playwright install --with-deps chromium && BASE_URL=https://shadman-portfolio.web.app pnpm e2e --grep @smoke
```

- Empty `channelId` on a PR → auto-named preview channel + PR comment. `expires` is ignored for `live`.
- `vars.PUBLIC_INDEXABLE` (repo variable) is flipped to `true` at v1.0 launch.
- `ci.yml` runs the quality gates (§1.3) on every PR; `links.yml` runs lychee weekly.

### 4.4 One-time setup

1. Firebase console → create project `shadman-portfolio` (Spark). No billing account.
2. `firebase init hosting:github` in the repo → creates the deploy service account and the `FIREBASE_SERVICE_ACCOUNT_SHADMAN_PORTFOLIO` GitHub secret.
3. Hosting settings → **release retention: 10 versions**.
4. GitHub repo variable `PUBLIC_INDEXABLE=false`.
5. (Optional) Cloudflare Web Analytics → add `shadman-portfolio.web.app` → paste the snippet token.
6. Uptime check (UptimeRobot free) on `/` and `/blog`.

### 4.5 Spark limits & operations

| Limit            | Value (verify on Firebase pricing page)                                               | Mitigation                                                                    |
| ---------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Hosting transfer | ~360 MB/day, **hard cap** — the site stops serving until the daily reset, never bills | ≤ 500 KB first visit, immutable caching, AVIF images → ~700+ new visitors/day |
| Hosting storage  | 10 GB including old releases                                                          | retention = 10 versions                                                       |
| Cloud Functions  | not available                                                                         | contact form deferred to M5                                                   |

- **Rollback:** Hosting console → Release history → Rollback, or `firebase hosting:clone shadman-portfolio:<version-id> shadman-portfolio:live`.
- **Dependencies:** Renovate, grouped weekly, targeting `develop`.

### 4.6 Custom domain (deferred)

Not needed for the 0.x versions. When you buy one (at v1.0 or later):

1. Hosting → Add custom domain → add the TXT + A records at your registrar; SSL is automatic.
2. Set `PUBLIC_SITE_URL` to the new domain → canonical URLs, sitemap and OG tags move with it.
3. Search Console: add the new property. Firebase config redirects are path-based, so the default `*.web.app` host can't be 301-redirected to the custom domain from `firebase.json`; `rel=canonical` on every page (pointing at the domain) is what consolidates indexing.
4. M5 email: optionally verify the domain in Resend (SPF/DKIM) and switch `from` off `onboarding@resend.dev`.

---

## 5. Timeline (part-time, ~10 h/week)

| Week  | Milestone   | Outcome                                                      |
| ----- | ----------- | ------------------------------------------------------------ |
| 1     | M0          | Scaffold, CI, tokens, schemas, "hello" live on `web.app`     |
| 2–3   | M1 (part 1) | Layout, primitives, home static sections, slider             |
| 4     | M1 (part 2) | Projects list/detail, about, resume, email-only contact, 404 |
| 5     | M2          | Articles collection, home writing slider, `/blog`, RSS       |
| 6     | M3          | SEO, headers, a11y + perf audits, cross-browser              |
| 7     | M4          | Content complete, RC on staging, launch v1.0.0               |
| later | M5          | Blaze + contact form → v1.1.0                                |

**Risks:** owner content (start PF-50 now); Spark daily transfer cap (enforce page-weight budget); public email address attracting spam (use an alias).
