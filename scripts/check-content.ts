/**
 * Content guard (SRS §6.6, DoD #7). Runs before every build.
 *  - No design placeholders ("[Project name]", "TODO", …) in any content file.
 *  - profile.resume, if set, must exist under public/.
 *  - Every reference resolves. Astro only *logs* a dangling reference() and still builds,
 *    so integrity is enforced here.
 * Schema validation itself happens in `astro build` (content collections).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { findPlaceholders, looseMdxContent, resumeError } from '../src/lib/content/guards';

const ROOT = new URL('..', import.meta.url).pathname;
const CONTENT = join(ROOT, 'src/content');

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

for (const file of walk(CONTENT)) {
  const rel = relative(ROOT, file);
  const src = readFileSync(file, 'utf8');
  let data: unknown;
  if (file.endsWith('.json')) data = JSON.parse(src);
  else if (/\.mdx?$/.test(file)) data = frontmatter(src);
  else continue;
  for (const hit of findPlaceholders(data)) errors.push(`${rel} ${hit.path}: placeholder "${hit.value}"`);
}

const profile = JSON.parse(readFileSync(join(CONTENT, 'profile.json'), 'utf8')) as {
  main?: { resume?: string };
};
const resume = profile.main?.resume;
const missing = resumeError(resume, (p) => existsSync(join(ROOT, p)));
if (missing) errors.push(missing);

// ---------- Reference integrity ----------
const readJson = <T>(rel: string): T => JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as T;
const idsIn = (dir: string, ext: string) =>
  new Set(
    readdirSync(join(ROOT, dir))
      .filter((f) => f.endsWith(ext))
      .map((f) => f.slice(0, -ext.length)),
  );

const skillIds = new Set(readJson<{ id: string }[]>('src/content/skills.json').map((s) => s.id));
const projectIds = idsIn('src/content/projects', '.json');
const caseStudyIds = idsIn('src/content/case-studies', '.mdx');

const checkRefs = (where: string, refs: unknown, ids: Set<string>, kind: string) => {
  for (const ref of Array.isArray(refs) ? refs : refs === undefined ? [] : [refs]) {
    if (typeof ref !== 'string' || !ids.has(ref)) errors.push(`${where}: unknown ${kind} "${String(ref)}"`);
  }
};

for (const g of readJson<{ id: string; items?: unknown }[]>('src/content/skill-groups.json')) {
  checkRefs(`src/content/skill-groups.json [${g.id}].items`, g.items, skillIds, 'skill');
}
for (const e of readJson<{ id: string; technologies?: unknown }[]>('src/content/experience.json')) {
  checkRefs(`src/content/experience.json [${e.id}].technologies`, e.technologies, skillIds, 'skill');
}
for (const id of projectIds) {
  const rel = `src/content/projects/${id}.json`;
  const p = readJson<{ technologies?: unknown; caseStudy?: unknown }>(rel);
  checkRefs(`${rel} technologies`, p.technologies, skillIds, 'skill');
  checkRefs(`${rel} caseStudy`, p.caseStudy, caseStudyIds, 'case study');
}
for (const id of caseStudyIds) {
  const rel = `src/content/case-studies/${id}.mdx`;
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
console.log('✓ content check passed');
