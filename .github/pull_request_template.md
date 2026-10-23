## What & why

Closes #<issue>. SRS: FR-xx.x …   Design: `docs/design/<file>`

## Preview

Preview URL: <posted by the Firebase action> · Desktop / 768px / 375px screenshots

## Checklist (Definition of Done)

- [ ] Acceptance criteria verified on the preview URL
- [ ] Unit tests for new logic in `src/lib`; e2e for new user flows
- [ ] Empty / missing-data states handled (no `[placeholder]` or broken element renders)
- [ ] Keyboard-only + axe clean; touch targets ≥ 40px; no horizontal scroll at 320px
- [ ] No secrets client-side; external links via `safeExternalUrl`
- [ ] JS + page-weight budgets respected
- [ ] Docs/ADR updated if behaviour or decisions changed
