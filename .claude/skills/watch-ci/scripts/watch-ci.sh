#!/usr/bin/env bash
# Wait for a PR's checks, then print a pass/fail summary; on failure print every failing job's annotations.
# Usage: watch-ci.sh <pr> [--timeout <seconds>] [--interval <seconds>] [--once]
#   --once  do not wait, just evaluate the current state (used by merge-pr)
# Required checks: ALWAYS at least "branch-policy quality e2e pr-title". REQUIRED_CHECKS may only ADD names;
# an override that drops a default one is ignored (with a warning). No checks reported at all is a FAILURE.
# On a verdict the last line before RESULT is "VERIFIED_HEAD=<sha>": the PR head the verdict is about
# (merge-pr passes it to `gh pr merge --match-head-commit`). If the head moves while checking, exit 1.
# Env: GH=<path> overrides gh (tests). Needs only gh (uses gh --jq, no jq binary).
# Exit: 0 all required checks passed, 1 fail / missing / no checks / head moved, 4 timed out or pending.
set -euo pipefail

gh_bin="${GH:-gh}"
pr="${1:?usage: watch-ci.sh <pr> [--timeout <s>] [--interval <s>] [--once]}"
shift
timeout_s=1800
interval=30
once=0
while [ $# -gt 0 ]; do
  case "$1" in
    --timeout) timeout_s="${2:?}"; shift 2 ;;
    --interval) interval="${2:?}"; shift 2 ;;
    --once) once=1; shift ;;
    *) echo "watch-ci: unknown option $1" >&2; exit 2 ;;
  esac
done
# macOS has no timeout(1) by default: wait without a limit there.
with_timeout() { if command -v timeout >/dev/null 2>&1; then timeout "$@"; else shift; "$@"; fi; }

defaults="branch-policy quality e2e pr-title"
required="$defaults"
for extra in ${REQUIRED_CHECKS:-}; do
  case " $required " in *" $extra "*) ;; *) required="$required $extra" ;; esac
done
for d in $defaults; do
  case " ${REQUIRED_CHECKS:-$defaults} " in
    *" $d "*) ;;
    *) echo "watch-ci: ignoring REQUIRED_CHECKS: it drops the default check '$d' (overrides can only add checks)" >&2; break ;;
  esac
done

if [ "$once" = 0 ]; then
  # gh exits non-zero when a check failed; we evaluate the state ourselves below, so ignore its status.
  rc=0
  with_timeout "$timeout_s" "$gh_bin" pr checks "$pr" --watch --interval "$interval" || rc=$?
  if [ "$rc" = 124 ]; then echo "watch-ci: TIMEOUT after ${timeout_s}s, checks still pending" >&2; fi
fi

head_before="$("$gh_bin" pr view "$pr" --json headRefOid --jq .headRefOid)"
rows="$("$gh_bin" pr checks "$pr" --json name,bucket,link --jq '.[] | [.bucket, .name, .link] | @tsv' 2>/dev/null || true)"
head_after="$("$gh_bin" pr view "$pr" --json headRefOid --jq .headRefOid)"
if [ -z "$head_before" ] || [ "$head_before" != "$head_after" ]; then
  echo "watch-ci: the PR head moved while checking ($head_before -> $head_after); run it again" >&2
  echo "RESULT: FAIL"
  exit 1
fi

echo "== checks for PR #$pr (head $head_before) =="
if [ -z "$rows" ]; then
  echo "watch-ci: NO checks reported for PR #$pr; an empty list is a failure, not a pass" >&2
  echo "RESULT: FAIL"
  exit 1
fi
printf '%s\n' "$rows" | sort

status=0
pending=0
for name in $required; do
  bucket="$(printf '%s\n' "$rows" | awk -F'\t' -v n="$name" '$2 == n { print $1; exit }')"
  case "${bucket:-missing}" in
    pass) ;;
    pending) pending=1 ;;
    *) status=1; echo "required check '$name': ${bucket:-missing}" >&2 ;;
  esac
done

# Annotations of every failing job (logs cannot always be downloaded, annotations can).
printf '%s\n' "$rows" | awk -F'\t' '$1 == "fail" || $1 == "cancel" { print $2 "\t" $3 }' |
  while IFS=$'\t' read -r name link; do
    id="${link##*/job/}"
    case "$id" in '' | *[!0-9]*) echo "-- $name: no job id in link ($link)"; continue ;; esac
    echo "-- annotations for failing job '$name' (check-run $id)"
    "$gh_bin" api "repos/{owner}/{repo}/check-runs/$id/annotations" \
      --jq '.[] | "\(.annotation_level) \(.path):\(.start_line) \(.title // "") \(.message)"' || echo "(could not read annotations)"
  done

echo "VERIFIED_HEAD=$head_before"
if [ "$status" = 1 ]; then echo "RESULT: FAIL"; exit 1; fi
if [ "$pending" = 1 ]; then echo "RESULT: PENDING"; exit 4; fi
echo "RESULT: PASS (required: $required)"
