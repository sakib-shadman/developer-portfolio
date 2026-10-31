#!/usr/bin/env bash
# Move a stacked branch onto develop after its base PR was SQUASH-merged.
# Usage: rebase-stack.sh <branch> <old-base-sha> [--relay] [--post-only] [--clean-locks]
#   <old-base-sha>  the tip of the base branch BEFORE the squash (merge-pr prints it)
#   --relay         cannot push from here: re-bundle the rebased branch instead (see ship-pr)
#   --post-only     skip the rebase (you resolved conflicts and ran `git rebase --continue`), only verify + push
#   --clean-locks   remove stale .git/*.lock and tmp_* files when no git process is running
# Env: VERIFY_CMD (default "pnpm verify --skip-e2e"), GIT_COMMITTER_NAME/EMAIL as a fallback identity.
# Exit: 0 done, 5 conflicts (resolve, then re-run with --post-only), others are errors.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
branch="${1:?usage: rebase-stack.sh <branch> <old-base-sha> [--relay] [--post-only] [--clean-locks]}"
old_base="${2:?old base sha required}"
shift 2
relay=0 post_only=0 clean=0
while [ $# -gt 0 ]; do
  case "$1" in
    --relay) relay=1; shift ;;
    --post-only) post_only=1; shift ;;
    --clean-locks) clean=1; shift ;;
    *) echo "rebase-stack: unknown option $1" >&2; exit 2 ;;
  esac
done
verify_cmd="${VERIFY_CMD:-pnpm verify --skip-e2e}"
git_dir="$(git rev-parse --git-dir)"

# Leftover lock/tmp files (from a killed git, or a mount that forbids deleting) break every later git command.
stale="$(find "$git_dir" \( -name '*.lock' -o -name 'tmp_*' \) -not -path "$git_dir/objects/pack/*" 2>/dev/null || true)"
if [ -n "$stale" ]; then
  if [ "$clean" = 1 ] && ! pgrep -x git >/dev/null 2>&1; then
    # shellcheck disable=SC2086 # the file list is newline separated paths without spaces in a git dir
    rm -f $stale || { echo "rebase-stack: could not delete lock files (mount without delete permission?): ask the owner to allow deletes or remove them on the host:" >&2; echo "$stale" >&2; exit 1; }
    echo "rebase-stack: removed stale lock/tmp files"
  else
    echo "rebase-stack: lock/tmp files present, re-run with --clean-locks once no git process is running:" >&2
    echo "$stale" >&2
    exit 1
  fi
fi

# A committer identity is required to rewrite commits. Use the repo/user config, else the environment.
if [ -z "$(git config user.name || true)" ] || [ -z "$(git config user.email || true)" ]; then
  name="${GIT_COMMITTER_NAME:-${GIT_AUTHOR_NAME:-}}"
  email="${GIT_COMMITTER_EMAIL:-${GIT_AUTHOR_EMAIL:-}}"
  if [ -z "$name" ] || [ -z "$email" ]; then
    echo "rebase-stack: no git identity. Set user.name/user.email or GIT_COMMITTER_NAME/GIT_COMMITTER_EMAIL." >&2
    exit 1
  fi
  export GIT_COMMITTER_NAME="$name" GIT_COMMITTER_EMAIL="$email"
fi

if [ "$post_only" = 0 ]; then
  [ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "rebase-stack: working tree has uncommitted changes" >&2; exit 1; }
  git fetch --quiet origin
  git rev-parse --verify --quiet "$branch^{commit}" >/dev/null || { echo "rebase-stack: no such branch $branch" >&2; exit 2; }
  git merge-base --is-ancestor "$old_base" "$branch" || { echo "rebase-stack: $old_base is not an ancestor of $branch, wrong old base sha" >&2; exit 2; }
  echo "rebase-stack: replaying these commits onto origin/develop:"
  git log --oneline "$old_base..$branch"
  git switch --quiet "$branch"
  # --onto drops everything up to old-base: those commits are already in develop as ONE squash commit.
  if ! git rebase --onto origin/develop "$old_base" "$branch"; then
    echo "rebase-stack: CONFLICTS. Files:" >&2
    git diff --name-only --diff-filter=U >&2
    echo "Resolve them, git add, git rebase --continue, then re-run with --post-only." >&2
    exit 5
  fi
fi

echo "rebase-stack: verifying: $verify_cmd"
bash -c "$verify_cmd"

if [ "$relay" = 1 ]; then
  bundle="$("$here/../../ship-pr/scripts/bundle.sh" "$branch")"
  echo "rebase-stack: relay mode, rebased bundle: $bundle"
  echo "Copy it to the owner's machine, fetch it there and force-push with lease (see the ship-pr skill)."
else
  "$here/../../ship-pr/scripts/push.sh" "$branch" --force-with-lease
fi
