#!/usr/bin/env bash
# Push a branch, open (or reuse) its PR against develop, post any notes, print the PR URL.
# Usage: ship.sh <branch> <pr-body-file> [--title <t>] [--review <f>] [--fix <f>] [--verify <f>] [--skip-push]
# Exit codes: 0 done, 3 direct push failed (bundle built, relay needed), others are errors.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
branch="${1:?usage: ship.sh <branch> <pr-body-file> [--title <t>] [--review <f>] [--fix <f>] [--verify <f>] [--skip-push]}"
body="${2:?body file required}"
shift 2
title_args=()
review="" fix="" verify="" skip_push=0
while [ $# -gt 0 ]; do
  case "$1" in
    --title) title_args=(--title "${2:?}"); shift 2 ;;
    --review) review="${2:?}"; shift 2 ;;
    --fix) fix="${2:?}"; shift 2 ;;
    --verify) verify="${2:?}"; shift 2 ;;
    --skip-push) skip_push=1; shift ;;
    *) echo "ship: unknown option $1" >&2; exit 2 ;;
  esac
done

if [ "$skip_push" = 0 ]; then "$here/push.sh" "$branch"; fi
url="$("$here/open-pr.sh" "$branch" "$body" ${title_args[@]+"${title_args[@]}"} | tail -n 1)"
pr="${url##*/}"
[ -z "$review" ] || "$here/comment.sh" "$pr" review "$review"
[ -z "$fix" ] || "$here/comment.sh" "$pr" fix "$fix"
[ -z "$verify" ] || "$here/comment.sh" "$pr" verify "$verify"
echo "$url"
