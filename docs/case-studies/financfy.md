# Case study draft: Financfy

Status: draft, not published.

## Sourced facts

- Flutter accounting app for businesses. (CV)
- Helps small businesses track sales, stock and receivables and maintain cashbooks. (LinkedIn)
- BLoC state management and Clean Architecture. (CV)
- Feature-first architecture with internal packages: network client, logger, error reporting to a service, and a UI library. (CV project line)
- Vivasoft, 2024 to 2025. (CV, LinkedIn)

## Draft

The project page already renders three sections from data: "The problem" (`problem` below), "What I did" (the project's `contributions`) and "Results" (`outcomes`). The MDX body is for what those don't cover (architecture, decisions, challenges, metrics), so it stays empty until the questions below are answered. Nothing in `outcomes` may repeat a contribution.

```mdx
---
project: financfy
problem: Small businesses need to track sales, stock and receivables and keep cashbooks.
outcomes: []
---

<Section eyebrow="Architecture" title="Features on shared internal packages">

<Diagram
  nodes={[
    { label: 'Features', highlight: true },
    { label: 'UI library' },
    { label: 'Network client' },
    { label: 'Logger' },
    { label: 'Error reporting' },
  ]}
  caption="A feature-first app on four internal packages."
/>

</Section>
```

The `problem` line restates the sourced scope; sharpen it if there was a specific pain point. The diagram shows only the packages the CV names, one box each; check the arrangement (question 1).

## Questions for the owner

1. Why internal packages? What did splitting out the network client, logger, error reporting and UI library buy you (reuse across apps, team boundaries, testability)?
2. Which error-reporting service (Crashlytics, Sentry, other)?
3. Offline: does a cashbook work without a connection, and how is data synced?
4. One hard problem: for example money and rounding, stock consistency, or large lists of transactions.
5. Your role: sole developer, or lead of a team? (The site says "Flutter developer".)
6. Is the app public (store link) or a client product you can only describe?
