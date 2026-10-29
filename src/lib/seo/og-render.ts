/**
 * Renders an OG card to PNG at build time: satori (layout → SVG, text converted to paths) then sharp
 * (already an Astro dependency) rasterises it. Fonts are the Fontsource static files (satori can't
 * read the variable woff2 the site itself serves). Build-only: never bundled into client code.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import satori from 'satori';
import sharp from 'sharp';
import { ogTree, type OgCard } from './og';
import { OG_SIZE } from './text';

// Resolved from this module, not from process.cwd(): works from any cwd, in a workspace, or hoisted.
const require = createRequire(import.meta.url);
const font = (pkg: string, file: string) => readFileSync(require.resolve(`${pkg}/files/${file}`));

let fonts: { name: string; data: Buffer; weight: 400 | 600 | 700; style: 'normal' }[] | undefined;
const loadFonts = () =>
  (fonts ??= [
    {
      name: 'Inter',
      data: font('@fontsource/inter', 'inter-latin-400-normal.woff'),
      weight: 400,
      style: 'normal',
    },
    {
      name: 'Inter',
      data: font('@fontsource/inter', 'inter-latin-600-normal.woff'),
      weight: 600,
      style: 'normal',
    },
    {
      name: 'Space Grotesk',
      data: font('@fontsource/space-grotesk', 'space-grotesk-latin-700-normal.woff'),
      weight: 700,
      style: 'normal',
    },
  ]);

export async function renderOgPng(card: OgCard): Promise<Buffer> {
  const svg = await satori(ogTree(card) as never, { ...OG_SIZE, fonts: loadFonts() });
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
