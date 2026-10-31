#!/usr/bin/env bash
# Squash-merge a PR once the gate is met, delete its branch, list branches that now need rebasing.
# Usage: merge-pr.sh <pr> --review-approved [--dry-run]
#   --review-approved  the lead confirms, from the posted review/fix/verify notes, that the reviewer's latest
#                      verdict is APPROVE and no finding is open. This cannot be read from GitHub, so the
#                      script refuses to merge without it.
# Env: GH=<path> overrides gh (tests); REQUIRED_CHECKS is passed through to watch-ci.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
gh_bin="${GH:-gh}"
watch="$here/../../watch-ci/scripts/watch-ci.sh"
pr="${1:?usage: merge-pr.sh <pr> --review-approved [--dry-run]}"
shift
approved=0
dry=0
while [ $# -gt 0 ]; do
  case "$1" in
    --review-approved) approved=1; shift ;;
    --dry-run) dry=1; shift ;;
    *) echo "merge-pr: unknown option $1" >&2; exit 2 ;;
  esac
done
[ "$approved" = 1 ] || { echo "merge-pr: refusing. Confirm the reviewer's latest verdict is APPROVE with no open findings, then pass --review-approved." >&2; exit 2; }

view() { "$gh_bin" pr view "$pr" --json "$1" --jq "$2"; }
state="$(view state .state)"
[ "$state" = OPEN ] || { echo "merge-pr: PR #$pr is $state" >&2; exit 1; }
[ "$(view isDraft .isDraft)" = false ] || { echo "merge-pr: PR #$pr is a draft" >&2; exit 1; }
base="$(view baseRefName .baseRefName)"
[ "$base" = develop ] || { echo "merge-pr: base is '$base', not develop (merge the base PR first, then rebase-stack)" >&2; exit 1; }
head_ref="$(view headRefName .headRefName)"
head_sha="$(view headRefOid .headRefOid)"

merge_state="$(view mergeStateStatus .mergeStateStatus)"
if [ "$merge_state" = DIRTY ]; then echo "merge-pr: conflicts with develop, rebase the branch first (rebase-stack)" >&2; exit 1; fi
if [ "$merge_state" = BEHIND ]; then
  echo "merge-pr: branch is behind develop, updating with a rebase"
  if [ "$dry" = 1 ]; then echo "[dry-run] gh pr update-branch $pr --rebase"; else "$gh_bin" pr update-branch "$pr" --rebase; fi
  "$watch" "$pr" || { echo "merge-pr: CI not green after the update, not merging" >&2; exit 1; }
else
  "$watch" "$pr" --once || { echo "merge-pr: required checks are not all green, not merging" >&2; exit 1; }
fi

if [ "$dry" = 1 ]; then
  echo "[dry-run] gh pr merge $pr --squash --delete-branch"
else
  "$gh_bin" pr merge "$pr" --squash --delete-branch
fi
echo "merge-pr: merged PR #$pr ($head_ref @ $head_sha)"

echo "== open PRs stacked on $head_ref (rebase each with: rebase-stack.sh <branch> $head_sha) =="
"$gh_bin" pr list --state open --json number,headRefName,baseRefName \
  --jq ".[] | select(.baseRefName == \"$head_ref\") | \"#\\(.number) \\(.headRefName)\"" || true
echo "== remote branches that contain the old head $head_sha (also need rebase-stack) =="
git fetch --quiet origin 2>/dev/null || true
git branch -r --contains "$head_sha" 2>/dev/null | grep -v -e "origin/develop" -e "origin/main" -e "origin/HEAD" -e "origin/$head_ref" || echo "(none)"
