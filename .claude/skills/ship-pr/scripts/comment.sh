#!/usr/bin/env bash
# Post a review / fix / verify note from a file as a PR comment, headed with its kind.
# Usage: comment.sh <pr> <review|fix|verify> <file>
set -euo pipefail

gh_bin="${GH:-gh}"
pr="${1:?usage: comment.sh <pr> <review|fix|verify> <file>}"
kind="${2:?kind}"
file="${3:?file}"
case "$kind" in review | fix | verify) ;; *) echo "comment: kind must be review, fix or verify" >&2; exit 2 ;; esac
[ -s "$file" ] || { echo "comment: file missing or empty: $file" >&2; exit 2; }

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
heading="$(printf '%s' "$kind" | cut -c1 | tr '[:lower:]' '[:upper:]')$(printf '%s' "$kind" | cut -c2-)"
{ printf '**%s**\n\n' "$heading"; cat "$file"; } >"$tmp"
"$gh_bin" pr comment "$pr" --body-file "$tmp"
