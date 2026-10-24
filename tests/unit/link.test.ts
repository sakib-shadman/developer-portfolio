import { describe, expect, it } from 'vitest';
import { linkAttrs } from '../../src/lib/link';

describe('linkAttrs', () => {
  it.each(['/projects', '/projects/lms-cricket#role', '#top'])('internal %s → same tab', (href) => {
    expect(linkAttrs(href)).toEqual({ href, external: false });
  });

  it('external http(s) → new tab, noopener noreferrer', () => {
    expect(linkAttrs('https://github.com/sakib-shadman')).toEqual({
      href: 'https://github.com/sakib-shadman',
      target: '_blank',
      rel: 'noopener noreferrer',
      external: true,
    });
  });

  it('mailto with an address is allowed in the same tab', () => {
    expect(linkAttrs('mailto:me@example.com')).toEqual({ href: 'mailto:me@example.com', external: false });
  });

  it.each([
    undefined,
    null,
    '',
    'javascript:alert(1)',
    'data:text/html,x',
    '//evil.com',
    'mailto:',
    'ftp://x.com',
    'relative',
  ])('rejects %s', (href) => expect(linkAttrs(href)).toBeNull());
});
