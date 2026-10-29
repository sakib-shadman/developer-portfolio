# Browser support and link checks (NFR-06, PF-44)

Matrix (ADR-0006): last 2 versions of Chrome, Edge, Firefox, Safari (macOS and iOS) and Samsung Internet.

## How the matrix is verified

| Browser          | Engine   | Automated                                                           | Manual (owner)                           |
| ---------------- | -------- | ------------------------------------------------------------------- | ---------------------------------------- |
| Chrome, Edge     | Chromium | Playwright `chromium` (Desktop Chrome) and `mobile` (Pixel 7) in CI | Edge spot check                          |
| Firefox          | Gecko    | Playwright `firefox` in CI                                          | none                                     |
| Safari macOS     | WebKit   | Playwright `webkit` (Desktop Safari) in CI                          | spot check                               |
| Safari iOS       | WebKit   | the same WebKit engine, not iOS itself                              | **real iPhone**: checklist below         |
| Samsung Internet | Chromium | `mobile` (Chromium on Android)                                      | **real Samsung device**: checklist below |

`tests/unit/browser-support.test.ts` keeps this honest: all four Playwright projects must exist, CI must install chromium, webkit and firefox, and every feature on the guard's list (`FEATURES` in the test; 30 CSS/JS features, including ones not used yet) that appears in `src/` must have a row in the table below. When you introduce a feature of this kind that is not on the list, add it to the list and the table in the same PR.

## Modern features in use

Samsung Internet follows Chromium with a lag; its last two versions are past every Chromium floor here, so it has no column of its own.

Floors are the first stable version with support (MDN / Baseline); every browser in the matrix is well past all of them, so none needs a polyfill. "If unsupported" is the degradation we accepted anyway.

| Feature                                                    | Used for                                         | Floor (Chrome/Edge, Firefox, Safari) | If unsupported                                                                                           |
| ---------------------------------------------------------- | ------------------------------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `:has()`                                                   | card focus ring, slider card inset ring          | 105, 121, 15.4                       | the card ring would be missing; matrix browsers all support it                                           |
| `@media (scripting)`                                       | reserve space for script-revealed filters (CLS)  | 120, 113, 17                         | block ignored: small layout shift on reveal                                                              |
| `size-adjust`                                              | metric-matched fallback fonts (width)            | 92, 92, 17                           | fallback font is sized normally: small swap shift                                                        |
| `ascent-override`, `descent-override`, `line-gap-override` | metric-matched fallback fonts (vertical metrics) | 87, 89, **not supported in Safari**  | Safari applies the width match but not the vertical metrics: possible line-height shift on the font swap |
| `scroll-snap`                                              | sliders                                          | 69, 68, 11                           | free scrolling                                                                                           |
| `scrollbar-width`                                          | thin slider scrollbar                            | 121, 64, 18.2                        | default scrollbar                                                                                        |
| `aspect-ratio`                                             | card media, photos                               | 88, 89, 15                           | fixed heights from `height` attributes                                                                   |
| `clamp()`                                                  | fluid type and spacing                           | 79, 75, 13.1                         | n/a (floor is old)                                                                                       |
| `:focus-visible`                                           | all focus rings                                  | 86, 85, 15.4                         | n/a                                                                                                      |
| `inset`                                                    | positioning shorthand                            | 87, 66, 14.1                         | n/a                                                                                                      |
| `navigator.clipboard`                                      | "Copy address"                                   | 66, 63, 13.1                         | the `mailto:` link is always next to the button                                                          |
| `ResizeObserver`                                           | slider layout sync                               | 64, 69, 13.1                         | n/a                                                                                                      |
| `replaceAll`                                               | string helpers                                   | 85, 77, 13.1                         | n/a                                                                                                      |
| flex/grid `gap`                                            | spacing everywhere                               | 84, 63, 14.1                         | n/a                                                                                                      |
| `min()`                                                    | `minmax(min(100%, …))` grids                     | 79, 75, 11.1                         | n/a                                                                                                      |
| `loading="lazy"`                                           | card and case-study images                       | 77, 75, 15.4                         | images load eagerly                                                                                      |
| `fetchpriority`                                            | hero/LCP image                                   | 101, 132, 17.2                       | ignored; normal priority                                                                                 |
| `MediaQueryList.addEventListener`                          | reacting to `prefers-reduced-motion` changes     | 39, 55, 14                           | n/a                                                                                                      |
| `prefers-reduced-motion`                                   | motion off                                       | 74, 63, 10.1                         | motion stays on                                                                                          |
| `forced-colors`                                            | focus and dots in forced colors                  | 89, 89, n/a (no such mode)           | n/a                                                                                                      |

## Links

- `pnpm build` and `pnpm build:fixtures` run `scripts/check-links.ts` (rules in `src/lib/link-check.ts`, unit tested): every internal link, asset, `srcset` entry and `#anchor` must exist in the build; every `<a href>` must be what `linkAttrs()` would render; external links must be https with `target="_blank" rel="noopener noreferrer"`; own-origin absolute URLs (canonical, `og:image`, sitemap) must resolve to built files.
- `.github/workflows/links.yml` (lychee, weekly) checks that external URLs are still alive.

## Manual checklist (real devices, owner; also PF-51)

iPhone, Safari, and Samsung device, Samsung Internet. On the preview channel:

1. Home, Projects, Blog, About, Contact load; no horizontal scroll in portrait or landscape.
2. Sliders swipe and snap; dots work; Pause works.
3. Filters and search on /blog and /projects; Load more.
4. Contact: the `mailto:` link opens the mail app; "Copy address" copies.
5. Resume: "Download resume" downloads the PDF (or opens it with a save option); "View resume" opens it in a new tab and you can return.
6. External links (GitHub, LinkedIn, Medium) open in a new tab; the back gesture returns to the site.
7. Dark UI: text readable in bright light; theme colour matches the browser bar.
