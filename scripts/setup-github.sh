#!/usr/bin/env bash
# One-time GitHub setup: push branches, set default branch, labels, rulesets.
# Run from the repo root on your Mac:  bash scripts/setup-github.sh
# Requires: gh (https://cli.github.com), authenticated with `gh auth login` (scopes: repo, admin:repo_hook).
set -euo pipefail
REPO="${REPO:-sakib-shadman/developer-portfolio}"

echo "→ Using gh credentials for git over HTTPS"
gh auth status >/dev/null
gh auth setup-git

echo "→ Pushing main + develop"
git push -u origin main develop || echo "   (already pushed)"

echo "→ Default branch = develop (PRs target it by default)"
gh repo edit "$REPO" --default-branch develop \
  --enable-squash-merge --enable-merge-commit --enable-rebase-merge=false \
  --squash-merge-commit-message pr-title \
  --delete-branch-on-merge

echo "→ Labels"
label() { gh label create "$1" --repo "$REPO" --color "$2" --description "$3" --force >/dev/null; }
label "type:feature" 0E8A16 "New functionality"
label "type:bug"     D73A4A "Something is broken"
label "type:chore"   C5DEF5 "Tooling, CI, deps"
label "type:content" 5EEAD4 "Articles, projects, profile, resume"
label "type:docs"    0075CA "Documentation / ADRs"
for a in home projects blog contact seo infra a11y; do label "area:$a" BFD4F2 "Area: $a"; done
label "size:S" EDEDED "≤ ½ day"
label "size:M" D4C5F9 "≤ 1 day"
label "size:L" FBCA04 "≤ 2 days — split if bigger"
label "blocked:owner-content" B60205 "Waiting for real content from the owner"

echo "→ Rulesets"
ruleset() { # $1 name, $2 json
  local id
  id=$(gh api "repos/$REPO/rulesets" --jq ".[] | select(.name==\"$1\") | .id" || true)
  if [[ -n "$id" ]]; then
    gh api -X PUT "repos/$REPO/rulesets/$id" --input - <<<"$2" >/dev/null
  else
    gh api -X POST "repos/$REPO/rulesets" --input - <<<"$2" >/dev/null
  fi
  echo "   $1 ✓"
}

ruleset main '{
  "name": "main", "target": "branch", "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/main"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 0, "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false, "require_last_push_approval": false,
        "required_review_thread_resolution": true, "allowed_merge_methods": ["merge"] } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [
          { "context": "branch-policy" }, { "context": "quality" },
          { "context": "e2e" }, { "context": "lighthouse" } ] } }
  ]
}'

ruleset develop '{
  "name": "develop", "target": "branch", "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/develop"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 0, "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false, "require_last_push_approval": false,
        "required_review_thread_resolution": true, "allowed_merge_methods": ["squash", "merge"] } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [ { "context": "quality" }, { "context": "e2e" } ] } }
  ]
}'

echo "Done. Next: push your feature branch and open a PR into develop."
