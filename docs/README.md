# Docs

| File                     | What                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `IMPLEMENTATION_PLAN.md` | How the site is built, reviewed and shipped (tasks PF-xx, workflow, deployment)         |
| `SRS.md`                 | Requirements (FR/NFR ids) — **add from the claude.ai project "My Developer Portfolio"** |
| `HANDOFF.md`             | Design handoff — **add from the project**                                               |
| `design/*.dc.html`       | Screen designs (reference only, never imported) — **add from the project**              |
| `MAINTENANCE.md`         | How to add content, swap the resume, roll back, Spark limits, rotate tokens             |
| `a11y-audit.md`          | WCAG 2.2 AA audit suite, results and manual checklist                                   |
| `RELEASE.md`             | Release runbook: release candidate, v1.0.0 launch, Search Console, rollback             |
| `browser-support.md`     | Browser matrix, modern-feature floors, link checks, real-device checklist               |
| `adr/`                   | Architecture decision records                                                           |
| `contract/`              | JSON Schemas generated from `src/lib/content/schemas.ts` (`pnpm schemas:export`)        |

Where SRS and the plan disagree, the plan's ADRs record the approved deviation.
