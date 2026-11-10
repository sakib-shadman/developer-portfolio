# Case study draft: bKash DSO App

Status: draft, not published.

## Sourced facts

- Built the bKash DSO app from scratch in Flutter for Distribution Sales Officers nationwide. (CV, LinkedIn)
- Transaction and monitoring app: B2B transfers to agents and distributors, balance checks, statements, push notifications and live location tracking. (CV)
- Flutter, Dart, BLoC, Clean Architecture. (CV)
- Led a five-person team through implementation and delivery. (CV, LinkedIn)
- bKash partner team, June 2021 to September 2023; bKash is Bangladesh's largest mobile financial service. (CV, LinkedIn)

## Draft

The project page already renders three sections from data: "The problem" (`problem` below), "What I did" (the project's `contributions`) and "Results" (`outcomes`). The MDX body is for what those don't cover (architecture, decisions, challenges, metrics), so it stays empty until the questions below are answered. Nothing in `outcomes` may repeat a contribution.

```mdx
---
project: bkash-dso-app
problem: bKash's Distribution Sales Officers, working nationwide, needed a mobile app for B2B transfers to agents and distributors, balance checks and statements.
outcomes: []
---
```

The `problem` line restates the sourced scope; sharpen it with the real pain point if there was one.

## Questions for the owner

1. How was the app layered? (Feature modules, BLoC per feature, repositories, the API layer.) Enough for a 3–5 box diagram.
2. Live location tracking: how was it done (foreground service, background fetch, interval), and what was hard about it on low-end Android devices?
3. One decision with a trade-off: for example, why Flutter for this app, how B2B transfers were made safe against double submits or network drops, how the team split the work.
4. How you ran the five-person team: review process, branching, release rhythm.
5. Shareable numbers, if any: number of DSOs using it, app size, release count, crash-free rate. Skip anything bKash would not want public.
6. Any limits on what you can say publicly about bKash internals?
