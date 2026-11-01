# Release runbook (v1.0.0)

Step by step for PF-51 (release candidate, issue #39) and PF-52 (launch, issue #40). Branching rules are in `docs/IMPLEMENTATION_PLAN.md` section 3.1; rollback detail is in `docs/MAINTENANCE.md`.

**Do not start until both are true:** the owner's content is complete and `pnpm build` passes with it (#37), and Firebase Hosting is set up so `deploy.yml` deploys instead of skipping (#38; secret `FIREBASE_SERVICE_ACCOUNT_SHADMAN_PORTFOLIO_96097`). Setup (#38, once): `pnpm exec firebase init hosting:github --project shadman-portfolio-96097`; keep `firebase.json`, answer No to the build-script and deploy-on-merge prompts, and delete the generated `firebase-hosting-*.yml` workflows because `deploy.yml` replaces them (details: `docs/MAINTENANCE.md`, "First-time Firebase setup"). Nothing here is done by the tooling alone: the version bump, the tag and the merges are manual steps.

Tooling that exists for this runbook:

| Command                            | What it does                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm changelog`                   | git-cliff with `cliff.toml`; prints the changelog from Conventional Commits to stdout         |
| `pnpm smoke:live`                  | runs only `@smoke` tests against `SMOKE_BASE_URL`; skips (exit 0) when it is unset            |
| `pnpm e2e`, `pnpm e2e:fixtures`    | the full e2e suites (all browsers, then the fixtures build)                                   |
| `pnpm lhci`, `pnpm lhci:indexable` | Lighthouse CI budgets (fixtures routes; the indexable config is for a build with indexing on) |
| `.github/workflows/deploy.yml`     | deploys PR previews, `staging` (develop, `release/**`) and `live` (main); smoke-tests live    |

## Part 1: release candidate (PF-51, #39)

1. **Prerequisites.** `develop` is green in CI, `pnpm content:check` and `pnpm build` pass with the real content, and no record the owner wants published is still `"status": "draft"`.
2. **Cut the release branch** from an up-to-date `develop`:

   ```bash
   git switch develop && git pull
   git switch -c release/1.0.0
   ```

3. **Bump the version** in `package.json` (`"version": "1.0.0"`; it is `0.0.0` until now).
4. **Generate the changelog.** Preview with `pnpm changelog --unreleased`, then write the file for the new tag:

   ```bash
   pnpm changelog --tag v1.0.0 --output CHANGELOG.md
   pnpm exec prettier --write CHANGELOG.md
   ```

   Read it. Commit titles cannot be changed after merge, so edit `CHANGELOG.md` by hand only for typos. Commit both changes:

   ```bash
   git add package.json CHANGELOG.md
   git commit -m "release: 1.0.0"
   ```

5. **Open a PR `release/1.0.0` into `main`.** Pushing a `release/**` branch deploys it to the `staging` channel; the channel URL is printed in the `deploy` workflow summary and shown in Firebase console, Hosting. Use that URL as `STAGING_URL` below. `staging` stays `noindex` (`PUBLIC_INDEXABLE` is only honoured for live builds).
6. **Full regression in CI.** On the release PR: `ci` (lint, typecheck, unit tests, build, e2e on chromium, webkit and firefox, the `@fixtures` suite) and Lighthouse are green. To repeat locally:

   ```bash
   pnpm lint && pnpm typecheck && pnpm test && pnpm build
   pnpm exec playwright install --with-deps chromium webkit firefox
   pnpm e2e && pnpm e2e:fixtures
   pnpm build:fixtures && pnpm lhci
   ```

7. **Regression against staging.** Smoke tests, then the header rules (headers only count on a `web.app` URL):

   ```bash
   pnpm exec playwright install --with-deps chromium webkit
   SMOKE_BASE_URL=<STAGING_URL> pnpm smoke:live
   SMOKE_BASE_URL=<STAGING_URL> SMOKE_PROJECT=webkit pnpm smoke:live
   BASE_URL=<STAGING_URL> pnpm exec playwright test tests/e2e/headers.spec.ts
   ```

   Run the WebKit pass here, not for the first time on live: the header tests only ever ran against the emulator in CI.

   The `tests/e2e/headers.spec.ts` run (the last command above) verifies production header precedence on the real channel (the emulator is not the same thing).

8. **Manual checklists.** Walk through, on staging, and record results in the PR:
   - Real-device checklist (iPhone Safari, Samsung Internet): `docs/browser-support.md`, section "Manual checklist".
   - Accessibility: keyboard-only pass of every page, VoiceOver on macOS Safari and iOS Safari, 200% zoom, 320 px width with no horizontal scroll (the automated axe checks run as part of `pnpm e2e`).
9. **Resume PDF opens in Chrome, Firefox and Safari.** The site-wide CSP and `frame-ancestors 'none'` must not break each browser's built-in PDF viewer. On `<STAGING_URL>`, in each browser: use "View resume" (opens a new tab, the PDF renders, you can come back), open `<STAGING_URL>/resume/<file>.pdf` directly in a tab, and use "Download resume". Open the browser console and confirm there are no CSP violations. If a viewer is blocked, stop: change the headers in `firebase.json` (rationale in `docs/adr/0009-security-and-cache-headers.md`), and repeat from step 7.
10. **Fix findings on the release branch** with new commits (`fix: ...`), never by force-push. Re-run steps 6 to 9 for anything that changed.
11. **Approve.** The release PR needs a green CI, green Lighthouse, the changelog, and the checked lists from steps 8 and 9 in its description.

## Part 2: launch (PF-52, #40)

Immediately before merging (not earlier: any re-run of `deploy` on `main`, such as a hotfix, would publish an indexable 0.x), set the repository variable `PUBLIC_INDEXABLE` to `true` (GitHub, Settings, Secrets and variables, Actions, Variables). It only affects the live build (ADR-0007). Optionally set the variables `PUBLIC_GOOGLE_SITE_VERIFICATION` and `PUBLIC_BING_SITE_VERIFICATION` now (see step 5); live builds pass them as the verification meta tags.

1. **Merge `release/1.0.0` into `main`** with a merge commit (not a squash, so the release commit and history stay intact). The push to `main` runs `deploy.yml`: build with `PUBLIC_INDEXABLE=true`, deploy to the `live` channel, then smoke-test `https://shadman-portfolio-96097.web.app`.
2. **Tag the release** on the merge commit and push the tag:

   ```bash
   git switch main && git pull
   git tag -a v1.0.0 -m "v1.0.0"
   git push origin v1.0.0
   ```

3. **Back-merge** `main` into `develop` through a PR so the version bump and changelog return to `develop`.
4. **Live smoke e2e.** The workflow already ran one; repeat it by hand, and in a second engine:

   ```bash
   pnpm exec playwright install --with-deps chromium webkit
   SMOKE_BASE_URL=https://shadman-portfolio-96097.web.app pnpm smoke:live
   SMOKE_BASE_URL=https://shadman-portfolio-96097.web.app SMOKE_PROJECT=webkit pnpm smoke:live
   ```

   Also load the home page and confirm: no `noindex` robots meta, a canonical on `shadman-portfolio-96097.web.app`, `https://shadman-portfolio-96097.web.app/robots.txt` allows crawling and lists the sitemap.

5. **Search Console** (URL-prefix property, HTML-tag verification):
   1. In Google Search Console choose Add property, URL prefix, enter `https://shadman-portfolio-96097.web.app`.
   2. Choose the HTML tag method. It shows `<meta name="google-site-verification" content="TOKEN">`; copy only `TOKEN`.
   3. In GitHub set the repository variable `PUBLIC_GOOGLE_SITE_VERIFICATION` to `TOKEN`, then re-run the `deploy` workflow on `main` (Actions, deploy, Run workflow). The build renders the tag on every indexable page.
   4. Check the live source contains the tag (`curl -s https://shadman-portfolio-96097.web.app | grep google-site-verification`), then press Verify in Search Console.
   5. Under Sitemaps submit `sitemap-index.xml` (the URL `robots.txt` names: `https://shadman-portfolio-96097.web.app/sitemap-index.xml`).
6. **Bing Webmaster Tools.** Add the site; the quickest route is Import from Google Search Console. Or choose the meta-tag method, set the repository variable `PUBLIC_BING_SITE_VERIFICATION` to the `msvalidate.01` content value and re-run `deploy` as above. Submit `https://shadman-portfolio-96097.web.app/sitemap-index.xml` there too.
7. **Feed validation.** Paste `https://shadman-portfolio-96097.web.app/rss.xml` into the W3C Feed Validation Service (validator.w3.org/feed). It must report a valid RSS feed. Warnings about the feed's content type or self link: fix in a follow-up PR; errors block the launch.
8. **Social preview checks.** Run the home page and one project page through the LinkedIn Post Inspector, and through the card validator or a post preview on the platforms you use. Share images live at `/og/*.png` and are not hashed, so platforms cache them: after any later change to a card, re-scrape it with the same tools.
9. **Announce** only when steps 4 to 8 pass.

## Roll back

- **Live is broken:** Firebase console, Hosting, Release history, Rollback to the last good version; or `pnpm exec firebase hosting:clone shadman-portfolio-96097:@<version-id> shadman-portfolio-96097:live` (the `@` marks a version id; the id is in Release history). Do this first, investigate second.
- **Then fix the source:** revert on `develop` with `git revert <sha>` through a PR and release again as `v1.0.1` (same steps, branch `release/1.0.1`) so `main` stops containing the bad change. Never delete or move a published tag; add a new one.
- **Indexing must be switched off again** (for example the wrong content shipped): set the repository variable `PUBLIC_INDEXABLE` to `false` and re-run `deploy` on `main`. The site goes back to `noindex` and `robots.txt` disallows crawling.
- Hosting keeps only the last 10 versions, so decide quickly (`docs/MAINTENANCE.md`, "Roll back").
