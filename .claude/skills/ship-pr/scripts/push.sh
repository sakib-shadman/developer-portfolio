#!/usr/bin/env bash
# Push <branch> to origin directly. If that is rejected (auth, proxy, network), do NOT script a workaround:
# build a uniquely named bundle and print the relay instructions (exit 3).
# Usage: push.sh <branch> [--force-with-lease]
set -euo pipefail

branch="${1:?usage: push.sh <branch> [--force-with-lease]}"
lease=()
force_note=""
if [ "${2:-}" = "--force-with-lease" ]; then lease=(--force-with-lease); force_note=" --force-with-lease"; fi
# macOS has no timeout(1) by default: run without one there.
with_timeout() { if command -v timeout >/dev/null 2>&1; then timeout "$@"; else shift; "$@"; fi; }
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Never ship the wrong history: Claude trailers are forbidden by the repo rules.
if git log --format=%B "origin/develop..$branch" 2>/dev/null | grep -Eiq '^(Co-Authored-By: Claude|Claude-Session:)'; then
  echo "push: refusing, a commit on $branch has a Claude co-author or session trailer (see CLAUDE.md)" >&2
  exit 4
fi

export GIT_TERMINAL_PROMPT=0
if out="$(with_timeout "${PUSH_TIMEOUT:-90}" git push --set-upstream ${lease[@]+"${lease[@]}"} origin "$branch" 2>&1)"; then
  echo "$out"
  echo "push: pushed $branch"
  exit 0
fi
echo "$out" >&2
bundle="$("$here/bundle.sh" "$branch")"
cat >&2 <<MSG

push: direct push FAILED (see above). Relay path:
  1. Copy this bundle to the owner's machine with the session's file-copy tool (the name is unique, so it
     is not served from a cache): $bundle
  2. On that machine, in a clone of the repo: git fetch <bundle> '$branch:$branch' && git push${force_note} origin '$branch'
     (the relay script that does this lives outside this repo and is machine-specific.)
  3. Re-run ship.sh with --skip-push to open the PR.
MSG
exit 3
