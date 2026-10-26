/**
 * Slider behaviour (HANDOFF §6.1). Progressive enhancement: the server markup is a scrollable
 * track with the controls `hidden`; this script reveals and wires them. Each `[data-slider]` root
 * is independent so several sliders can share a page.
 */
import { EPS, activeIndex, destination, holdReasons, needsSettle, nextStop, pad2 } from './slider-math';

const INTERVAL_MS = 5000;

function init(root: HTMLElement): void {
  if (root.dataset.ready) return; // idempotent: never double-wire dots/listeners
  const track = root.querySelector<HTMLElement>('[data-slider-track]');
  const controls = root.querySelector<HTMLElement>('[data-slider-controls]');
  const dotsEl = root.querySelector<HTMLElement>('[data-slider-dots]');
  const counter = root.querySelector<HTMLElement>('[data-slider-counter]');
  const toggle = root.querySelector<HTMLButtonElement>('[data-slider-toggle]');
  if (!track || !controls || !dotsEl || !counter || !toggle) return;

  const noun = root.dataset.noun ?? 'item';
  const cards = [...track.querySelectorAll<HTMLElement>(':scope > article')];
  const count = cards.length;
  if (count < 2) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const state = { hovered: false, focusWithin: false, paused: false };
  let active = 0;
  /** Card the user/autoplay explicitly navigated to; cleared as soon as the user scrolls freely. */
  let target: number | undefined;
  let timer: number | undefined;
  let settleTimer: number | undefined;
  let ticks = 0;

  const metrics = () => {
    const cardW = cards[0]!.getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    return { cardW, gap, maxScroll: track.scrollWidth - track.clientWidth };
  };

  // Dots: one real button per card (44px hit area, labelled, aria-current).
  const dots = cards.map((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dot';
    b.setAttribute('aria-label', `Show ${noun} ${i + 1} of ${count}`);
    b.append(Object.assign(document.createElement('span'), { className: 'pip' }));
    b.addEventListener('click', () => {
      goTo(i);
      restartTimer();
    });
    dotsEl.append(b);
    return b;
  });

  function render(): void {
    dots.forEach((d, i) => d.setAttribute('aria-current', i === active ? 'true' : 'false'));
    counter!.textContent = `${pad2(active + 1)} / ${pad2(count)}`;
  }

  function sync(): void {
    const { cardW, gap, maxScroll } = metrics();
    // Nothing to slide (all cards fit): hide the controls rather than show dead ones.
    controls!.hidden = maxScroll <= EPS;
    // Nothing to scroll → not a tab stop (the no-JS markup keeps tabindex=0).
    track!.tabIndex = maxScroll > EPS ? 0 : -1;
    active = activeIndex(track!.scrollLeft, maxScroll, cardW, gap, count, target);
    render();
  }

  function goTo(i: number): void {
    const { cardW, gap, maxScroll } = metrics();
    const dest = destination(i, cardW, gap, maxScroll);
    track!.scrollTo({ left: dest, behavior: reduced.matches ? 'auto' : 'smooth' });
    // A smooth scroll can be cut short (scroll-snap, engine quirks): finish it instantly if so.
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      if (needsSettle(track!.scrollLeft, dest)) track!.scrollTo({ left: dest, behavior: 'auto' });
    }, 900);
    target = i;
    active = i;
    render();
  }

  /** Current hold reasons, mirrored on the root so the state is inspectable (and testable). */
  function holds() {
    // Event-driven flags are cross-checked against the live DOM state so a missed enter/leave or
    // focusout (engine quirks) can never leave autoplay held for good.
    return holdReasons({
      hovered: state.hovered && root.matches(':hover'),
      focusWithin: state.focusWithin && track!.matches(':focus-within'),
      paused: state.paused,
      reducedMotion: reduced.matches,
      hidden: document.hidden,
    });
  }

  function publish(result?: string): void {
    const h = holds();
    root.dataset.holds = h.join(' ');
    root.dataset.autoplay = timer !== undefined && h.length === 0 ? 'running' : 'stopped';
    root.dataset.ticks = String(ticks);
    if (result) root.dataset.tick = result;
  }

  function tick(): void {
    ticks += 1;
    const { cardW, gap, maxScroll } = metrics();
    if (maxScroll <= EPS) return publish('fits');
    if (holds().length > 0) return publish('held');
    const next = nextStop(track!.scrollLeft, maxScroll, cardW, gap, count);
    goTo(next);
    publish(`goto-${next}`);
  }

  /** (Re)starts the 5s clock so a full interval passes after any user action. */
  function restartTimer(): void {
    window.clearInterval(timer);
    timer = undefined;
    // Reduced motion: no timer at all.
    if (!reduced.matches) timer = window.setInterval(tick, INTERVAL_MS);
    publish();
  }

  function applyMotionPreference(): void {
    // The Pause control would control nothing under reduced motion.
    toggle!.hidden = reduced.matches;
    restartTimer();
  }

  function setPaused(paused: boolean): void {
    state.paused = paused;
    publish();
    toggle!.setAttribute('aria-label', `${paused ? 'Resume' : 'Pause'} automatic ${noun} scrolling`);
    toggle!.dataset.state = paused ? 'paused' : 'playing';
  }

  toggle.addEventListener('click', () => {
    setPaused(!state.paused);
    restartTimer();
  });
  track.addEventListener('scroll', sync, { passive: true });
  // Hover means a mouse pointer only: a tap fires enter without a matching leave on touch screens,
  // which would hold autoplay forever.
  root.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') state.hovered = true;
    publish();
  });
  root.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') state.hovered = false;
    publish();
  });
  // Hold only for focus inside the track (HANDOFF §6.1), not the dots/Pause buttons: a clicked
  // button keeps focus and would otherwise stop autoplay for good.
  track.addEventListener('focusin', () => {
    state.focusWithin = true;
    publish();
  });
  track.addEventListener('focusout', (e) => {
    if (!track.contains(e.relatedTarget as Node | null)) state.focusWithin = false;
    publish();
  });
  // User navigation (swipe, wheel, drag, keys) hands control back to the scroll position and
  // restarts the clock so a tick can't yank the cards away.
  for (const type of ['pointerdown', 'wheel', 'touchstart', 'keydown'] as const)
    track.addEventListener(
      type,
      () => {
        target = undefined;
        window.clearTimeout(settleTimer);
        restartTimer();
      },
      { passive: true },
    );
  reduced.addEventListener('change', applyMotionPreference);
  document.addEventListener('visibilitychange', () => publish());
  new ResizeObserver(sync).observe(track);

  setPaused(false);
  applyMotionPreference();
  sync();
  root.dataset.ready = 'true';
}

export function initSliders(): void {
  document.querySelectorAll<HTMLElement>('[data-slider]').forEach(init);
}
