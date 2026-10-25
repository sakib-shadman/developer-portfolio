import { describe, expect, it } from 'vitest';
import {
  activeIndex,
  nextIndex,
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
