import { describe, expect, it, vi } from 'vitest';
import {
  CLEAR_AFTER_MS,
  COPIED,
  COPY_FAILED,
  copyAddress,
  createAnnouncer,
  mailtoHref,
  placeLine,
  type Scheduler,
} from '../../src/lib/contact';
import { linkAttrs } from '../../src/lib/link';

describe('mailtoHref', () => {
  it('encodes the subject and passes linkAttrs', () => {
    const href = mailtoHref('a@b.dev');
    expect(href).toBe('mailto:a@b.dev?subject=Hello%20from%20your%20portfolio');
    expect(linkAttrs(href)?.href).toBe(href);
    expect(mailtoHref('a@b.dev', 'A&B')).toContain('subject=A%26B');
  });
});

describe('copyAddress', () => {
  it('writes and reports success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await copyAddress('a@b.dev', { writeText })).toBe(COPIED);
    expect(writeText).toHaveBeenCalledWith('a@b.dev');
  });
  it('reports failure when the write rejects or the API is missing', async () => {
    expect(await copyAddress('x', { writeText: vi.fn().mockRejectedValue(new Error('denied')) })).toBe(
      COPY_FAILED,
    );
    expect(await copyAddress('x', undefined)).toBe(COPY_FAILED);
  });
});

describe('placeLine', () => {
  it('joins what exists', () => {
    expect(placeLine('Dhaka', 'GMT+6')).toBe('Dhaka · GMT+6');
    expect(placeLine('Dhaka')).toBe('Dhaka');
    expect(placeLine(undefined, 'GMT+6')).toBe('GMT+6');
    expect(placeLine()).toBeUndefined();
  });
});

describe('createAnnouncer', () => {
  function fake() {
    const frames: (() => void)[] = [];
    const timers: { cb: () => void; ms: number; live: boolean }[] = [];
    const cancelledFrames: unknown[] = [];
    const cancelledTimers: unknown[] = [];
    const sched: Scheduler = {
      frame: (cb) => frames.push(cb) - 1,
      later: (cb, ms) => timers.push({ cb, ms, live: true }) - 1,
      cancelFrame: (h) => cancelledFrames.push(h),
      cancelLater: (h) => {
        cancelledTimers.push(h);
        if (typeof h === 'number' && timers[h]) timers[h].live = false;
      },
    };
    return { frames, timers, cancelledFrames, cancelledTimers, sched };
  }

  it('clears, sets on the next frame, clears after the delay', () => {
    const region = { textContent: 'old' as string | null };
    const f = fake();
    const announce = createAnnouncer(region, f.sched);
    announce(COPIED);
    expect(region.textContent).toBe('');
    f.frames[0]!();
    expect(region.textContent).toBe(COPIED);
    expect(f.timers[0]!.ms).toBe(CLEAR_AFTER_MS);
    f.timers[0]!.cb();
    expect(region.textContent).toBe('');
  });

  it('re-announces an identical message: text is emptied before it is set again', () => {
    const region = { textContent: '' as string | null };
    const seen: (string | null)[] = [];
    const f = fake();
    const announce = createAnnouncer(region, f.sched);
    announce(COPIED);
    f.frames[0]!();
    seen.push(region.textContent);
    announce(COPIED);
    seen.push(region.textContent);
    f.frames[1]!();
    seen.push(region.textContent);
    expect(seen).toEqual([COPIED, '', COPIED]);
    expect(f.cancelledFrames).toEqual([0]); // the first frame id, not a timer id
    expect(f.cancelledTimers).toEqual([0]); // the first timer id, cancelled through cancelLater
    expect(f.timers[0]!.live).toBe(false);
    expect(f.timers[1]!.live).toBe(true); // the new announcement's timer is armed
  });
});
