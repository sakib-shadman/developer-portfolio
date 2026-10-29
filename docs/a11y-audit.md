# Accessibility audit (WCAG 2.2 AA) — PF-42

Target: WCAG 2.2 AA (SRS NFR-02). Status: **automated part complete and enforced in CI; manual screen-reader pass is the owner's** (checklist below).

## Automated (tests/e2e/a11y.spec.ts, runs in the real, shipped and fixtures suites)

| Area                       | What is asserted                                                                                                                                                                                                                                                                                                                                                                               | Build                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| axe `wcag2a/2aa/21aa/22aa` | Zero violations on `/`, `/projects`, `/blog`, `/about`, `/contact`, the 404 page and every project detail page, at 1440, 768 and 390 px (includes 2.5.8 target size)                                                                                                                                                                                                                           | any content                           |
| axe, interactive states    | Blog tag filter applied, no-match empty state, Load more expanded, projects filter, home slider paused, contact "Email address copied" status; at 1440 and 390 px                                                                                                                                                                                                                              | fixtures                              |
| Keyboard                   | Tab order: skip link first, then header, main, footer; focus leaves the page (no trap); every stop is visible, not covered by other content (2.4.11) and has a focus indicator (outline or box-shadow, on the element or its card); at 1440 and 390 px. Skip link moves focus to `main`; Enter on a nav link navigates; Enter and Space operate filter chips, Load more, slider pause and copy | any content, fixtures for the buttons |
| Reflow                     | No horizontal scroll at 320 px and at 200 % / 400 % zoom (640 / 320 CSS px); axe clean at 320 px; WCAG 1.4.12 text-spacing overrides cause no overflow                                                                                                                                                                                                                                         | any content                           |
| Forced colors              | `forced-colors: active`: every focus stop keeps an outline (box-shadow is dropped by the browser) and every button/input in `main` keeps a border                                                                                                                                                                                                                                              | any content                           |
| Reduced motion             | `scroll-behavior: auto`, no animation or transition over 50 ms; sliders do not auto-advance over 7 s and show no pause control                                                                                                                                                                                                                                                                 | any content, fixtures for the slider  |
| Structure                  | One `h1`, first heading is `h1`, no skipped levels; one `main`/`header`/`footer`; every `nav` labelled and labels unique; no vague link text; same link text never points at different targets unless named by its card; every `img` has a meaningful `alt`                                                                                                                                    | any content                           |

Verified the tests bite: removing `outline` from `main a:focus-visible` fails the keyboard and forced-colors tests.

## Results

No defects were found by the automated checks on the current build, so this PR changes no product code. Earlier work already covers: skip link, labelled landmarks, inset focus rings in sliders, 24 px slider dots, `aria-live` status text for filters and copy, "(opens in a new tab)" in external link names, reduced-motion handling.

## Not covered by automation (known limits)

axe finds roughly a third of WCAG issues. Not machine-checkable here: meaningful reading order and screen-reader announcements, whether alt text is accurate, cognitive load and wording, real-device zoom and text-size settings, high-contrast themes beyond Chromium's `forced-colors` emulation, Safari and Firefox focus behaviour (CI runs Firefox and WebKit for the standing suites, not this one).

## Manual checklist for the owner

Do this on the preview channel before v1.0 (PF-51). Record pass or fail and any note.

### VoiceOver, macOS + Safari (Cmd+F5)

1. Landmarks: open the rotor (VO+U), Landmarks: banner, Primary navigation, main, contentinfo are present once each; navigation names are unique.
2. Headings rotor: one level-1 heading per page; levels read as an outline (no jumps).
3. Skip link: Tab once, hear "Skip to content", press Return: VoiceOver reads the start of main.
4. Links rotor: link names make sense out of context (including "Read on Medium", project links, "Copy address").
5. Home: each slider is announced as a region with a name; Previous/Next/dots and Pause announce their state ("pressed"/"current"); the position counter is read once, not on every autoplay tick.
6. Projects and Blog: activate a filter chip: the pressed state is announced and the result count status is spoken once; a no-match search announces the empty state; Load more moves focus to the first new card.
7. Contact: "Copy address" announces "Email address copied".
8. Images: the profile photo and card thumbnails read useful alt text, decorative images are skipped.
9. 404 page: the heading and the way home are announced.

### VoiceOver, iOS + Safari (Settings, Accessibility, VoiceOver)

1. Swipe through the home page top to bottom: reading order matches the visual order; no unlabeled "button" or "link".
2. Rotor (twist): Headings and Links work as above.
3. Double-tap the slider controls and a filter chip: states are announced; the slider track scrolls with a three-finger swipe.
4. Rotate to landscape and set Larger Text to the maximum: nothing is clipped, no horizontal scrolling.
5. Touch targets: every control is comfortably tappable (24 px minimum is enforced; aim for 44 px on primary actions).

### Other quick checks

- Keyboard only (no mouse) on a real browser: Tab and Shift+Tab through every page, focus always visible, nothing is skipped or trapped.
- Windows High Contrast / macOS Increase Contrast: text, buttons and focus rings remain visible.
- Browser zoom 200 % and 400 %; text-only zoom to 200 %.
- OS "Reduce motion" on: no automatic movement.
