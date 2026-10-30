# Building my portfolio with AI agents, part 1: the team and the workflow

My developer portfolio was written, reviewed and merged by a team of AI agents: 25 pull requests in about ten days. After the first few set up the tooling, none merged without a review and green CI. This first part covers the team and the workflow. [Part 2](./series-part-2.md) covers the architecture they built and the CI pipeline that checks every change.

I build Flutter apps and an iOS SDK for a living. A portfolio site is the side project that never gets finished, so I turned it into an experiment: could an agent team work like a disciplined human team, with a spec, decisions on paper, code review and a CI pipeline that blocks bad merges?

## Start with documents, not prompts

Before any code, the project had a requirements document (SRS), a design handoff with page designs, and an implementation plan. The plan split the work into tasks with ids (PF-10, PF-43) and acceptance criteria, grouped into milestones: foundation, pages, writing and RSS, then hardening (SEO, security headers, accessibility, performance, link checks).

The lead agent also wrote architecture decision records (ADRs) for anything weighty, nine in total: the stack, hosting, content format, contact, analytics, budgets and more. They made reviews concrete. Instead of "I don't like this," the reviewer could say "this contradicts ADR-0008."

## The team

| Role            | Model         | Can edit code?  | Job                                                                              |
| --------------- | ------------- | --------------- | -------------------------------------------------------------------------------- |
| Team lead       | Claude Opus   | No, coordinates | Plans tasks, routes PRs through review, merges only when review and CI are green |
| Senior engineer | Claude Sonnet | Yes             | Builds one task end to end on its own branch, then fixes every finding           |
| PR reviewer     | Claude Opus   | No              | Reviews each PR with fresh context, runs tests and experiments, verifies fixes   |

Three design choices made this work:

1. **The reviewer has no Write or Edit tool.** It can run anything, but every problem it finds has to go back to the engineer in writing. Nothing gets silently patched during review.
2. **The stronger model reviews.** Sonnet writes code quickly and cheaply. Opus is better at doubting it, and review is where doubt pays.
3. **The team lives in the repo.** Each role is a Markdown file in `.claude/agents/` with its model, tools and brief. The rules every agent follows are in `CLAUDE.md`: Conventional Commits with no AI co-author lines, every link through one safety helper, and never invent content.

Here is the top of the reviewer's brief:

```markdown
---
name: pr-reviewer
description: Independent, skeptical code review of a pull request in this repo against the SRS, the design handoff and the repo rules. Use for every PR before it is merged.
tools: Read, Grep, Glob, Bash
model: opus
---

You are a senior front-end reviewer. Review the given PR independently — do not assume the
author's reasoning is correct, and do not rubber-stamp.
```

## The loop

![The PR loop: develop, review, fix, verify, merge](./images/pr-loop.png)

1. The lead assigns a task: the PF id, the design file, the acceptance criteria and what's already merged.
2. The engineer builds it in its own clone and must pass lint, type checks, unit tests, the build and the e2e suites locally before opening a PR.
3. The reviewer reads the diff against the plan, the ADRs and the design. It runs the tests, writes small experiments to confirm suspicions, and reports a verdict with a findings table: severity, file and line, problem, fix.
4. The engineer fixes every finding, non-blocking ones included, and writes a note mapping each finding to a change.
5. The reviewer verifies the fixes. A favourite move: put the original bug back and check the new test now fails.
6. The lead checks the verdict, open findings, the four required CI checks and that the branch is current, then squash-merges.

The review report and fix notes are posted on each PR, so the GitHub history keeps the reasoning, not just the diff.

## What the reviewer caught

- Accessibility tests that still passed after the bug they guarded was put back.
- A rollback command in the docs missing one `@`. It would have failed at the worst possible moment.
- A link checker that ignored fonts referenced from inline CSS and own-site URLs in structured data.
- A browser-support table, written from memory, that wrongly said Safari supports all the font metric overrides.

## What went wrong

**The agents couldn't push.** They ran in a cloud workspace without write access to my GitHub repo, and every push came back 403. The workaround: each branch was packed into a `git bundle`, copied to my Mac, and pushed by a small script with a token. It worked, but my laptop became part of the pipeline, and when it slept, finished work waited.

**Three engineers were too many.** I started with three Sonnet engineers in parallel lanes, each with its own clone and test port. Parallel branches kept touching the same files, so merges needed rebases. Together with an Opus reviewer they also used up my weekly usage limit, and the team sat idle until it reset. I switched to one engineer working sequentially. For a project this size, it was barely slower.

**Unwritten rules don't stick.** Early commits carried an AI co-author line I didn't want. I asked for it removed, the history was rewritten, and the rule went into `CLAUDE.md`. Anything I only said once in chat had to be said again; anything in the repo stuck.

**Some things stay human.** The agents won't write my bio or pick my analytics provider, and they shouldn't. Content, decisions, accounts and testing on a real phone are mine.

## Takeaway

The model writing the code mattered less than the system around it: written requirements, an independent reviewer that can't edit, and rules that live in the repo. In part 2, I'll go through the architecture and the CI pipeline every PR had to pass.
