import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// Repo-scoped agents (.claude/agents/<name>.md): valid frontmatter everywhere, and the review agents keep
// their mandatory habits (mutation check, external-fact check) and web tools.
const DIR = '.claude/agents';
// Tool names from https://code.claude.com/docs/en/sub-agents (a typo such as "Bassh" silently grants nothing).
const KNOWN_TOOLS = new Set([
  'Read',
  'Write',
  'Edit',
  'Grep',
  'Glob',
  'Bash',
  'PowerShell',
  'LSP',
  'NotebookEdit',
  'WebFetch',
  'WebSearch',
  'TodoWrite',
  'Skill',
  'ToolSearch',
  'EnterWorktree',
  'ExitWorktree',
  'Monitor',
  'TaskStop',
  'SendMessage',
  'Artifact',
  'ListAgents',
  'Agent',
  'Task',
  'TaskCreate',
  'TaskGet',
  'TaskList',
  'TaskUpdate',
  'CronCreate',
  'CronDelete',
  'CronList',
]);
const MODEL = /^(sonnet|opus|haiku|fable|inherit|claude-[\w.-]+)$/;
const files = readdirSync(DIR).filter((f) => f.endsWith('.md'));

function load(file: string) {
  const text = readFileSync(join(DIR, file), 'utf8');
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  expect(m, `${file} must start with --- frontmatter ---`).not.toBeNull();
  const fm = parse(m![1]!) as Record<string, unknown>;
  const tools = String(fm.tools ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  return { fm, tools, body: text.slice(m![0].length).replace(/\s+/g, ' ') };
}

describe('agents', () => {
  it('has the five agents', () => {
    expect(files.sort()).toEqual(['pr-reviewer.md', 'pr-verifier.md', 'senior-engineer.md', 'team-lead.md']);
  });

  describe.each(files)('%s', (file) => {
    const { fm, tools, body } = load(file);
    it('has name equal to the file name, a description, tools and a model', () => {
      expect(fm.name).toBe(file.replace(/\.md$/, ''));
      expect(String(fm.description).trim().length).toBeGreaterThan(40);
      expect(tools.length).toBeGreaterThan(0);
      expect(String(fm.model)).toMatch(MODEL);
      for (const t of tools) expect(KNOWN_TOOLS.has(t) || /^mcp__/.test(t), `unknown tool "${t}"`).toBe(true);
      expect(body.trim().length).toBeGreaterThan(200);
    });
  });

  describe.each(['pr-reviewer.md', 'pr-verifier.md'])('%s required steps', (file) => {
    const { tools, body } = load(file);
    it('has the web tools for primary-source checks', () => {
      expect(tools).toEqual(expect.arrayContaining(['WebFetch', 'WebSearch']));
    });
    it('requires the mutation check: put the bug back, a still-passing test is a blocker', () => {
      expect(body).toMatch(/\*\*\(?(a\) )?Mutation check/);
      expect(body).toMatch(/original bug back/);
      expect(body).toMatch(/still passes[^.]*blocker/);
    });
    it('requires the external-fact check against a primary source with the URL cited', () => {
      expect(body).toMatch(/External-fact check/);
      expect(body).toMatch(/browser support, standards, library APIs, platform limits, pricing or quotas/);
      expect(body).toMatch(/primary source/);
      expect(body).toMatch(/URL cited/);
      expect(body).toMatch(/unverif|cannot verify/);
    });
    it('does its mutations in a throwaway worktree, never in the PR checkout', () => {
      expect(body).toContain('git worktree add');
    });
  });

  describe('pr-verifier', () => {
    const { fm, tools, body } = load('pr-verifier.md');
    it('is Sonnet with exactly the read-only toolset (no Edit/Write)', () => {
      expect(fm.model).toBe('sonnet');
      expect([...tools].sort()).toEqual(['Bash', 'Glob', 'Grep', 'Read', 'WebFetch', 'WebSearch']);
    });
    it('reports APPROVE or REQUEST CHANGES, writes no review and never edits code', () => {
      expect(body).toMatch(/APPROVE or REQUEST CHANGES/);
      expect(body).toMatch(/never edit code/);
      expect(body).toMatch(/Writes? no review|do not review the PR afresh/);
    });
  });

  describe('pr-reviewer', () => {
    it('is Opus', () => {
      expect(load('pr-reviewer.md').fm.model).toBe('opus');
    });
  });

  describe('team-lead routing', () => {
    const { body } = load('team-lead.md');
    it('uses pr-reviewer (Opus) for the first review and pr-verifier (Sonnet) for fix verification', () => {
      expect(body).toMatch(/first review[^.]*`pr-reviewer` \(Opus\)/);
      expect(body).toMatch(/`pr-verifier` \(Sonnet\)/);
      expect(body).toMatch(
        /Escalate to `pr-reviewer` \(Opus\) again only when a fix is large or changes the design/,
      );
    });
    it('preloads skills that exist and can be preloaded (not disable-model-invocation)', () => {
      const raw = readFileSync(join(DIR, 'team-lead.md'), 'utf8');
      const fm = parse(/^---\n([\s\S]*?)\n---\n/.exec(raw)![1]!) as { skills?: string[] };
      expect(fm.skills).toEqual(expect.arrayContaining(['ship-pr', 'watch-ci', 'rebase-stack']));
      for (const name of fm.skills ?? []) {
        const skill = readFileSync(join('.claude/skills', name, 'SKILL.md'), 'utf8');
        expect(skill, `${name} is preloaded, so it cannot disable model invocation`).not.toMatch(
          /disable-model-invocation: true/,
        );
      }
    });
    it('does not claim subagents cannot start subagents (the docs allow nesting)', () => {
      expect(body).not.toMatch(/subagents cannot start other subagents/i);
    });
    it('waits for CI with the watch-ci skill, never sleep loops', () => {
      expect(body).toContain('watch-ci');
      expect(body).toContain('gh pr checks --watch');
      expect(body).toMatch(/Never poll with sleep loops/);
    });
  });
});
