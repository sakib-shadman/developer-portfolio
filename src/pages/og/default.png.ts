import type { APIRoute } from 'astro';
import { getProfile } from '../../lib/content/queries';
import { defaultCard } from '../../lib/seo/og';
import { renderOgPng } from '../../lib/seo/og-render';

// /og/default.png: the share image for every page without a more specific one (built from profile data).
export const GET: APIRoute = async ({ site }) => {
  const profile = await getProfile();
  const png = await renderOgPng(defaultCard(profile, new URL(site ?? 'http://localhost').host));
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
