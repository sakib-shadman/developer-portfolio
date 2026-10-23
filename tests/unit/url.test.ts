import { describe, expect, it } from 'vitest';
import { canonicalize, isHttpUrl, safeExternalUrl } from '../../src/lib/url';

describe('url', () => {
  it.each([
    ['https://github.com/sakib-shadman', true],
    ['http://example.com', true],
    ['javascript:alert(1)', false],
    ['data:text/html,hi', false],
    ['/relative', false],
    ['not a url', false],
    [42, false],
  ])('isHttpUrl(%s) = %s', (input, expected) => {
    expect(isHttpUrl(input)).toBe(expected);
  });

  it('safeExternalUrl drops unsafe values', () => {
    expect(safeExternalUrl('https://x.dev')).toBe('https://x.dev');
    expect(safeExternalUrl('javascript:void(0)')).toBeUndefined();
  });

  it('canonicalize strips query and hash', () => {
    expect(canonicalize('https://medium.com/@me/post-abc?source=rss----1#top')).toBe(
      'https://medium.com/@me/post-abc',
    );
  });
});
