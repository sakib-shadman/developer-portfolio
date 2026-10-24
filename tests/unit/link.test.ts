import { describe, expect, it } from 'vitest';
import { linkAttrs } from '../../src/lib/link';

describe('linkAttrs', () => {
  it.each(['/projects', '/projects/lms-cricket#role', '/blog?tag=flutter', '#top'])(
    'internal %s → same tab',
    (href) => {
      expect(linkAttrs(href)).toEqual({ href, external: false });
    },
  );

  it('external http(s) → new tab, noopener noreferrer, normalised href', () => {
    expect(linkAttrs('https://github.com/sakib-shadman')).toEqual({
      href: 'https://github.com/sakib-shadman',
      target: '_blank',
      rel: 'noopener noreferrer',
      external: true,
    });
    expect(linkAttrs('HTTPS://Example.com')?.href).toBe('https://example.com/');
  });

  it.each(['mailto:me@example.com', 'mailto:me@example.com?subject=Hello%20there'])(
    'mailto %s → same tab',
    (href) => {
      expect(linkAttrs(href)).toEqual({ href, external: false });
    },
  );

  it.each([
    undefined,
    null,
    '',
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    ' javascript:alert(1)',
    'data:text/html,x',
    '//evil.com',
    '/\\evil.com',
    '/\t/evil.com',
    '/ /evil.com',
    'https:evil.com',
    ' https://x.dev',
    'https://',
    'mailto:',
    'mailto:nobody',
    'ftp://x.com',
    'relative/path',
    'http://[::1', // URL constructor throws → caught
  ])('rejects %j', (href) => expect(linkAttrs(href)).toBeNull());
});
