#!/usr/bin/env bash
# Wait for a PR's checks, then print a pass/fail summary; on failure print every failing job's annotations.
# Usage: watch-ci.sh <pr> [--timeout <seconds>] [--interval <seconds>] [--once]
#   --once  do not wait, just evaluate the current state (used by merge-pr)
# Env: REQUIRED_CHECKS (default "branch-policy quality e2e pr-title"), GH=<path> overrides gh (tests).
# Exit: 0 all required checks passed, 1 a check failed (or a required check is missing), 4 timed out/pending.
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
required="${REQUIRED_CHECKS:-branch-policy quality e2e pr-title}"

if [ "$once" = 0 ]; then
  # gh exits non-zero when a check failed; we evaluate the state ourselves below, so ignore its status.
  # Checks appear a few seconds after a push: an empty list is retried by --watch's own polling.
  rc=0
  with_timeout "$timeout_s" "$gh_bin" pr checks "$pr" --watch --interval "$interval" || rc=$?
  if [ "$rc" = 124 ]; then echo "watch-ci: TIMEOUT after ${timeout_s}s, checks still pending" >&2; fi
fi

json="$("$gh_bin" pr checks "$pr" --json name,bucket,state,link 2>/dev/null || true)"
[ -n "$json" ] || json="[]"
echo "== checks for PR #$pr =="
printf '%s' "$json" | jq -r '.[] | "\(.bucket)\t\(.name)\t\(.link)"' | sort

status=0
pending=0
for name in $required; do
  bucket="$(printf '%s' "$json" | jq -r --arg n "$name" '[.[] | select(.name == $n)][0].bucket // "missing"')"
  case "$bucket" in
    pass | skipping) ;;
    pending) pending=1 ;;
    *) status=1; echo "required check '$name': $bucket" >&2 ;;
  esac
done

# Annotations of every failing job (logs cannot always be downloaded, annotations can).
printf '%s' "$json" | jq -r '.[] | select(.bucket == "fail" or .bucket == "cancel") | "\(.name)\t\(.link)"' |
  while IFS=$'\t' read -r name link; do
    id="${link##*/job/}"
    case "$id" in '' | *[!0-9]*) echo "-- $name: no job id in link ($link)"; continue ;; esac
    echo "-- annotations for failing job '$name' (check-run $id)"
    "$gh_bin" api "repos/{owner}/{repo}/check-runs/$id/annotations" \
      --jq '.[] | "\(.annotation_level) \(.path):\(.start_line) \(.title // "") \(.message)"' || echo "(could not read annotations)"
  done

if [ "$status" = 1 ]; then echo "RESULT: FAIL"; exit 1; fi
if [ "$pending" = 1 ]; then echo "RESULT: PENDING"; exit 4; fi
echo "RESULT: PASS (required: $required)"
