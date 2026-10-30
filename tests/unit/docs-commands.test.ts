import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// PF-53: the README and MAINTENANCE guide must only name scripts, files and folders that exist.
const DOCS = ['README.md', 'docs/MAINTENANCE.md'];
const scripts = Object.keys(
  JSON.parse(readFileSync('package.json', 'utf8')).scripts as Record<string, string>,
);

/** Paths that are examples, build output or created by the reader, not files of the repo. */
const NOT_IN_REPO =
  /<|\*|example|^dist|^public\/resume\/|^src\/content\/(images|projects\/images|articles\/images)\/$/;

const spans = (text: string) => [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]!);
const codeBlocks = (text: string) => [...text.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((m) => m[1]!);

describe.each(DOCS)('%s', (file) => {
  const text = readFileSync(file, 'utf8');

  it('mentions only package.json scripts after `pnpm`', () => {
    const lines = [...spans(text), ...codeBlocks(text).flatMap((b) => b.split('\n'))];
    const used = new Set<string>();
    for (const line of lines)
      for (const m of line.matchAll(/\bpnpm (?!exec\b|install\b|dlx\b)([a-z][\w:-]*)/g)) used.add(m[1]!);
    expect([...used].filter((s) => !scripts.includes(s))).toEqual([]);
  });

  it('names only repo paths that exist', () => {
    const paths = spans(text)
      .map((s) => s.split(/\s/)[0]!.replace(/[.,;:]+$/, ''))
      .filter((s) =>
        /^(src|docs|tests|scripts|public|\.github|\.claude)\/|^[\w.-]+\.(md|json|toml|cjs|mjs|ts)$/.test(s),
      )
      .filter((s) => !NOT_IN_REPO.test(s));
    // Bare `profile.json` style names in prose are the files of src/content.
    const exists = (p: string) =>
      existsSync(p) || (/^[\w.-]+\.json$/.test(p) && existsSync(`src/content/${p}`));
    expect(paths.filter((p) => !exists(p))).toEqual([]);
  });

  it('names only scripts/ files that exist in command lines', () => {
    const cmds = codeBlocks(text).concat(spans(text));
    const used = cmds.flatMap((c) => [...c.matchAll(/scripts\/[\w.-]+/g)].map((m) => m[0]));
    expect(used.filter((p) => !existsSync(p))).toEqual([]);
  });
});
