---
name: ship-pr
description: Use to publish a finished branch as a pull request against develop. Pushes the branch (or, when the cloud session cannot push, builds a uniquely named git bundle to relay through the owner's machine), opens the PR from a body file or reuses the open one, posts review/fix/verify notes as PR comments and prints the PR URL.
argument-hint: '<branch> <pr-body-file> [--title "type(scope): subject (PF-xx)"] [--review f] [--fix f] [--verify f] [--skip-push]'
---

# ship-pr

Run from the repository root with the branch committed. `gh` must be authenticated (`GH_TOKEN`).

```bash
.claude/skills/ship-pr/scripts/ship.sh <branch> <pr-body-file> [--title "<conventional commit>"] \
  [--review <file>] [--fix <file>] [--verify <file>] [--skip-push]
```

It does, in order (each step is also a script you can run alone):

1. `scripts/push.sh <branch>`: a direct `git push --set-upstream origin <branch>` (90 s timeout). Refuses a branch with a Claude trailer.
2. `scripts/open-pr.sh <branch> <body-file>`: `gh pr create --base develop`, or reuses the open PR for that head (`--update-body` rewrites its body). The title defaults to the branch tip's commit subject and must be a Conventional Commit of at most 100 characters (it becomes the squash commit; `pr-title` checks it).
3. `scripts/comment.sh <pr> <review|fix|verify> <file>`: posts each note given as a comment headed with its kind.
4. Prints the PR URL (last line).

## When the push fails

`push.sh` classifies the failure and never prints push output raw (URL credentials are redacted):

- **Stale lease / non-fast-forward / "fetch first" (exit 1):** an error, not an auth problem. No bundle. Run `git fetch origin && git log --oneline <branch>..origin/<branch>`, inspect, integrate, push again.
- **Anything else unrecognised (exit 1):** shown redacted; no relay.
- **Auth, proxy or network (403, "not in this session's authorized repository set", authentication failures, DNS or tunnel errors): exit code 3**, the relay below.
- A branch with a Claude trailer (exit 4), or an unreadable `origin/develop..<branch>` range (exit 2), also stops before pushing.
- `push.sh <branch> --lease-sha <sha>` force-pushes as `--force-with-lease=<branch>:<sha> --force-if-includes` (used by rebase-stack).

Auth or the egress proxy can refuse the push from a cloud session (exit 3). Do **not** try other remotes, tokens or tunnels. `push.sh` has already built a bundle with `scripts/bundle.sh` (`git bundle create <unique>.bundle <branch> ^origin/develop`, then `git bundle verify`) and printed its path and these steps:

1. Copy the bundle to the owner's machine with the session's file-copy tool. **The name is unique every time (branch, UTC timestamp, short sha, pid) because that tool caches by name**: never reuse or overwrite an older bundle, and always pass the path the script printed.
2. The owner's machine fetches it into a clone and pushes: `git fetch <bundle> '<branch>:<branch>' && git push origin '<branch>'`. The script that automates this lives outside this repo and is machine-specific; do not add it here.
3. Re-run `ship.sh <branch> <body-file> --skip-push` to open the PR.

Bundle a new version after every fix commit (new file name again).

## Rules that always apply

- No Claude co-author or session trailers on commits or in PR bodies and comments (`CLAUDE.md`); `push.sh` refuses a branch that has one.
- Never print tokens: do not `echo` or `env` secrets, do not `set -x` around `gh`/`git` calls, and keep `GH_TOKEN` in the environment, never in a URL or argument.
- Leftover `tmp_*` and `*.lock` files in `.git` (a killed git, or a mounted folder that refuses deletes) make every later git command fail with "Unable to create ... .lock". Check that no git process runs, then remove them: `find .git \( -name "*.lock" -o -name "tmp_*" \) -not -path ".git/objects/pack/*"`. If the delete is refused ("Operation not permitted"), ask the owner to allow deletes for that folder (or delete them on their machine); do not work around it.
- These skills are repo-scoped (`.claude/skills/`), never user-global.
