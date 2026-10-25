import { describe, expect, it, vi } from 'vitest';
import { COPIED, COPY_FAILED, copyAddress, mailtoHref, placeLine } from '../../src/lib/contact';
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
