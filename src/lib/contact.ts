/** Contact helpers (FR-11, ADR-0004): mailto link and clipboard copy with a graceful failure. */
export const MAIL_SUBJECT = 'Hello from your portfolio';
export const COPIED = 'Email address copied';
export const COPY_FAILED = 'Copy failed. Select the address and copy it manually.';

export const mailtoHref = (email: string, subject: string = MAIL_SUBJECT): string =>
  `mailto:${email}?subject=${encodeURIComponent(subject)}`;

/** Writes to the clipboard and returns the message for the live region; never throws. */
export async function copyAddress(
  text: string,
  clipboard: Pick<Clipboard, 'writeText'> | undefined,
): Promise<string> {
  try {
    if (!clipboard) throw new Error('Clipboard API unavailable');
    await clipboard.writeText(text);
    return COPIED;
  } catch {
    return COPY_FAILED;
  }
}

/** "Dhaka, Bangladesh · GMT+6"; undefined when neither is set. */
export const placeLine = (location?: string, timezone?: string): string | undefined =>
  [location, timezone].filter(Boolean).join(' · ') || undefined;

export interface Scheduler {
  frame: (cb: () => void) => unknown;
  later: (cb: () => void, ms: number) => unknown;
  cancelFrame: (handle: unknown) => void;
  cancelLater: (handle: unknown) => void;
}
export const CLEAR_AFTER_MS = 4000;

/**
 * Live-region announcer: clears first and sets the text on the next frame so screen readers
 * re-announce an identical message, then clears it after a while so it doesn't linger.
 */
export function createAnnouncer(
  region: { textContent: string | null },
  sched: Scheduler,
  clearAfter = CLEAR_AFTER_MS,
): (message: string) => void {
  let frame: unknown;
  let timer: unknown;
  return (message) => {
    if (frame !== undefined) sched.cancelFrame(frame);
    if (timer !== undefined) sched.cancelLater(timer);
    frame = timer = undefined;
    region.textContent = '';
    frame = sched.frame(() => {
      region.textContent = message;
      timer = sched.later(() => {
        region.textContent = '';
      }, clearAfter);
    });
  };
}
