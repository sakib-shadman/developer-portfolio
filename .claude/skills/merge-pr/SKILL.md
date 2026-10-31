---
name: merge-pr
description: Use to merge a reviewed PR. Verifies the merge gate (reviewer's latest verdict APPROVE with no open findings, confirmed by the lead; required checks branch-policy, quality, e2e, pr-title green; branch up to date with develop), squash-merges, deletes the branch and lists the open branches that now need rebase-stack.
argument-hint: '<pr-number> --review-approved [--dry-run]'
---

# merge-pr

The lead decides the review gate from the posted review, fix and verify notes (the latest verdict must be APPROVE and every finding resolved). That cannot be read from GitHub, so the script only proceeds when you pass `--review-approved`.

```bash
.claude/skills/merge-pr/scripts/merge-pr.sh <pr> --review-approved [--dry-run]
```

What it checks and does:

1. PR is open, not a draft, **base is develop** (a stacked PR is merged only after its base: merge the base first, then `rebase-stack`), not conflicting.
2. Branch up to date with develop: if the merge state is `BEHIND` it runs `gh pr update-branch <pr> --rebase` and then **waits for CI again** with the watch-ci skill; otherwise it judges the current checks (`watch-ci.sh --once`). Any red or missing required check stops it (exit 1).
3. `gh pr merge <pr> --squash --delete-branch` (the PR title becomes the squash commit; no trailers are added).
4. Prints the PR's old head sha and the work that now needs a rebase: open PRs whose base is the merged branch, and remote branches that contain the old head. For each run the rebase-stack skill: `.claude/skills/rebase-stack/scripts/rebase-stack.sh <branch> <old-head-sha>`.

Never merge around a failing required check or an unresolved finding; fix and re-run.

## Rules that always apply

- No Claude co-author or session trailers on commits or in PR bodies and comments (`CLAUDE.md`); `push.sh` refuses a branch that has one.
- Never print tokens: do not `echo` or `env` secrets, do not `set -x` around `gh`/`git` calls, and keep `GH_TOKEN` in the environment, never in a URL or argument.
- Leftover `tmp_*` and `*.lock` files in `.git` (a killed git, or a mounted folder that refuses deletes) make every later git command fail with "Unable to create ... .lock". Check that no git process runs, then remove them: `find .git \( -name "*.lock" -o -name "tmp_*" \) -not -path ".git/objects/pack/*"`. If the delete is refused ("Operation not permitted"), ask the owner to allow deletes for that folder (or delete them on their machine); do not work around it.
- These skills are repo-scoped (`.claude/skills/`), never user-global.
