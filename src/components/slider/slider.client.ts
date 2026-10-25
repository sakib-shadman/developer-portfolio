/**
 * Slider behaviour (HANDOFF §6.1). Progressive enhancement: the server markup is a scrollable
 * track with the controls `hidden`; this script reveals and wires them. Each `[data-slider]` root
 * is independent so several sliders can share a page.
 */
import { activeIndex, nextIndex, pad2, scrollTarget, shouldAutoAdvance } from './slider-math';

const INTERVAL_MS = 5000;

function init(root: HTMLElement): void {
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
  let timer: number | undefined;

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
    b.addEventListener('click', () => goTo(i));
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
    controls!.hidden = maxScroll <= 1;
    active = activeIndex(track!.scrollLeft, maxScroll, cardW, gap, count);
    render();
  }

  function goTo(i: number): void {
    const { cardW, gap } = metrics();
    track!.scrollTo({
      left: scrollTarget(i, cardW, gap),
      behavior: reduced.matches ? 'auto' : 'smooth',
    });
    active = i;
    render();
  }

  function tick(): void {
    const { maxScroll } = metrics();
    if (maxScroll <= 1) return;
    if (!shouldAutoAdvance({ ...state, reducedMotion: reduced.matches, hidden: document.hidden })) return;
    goTo(nextIndex(active, count));
  }

  function applyMotionPreference(): void {
    window.clearInterval(timer);
    timer = undefined;
    // Reduced motion: no timer at all, and the Pause control would control nothing.
    toggle!.hidden = reduced.matches;
    if (!reduced.matches) timer = window.setInterval(tick, INTERVAL_MS);
  }

  function setPaused(paused: boolean): void {
    state.paused = paused;
    toggle!.setAttribute('aria-label', `${paused ? 'Resume' : 'Pause'} automatic ${noun} scrolling`);
    toggle!.dataset.state = paused ? 'paused' : 'playing';
  }

  toggle.addEventListener('click', () => setPaused(!state.paused));
  track.addEventListener('scroll', sync, { passive: true });
  root.addEventListener('mouseenter', () => (state.hovered = true));
  root.addEventListener('mouseleave', () => (state.hovered = false));
  root.addEventListener('focusin', () => (state.focusWithin = true));
  root.addEventListener('focusout', (e) => {
    if (!root.contains((e as FocusEvent).relatedTarget as Node | null)) state.focusWithin = false;
  });
  reduced.addEventListener('change', applyMotionPreference);
  new ResizeObserver(sync).observe(track);

  setPaused(false);
  applyMotionPreference();
  sync();
  root.dataset.ready = 'true';
}

export function initSliders(): void {
  document.querySelectorAll<HTMLElement>('[data-slider]').forEach(init);
}
