---
name: rebase-stack
description: Use after a base PR was squash-merged into develop to move the branches stacked on it onto develop. Runs git rebase --onto origin/develop <old-base-sha> <branch>, handles a missing committer identity and stale lock files, stops on conflicts, runs pnpm verify --skip-e2e, then force-pushes with lease (or re-bundles in relay mode).
argument-hint: '<branch> <old-base-sha> [--relay] [--post-only] [--clean-locks]'
---

# rebase-stack

```bash
.claude/skills/rebase-stack/scripts/rebase-stack.sh <branch> <old-base-sha> [--relay] [--post-only] [--clean-locks]
```

`<old-base-sha>` is the tip of the base branch **before** it was squash-merged (merge-pr prints it as "old head"; or `git rev-parse origin/<base-branch>` before the branch is deleted, or the base PR's last commit).

## Why not a plain `git rebase origin/develop`

A squash merge turns the base branch's N commits into **one new commit** with different hashes. A plain rebase of the stacked branch replays all N base commits again on top of develop, where their content already exists: you get conflicts, duplicated or empty commits, and a PR diff that includes the base work. `git rebase --onto origin/develop <old-base-sha> <branch>` replays only the commits after the old base.

## What the script does

1. Stops on stale `.git/*.lock` or `tmp_*` files (`--clean-locks` removes them when no git process runs; see the rules below).
2. Needs a committer identity to rewrite commits: uses the repo/user git config, else `GIT_COMMITTER_NAME`/`GIT_COMMITTER_EMAIL` (or the `GIT_AUTHOR_*` pair) from the environment without writing config; fails with a clear message if neither exists.
3. Requires a clean tree, fetches, and **refuses unless the local branch equals `origin/<branch>`** (otherwise the force-push would silently drop a teammate's commit: inspect with `git log --oneline <branch>..origin/<branch>`). It records that remote tip, checks `<old-base-sha>` is an ancestor of the branch, lists the commits it will replay, then runs the `--onto` rebase.
4. **Conflicts: exit 5**, with the conflicting files. Resolve, `git add`, `git rebase --continue`, then re-run with `--post-only`, which refuses while a `rebase-merge`/`rebase-apply` directory exists, when HEAD is not on the branch, or when the branch does not contain `origin/develop`. Do not resolve by taking either side blindly: the stacked change must still do what it did.
5. Runs `pnpm verify --skip-e2e` (override with `VERIFY_CMD`). A failure stops before any push.
6. Publishes through `ship-pr/scripts/push.sh --lease-sha <recorded remote tip>`, i.e. `--force-with-lease=<branch>:<sha> --force-if-includes`, so it can only replace the tip you inspected. If the push is rejected, or with `--relay`, it builds a **new uniquely named bundle** instead (see the ship-pr skill for the relay path). After a force-push or relay, the PR base changes to develop automatically when the old base branch was deleted; otherwise run `gh pr edit <pr> --base develop`.

Then run the watch-ci skill on the PR.

## Rules that always apply

- No Claude co-author or session trailers on commits or in PR bodies and comments (`CLAUDE.md`); `push.sh` refuses a branch that has one.
- Never print tokens: do not `echo` or `env` secrets, do not `set -x` around `gh`/`git` calls, and keep `GH_TOKEN` in the environment, never in a URL or argument.
- Leftover `tmp_*` and `*.lock` files in `.git` (a killed git, or a mounted folder that refuses deletes) make every later git command fail with "Unable to create ... .lock". Check that no git process runs, then remove them: `find .git \( -name "*.lock" -o -name "tmp_*" \) -not -path ".git/objects/pack/*"`. If the delete is refused ("Operation not permitted"), ask the owner to allow deletes for that folder (or delete them on their machine); do not work around it.
- These skills are repo-scoped (`.claude/skills/`), never user-global.
