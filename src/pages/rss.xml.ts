import { getRssString } from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getArticles, getProfile } from '../lib/content/queries';
import { buildFeedItems } from '../lib/rss';

/**
 * FR-15 feed of article references. Always served and valid even with zero items (FR-15.5), so
 * the <link rel="alternate"> in BaseLayout and the footer link can always point here.
 */
export const GET: APIRoute = async ({ site }) => {
  if (!site) throw new Error('`site` must be configured to build /rss.xml');
  const [profile, articles] = await Promise.all([getProfile(), getArticles()]);
  const body = await getRssString({
    title: `${profile.name} — Articles`,
    description: `Articles by ${profile.name}, ${profile.title}. Every entry links to the original on Medium.`,
    site,
    items: buildFeedItems(articles),
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    // The channel <link> is the human-readable home of these articles (overrides the site root).
    customData: `<link>${new URL('blog', site).href}</link><language>en</language><atom:link href="${new URL('rss.xml', site).href}" rel="self" type="application/rss+xml"/>`,
  });
  return new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
