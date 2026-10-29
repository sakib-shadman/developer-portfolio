import type { APIRoute, GetStaticPaths } from 'astro';
import { getProfile, getProjects } from '../../../lib/content/queries';
import { detailPageProjects } from '../../../lib/project-detail';
import { sortProjects } from '../../../lib/projects';
import { projectCard } from '../../../lib/seo/og';
import { renderOgPng } from '../../../lib/seo/og-render';

// One card per project that has a detail page (same set as /projects/[slug]).
export const getStaticPaths = (async () => {
  const pages = detailPageProjects(sortProjects(await getProjects()));
  return pages.map((project) => ({ params: { slug: project.slug }, props: { project } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ project: { name: string; label: string } }> = async ({ props, site }) => {
  const profile = await getProfile();
  const png = await renderOgPng(
    projectCard(props.project, profile.name, new URL(site ?? 'http://localhost').host),
  );
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
