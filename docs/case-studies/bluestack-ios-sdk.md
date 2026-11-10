# Case study draft: BlueStack iOS SDK

Status: draft, not published.

## Sourced facts

- iOS advertising SDK components for Azerion's BlueStack SDK, focusing on architecture, compatibility, reliability and maintainability. (CV, LinkedIn)
- Ad network adapters for BidMachine and AppLovin. (CV, LinkedIn)
- Google AdMob mediation, Prebid bidding, CMP consent management and OMID viewability. (CV; LinkedIn says "Google Ad Manager mediation" and "Prebid as a bidding partner". The owner chose AdMob for the site.)
- SDK releases through CocoaPods, Swift Package Manager and XCFramework, with testing and CI/CD on TeamCity. (CV, LinkedIn)
- Public SDK documentation and demo apps that help publishers and partners integrate the SDK. (CV, LinkedIn)
- Objective-C and Swift. (CV project line)
- Vivasoft for Azerion, January 2026 to present. (CV, LinkedIn)

## Draft

The project page already renders three sections from data: "The problem" (`problem` below), "What I did" (the project's `contributions`) and "Results" (`outcomes`). The MDX body is for what those don't cover (architecture, decisions, challenges, metrics), so it stays empty until the questions below are answered. Nothing in `outcomes` may repeat a contribution.

```mdx
---
project: bluestack-ios-sdk
problem: Publishers integrate BlueStack to serve ads in their iOS apps. The SDK has to bring in demand from several ad networks, bidding, consent and viewability, and ship through the package managers publishers already use.
outcomes: []
---
```

The `problem` line is a framing of the sourced scope; confirm or rewrite it.

## Questions for the owner

1. What does an adapter look like? A sentence on the interface the SDK defines and what each network adapter implements is enough for an architecture diagram.
2. How do mediation, Prebid bidding and the ad networks fit together at request time? (Which component decides which ad is shown?)
3. One technical decision you made or argued for, and the trade-off. Examples: Objective-C vs Swift at the public API boundary, how XCFramework and SPM builds are produced from one source, how adapters are versioned against network SDK versions.
4. One hard problem and how you solved it (a compatibility break, a crash, a release issue).
5. Anything measurable and shareable: number of adapters shipped, release cadence, supported iOS versions, build or release time saved.
6. Is the public documentation online? A link can go in the project's `links.docs`.
7. Is it OK to name Azerion, BidMachine and AppLovin on the case study page? (They are already on the public CV.)
