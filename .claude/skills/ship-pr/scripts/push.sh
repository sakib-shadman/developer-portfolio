#!/usr/bin/env bash
# Push <branch> to origin directly, and classify a failure instead of guessing:
#   auth / proxy / network (403, "not in this session's authorized repository set", auth failures, DNS,
#   tunnel errors)  -> build a uniquely named bundle and print the relay instructions (exit 3);
#   stale lease / non-fast-forward / "fetch first" -> an ERROR (exit 1): fetch and inspect, never relay;
#   anything else   -> exit 1 with the (redacted) output.
# Usage: push.sh <branch> [--lease-sha <sha>]
#   --lease-sha  force-push as a rebase does: --force-with-lease=<branch>:<sha> --force-if-includes, where
#                <sha> is the remote tip you inspected (the stacked rebase passes origin/<branch> from before).
# Push output is never printed raw: credentials in URLs (https://user:token@host) are redacted.
set -euo pipefail

branch="${1:?usage: push.sh <branch> [--lease-sha <sha>]}"
shift
lease=()
force_note=""
while [ $# -gt 0 ]; do
  case "$1" in
    --lease-sha)
      sha="${2:?--lease-sha needs a sha}"
      case "$sha" in '' | *[!0-9a-f]*) echo "push: --lease-sha must be a hex sha" >&2; exit 2 ;; esac
      lease=("--force-with-lease=$branch:$sha" --force-if-includes)
      force_note=" --force-with-lease=$branch:$sha --force-if-includes"
      shift 2 ;;
    *) echo "push: unknown option $1" >&2; exit 2 ;;
  esac
done
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# macOS has no timeout(1) by default: run without one there.
with_timeout() { if command -v timeout >/dev/null 2>&1; then timeout "$@"; else shift; "$@"; fi; }
redact() { sed -E 's#(://)[^/@[:space:]]+@#\1***@#g'; }

# Never ship the wrong history: Claude trailers are forbidden by the repo rules. Failing to compute the
# range (for example no origin/develop yet) is an error, not a pass.
if ! messages="$(git log --format=%B "origin/develop..$branch" 2>&1)"; then
  echo "push: cannot compute origin/develop..$branch (run git fetch origin): $(printf '%s' "$messages" | redact)" >&2
  exit 2
fi
if printf '%s\n' "$messages" | grep -Eiq '^(Co-Authored-By: Claude|Claude-Session:)'; then
  echo "push: refusing, a commit on $branch has a Claude co-author or session trailer (see CLAUDE.md)" >&2
  exit 4
fi

export GIT_TERMINAL_PROMPT=0
rc=0
out="$(with_timeout "${PUSH_TIMEOUT:-90}" git push --set-upstream ${lease[@]+"${lease[@]}"} origin "$branch" 2>&1)" || rc=$?
safe="$(printf '%s\n' "$out" | redact)"
if [ "$rc" = 0 ]; then
  printf '%s\n' "$safe"
  echo "push: pushed $branch"
  exit 0
fi

# Order matters: a lease/fast-forward problem is the remote branch having moved, whatever else the text says.
if printf '%s' "$out" | grep -Eiq 'stale info|non-fast-forward|fetch first|tip of your current branch is behind|force-if-includes|\(already exists\)|\[rejected\]'; then
  printf '%s\n' "$safe" >&2
  cat >&2 <<MSG

push: REJECTED because the remote branch is not what this push expected (stale lease or non-fast-forward).
This is not an auth problem, so no relay bundle was built. Someone pushed to origin/$branch, or your local
copy is out of date. Run:  git fetch origin && git log --oneline $branch..origin/$branch
Inspect those commits, integrate them if they matter, then push again.
MSG
  exit 1
fi
if printf '%s' "$out" | grep -Eiq '403|401|407|not in this session.s authorized repository set|authentication failed|could not read (username|password)|permission denied|access denied|unable to access|could not resolve host|proxy|tunnel|connection (refused|timed out|reset)|timed out|network is unreachable|terminal prompts disabled'; then
  printf '%s\n' "$safe" >&2
  bundle="$("$here/bundle.sh" "$branch")"
  cat >&2 <<MSG

push: direct push FAILED on auth, proxy or network (see above). Relay path:
  1. Copy this bundle to the owner's machine with the session's file-copy tool (the name is unique, so it
     is not served from a cache): $bundle
  2. On that machine, in a clone of the repo: git fetch <bundle> '$branch:$branch' && git push${force_note} origin '$branch'
     (the relay script that does this lives outside this repo and is machine-specific.)
  3. Re-run ship.sh with --skip-push to open the PR.
MSG
  exit 3
fi
printf '%s\n' "$safe" >&2
echo "push: FAILED for a reason that is neither auth/proxy nor a stale lease; not relaying. See the output above." >&2
exit 1
