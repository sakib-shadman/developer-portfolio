import { describe, expect, it } from 'vitest';
import { linkAttrs, opensInNewTab } from '../../src/lib/link';

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

describe('linkAttrs newTab option', () => {
  it('internal PDF path opens in a new tab with noopener noreferrer, still not "external"', () => {
    expect(linkAttrs('/resume/cv.pdf', { newTab: true })).toEqual({
      href: '/resume/cv.pdf',
      target: '_blank',
      rel: 'noopener noreferrer',
      external: false,
    });
    expect(linkAttrs('/resume/cv.pdf')).toEqual({ href: '/resume/cv.pdf', external: false });
    expect(linkAttrs('/resume/cv.pdf', { newTab: false })).toEqual({
      href: '/resume/cv.pdf',
      external: false,
    });
  });

  it('external links are unchanged by the option; unsafe hrefs stay rejected', () => {
    expect(linkAttrs('https://x.dev', { newTab: true })).toEqual(linkAttrs('https://x.dev'));
    expect(linkAttrs('javascript:alert(1)', { newTab: true })).toBeNull();
    expect(linkAttrs('//evil.com/x.pdf', { newTab: true })).toBeNull();
    expect(linkAttrs(undefined, { newTab: true })).toBeNull();
  });

  it('opensInNewTab is true for external and newTab links only', () => {
    expect(opensInNewTab(linkAttrs('https://x.dev'))).toBe(true);
    expect(opensInNewTab(linkAttrs('/resume/cv.pdf', { newTab: true }))).toBe(true);
    expect(opensInNewTab(linkAttrs('/resume/cv.pdf'))).toBe(false);
    expect(opensInNewTab(linkAttrs('mailto:me@example.com'))).toBe(false);
    expect(opensInNewTab(null)).toBe(false);
  });
});
