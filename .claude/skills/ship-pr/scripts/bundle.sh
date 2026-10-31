#!/usr/bin/env bash
# Create a git bundle of <branch> on top of a base (default origin/develop) with a UNIQUE file name.
# Usage: bundle.sh <branch> [--base <ref>] [--out-dir <dir>]
# Prints the bundle path as the last line. Unique names matter: the file-copy tool used to relay bundles
# caches by name, so a reused name delivers a stale file.
set -euo pipefail

usage() { echo "usage: bundle.sh <branch> [--base <ref>] [--out-dir <dir>]" >&2; exit 2; }
[ $# -ge 1 ] || usage
branch="$1"; shift
base="origin/develop"
out_dir="${BUNDLE_DIR:-${TMPDIR:-/tmp}}"
while [ $# -gt 0 ]; do
  case "$1" in
    --base) base="${2:?}"; shift 2 ;;
    --out-dir) out_dir="${2:?}"; shift 2 ;;
    *) usage ;;
  esac
done

git rev-parse --verify --quiet "$branch^{commit}" >/dev/null || { echo "bundle: no such branch: $branch" >&2; exit 2; }
git rev-parse --verify --quiet "$base^{commit}" >/dev/null || { echo "bundle: no such base: $base (git fetch origin first)" >&2; exit 2; }
if [ -z "$(git rev-list "$base..$branch" | head -n 1)" ]; then
  echo "bundle: $branch has no commits on top of $base" >&2
  exit 1
fi

mkdir -p "$out_dir"
slug="${branch//\//-}"
sha="$(git rev-parse --short "$branch")"
file="$out_dir/${slug}-$(date -u +%Y%m%dT%H%M%SZ)-${sha}-$$.bundle"
# "<branch> ^<base>" keeps the branch ref in the bundle and states the prerequisite explicitly.
git bundle create "$file" "$branch" "^$base" >&2
git bundle verify "$file" >&2
echo "$file"
