---
name: watch-ci
description: Use after pushing a PR to wait for its CI checks and get a clear pass/fail summary. Waits with gh pr checks --watch (with a timeout), then checks the four required checks and, for any failing job, prints its annotations through the check-runs API because logs cannot always be downloaded.
argument-hint: '<pr-number> [--timeout seconds] [--interval seconds] [--once]'
---

# watch-ci

```bash
.claude/skills/watch-ci/scripts/watch-ci.sh <pr> [--timeout 1800] [--interval 30] [--once]
```

- Waits with `gh pr checks <pr> --watch --interval 30` under `timeout` (default 1800 s). `--once` skips the wait and judges the current state (merge-pr uses it).
- Required checks (override with `REQUIRED_CHECKS`): `branch-policy quality e2e pr-title`. A required check that failed, was cancelled or never appeared is a failure. Other failing checks (for example Lighthouse) are listed but do not fail the result.
- For every failing job it prints the annotations from `gh api repos/{owner}/{repo}/check-runs/<job-id>/annotations` (path, line, message). The job id is taken from the check's link (`.../job/<id>`). Playwright's GitHub reporter and ESLint write their errors there, so this is usually enough to find the failing test without logs.
- Exit codes: **0** pass (`RESULT: PASS`), **1** fail (`RESULT: FAIL`), **4** still pending after the timeout (`RESULT: PENDING`: run it again, do not merge).

If annotations are empty, open the check's link or run `gh run view <run-id> --log-failed` where logs are available.

## Rules that always apply

- No Claude co-author or session trailers on commits or in PR bodies and comments (`CLAUDE.md`); `push.sh` refuses a branch that has one.
- Never print tokens: do not `echo` or `env` secrets, do not `set -x` around `gh`/`git` calls, and keep `GH_TOKEN` in the environment, never in a URL or argument.
- Leftover `tmp_*` and `*.lock` files in `.git` (a killed git, or a mounted folder that refuses deletes) make every later git command fail with "Unable to create ... .lock". Check that no git process runs, then remove them: `find .git \( -name "*.lock" -o -name "tmp_*" \) -not -path ".git/objects/pack/*"`. If the delete is refused ("Operation not permitted"), ask the owner to allow deletes for that folder (or delete them on their machine); do not work around it.
- These skills are repo-scoped (`.claude/skills/`), never user-global.
