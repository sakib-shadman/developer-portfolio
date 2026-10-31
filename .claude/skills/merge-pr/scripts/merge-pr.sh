#!/usr/bin/env bash
# Squash-merge a PR once the gate is met, delete its branch, list branches that now need rebasing.
# Usage: merge-pr.sh <pr> --review-approved [--dry-run]
#   --review-approved  the lead confirms, from the posted review/fix/verify notes, that the reviewer's latest
#                      verdict is APPROVE and no finding is open. This cannot be read from GitHub, so the
#                      script refuses to merge without it.
# The gate is not configurable: REQUIRED_CHECKS is ignored here (watch-ci always requires at least
# branch-policy, quality, e2e and pr-title), and the merge is pinned to the head SHA watch-ci verified.
# Env: GH=<path> overrides gh (tests).
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
orig_head="$(view headRefOid .headRefOid)"

merge_state="$(view mergeStateStatus .mergeStateStatus)"
if [ "$merge_state" = DIRTY ]; then echo "merge-pr: conflicts with develop, rebase the branch first (rebase-stack)" >&2; exit 1; fi

# An environment override must never weaken the gate.
unset REQUIRED_CHECKS

verdict="$(mktemp)"
trap 'rm -f "$verdict"' EXIT
check() { # <watch-ci args...>: run watch-ci, show its output, keep it for the VERIFIED_HEAD line
  local rc=0
  "$watch" "$pr" "$@" >"$verdict" || rc=$?
  cat "$verdict"
  return "$rc"
}

if [ "$merge_state" = BEHIND ]; then
  echo "merge-pr: branch is behind develop, updating with a rebase"
  if [ "$dry" = 1 ]; then echo "[dry-run] gh pr update-branch $pr --rebase"; else "$gh_bin" pr update-branch "$pr" --rebase; fi
  # The head changed: watch-ci reads the new one and waits for CI on it.
  check || { echo "merge-pr: CI not green after the update, not merging" >&2; exit 1; }
else
  check --once || { echo "merge-pr: required checks are not all green, not merging" >&2; exit 1; }
fi

# Merge exactly the commit whose checks were verified: a push after the check makes the merge fail.
verified="$(sed -n 's/^VERIFIED_HEAD=//p' "$verdict" | tail -n 1)"
case "$verified" in '' | *[!0-9a-f]*) echo "merge-pr: watch-ci did not report a verified head sha, not merging" >&2; exit 1 ;; esac
head_sha="$verified"

if [ "$dry" = 1 ]; then
  echo "[dry-run] gh pr merge $pr --squash --delete-branch --match-head-commit $head_sha"
else
  "$gh_bin" pr merge "$pr" --squash --delete-branch --match-head-commit "$head_sha"
fi
echo "merge-pr: merged PR #$pr ($head_ref @ $head_sha)"

# Branches stacked on this one were built on the head as it was BEFORE any update-branch rebase.
echo "== open PRs stacked on $head_ref (rebase each with: rebase-stack.sh <branch> $orig_head) =="
"$gh_bin" pr list --state open --json number,headRefName,baseRefName \
  --jq ".[] | select(.baseRefName == \"$head_ref\") | \"#\\(.number) \\(.headRefName)\"" || true
echo "== remote branches that contain the old head $orig_head (also need rebase-stack) =="
git fetch --quiet origin 2>/dev/null || true
git branch -r --contains "$orig_head" 2>/dev/null | grep -v -e "origin/develop" -e "origin/main" -e "origin/HEAD" -e "origin/$head_ref" || echo "(none)"
