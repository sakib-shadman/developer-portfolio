# Case study drafts

Drafts for the four featured projects, written only from the owner's CV (`public/resume/shadman-sakib-resume.pdf`) and LinkedIn profile. They are **not published**: nothing here is in `src/content`, so no project links a case study yet.

Each draft has three parts:

1. **Sourced facts**: the lines the draft is built from, with the source.
2. **Draft**: the MDX that would go in `src/content/case-studies/<slug>.mdx`. It has only the sections the sources support: Context and What I built, plus, for Financfy, a diagram of the internal packages the CV names. Architecture, Decisions, Challenges and Metrics are left out until the owner supplies them.
3. **Questions for the owner**: what is needed to make the case study worth reading. Answer in plain text; numbers only if they are real and shareable.

To publish one: answer its questions, extend the draft, move it to `src/content/case-studies/<slug>.mdx`, and add `"caseStudy": "<slug>"` to the project JSON (see "Add a case study" in `docs/MAINTENANCE.md`).

| Project           | Draft                                          |
| ----------------- | ---------------------------------------------- |
| BlueStack iOS SDK | [bluestack-ios-sdk.md](./bluestack-ios-sdk.md) |
| bKash DSO App     | [bkash-dso-app.md](./bkash-dso-app.md)         |
| Inspector Android | [inspector-android.md](./inspector-android.md) |
| Financfy          | [financfy.md](./financfy.md)                   |
