#!/usr/bin/env bash
# Open a PR for <branch> against develop, or reuse the open one. Prints the PR URL on the last line.
# Usage: open-pr.sh <branch> <body-file> [--title <title>] [--update-body]
# Title defaults to the branch tip's commit subject (it becomes the squash commit, so it must be a
# Conventional Commit of at most 100 characters). GH=<path> overrides the gh binary (used by tests).
set -euo pipefail

gh_bin="${GH:-gh}"
branch="${1:?usage: open-pr.sh <branch> <body-file> [--title <title>] [--update-body]}"
body="${2:?body file required}"
shift 2
title=""
update=0
while [ $# -gt 0 ]; do
  case "$1" in
    --title) title="${2:?}"; shift 2 ;;
    --update-body) update=1; shift ;;
    *) echo "open-pr: unknown option $1" >&2; exit 2 ;;
  esac
done
[ -s "$body" ] || { echo "open-pr: body file missing or empty: $body" >&2; exit 2; }
[ -n "$title" ] || title="$(git log -1 --format=%s "$branch")"

if [ "${#title}" -gt 100 ] || ! printf '%s' "$title" | grep -Eq '^(feat|fix|chore|docs|refactor|test|perf|style|ci|build|revert|content|release)(\([^)]+\))?!?: .+'; then
  echo "open-pr: title is not a Conventional Commit within 100 characters: $title" >&2
  exit 2
fi

existing="$("$gh_bin" pr list --head "$branch" --base develop --state open --json number,url --jq '.[0] | select(. != null) | "\(.number) \(.url)"')"
if [ -n "$existing" ]; then
  num="${existing%% *}"
  url="${existing#* }"
  echo "open-pr: reusing open PR #$num" >&2
  if [ "$update" = 1 ]; then "$gh_bin" pr edit "$num" --body-file "$body" >&2; fi
  echo "$url"
  exit 0
fi
"$gh_bin" pr create --base develop --head "$branch" --title "$title" --body-file "$body"
