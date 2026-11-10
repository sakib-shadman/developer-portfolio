# Case study draft: Financfy

Status: draft, not published.

## Sourced facts

- Flutter accounting app for businesses. (CV)
- Helps small businesses track sales, stock and receivables and maintain cashbooks. (LinkedIn)
- BLoC state management and Clean Architecture. (CV)
- Feature-first architecture with internal packages: network client, logger, error reporting to a service, and a UI library. (CV project line)
- Vivasoft, 2024 to 2025. (CV, LinkedIn)

## Draft

```mdx
---
project: financfy
problem: Small businesses need to track sales, stock and receivables and keep cashbooks.
outcomes: []
---

<Section eyebrow="Context" title="Accounting for small businesses">

Financfy is a Flutter accounting app that helps small businesses track sales, stock and receivables and maintain cashbooks. I built it at Vivasoft in 2024 and 2025.

</Section>

<Section eyebrow="What I built" title="A feature-first app on shared internal packages">

The app follows a feature-first architecture with BLoC and Clean Architecture. Shared concerns live in internal packages:

- a network client,
- a logger,
- error reporting to a service,
- a UI library.

</Section>

<Section eyebrow="Architecture" title="Features on top of internal packages">

<Diagram
  nodes={[
    { label: 'Feature modules', highlight: true },
    { label: 'UI library' },
    { label: 'Network client' },
    { label: 'Logger and error reporting' },
  ]}
  caption="Feature modules use shared internal packages."
/>

</Section>
```

The `problem` line restates the sourced scope; sharpen it if there was a specific pain point. The diagram shows only the packages the CV names; check that the arrangement is right.

## Questions for the owner

1. Why internal packages? What did splitting out the network client, logger, error reporting and UI library buy you (reuse across apps, team boundaries, testability)?
2. Which error-reporting service (Crashlytics, Sentry, other)?
3. Offline: does a cashbook work without a connection, and how is data synced?
4. One hard problem: for example money and rounding, stock consistency, or large lists of transactions.
5. Your role: sole developer, or lead of a team? (The site says "Flutter developer".)
6. Is the app public (store link) or a client product you can only describe?
