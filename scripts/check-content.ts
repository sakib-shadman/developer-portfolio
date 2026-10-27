/**
 * Content guard (SRS §6.6, DoD #7). Runs before every build.
 *  - No design placeholders ("[Project name]", "TODO", …) in any content file.
 *  - profile.resume, if set, must exist under public/.
 *  - Every reference resolves. Astro only *logs* a dangling reference() and still builds,
 *    so integrity is enforced here.
 * Schema validation itself happens in `astro build` (content collections).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { findPlaceholders, looseMdxContent, resumeError } from '../src/lib/content/guards';
import {
  FIXTURE_CONTENT,
  fixtureFileName,
  FIXTURE_MARKER,
  REAL_CONTENT,
  contentRoot,
  fixtureLeak,
  fixturesOn,
  publicRoot,
} from '../src/lib/content/root';

const ROOT = new URL('..', import.meta.url).pathname;
const FIXTURES = fixturesOn(process.env.PUBLIC_CONTENT_FIXTURES);
const CONTENT_DIR = contentRoot(process.env.PUBLIC_CONTENT_FIXTURES);
const PUBLIC_DIR = publicRoot(process.env.PUBLIC_CONTENT_FIXTURES);
const CONTENT = join(ROOT, CONTENT_DIR);

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

function frontmatter(source: string): unknown {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  return m?.[1] ? parseYaml(m[1]) : {};
}

const errors: string[] = [];

// Fixtures must never leak into real content, whichever content is being checked.
for (const file of walk(join(ROOT, REAL_CONTENT))) {
  if (fixtureFileName(basename(file))) {
    errors.push(`${relative(ROOT, file)}: fixture-style file name (fixtures belong in ${FIXTURE_CONTENT})`);
  }
  if (/\.(json|mdx?)$/.test(file) && fixtureLeak(readFileSync(file, 'utf8'))) {
    errors.push(
      `${relative(ROOT, file)}: contains the fixture marker "${FIXTURE_MARKER}" (fixtures belong in ${FIXTURE_CONTENT})`,
    );
  }
}

// Every fixture record carries the marker, so a copied record is caught by the leak scan above.
const UNMARKED_OK = new Set(['skills.json', 'skill-groups.json']);
for (const file of walk(CONTENT)) {
  const rel = relative(ROOT, file);
  const src = readFileSync(file, 'utf8');
  if (FIXTURES && /\.(json|mdx?)$/.test(file) && !UNMARKED_OK.has(basename(file)) && !fixtureLeak(src)) {
    errors.push(`${rel}: fixture record without the marker "${FIXTURE_MARKER}"`);
  }
  let data: unknown;
  if (file.endsWith('.json')) data = JSON.parse(src);
  else if (/\.mdx?$/.test(file)) data = frontmatter(src);
  else continue;
  for (const hit of findPlaceholders(data)) errors.push(`${rel} ${hit.path}: placeholder "${hit.value}"`);
}

const profile = JSON.parse(readFileSync(join(CONTENT, 'profile.json'), 'utf8')) as {
  main?: { resume?: string; intro?: string };
};
if (FIXTURES && !fixtureLeak(profile.main?.intro ?? '')) {
  errors.push(
    `${CONTENT_DIR}/profile.json: fixture profile must carry the marker "${FIXTURE_MARKER}" in intro`,
  );
}
const resume = profile.main?.resume;
const missing = resumeError(resume, (p) => existsSync(join(ROOT, PUBLIC_DIR, p.replace(/^public\//, ''))));
if (missing) errors.push(missing);

// ---------- Reference integrity ----------
const readJson = <T>(rel: string): T => JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as T;
const idsIn = (dir: string, ext: string) =>
  new Set(
    readdirSync(join(ROOT, dir))
      .filter((f) => f.endsWith(ext))
      .map((f) => f.slice(0, -ext.length)),
  );

const skillIds = new Set(readJson<{ id: string }[]>(`${CONTENT_DIR}/skills.json`).map((s) => s.id));
const projectIds = idsIn(`${CONTENT_DIR}/projects`, '.json');
const caseStudyIds = idsIn(`${CONTENT_DIR}/case-studies`, '.mdx');

const checkRefs = (where: string, refs: unknown, ids: Set<string>, kind: string) => {
  for (const ref of Array.isArray(refs) ? refs : refs === undefined ? [] : [refs]) {
    if (typeof ref !== 'string' || !ids.has(ref)) errors.push(`${where}: unknown ${kind} "${String(ref)}"`);
  }
};

for (const g of readJson<{ id: string; items?: unknown }[]>(`${CONTENT_DIR}/skill-groups.json`)) {
  checkRefs(`${CONTENT_DIR}/skill-groups.json [${g.id}].items`, g.items, skillIds, 'skill');
}
for (const e of readJson<{ id: string; technologies?: unknown }[]>(`${CONTENT_DIR}/experience.json`)) {
  checkRefs(`${CONTENT_DIR}/experience.json [${e.id}].technologies`, e.technologies, skillIds, 'skill');
}
for (const id of projectIds) {
  const rel = `${CONTENT_DIR}/projects/${id}.json`;
  const p = readJson<{ technologies?: unknown; caseStudy?: unknown }>(rel);
  checkRefs(`${rel} technologies`, p.technologies, skillIds, 'skill');
  checkRefs(`${rel} caseStudy`, p.caseStudy, caseStudyIds, 'case study');
}
for (const id of caseStudyIds) {
  const rel = `${CONTENT_DIR}/case-studies/${id}.mdx`;
  const fm = frontmatter(readFileSync(join(ROOT, rel), 'utf8')) as { project?: unknown };
  checkRefs(`${rel} project`, fm.project, projectIds, 'project');
  for (const hit of looseMdxContent(readFileSync(join(ROOT, rel), 'utf8'))) {
    errors.push(`${rel}:${hit.line}: content outside a <Section> ("${hit.text.slice(0, 40)}")`);
  }
}

if (errors.length) {
  console.error(`✖ content check failed (${errors.length}):\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ content check passed${FIXTURES ? ' (fixtures)' : ''}`);
