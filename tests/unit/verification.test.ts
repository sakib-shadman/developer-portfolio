import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Seo from '../../src/components/layout/Seo.astro';
import { verificationTags } from '../../src/lib/seo/verification';

describe('verificationTags', () => {
  it('returns nothing when unset or empty', () => {
    expect(verificationTags({})).toEqual([]);
    expect(
      verificationTags({ PUBLIC_GOOGLE_SITE_VERIFICATION: '  ', PUBLIC_BING_SITE_VERIFICATION: '' }),
    ).toEqual([]);
  });
  it('returns the Google and Bing tags for valid tokens', () => {
    expect(
      verificationTags({
        PUBLIC_GOOGLE_SITE_VERIFICATION: ' abc123_DEF-456 ',
        PUBLIC_BING_SITE_VERIFICATION: 'ABCDEF0123456789',
      }),
    ).toEqual([
      { name: 'google-site-verification', content: 'abc123_DEF-456' },
      { name: 'msvalidate.01', content: 'ABCDEF0123456789' },
    ]);
  });
  it('ignores tokens that could break out of an attribute', () => {
    expect(verificationTags({ PUBLIC_GOOGLE_SITE_VERIFICATION: 'abc" onload="x(1)' })).toEqual([]);
    expect(verificationTags({ PUBLIC_GOOGLE_SITE_VERIFICATION: 'short' })).toEqual([]);
  });
});

describe('<Seo> verification meta', () => {
  let c: AstroContainer;
  beforeAll(async () => {
    c = await AstroContainer.create();
  });
  afterEach(() => vi.unstubAllEnvs());
  const render = (props: Record<string, unknown> = {}) =>
    c.renderToString(Seo, {
      props: { title: 'Page', description: 'About.', path: '/', ...props },
      request: new Request('http://localhost/'),
    });

  it('renders no verification tag when the env vars are unset', async () => {
    vi.stubEnv('PUBLIC_GOOGLE_SITE_VERIFICATION', '');
    vi.stubEnv('PUBLIC_BING_SITE_VERIFICATION', '');
    const html = await render();
    expect(html).not.toContain('google-site-verification');
    expect(html).not.toContain('msvalidate.01');
  });
  it('renders the tags when set, and not on the noindex 404 page', async () => {
    vi.stubEnv('PUBLIC_GOOGLE_SITE_VERIFICATION', 'tokenGOOGLE_123');
    vi.stubEnv('PUBLIC_BING_SITE_VERIFICATION', 'TOKENBING0123456');
    const html = await render();
    expect(html).toContain('<meta name="google-site-verification" content="tokenGOOGLE_123">');
    expect(html).toContain('<meta name="msvalidate.01" content="TOKENBING0123456">');
    expect(await render({ noindex: true })).not.toContain('google-site-verification');
  });
});
