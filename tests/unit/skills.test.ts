import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// Repo-scoped Claude Code skills (.claude/skills/<name>/SKILL.md): valid frontmatter, and every script a
// skill refers to exists and is executable. (tests/unit/skills-scripts.test.ts covers what the scripts do.)
const ROOT = '.claude/skills';
const skills = readdirSync(ROOT).filter((d) => statSync(join(ROOT, d)).isDirectory());

describe('skills', () => {
  it('has the four PR-routine skills', () => {
    expect(skills.sort()).toEqual(['merge-pr', 'rebase-stack', 'ship-pr', 'watch-ci']);
  });

  describe.each(skills)('%s', (dir) => {
    const file = join(ROOT, dir, 'SKILL.md');
    const text = readFileSync(file, 'utf8');
    const m = /^---\n([\s\S]*?)\n---\n/.exec(text);

    it('has YAML frontmatter with a name equal to its folder and a non-empty description', () => {
      expect(m, `${file} must start with --- frontmatter ---`).not.toBeNull();
      const fm = parse(m![1]!) as Record<string, unknown>;
      expect(fm.name).toBe(dir);
      expect(typeof fm.description).toBe('string');
      expect((fm.description as string).trim().length).toBeGreaterThan(40);
      expect(fm.description as string).toMatch(/^Use /); // says when to use it
    });

    it('has instructions after the frontmatter', () => {
      expect(text.slice(m![0].length).trim().length).toBeGreaterThan(200);
    });

    it('states the common rules: no trailers, no tokens, lock files, repo scope', () => {
      expect(text).toMatch(/co-author or session trailers/);
      expect(text).toMatch(/Never print tokens/);
      expect(text).toMatch(/\*\.lock/);
      expect(text).toMatch(/repo-scoped/);
    });

    it('references only scripts that exist and are executable', () => {
      const refs = [...text.matchAll(/(?:([\w-]+)\/)?scripts\/([\w.-]+\.sh)/g)];
      expect(refs.length).toBeGreaterThan(0);
      for (const [, otherSkill, name] of refs) {
        const path = join(ROOT, otherSkill ?? dir, 'scripts', name!);
        expect(existsSync(path), `${path} (referenced in ${file})`).toBe(true);
        expect(statSync(path).mode & 0o111, `${path} must be executable`).not.toBe(0);
      }
    });

    it('every script in the folder is bash with set -euo pipefail', () => {
      const dirScripts = join(ROOT, dir, 'scripts');
      for (const name of readdirSync(dirScripts)) {
        const body = readFileSync(join(dirScripts, name), 'utf8');
        expect(body.startsWith('#!/usr/bin/env bash\n'), name).toBe(true);
        expect(body, name).toContain('set -euo pipefail');
        expect(statSync(join(dirScripts, name)).mode & 0o111, name).not.toBe(0);
      }
    });
  });
});
