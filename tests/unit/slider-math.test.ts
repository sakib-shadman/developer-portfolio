import { describe, expect, it } from 'vitest';
import {
  EPS,
  activeIndex,
  destination,
  holdReasons,
  needsSettle,
  nextIndex,
  nextStop,
  pad2,
  scrollTarget,
  shouldAutoAdvance,
} from '../../src/components/slider/slider-math';

describe('activeIndex', () => {
  // 6 cards of 380px + 24px gap, track shows 3 → maxScroll = 6*380 + 5*24 - 1196
  const W = 380;
  const G = 24;
  const max = 6 * W + 5 * G - (3 * W + 2 * G);
  it('rounds scrollLeft to the nearest card', () => {
    expect(activeIndex(0, max, W, G, 6)).toBe(0);
    expect(activeIndex(201, max, W, G, 6)).toBe(0);
    expect(activeIndex(203, max, W, G, 6)).toBe(1);
    expect(activeIndex(404, max, W, G, 6)).toBe(1);
    expect(activeIndex(808, max, W, G, 6)).toBe(2);
  });
  it('marks the last card active at the end of the track', () => {
    expect(activeIndex(max, max, W, G, 6)).toBe(5);
    expect(activeIndex(max - 1, max, W, G, 6)).toBe(5);
  });
  it('clamps and handles non-scrolling or empty tracks', () => {
    expect(activeIndex(-50, max, W, G, 6)).toBe(0);
    expect(activeIndex(100000, 100001, W, G, 3)).toBe(2);
    expect(activeIndex(0, 0, W, G, 3)).toBe(0);
    expect(activeIndex(0, 0.5, W, G, 3)).toBe(0);
    expect(activeIndex(10, 100, W, G, 0)).toBe(0);
  });
});

describe('nextIndex / scrollTarget / pad2', () => {
  it('advances one and wraps', () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
    expect(nextIndex(0, 0)).toBe(0);
  });
  it('computes the scroll offset of a card', () => {
    expect(scrollTarget(0, 380, 24)).toBe(0);
    expect(scrollTarget(3, 380, 24)).toBe(1212);
  });
  it('pads counters', () => {
    expect(pad2(1)).toBe('01');
    expect(pad2(12)).toBe('12');
  });
});

describe('shouldAutoAdvance', () => {
  const idle = { hovered: false, focusWithin: false, paused: false, reducedMotion: false, hidden: false };
  it('advances only when nothing holds it', () => {
    expect(shouldAutoAdvance(idle)).toBe(true);
    for (const k of Object.keys(idle) as (keyof typeof idle)[]) {
      expect(shouldAutoAdvance({ ...idle, [k]: true }), k).toBe(false);
    }
  });
});

describe('3 cards, 2 per view (card 2 offset == end of track)', () => {
  // card 414, gap 24, track 852 → step 438, maxScroll = 3*414 + 48 - 852 = 438
  const W = 414;
  const G = 24;
  const max = 438;
  it('an explicit target wins over the at-end rule', () => {
    expect(activeIndex(max, max, W, G, 3, 1)).toBe(1);
    expect(activeIndex(max, max, W, G, 3, 2)).toBe(2);
    expect(activeIndex(100, max, W, G, 3, 0)).toBe(0);
    expect(activeIndex(max, max, W, G, 3, 99)).toBe(2); // clamped
    expect(activeIndex(max, max, W, G, 3, -4)).toBe(0);
  });
  it('free scrolling to the end still marks the last card', () => {
    expect(activeIndex(max, max, W, G, 3)).toBe(2);
    expect(activeIndex(0, max, W, G, 3)).toBe(0);
  });
  it('a target is ignored when nothing scrolls', () => {
    expect(activeIndex(0, 0, W, G, 3, 2)).toBe(0);
  });
});

describe('nextStop (autoplay)', () => {
  it('steps one card and wraps, skipping cards that cannot scroll further', () => {
    // 3 cards, 2 per view: 0 → 1 (at the end) → wrap to 0
    expect(nextStop(0, 438, 414, 24, 3)).toBe(1);
    expect(nextStop(438, 438, 414, 24, 3)).toBe(0);
  });
  it('6 cards, 3 per view: 0 → 1 → 2 → 3 → wrap', () => {
    const W = 380;
    const G = 24;
    const step = W + G;
    const max = 3 * step;
    expect(nextStop(0, max, W, G, 6)).toBe(1);
    expect(nextStop(step, max, W, G, 6)).toBe(2);
    expect(nextStop(2 * step, max, W, G, 6)).toBe(3);
    expect(nextStop(max, max, W, G, 6)).toBe(0);
  });
  it('works from a mid-card position and tolerates sub-pixel offsets', () => {
    expect(nextStop(200, 1212, 380, 24, 6)).toBe(1);
    expect(nextStop(403.6, 1212, 380, 24, 6)).toBe(2);
  });
});

describe('holdReasons / destination / needsSettle / tolerance', () => {
  const idle = { hovered: false, focusWithin: false, paused: false, reducedMotion: false, hidden: false };
  it('lists every active hold in a stable order', () => {
    expect(holdReasons(idle)).toEqual([]);
    expect(
      holdReasons({ hovered: true, focusWithin: true, paused: true, reducedMotion: true, hidden: true }),
    ).toEqual(['hover', 'focus', 'paused', 'reduced', 'hidden']);
    expect(holdReasons({ ...idle, paused: true })).toEqual(['paused']);
  });
  it('clamps the destination to the track end', () => {
    expect(destination(0, 414, 24, 438)).toBe(0);
    expect(destination(1, 414, 24, 438)).toBe(438);
    expect(destination(2, 414, 24, 438)).toBe(438);
  });
  it('detects a smooth scroll cut short', () => {
    expect(needsSettle(0, 438)).toBe(true);
    expect(needsSettle(437.4, 438)).toBe(false);
    expect(needsSettle(438 - EPS - 0.5, 438)).toBe(true);
  });
  it('tolerates fractional scroll metrics (Gecko/WebKit)', () => {
    // maxScroll reported as 1.6 / 2 → nothing really scrolls
    expect(activeIndex(0, 1.6, 414, 24, 3, 2)).toBe(0);
    expect(activeIndex(0, EPS, 414, 24, 3)).toBe(0);
    // sitting 1.5px short of the end still counts as the end, and nextStop wraps
    expect(activeIndex(436.5, 438, 414, 24, 3)).toBe(2);
    expect(nextStop(436.5, 438, 414, 24, 3)).toBe(0);
    expect(nextStop(0, 438, 414, 24, 3)).toBe(1);
  });
});
